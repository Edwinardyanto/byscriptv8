// src/scripts/pages/autotradersPage.js

import {
  getAutotraders,
  getAccounts,
  getAssets,
  getTradingPlans,
  getTrades,
  getAssetEquityByRange,
} from "../dataAccess.js";

import { renderTotalPerformanceChart } from "../components/TotalPerformanceChart.js";

/* =========================
   Helpers
========================= */

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const toTitle = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());

const fmtUSD0 = (v) =>
  `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const fmtUSDSign0 = (v) => {
  const n = Number(v || 0);
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
};

const toDateKey = (ms) => {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/* =========================
   Unrealized PnL (daily snapshot)
   Source: data/positions_daily/YYYY-MM-DD.json
========================= */

const uPnlCache = new Map();

const getUnrealizedPnlByDate = async (dateKey) => {
  const key = String(dateKey || "").trim();
  if (!key) return 0;
  if (uPnlCache.has(key)) return uPnlCache.get(key);

  try {
    // NOTE: this file sits in src/scripts/pages/, so we need ../../../ to reach /data
    const url = new URL(`../../../data/positions_daily/${key}.json`, import.meta.url);
    const r = await fetch(url);
    if (!r.ok) throw new Error("positions_daily missing");

    const j = await r.json();
    let sum = 0;

    for (const acc of j?.accounts || []) {
      for (const pos of acc?.positions || []) {
        sum += safeNum(pos?.unrealized_pnl);
      }
    }

    sum = Number(sum.toFixed(2));
    uPnlCache.set(key, sum);
    return sum;
  } catch {
    uPnlCache.set(key, 0);
    return 0;
  }
};

/* =========================
   Performance series (cumulative PnL)
========================= */

const buildDailySeries = (reduceOnlyTrades) => {
  const map = new Map();
  let minDate = null;
  let maxDate = null;

  for (const t of reduceOnlyTrades) {
    const filledMs = safeNum(t.filled_at || 0) * 1000;
    if (!filledMs) continue;

    const key = toDateKey(filledMs);
    const pnl = safeNum(t.pnl_usd);
    map.set(key, (map.get(key) || 0) + pnl);

    if (!minDate || key < minDate) minDate = key;
    if (!maxDate || key > maxDate) maxDate = key;
  }

  if (!minDate || !maxDate) return { labels: [], series: [] };

  const labels = [];
  const series = [];

  const start = new Date(`${minDate}T00:00:00Z`).getTime();
  const end = new Date(`${maxDate}T00:00:00Z`).getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  let cumulative = 0;
  for (let ts = start; ts <= end; ts += dayMs) {
    const key = toDateKey(ts);
    labels.push(key);
    cumulative += safeNum(map.get(key) || 0);
    series.push(Number(cumulative.toFixed(2)));
  }

  return { labels, series };
};

const sliceRange = ({ labels, series }, range) => {
  const n =
    range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : null;

  if (!labels.length || !series.length) return { labels: [], series: [] };
  if (!n) return { labels, series };

  return {
    labels: labels.slice(-n),
    series: series.slice(-n),
  };
};

const buildRangeWindow = (labels, range) => {
  const n =
    range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : null;

  if (!n || !labels.length) return { fromMs: null, toMs: null };

  const fromLabel = labels.slice(-n)[0];
  const toLabel = labels[labels.length - 1];

  const fromMs = new Date(`${fromLabel}T00:00:00Z`).getTime();
  const toMs = new Date(`${toLabel}T23:59:59Z`).getTime() + 1;
  return { fromMs, toMs };
};

const calcRangeMetrics = ({ fromMs, toMs }, tradesAll, tradesReduceOnly) => {
  const inRange = (t) => {
    const ms = safeNum(t.filled_at || 0) * 1000;
    if (!ms) return false;
    if (fromMs != null && ms < fromMs) return false;
    if (toMs != null && ms >= toMs) return false;
    return true;
  };

  const closes = tradesReduceOnly.filter(inRange);
  const all = tradesAll.filter(inRange);

  const grossProfit = closes.reduce(
    (s, t) => s + Math.max(0, safeNum(t.pnl_usd)),
    0
  );
  const grossLoss = closes.reduce(
    (s, t) => s + Math.abs(Math.min(0, safeNum(t.pnl_usd))),
    0
  );
  const profitFactor =
    grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const win = closes.filter((t) => safeNum(t.pnl_usd) > 0).length;
  const loss = closes.filter((t) => safeNum(t.pnl_usd) < 0).length;

  const volume = all.reduce((s, t) => {
    const notional = Math.abs(safeNum(t.size) * safeNum(t.price_usd));
    return s + notional;
  }, 0);

  const pnl = closes.reduce((s, t) => s + safeNum(t.pnl_usd), 0);

  return {
    pnl,
    grossProfit,
    grossLoss,
    profitFactor,
    trades: { total: closes.length, win, loss },
    volume,
  };
};

/* =========================
   Running positions (derived from trades netting)
   - buy  = +size
   - sell = -size
   Count open positions per autotrader = count(asset_id where net != 0)
========================= */

const buildRunningMapFromTrades = (tradesAll) => {
  const netByKey = new Map(); // key: autotrader_id|asset_id => netQty

  for (const t of tradesAll) {
    const aid = t?.autotrader_id;
    const asset = t?.asset_id;
    if (!aid || !asset) continue;

    const size = safeNum(t.size);
    if (!size) continue;

    const side = String(t.side || "").toLowerCase();
    const delta = side === "buy" ? size : side === "sell" ? -size : 0;
    if (!delta) continue;

    const key = `${aid}|${asset}`;
    netByKey.set(key, (netByKey.get(key) || 0) + delta);
  }

  const runningCountByAutotrader = new Map();
  for (const [key, net] of netByKey.entries()) {
    if (Math.abs(net) <= 1e-12) continue;
    const autotraderId = key.split("|")[0];
    runningCountByAutotrader.set(
      autotraderId,
      (runningCountByAutotrader.get(autotraderId) || 0) + 1
    );
  }

  return runningCountByAutotrader;
};

/* =========================
   Table render
========================= */

const renderAutotradersTable = ({ rows, page, pageSize }) => {
  const tbody = document.querySelector("[data-autotraders-rows]");
  const pagination = document.querySelector("[data-autotraders-pagination]");
  if (!tbody) return;

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  tbody.innerHTML = "";
  for (const r of pageRows) {
    const statusClass =
      r.status === "running" ? "status-pill--active" : "status-pill--stopped";
    const pnlClass = r.pnl_usd > 0 ? "pnl-positive" : r.pnl_usd < 0 ? "pnl-negative" : "";
    const actionLabel = r.status === "running" ? "Stop" : "Start";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="col-status"><span class="status-pill ${statusClass}">${
      r.status === "running" ? "RUNNING" : "STOPPED"
    }</span></td>
      <td class="col-autotrader" title="${r.autotrader_name || ""}">${
      r.autotrader_name
    }</td>
      <td class="col-plan" title="${r.plan_name || ""}">${r.plan_name}</td>
      <td class="col-pair" title="${r.pair || ""}">${r.pair}</td>
      <td class="col-provider" title="${r.provider_label || ""}">${
      r.provider_label
    }</td>
      <td class="col-capital numeric">${fmtUSD0(r.capital_usd)}</td>
      <td class="col-pnl numeric ${pnlClass}">${fmtUSDSign0(r.pnl_usd)}</td>
      <td class="col-winrate numeric">${Number(r.win_rate || 0).toFixed(
      0
    )}%</td>
      <td class="col-running numeric">${Number(r.running_positions || 0)}</td>
      <td class="col-action"><button class="table-action" type="button" data-action="toggle" data-id="${
      r.autotrader_id
    }">${actionLabel}</button></td>
      <td class="col-detail"><a class="table-action" href="autotraders/detail.html?id=${encodeURIComponent(
        r.autotrader_id
      )}">View</a></td>
    `;
    tbody.appendChild(tr);
  }

  if (!pagination) return;

  const renderPageBtn = (p, label = null) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `page-button${p === safePage ? " is-active" : ""}`;
    btn.textContent = label || String(p);
    btn.dataset.page = String(p);
    return btn;
  };

  pagination.innerHTML = "";
  if (totalPages <= 1) return;

  const maxButtons = 9;
  const windowSize = Math.min(maxButtons, totalPages);
  let startPage = Math.max(1, safePage - Math.floor(windowSize / 2));
  let endPage = startPage + windowSize - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - windowSize + 1);
  }

  if (safePage > 1) {
    const prev = renderPageBtn(safePage - 1, "‹");
    prev.classList.add("next");
    pagination.appendChild(prev);
  }

  for (let p = startPage; p <= endPage; p += 1) {
    pagination.appendChild(renderPageBtn(p));
  }

  if (safePage < totalPages) {
    const next = renderPageBtn(safePage + 1, "›");
    next.classList.add("next");
    pagination.appendChild(next);
  }
};

/* =========================
   Init page
========================= */

const initAutotradersPage = async () => {
  const chartContainer = document.querySelector(
    '[data-total-performance="autotraders"]'
  );
  const rowsSelect = document.querySelector("[data-autotraders-rows-per-page]");

  const liveTotal = document.getElementById("live-autotraders-total");
  const liveRunning = document.getElementById("live-autotraders-active");
  const liveStopped = document.getElementById("live-autotraders-stopped");
  const liveCapital = document.getElementById("live-capital-value");

  const metricProfitFactor = document.getElementById("metric-profit-factor");
  const metricTrades = document.getElementById("metric-trades");
  const metricTradesSub = document.getElementById("metric-trades-sub");
  const metricVolume = document.getElementById("metric-volume");

  const [autotraders, accounts, assets, plans, trades, equityAll] = await Promise.all([
    getAutotraders(),
    getAccounts(),
    getAssets(),
    getTradingPlans(),
    getTrades(),
    getAssetEquityByRange("ALL"),
  ]);

  const accountMap = new Map((accounts || []).map((a) => [a.account_id, a]));
  const assetMap = new Map((assets || []).map((a) => [a.asset_id, a]));
  const planMap = new Map((plans || []).map((p) => [p.plan_id, p]));

  const tradesAll = Array.isArray(trades) ? trades.slice() : [];
  const tradesReduceOnly = tradesAll.filter((t) => t && t.reduce_only === true);

  // Equity series (daily) for total PnL curve (realized + unrealized)
  const equitySeriesAll = Array.isArray(equityAll) ? equityAll.slice() : [];

  // PnL + win/loss per autotrader from reduce_only
  const pnlByAutotrader = new Map();
  const winsByAutotrader = new Map();
  const lossesByAutotrader = new Map();
  const closesByAutotrader = new Map();

  for (const t of tradesReduceOnly) {
    const id = t.autotrader_id;
    if (!id) continue;

    const pnl = safeNum(t.pnl_usd);
    pnlByAutotrader.set(id, (pnlByAutotrader.get(id) || 0) + pnl);

    closesByAutotrader.set(id, (closesByAutotrader.get(id) || 0) + 1);
    if (pnl > 0) winsByAutotrader.set(id, (winsByAutotrader.get(id) || 0) + 1);
    if (pnl < 0)
      lossesByAutotrader.set(id, (lossesByAutotrader.get(id) || 0) + 1);
  }

  // running positions (netting trades)
  const runningPositionsByAutotrader = buildRunningMapFromTrades(tradesAll);

  const state = {
    range: "7D",
    page: 1,
    pageSize: rowsSelect ? Number(rowsSelect.value || 10) : 10,
    rows: (autotraders || []).map((a) => {
      const account = accountMap.get(a.account_id);
      const asset = assetMap.get(a.asset_id);
      const plan = planMap.get(a.plan_id);

      const planName = plan?.name || "Trading Plan";
      const autotraderName = a?.autotrader_name || a?.name || "Autotrader";

      const marketType =
        plan?.market_type || account?.market_type || a?.market_type || "spot";
      const isFutures = String(marketType).toLowerCase() !== "spot";

      const sym = asset?.asset_symbol || a.asset_id || "ASSET";
      const pair = `${sym}/USDT${isFutures ? " Perp" : ""}`;

      const providerKey = account?.exchange || account?.provider || "provider";
      const providerLabel = toTitle(providerKey);

      const cap = safeNum(a.capital_usd);
      const pnl = safeNum(pnlByAutotrader.get(a.autotrader_id) || 0);

      const closeCount = safeNum(closesByAutotrader.get(a.autotrader_id) || 0);
      const winCount = safeNum(winsByAutotrader.get(a.autotrader_id) || 0);
      const lossCount = safeNum(lossesByAutotrader.get(a.autotrader_id) || 0);
      const winRate = closeCount ? (winCount / closeCount) * 100 : 0;

      const runningPositions =
        safeNum(runningPositionsByAutotrader.get(a.autotrader_id) || 0);

      return {
        autotrader_id: a.autotrader_id,
        status: String(a.status || "").toLowerCase() === "running" ? "running" : "stopped",
        autotrader_name: autotraderName,
        plan_name: planName,
        pair,
        provider_label: providerLabel,
        capital_usd: cap,
        pnl_usd: pnl,
        win_rate: winRate,
        win_count: winCount,
        loss_count: lossCount,
        running_positions: runningPositions,
      };
    }),
  };

  const sumCapitalRunning = () =>
    state.rows
      .filter((r) => r.status === "running")
      .reduce((s, r) => s + safeNum(r.capital_usd), 0);

  const updateLive = () => {
    const total = state.rows.length;
    const running = state.rows.filter((r) => r.status === "running").length;
    const stopped = total - running;

    if (liveTotal) liveTotal.textContent = String(total);
    if (liveRunning) liveRunning.textContent = String(running);
    if (liveStopped) liveStopped.textContent = String(stopped);
    if (liveCapital) liveCapital.textContent = fmtUSD0(sumCapitalRunning());
  };

  const updateMetrics = () => {
    const labels = equitySeriesAll.map((d) => d?.date).filter(Boolean);
    const window = buildRangeWindow(labels, state.range);
    const m = calcRangeMetrics(window, tradesAll, tradesReduceOnly);

    if (metricProfitFactor) {
      const pf = Number.isFinite(m.profitFactor) ? m.profitFactor : 0;
      metricProfitFactor.textContent = pf === Infinity ? "∞" : pf.toFixed(1);
    }

    if (metricTrades) metricTrades.textContent = m.trades.total.toLocaleString();
    if (metricTradesSub)
      metricTradesSub.textContent = `${m.trades.win.toLocaleString()} / ${m.trades.loss.toLocaleString()}`;
    if (metricVolume) metricVolume.textContent = fmtUSD0(m.volume);
  };

  const renderChart = () => {
    // Build total performance curve from equity (realized + unrealized)
    const labelsAll = equitySeriesAll.map((d) => d?.date).filter(Boolean);
    const valuesAll = equitySeriesAll.map((d) => safeNum(d?.value));

    const sliceN =
      state.range === "7D" ? 7 : state.range === "30D" ? 30 : state.range === "90D" ? 90 : null;

    const labels = sliceN ? labelsAll.slice(-sliceN) : labelsAll;
    const values = sliceN ? valuesAll.slice(-sliceN) : valuesAll;

    const base = values.length ? values[0] : 0;
    const totalSeries = values.map((v) => Number((v - base).toFixed(2)));

    // Headline number: REALIZED PnL only (reduce_only closes) within selected range
    const window = buildRangeWindow(labelsAll, state.range);
    const m = calcRangeMetrics(window, tradesAll, tradesReduceOnly);
    const realizedPnl = safeNum(m.pnl);

    // Sub line: uPnL at end date of selected range
    const endDateKey = labels.length ? labels[labels.length - 1] : null;

    const chartData = {
      totalValue: fmtUSDSign0(realizedPnl),
      // We intentionally do NOT show % here (no capital baseline). We'll hide the badge on this page.
      percent: 0,
      chart: {
        activeRange: state.range,
        series: totalSeries,
        labels,
      },
      _endDateKey: endDateKey,
    };

    renderTotalPerformanceChart({
      container: chartContainer,
      data: chartData,
      status: totalSeries.length ? "ready" : "empty",
      onRangeChange: (nextRange) => {
        state.range = String(nextRange || "7D").toUpperCase();
        renderChart();
        updateMetrics();
      },
    });

    // Replace the % badge with a smaller uPnL line below the headline.
    // This is page-scoped and will not affect Dashboard.
    const scope = chartContainer?.closest(".asset-summary") || document;
    const sub = scope.querySelector('[data-field="asset.subText"]');
    if (sub) {
      sub.textContent = "uPnL: --";
      if (chartData._endDateKey) {
        getUnrealizedPnlByDate(chartData._endDateKey).then((u) => {
          sub.textContent = `uPnL: ${fmtUSDSign0(u)}`;
        });
      }
    }
  };

  // Initial render
  updateLive();
  updateMetrics();
  renderChart();
  renderAutotradersTable({
    rows: state.rows,
    page: state.page,
    pageSize: state.pageSize,
  });

  // Events
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const pageBtn = target.closest(".page-button");
    if (pageBtn && pageBtn.dataset?.page) {
      const next = Number(pageBtn.dataset.page || 1);
      if (Number.isFinite(next)) {
        state.page = next;
        renderAutotradersTable({
          rows: state.rows,
          page: state.page,
          pageSize: state.pageSize,
        });
      }
      return;
    }

    const toggle = target.closest('[data-action="toggle"]');
    if (toggle && toggle.dataset?.id) {
      const id = toggle.dataset.id;
      const row = state.rows.find(
        (r) => String(r.autotrader_id) === String(id)
      );
      if (!row) return;

      row.status = row.status === "running" ? "stopped" : "running";
      updateLive();
      renderAutotradersTable({
        rows: state.rows,
        page: state.page,
        pageSize: state.pageSize,
      });
      return;
    }
  });

  if (rowsSelect) {
    rowsSelect.addEventListener("change", () => {
      state.pageSize = Number(rowsSelect.value || 10);
      state.page = 1;
      renderAutotradersTable({
        rows: state.rows,
        page: state.page,
        pageSize: state.pageSize,
      });
    });
  }
};

initAutotradersPage();
