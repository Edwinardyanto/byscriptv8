import {
  getAutotraders,
  getAccounts,
  getAssets,
  getTradingPlans,
  getTrades,
} from "../dataAccess.js";

import { renderTotalPerformanceChart } from "../components/TotalPerformanceChart.js";

const fmtUSD = (v) => {
  const n = Number(v || 0);
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString(undefined, {
    maximumFractionDigits: 0,
  })}`;
};

const fmtUSD0 = (v) =>
  `$${Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const toTitle = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());

const toDateKey = (ms) => {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const buildDailySeries = (reduceOnlyTrades) => {
  // Map date -> pnl
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

  if (!minDate || !maxDate) {
    return { labels: [], series: [] };
  }

  const labels = [];
  const series = [];

  // iterate day by day (UTC)
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
  const n = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : null;
  if (!labels.length || !series.length) return { labels: [], series: [] };
  if (!n) return { labels, series };
  return {
    labels: labels.slice(-n),
    series: series.slice(-n),
  };
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

  const grossProfit = closes.reduce((s, t) => s + Math.max(0, safeNum(t.pnl_usd)), 0);
  const grossLoss = closes.reduce((s, t) => s + Math.abs(Math.min(0, safeNum(t.pnl_usd))), 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  const win = closes.filter((t) => safeNum(t.pnl_usd) > 0).length;
  const loss = closes.filter((t) => safeNum(t.pnl_usd) < 0).length;
  const totalTrades = closes.length;

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
    trades: { total: totalTrades, win, loss },
    volume,
  };
};

const buildRangeWindow = (labels, range) => {
  const n = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : null;
  if (!n || !labels.length) return { fromMs: null, toMs: null };
  const fromLabel = labels.slice(-n)[0];
  const toLabel = labels[labels.length - 1];
  const fromMs = new Date(`${fromLabel}T00:00:00Z`).getTime();
  const toMs = new Date(`${toLabel}T23:59:59Z`).getTime() + 1;
  return { fromMs, toMs };
};

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
    const statusClass = r.status === "running" ? "status-pill--active" : "status-pill--stopped";
    const pnlClass = r.pnl_usd >= 0 ? "pnl-positive" : "pnl-negative";
    const actionLabel = r.status === "running" ? "Stop" : "Start";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="status-pill ${statusClass}">${r.status === "running" ? "RUNNING" : "STOPPED"}</span></td>
      <td class="col-trading-plan"><span class="trading-plan-name">${r.plan_name}</span></td>
      <td>${r.pair}</td>
      <td>${r.exchange_label}</td>
      <td class="numeric">${fmtUSD0(r.capital_usd)}</td>
      <td class="numeric ${pnlClass}">${fmtUSD(r.pnl_usd)}</td>
      <td class="numeric">${r.win_rate.toFixed(0)}%</td>
      <td class="numeric">${r.status === "running" ? "1" : "0"}</td>
      <td><button class="table-action" type="button" data-action="toggle" data-id="${r.autotrader_id}">${actionLabel}</button></td>
      <td><a class="table-action" href="autotraders/detail.html?id=${encodeURIComponent(r.autotrader_id)}">View</a></td>
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

const initAutotradersPage = async () => {
  const chartContainer = document.querySelector('[data-total-performance="autotraders"]');
  const rowsSelect = document.querySelector('[data-autotraders-rows-per-page]');

  const liveTotal = document.getElementById("live-autotraders-total");
  const liveRunning = document.getElementById("live-autotraders-active");
  const liveStopped = document.getElementById("live-autotraders-stopped");
  const liveCapital = document.getElementById("live-capital-value");

  const metricProfitFactor = document.getElementById("metric-profit-factor");
  const metricTrades = document.getElementById("metric-trades");
  const metricTradesSub = document.getElementById("metric-trades-sub");
  const metricVolume = document.getElementById("metric-volume");

  const [autotraders, accounts, assets, plans, trades] = await Promise.all([
    getAutotraders(),
    getAccounts(),
    getAssets(),
    getTradingPlans(),
    getTrades(),
  ]);

  const accountMap = new Map((accounts || []).map((a) => [a.account_id, a]));
  const assetMap = new Map((assets || []).map((a) => [a.asset_id, a]));
  const planMap = new Map((plans || []).map((p) => [p.plan_id, p]));

  // trades
  const tradesAll = Array.isArray(trades) ? trades.slice() : [];
  const tradesReduceOnly = tradesAll.filter((t) => t && t.reduce_only === true);

  // performance daily pnl series (cumulative)
  const full = buildDailySeries(tradesReduceOnly);

  // Autotraders aggregates for table
  const pnlByAutotrader = new Map();
  const winsByAutotrader = new Map();
  const closesByAutotrader = new Map();

  for (const t of tradesReduceOnly) {
    const id = t.autotrader_id;
    if (!id) continue;
    pnlByAutotrader.set(id, (pnlByAutotrader.get(id) || 0) + safeNum(t.pnl_usd));
    closesByAutotrader.set(id, (closesByAutotrader.get(id) || 0) + 1);
    if (safeNum(t.pnl_usd) > 0) winsByAutotrader.set(id, (winsByAutotrader.get(id) || 0) + 1);
  }

  const state = {
    range: "7D",
    page: 1,
    pageSize: rowsSelect ? Number(rowsSelect.value || 10) : 10,
    rows: (autotraders || []).map((a) => {
      const account = accountMap.get(a.account_id);
      const asset = assetMap.get(a.asset_id);
      const plan = planMap.get(a.plan_id);

      const cap = safeNum(a.capital_usd);
      const pnl = safeNum(pnlByAutotrader.get(a.autotrader_id) || 0);
      const closeCount = safeNum(closesByAutotrader.get(a.autotrader_id) || 0);
      const winCount = safeNum(winsByAutotrader.get(a.autotrader_id) || 0);
      const winRate = closeCount ? (winCount / closeCount) * 100 : 0;

      const marketType = plan?.market_type || account?.market_type || "spot";
      const isFutures = String(marketType).toLowerCase() !== "spot";

      const sym = asset?.asset_symbol || a.asset_id;
      const pair = `${sym}/USDT${isFutures ? " Perp" : ""}`;
      const exchangeKey = account?.exchange || account?.provider || "exchange";
      const exchangeLabel = `${toTitle(exchangeKey)}${isFutures ? " Futures" : ""}`.trim();

      return {
        autotrader_id: a.autotrader_id,
        status: a.status,
        plan_name: plan?.name || "Trading Plan",
        pair,
        exchange_label: exchangeLabel,
        capital_usd: cap,
        pnl_usd: pnl,
        win_rate: winRate,
      };
    }),
  };

  
  // Sort so the first page looks meaningful: running first, then higher PnL, then higher capital
  state.rows.sort((a, b) => {
    const ar = a.status === "running" ? 0 : 1;
    const br = b.status === "running" ? 0 : 1;
    if (ar !== br) return ar - br;
    const pnlDiff = safeNum(b.pnl_usd) - safeNum(a.pnl_usd);
    if (pnlDiff !== 0) return pnlDiff;
    return safeNum(b.capital_usd) - safeNum(a.capital_usd);
  });
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
    const { labels } = full;
    const window = buildRangeWindow(labels, state.range);
    const m = calcRangeMetrics(window, tradesAll, tradesReduceOnly);

    if (metricProfitFactor) {
      const pf = Number.isFinite(m.profitFactor) ? m.profitFactor : 0;
      metricProfitFactor.textContent = pf === Infinity ? "∞" : pf.toFixed(1);
    }

    if (metricTrades) metricTrades.textContent = m.trades.total.toLocaleString();
    if (metricTradesSub) metricTradesSub.textContent = `${m.trades.win.toLocaleString()} / ${m.trades.loss.toLocaleString()}`;
    if (metricVolume) metricVolume.textContent = fmtUSD0(m.volume);
  };

  const renderChart = () => {
    const sliced = sliceRange(full, state.range);
    const series = sliced.series;
    const labels = sliced.labels;

    const totalPnl = series.length ? series[series.length - 1] - series[0] : 0;
    const totalCapital = state.rows.reduce((s, r) => s + safeNum(r.capital_usd), 0);
    const pct = totalCapital > 0 ? (totalPnl / totalCapital) * 100 : 0;

    const chartData = {
      totalValue: fmtUSD(totalPnl),
      percent: pct,
      chart: {
        activeRange: state.range,
        series,
        labels,
      },
    };

    renderTotalPerformanceChart({
      container: chartContainer,
      data: chartData,
      status: series.length ? "ready" : "empty",
      onRangeChange: (nextRange) => {
        state.range = String(nextRange || "7D").toUpperCase();
        renderChart();
        updateMetrics();
      },
    });
  };

  // Initial render
  updateLive();
  updateMetrics();
  renderChart();
  renderAutotradersTable({ rows: state.rows, page: state.page, pageSize: state.pageSize });

  // Events
  document.addEventListener("click", (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    const pageBtn = target.closest(".page-button");
    if (pageBtn && pageBtn.dataset?.page) {
      const next = Number(pageBtn.dataset.page || 1);
      if (Number.isFinite(next)) {
        state.page = next;
        renderAutotradersTable({ rows: state.rows, page: state.page, pageSize: state.pageSize });
      }
      return;
    }

    const toggle = target.closest('[data-action="toggle"]');
    if (toggle && toggle.dataset?.id) {
      const id = toggle.dataset.id;
      const row = state.rows.find((r) => String(r.autotrader_id) === String(id));
      if (!row) return;
      row.status = row.status === "running" ? "stopped" : "running";
      updateLive();
      renderAutotradersTable({ rows: state.rows, page: state.page, pageSize: state.pageSize });
      return;
    }
  });

  if (rowsSelect) {
    rowsSelect.addEventListener("change", () => {
      state.pageSize = Number(rowsSelect.value || 10);
      state.page = 1;
      renderAutotradersTable({ rows: state.rows, page: state.page, pageSize: state.pageSize });
    });
  }
};

initAutotradersPage();
