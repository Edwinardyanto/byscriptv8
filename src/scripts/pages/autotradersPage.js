import { renderAppShell } from "../layout/appShell.js";
import { renderSidebar } from "../layout/sidebar.js";
import { renderTotalPerformanceChart } from "../components/TotalPerformanceChart.js";

import {
  getAutotraders,
  getTradingPlans,
  getAccounts,
  getTrades,
} from "../dataAccess.js";

import { formatMoney, formatPercent } from "../format.js";

/**
 * =========================
 * Utils
 * =========================
 */

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const safeNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const normalizeProviderLabel = (providerRaw) => {
  if (!providerRaw) return "-";
  return String(providerRaw).trim();
};

const formatPairLabel = (assetSymbol, isPerp) => {
  if (!assetSymbol) return "-";
  return isPerp ? `${assetSymbol}/USDT Perp` : `${assetSymbol}/USDT`;
};

const isRunningStatus = (status) => {
  const s = String(status || "").toLowerCase();
  return s === "running" || s === "active" || s === "on";
};

const makeStatusPill = (status) => {
  const running = isRunningStatus(status);
  const cls = running ? "status-pill active" : "status-pill stopped";
  const label = running ? "RUNNING" : "STOPPED";
  return `<span class="${cls}">${label}</span>`;
};

/**
 * Running count:
 * Kita hitung "posisi belum close" dari net qty trades per autotrader.
 * Assumption:
 * - Trade punya qty (atau size). Kalau ada `qty`, pakai qty. Kalau tidak, coba `size`.
 * - Buy menambah exposure, Sell mengurangi. Kita pakai `side` untuk sign.
 */
const calcRunningCountFromTrades = (trades) => {
  const byKey = new Map();

  for (const t of trades) {
    const autotraderId = t.autotrader_id || t.autotraderId;
    if (!autotraderId) continue;

    const side = String(t.side || "").toLowerCase();
    const qtyRaw = t.qty ?? t.quantity ?? t.size ?? 0;
    const qty = safeNumber(qtyRaw, 0);

    let signed = qty;
    if (side === "sell" || side === "short") signed = -qty;

    const prev = byKey.get(autotraderId) || 0;
    byKey.set(autotraderId, prev + signed);
  }

  // Net qty != 0 dianggap masih ada posisi terbuka (count 1)
  // Kalau kamu punya multi-position per autotrader, kita bisa improve nanti.
  const runningCount = new Map();
  for (const [k, netQty] of byKey.entries()) {
    runningCount.set(k, Math.abs(netQty) > 1e-12 ? 1 : 0);
  }

  return runningCount;
};

/**
 * Realized PnL + WinRate:
 * Base: trades reduce_only=true (posisi close).
 */
const calcPnLAndWinRate = (trades) => {
  const stats = new Map();

  for (const t of trades) {
    const autotraderId = t.autotrader_id || t.autotraderId;
    if (!autotraderId) continue;

    const reduceOnly = Boolean(t.reduce_only ?? t.reduceOnly);
    if (!reduceOnly) continue;

    const pnl = safeNumber(t.pnl_usd ?? t.pnlUsd ?? 0, 0);

    let row = stats.get(autotraderId);
    if (!row) {
      row = { pnl: 0, wins: 0, losses: 0, trades: 0 };
      stats.set(autotraderId, row);
    }

    row.pnl += pnl;
    row.trades += 1;
    if (pnl > 0) row.wins += 1;
    else if (pnl < 0) row.losses += 1;
  }

  return stats;
};

const calcVolume = (trades) => {
  // Volume: sum abs(size * price_usd) fallback abs(notional_usd) fallback 0
  let total = 0;
  for (const t of trades) {
    const size = safeNumber(t.size ?? t.qty ?? t.quantity ?? 0, 0);
    const price = safeNumber(t.price_usd ?? t.priceUsd ?? t.price ?? 0, 0);
    const notional = safeNumber(t.notional_usd ?? t.notionalUsd ?? 0, 0);

    const v = notional > 0 ? notional : Math.abs(size * price);
    total += v;
  }
  return total;
};

const calcProfitFactor = (trades) => {
  // profit factor = grossProfit / grossLoss (loss absolute)
  let grossProfit = 0;
  let grossLoss = 0;

  for (const t of trades) {
    const reduceOnly = Boolean(t.reduce_only ?? t.reduceOnly);
    if (!reduceOnly) continue;

    const pnl = safeNumber(t.pnl_usd ?? t.pnlUsd ?? 0, 0);
    if (pnl > 0) grossProfit += pnl;
    else if (pnl < 0) grossLoss += Math.abs(pnl);
  }

  if (grossLoss <= 0) {
    if (grossProfit > 0) return Infinity;
    return 0;
  }

  return grossProfit / grossLoss;
};

const getRangeDays = (rangeLabel) => {
  const label = String(rangeLabel || "").toUpperCase();
  if (label === "7D") return 7;
  if (label === "30D") return 30;
  if (label === "90D") return 90;
  return null; // ALL
};

const parseDateMs = (v) => {
  if (!v) return null;
  const ms = Date.parse(v);
  return Number.isFinite(ms) ? ms : null;
};

const filterTradesByRange = (trades, rangeLabel) => {
  const days = getRangeDays(rangeLabel);
  if (!days) return trades;

  // cari max timestamp di trades sebagai "today"
  let maxMs = null;
  for (const t of trades) {
    const ms =
      parseDateMs(t.filled_at ?? t.filledAt ?? t.created_at ?? t.createdAt) ??
      null;
    if (ms === null) continue;
    if (maxMs === null || ms > maxMs) maxMs = ms;
  }

  if (maxMs === null) return trades;

  const minMs = maxMs - days * 24 * 60 * 60 * 1000;

  return trades.filter((t) => {
    const ms =
      parseDateMs(t.filled_at ?? t.filledAt ?? t.created_at ?? t.createdAt) ??
      null;
    if (ms === null) return false;
    return ms >= minMs && ms <= maxMs;
  });
};

/**
 * Build equity series from reduce_only pnl in time.
 * (Bukan equity beneran, tapi cocok buat chart "performance" sederhana).
 */
const buildPerformanceSeries = (trades) => {
  const rows = [];

  for (const t of trades) {
    const ms =
      parseDateMs(t.filled_at ?? t.filledAt ?? t.created_at ?? t.createdAt) ??
      null;
    if (ms === null) continue;

    const reduceOnly = Boolean(t.reduce_only ?? t.reduceOnly);
    if (!reduceOnly) continue;

    const pnl = safeNumber(t.pnl_usd ?? t.pnlUsd ?? 0, 0);
    rows.push({ ms, pnl });
  }

  rows.sort((a, b) => a.ms - b.ms);

  let cum = 0;
  const series = [];
  const labels = [];

  // simple downsample by day: sum pnl per day
  const dayMap = new Map();
  for (const r of rows) {
    const dayKey = new Date(r.ms).toISOString().slice(0, 10);
    dayMap.set(dayKey, (dayMap.get(dayKey) || 0) + r.pnl);
  }

  const dayKeys = Array.from(dayMap.keys()).sort();
  for (const dayKey of dayKeys) {
    cum += dayMap.get(dayKey) || 0;
    series.push(cum);
    labels.push(dayKey);
  }

  return { series, labels };
};

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value;
};

const setHtml = (id, html) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html;
};

const formatMoneyCompact = (v) => {
  const n = safeNumber(v, 0);
  return formatMoney(n);
};

const formatPnL = (v) => {
  const n = safeNumber(v, 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${formatMoney(n)}`;
};

const formatWinRate = (wins, losses) => {
  const w = safeNumber(wins, 0);
  const l = safeNumber(losses, 0);
  const total = w + l;
  if (total <= 0) return "0%";
  return formatPercent((w / total) * 100);
};

/**
 * =========================
 * Render Table
 * =========================
 */
const renderTable = ({
  autotraders,
  plansById,
  accountsById,
  pnlStatsByAutotrader,
  runningCountByAutotrader,
  pagination,
}) => {
  const tbody = document.querySelector("[data-autotraders-rows]");
  if (!tbody) return;

  const { page, pageSize } = pagination;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const rows = autotraders.slice(start, end);

  tbody.innerHTML = rows
    .map((a) => {
      const status = a.status ?? a.state ?? "stopped";
      const running = isRunningStatus(status);

      const autotraderName = a.autotrader_name ?? a.name ?? a.autotraderName ?? "-";

      const planId = a.plan_id ?? a.planId ?? a.trading_plan_id ?? a.tradingPlanId;
      const plan = plansById.get(planId) || null;
      const planName = plan?.name || plan?.plan_name || (planId ? `Plan ${planId}` : "-");

      const accountId = a.account_id ?? a.accountId;
      const account = accountsById.get(accountId) || null;

      const provider = normalizeProviderLabel(account?.provider || account?.provider_name || account?.exchange || "-");

      const marketType = String(account?.market_type || account?.marketType || "").toLowerCase();
      const isPerp = marketType.includes("future") || marketType.includes("perp");

      const assetSymbol = a.asset_symbol ?? a.assetSymbol ?? a.symbol ?? a.asset_id ?? a.assetId ?? "";
      const pair = formatPairLabel(assetSymbol || "-", isPerp);

      const capital = safeNumber(a.capital_usd ?? a.capitalUsd ?? a.capital ?? 0, 0);

      const pnlRow = pnlStatsByAutotrader.get(a.autotrader_id ?? a.autotraderId) || {
        pnl: 0,
        wins: 0,
        losses: 0,
        trades: 0,
      };

      const pnl = pnlRow.pnl;
      const wins = pnlRow.wins;
      const losses = pnlRow.losses;

      const runningCount = runningCountByAutotrader.get(a.autotrader_id ?? a.autotraderId) || 0;

      return `
        <tr>
          <td class="col-status">${makeStatusPill(status)}</td>

          <td class="col-autotrader">
            <strong style="color: var(--color-text); font-weight: 600;">
              ${autotraderName}
            </strong>
          </td>

          <td class="col-plan">${planName}</td>

          <td class="col-pair">${pair}</td>

          <td class="col-provider">${provider}</td>

          <td class="col-capital numeric">${formatMoneyCompact(capital)}</td>

          <td class="col-pnl numeric">
            <span class="${pnl >= 0 ? "text-green" : "text-red"}">${formatPnL(pnl)}</span>
          </td>

          <td class="col-winrate numeric">${formatWinRate(wins, losses)}</td>

          <td class="col-running numeric">${runningCount}</td>

          <td class="col-action">
            <button class="button button--sm">${running ? "Stop" : "Start"}</button>
          </td>

          <td class="col-detail">
            <button class="button button--sm">View</button>
          </td>
        </tr>
      `;
    })
    .join("");
};

/**
 * Pagination controls
 */
const renderPagination = ({ total, page, pageSize }) => {
  const root = document.querySelector("[data-autotraders-pagination]");
  if (!root) return;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = clamp(page, 1, totalPages);

  const mkBtn = (label, p, active = false, disabled = false) => {
    const cls = ["page-button"];
    if (active) cls.push("active");
    return `
      <button class="${cls.join(" ")}" data-page="${p}" ${disabled ? "disabled" : ""}>
        ${label}
      </button>
    `;
  };

  // simple: show first 5 pages
  const maxPages = 7;
  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);

  const visible = pages.slice(0, maxPages);

  root.innerHTML = `
    ${mkBtn("‹", current - 1, false, current <= 1)}
    ${visible.map((p) => mkBtn(String(p), p, p === current)).join("")}
    ${totalPages > maxPages ? `<span style="opacity:.6; padding:0 6px;">...</span>` : ""}
    ${totalPages > maxPages ? mkBtn(String(totalPages), totalPages, current === totalPages) : ""}
    ${mkBtn("›", current + 1, false, current >= totalPages)}
  `;
};

/**
 * =========================
 * Main
 * =========================
 */
const state = {
  range: "ALL",
  page: 1,
  pageSize: 100,
  autotraders: [],
  plansById: new Map(),
  accountsById: new Map(),
  trades: [],
};

const apply = () => {
  // filter trades by range
  const tradesInRange = filterTradesByRange(state.trades, state.range);

  // metrics
  const pf = calcProfitFactor(tradesInRange);
  const reduceOnlyTrades = tradesInRange.filter((t) => Boolean(t.reduce_only ?? t.reduceOnly));
  const win = reduceOnlyTrades.filter((t) => safeNumber(t.pnl_usd ?? t.pnlUsd ?? 0, 0) > 0).length;
  const lose = reduceOnlyTrades.filter((t) => safeNumber(t.pnl_usd ?? t.pnlUsd ?? 0, 0) < 0).length;

  setText("metric-profit-factor", pf === Infinity ? "∞" : String(Math.round(pf * 10) / 10));
  setText("metric-trades", String(reduceOnlyTrades.length));
  setText("metric-trades-sub", `${win} / ${lose}`);

  const vol = calcVolume(tradesInRange);
  setText("metric-volume", formatMoneyCompact(vol));

  // live summary from autotraders
  const total = state.autotraders.length;
  const active = state.autotraders.filter((a) => isRunningStatus(a.status ?? a.state)).length;
  const stopped = total - active;

  setText("live-autotraders-total", String(total));
  setText("live-autotraders-active", String(active));
  setText("live-autotraders-stopped", String(stopped));

  const capitalAllocation = state.autotraders
    .filter((a) => isRunningStatus(a.status ?? a.state))
    .reduce((sum, a) => sum + safeNumber(a.capital_usd ?? a.capitalUsd ?? a.capital ?? 0, 0), 0);

  setText("live-capital-value", formatMoneyCompact(capitalAllocation));

  // chart series
  const perf = buildPerformanceSeries(tradesInRange);

  // update chart ui (TotalPerformanceChart expects container exists)
  const totalValue = perf.series.length ? perf.series[perf.series.length - 1] : 0;
  const firstValue = perf.series.length ? perf.series[0] : 0;
  const changePct = firstValue !== 0 ? ((totalValue - firstValue) / Math.abs(firstValue)) * 100 : 0;

  const totalBalanceEl = document.querySelector('[data-field="asset.totalBalance"]');
  const changeEl = document.querySelector('[data-field="asset.change"]');

  if (totalBalanceEl) totalBalanceEl.textContent = formatMoneyCompact(totalValue);
  if (changeEl) {
    const sign = changePct > 0 ? "+" : "";
    changeEl.textContent = `${sign}${formatPercent(changePct)}`;
    changeEl.classList.toggle("positive", changePct >= 0);
    changeEl.classList.toggle("negative", changePct < 0);
  }

  // render chart with shared component
  // component reads from the container, but we can feed data through a simple adapter:
  renderTotalPerformanceChart({
    root: document.querySelector('[data-total-performance="autotraders"]'),
    labels: perf.labels,
    values: perf.series,
  });

  // table stats
  const pnlStats = calcPnLAndWinRate(tradesInRange);
  const runningCount = calcRunningCountFromTrades(tradesInRange);

  // sorting: running first, then pnl desc, then capital desc
  const autotradersSorted = [...state.autotraders].sort((a, b) => {
    const ar = isRunningStatus(a.status ?? a.state) ? 1 : 0;
    const br = isRunningStatus(b.status ?? b.state) ? 1 : 0;
    if (ar !== br) return br - ar;

    const ap = pnlStats.get(a.autotrader_id ?? a.autotraderId)?.pnl ?? 0;
    const bp = pnlStats.get(b.autotrader_id ?? b.autotraderId)?.pnl ?? 0;
    if (ap !== bp) return bp - ap;

    const ac = safeNumber(a.capital_usd ?? a.capitalUsd ?? a.capital ?? 0, 0);
    const bc = safeNumber(b.capital_usd ?? b.capitalUsd ?? b.capital ?? 0, 0);
    return bc - ac;
  });

  // pagination
  const totalRows = autotradersSorted.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / state.pageSize));
  state.page = clamp(state.page, 1, totalPages);

  renderTable({
    autotraders: autotradersSorted,
    plansById: state.plansById,
    accountsById: state.accountsById,
    pnlStatsByAutotrader: pnlStats,
    runningCountByAutotrader: runningCount,
    pagination: { page: state.page, pageSize: state.pageSize },
  });

  renderPagination({ total: totalRows, page: state.page, pageSize: state.pageSize });

  // bind pagination clicks
  const pag = document.querySelector("[data-autotraders-pagination]");
  if (pag) {
    pag.querySelectorAll("button[data-page]").forEach((btn) => {
      btn.onclick = () => {
        const p = Number(btn.getAttribute("data-page"));
        if (!Number.isFinite(p)) return;
        state.page = p;
        apply();
      };
    });
  }
};

const bindRangeButtons = () => {
  document.querySelectorAll(".asset-summary-pills button[data-range]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".asset-summary-pills button[data-range]").forEach((b) => {
        b.classList.remove("active");
      });

      btn.classList.add("active");
      state.range = btn.getAttribute("data-range") || "ALL";
      state.page = 1;
      apply();
    });
  });
};

const bindRowsPerPage = () => {
  const sel = document.querySelector("[data-autotraders-rows-per-page]");
  if (!sel) return;

  sel.addEventListener("change", () => {
    const v = Number(sel.value);
    state.pageSize = Number.isFinite(v) ? v : 100;
    state.page = 1;
    apply();
  });
};

const init = async () => {
  renderAppShell();
  renderSidebar("autotraders");

  // load data
  const [autotraders, plans, accounts, trades] = await Promise.all([
    getAutotraders(),
    getTradingPlans(),
    getAccounts(),
    getTrades(),
  ]);

  state.autotraders = Array.isArray(autotraders) ? autotraders : [];
  state.trades = Array.isArray(trades) ? trades : [];

  state.plansById = new Map(
    (Array.isArray(plans) ? plans : []).map((p) => [p.plan_id ?? p.id, p])
  );

  state.accountsById = new Map(
    (Array.isArray(accounts) ? accounts : []).map((a) => [a.account_id ?? a.id, a])
  );

  bindRangeButtons();
  bindRowsPerPage();

  apply();
};

init();
