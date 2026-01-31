// src/scripts/data.js

import {
  getAssetEquityByRange,
  getAccountsWithSummary,
  getAccounts,
  getAutotraders,
  getTradingPlans,
  getTrades,
  getAssets,
} from "./dataAccess.js";

/* ------------------------------------------------------
 * Utils
 * ------------------------------------------------------ */

const formatCurrency = (value, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0));

const formatNumber = (value) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatPct = (value, digits = 2) => {
  const n = Number(value || 0);
  return `${n.toFixed(digits)}%`;
};

const formatSignedPct = (value, digits = 2) => {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
};

const formatTimeAgo = (iso) => {
  const ms = Date.parse(iso || "");
  if (!Number.isFinite(ms)) return "-";

  const diff = Math.max(0, Date.now() - ms);
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day >= 365) return `${Math.floor(day / 365)}y ago`;
  if (day >= 30) return `${Math.floor(day / 30)}mo ago`;
  if (day >= 1) return `${day}d ago`;
  if (hr >= 1) return `${hr}h ago`;
  if (min >= 1) return `${min}m ago`;
  return `${sec}s ago`;
};

/* ------------------------------------------------------
 * STATE (SINGLE SOURCE OF TRUTH)
 * ------------------------------------------------------ */

let activeRange = "7D";

export const setActiveRange = (range) => {
  activeRange = range;
};

export const getActiveRange = () => activeRange;

/* ------------------------------------------------------
 * RANGE CONFIG
 * ------------------------------------------------------ */

const RANGE_DAYS = {
  "7D": 7,
  "30D": 30,
  "90D": 90,
  ALL: "ALL",
};

const sliceSeriesByRange = (series = [], range) => {
  if (!series.length) return [];
  if (range === "ALL") return series;

  const days = RANGE_DAYS[range];
  if (!days) return series;

  return series.slice(-days);
};

/* ------------------------------------------------------
 * COMPUTE SUMMARY
 * ------------------------------------------------------ */

const computeSummary = (series) => {
  if (!series || series.length < 2) {
    return { totalValue: 0, percent: 0 };
  }

  const first = Number(series[0]?.equity_usd || 0);
  const last = Number(series[series.length - 1]?.equity_usd || 0);

  const percent = first > 0 ? ((last - first) / first) * 100 : 0;

  return { totalValue: last, percent };
};

/* ------------------------------------------------------
 * ASSET SUMMARY
 * ------------------------------------------------------ */

const buildAssetSummary = async () => {
  const rawSeries = await getAssetEquityByRange("ALL");
  const slicedSeries = sliceSeriesByRange(rawSeries, activeRange);

  const { totalValue, percent } = computeSummary(slicedSeries);

  return {
    totalValue: formatCurrency(totalValue),
    percent,
    chart: {
      series: slicedSeries.map((d) => Number(d.equity_usd || 0)),
      labels: slicedSeries.map((d) => d.date),
    },
  };
};

export const setAssetRange = async (range) => {
  activeRange = range;
  return buildAssetSummary();
};

/* ------------------------------------------------------
 * ACCOUNTS SUMMARY
 * ------------------------------------------------------ */

const buildAccountsSummary = async () => {
  const accounts = await getAccountsWithSummary();

  const list = accounts.map((a) => ({
    name: a.account_name || a.account_id,
    amount: Number(a.totalValueUsd || 0),
    value: formatCurrency(a.totalValueUsd || 0),
  }));

  const total = list.reduce((sum, x) => sum + x.amount, 0);

  return {
    total: formatCurrency(total),
    accounts: list,
  };
};

/* ------------------------------------------------------
 * DATA OVERVIEW (IN ALERTS SECTION)
 * ------------------------------------------------------ */

const buildAlertsKpis = async () => {
  const [accounts, autotraders, trades, equitySeries] = await Promise.all([
    getAccounts(),
    getAutotraders(),
    getTrades(),
    getAssetEquityByRange("ALL"),
  ]);

  // Accounts
  const totalAccounts = Array.isArray(accounts) ? accounts.length : 0;

  let spotCount = 0;
  let futuresCount = 0;
  let lastConnectedAt = null;

  for (const a of accounts || []) {
    const mt = String(a?.market_type || "").toLowerCase();
    const name = String(a?.account_name || "").toLowerCase();

    if (mt === "spot") spotCount += 1;
    else if (mt === "futures") futuresCount += 1;
    else if (mt === "web3") {
      // fallback: infer from account_name
      if (name.includes("futures")) futuresCount += 1;
      else spotCount += 1;
    }

    if (a?.connected_at) {
      if (!lastConnectedAt) lastConnectedAt = a.connected_at;
      else if (Date.parse(a.connected_at) > Date.parse(lastConnectedAt)) {
        lastConnectedAt = a.connected_at;
      }
    }
  }

  // Autotraders
  const totalAutotraders = Array.isArray(autotraders) ? autotraders.length : 0;

  let active = 0;
  let stopped = 0;
  let paused = 0;

  for (const a of autotraders || []) {
    const s = String(a?.status || "").toLowerCase();
    if (s === "running") active += 1;
    else if (s === "stopped") stopped += 1;
    else if (s) paused += 1;
  }

  // Trades
  const totalTrades = Array.isArray(trades) ? trades.length : 0;

  const closed = (trades || []).filter((t) => t?.reduce_only === true);
  const closedCount = closed.length;

  const winCount = closed.filter((t) => Number(t?.pnl_usd || 0) > 0).length;
  const winRate = closedCount > 0 ? (winCount / closedCount) * 100 : 0;

  // Optional if field exists, otherwise 0
  const failed = (trades || []).filter(
    (t) => String(t?.status || "").toLowerCase() === "failed"
  ).length;

  // Total realized PnL
  const totalPnlUsd = closed.reduce(
    (sum, t) => sum + Number(t?.pnl_usd || 0),
    0
  );

  // ROI from equity series (first vs last)
  let roiPct = 0;
  if (Array.isArray(equitySeries) && equitySeries.length >= 2) {
    const first = Number(equitySeries[0]?.equity_usd || 0);
    const last = Number(equitySeries[equitySeries.length - 1]?.equity_usd || 0);
    roiPct = first > 0 ? ((last - first) / first) * 100 : 0;
  }

  return {
    accounts: {
      title: "Accounts Connected",
      value: formatNumber(totalAccounts),
      sub: `${formatNumber(spotCount)} Spot, ${formatNumber(futuresCount)} Futures`,
      meta: `Last connected: ${lastConnectedAt ? formatTimeAgo(lastConnectedAt) : "-"}`,
    },
    autotraders: {
      title: "Autotraders",
      value: formatNumber(totalAutotraders),
      sub: `Active: ${formatNumber(active)}, Stopped: ${formatNumber(stopped)}`,
      meta: `Paused by risk guard: ${formatNumber(paused)}`,
    },
    trades: {
      title: "Trades",
      value: formatNumber(totalTrades),
      sub: `Win rate: ${formatPct(winRate, 2)}`,
      meta: `Failed: ${formatNumber(failed)}`,
    },
    pnl: {
      title: "Total PnL",
      value: formatCurrency(totalPnlUsd, 2),
      sub: `ROI: ${formatSignedPct(roiPct, 2)}`,
      meta: "Fees: -",
    },
  };
};

/* ------------------------------------------------------
 * TOP AUTOTRADERS
 * ------------------------------------------------------ */

const buildTopAutotraders = async () => {
  const [autotraders, plans, trades, assets] = await Promise.all([
    getAutotraders(),
    getTradingPlans(),
    getTrades(),
    getAssets(),
  ]);

  const planNameById = new Map((plans || []).map((p) => [p.plan_id, p.name || ""]));
  const assetSymbolById = new Map(
    (assets || []).map((a) => [a.asset_id, a.asset_symbol || ""])
  );

  const SPARK_POINTS = 24;

  const toFilledAtMs = (t) => {
    const ms =
      typeof t?.filled_at === "number"
        ? t.filled_at * 1000
        : Date.parse(t?.filled_at || "");
    return Number.isFinite(ms) ? ms : 0;
  };

  // Aggregate realized performance per autotrader (reduce_only only)
  const agg = new Map();

  // For sparkline: store pnl_usd per close (reduce_only) sorted by time
  const pnlTradesByAutotrader = new Map();

  for (const t of trades || []) {
    if (!t || !t.autotrader_id) continue;
    if (t.reduce_only !== true) continue;

    const qty = Math.abs(Number(t.size || 0));
    const price = Number(t.price_usd || 0);
    const notional = qty * price;

    const pnlUsd = Number(t.pnl_usd || 0);
    const filledAtMs = toFilledAtMs(t);

    const cur = agg.get(t.autotrader_id) || {
      pnlUsd: 0,
      notionalClosed: 0,
      closeCount: 0,
      lastFilledAt: 0,
    };

    cur.pnlUsd += pnlUsd;
    cur.notionalClosed += notional;
    cur.closeCount += 1;
    cur.lastFilledAt = Math.max(cur.lastFilledAt, filledAtMs);

    agg.set(t.autotrader_id, cur);

    const arr = pnlTradesByAutotrader.get(t.autotrader_id) || [];
    arr.push({ t: filledAtMs, pnl: pnlUsd });
    pnlTradesByAutotrader.set(t.autotrader_id, arr);
  }

  // Build spark values: cumulative pnl_usd over last N closes
  const sparkById = new Map();
  for (const [id, arr] of pnlTradesByAutotrader.entries()) {
    arr.sort((a, b) => (a.t || 0) - (b.t || 0));
    const sliced = arr.slice(-SPARK_POINTS);

    let cum = 0;
    const values = sliced.map((x) => {
      cum += Number(x.pnl || 0);
      return cum;
    });

    sparkById.set(id, values.length >= 2 ? values : [0, 0]);
  }

  const rows = (autotraders || []).map((a) => {
    const s =
      agg.get(a.autotrader_id) || {
        pnlUsd: 0,
        notionalClosed: 0,
        closeCount: 0,
        lastFilledAt: 0,
      };

    const capital = Number(a.capital_usd || 0);
    const pct = capital > 0 ? (s.pnlUsd / capital) * 100 : 0;

    const planName = planNameById.get(a.plan_id) || "";
    const sym = assetSymbolById.get(a.asset_id) || "";

    return {
      autotrader_id: a.autotrader_id,
      status: a.status,
      autotraderName: a.autotrader_name || "",
      planName,
      assetSymbol: sym,
      profitPct: pct,
      closeCount: s.closeCount,
      lastFilledAt: s.lastFilledAt,
      spark: sparkById.get(a.autotrader_id) || [0, 0],
    };
  });

  let ranked = rows.filter((r) => r.closeCount > 0);
  if (!ranked.length) ranked = rows;

  ranked.sort((a, b) => {
    if (b.profitPct !== a.profitPct) return b.profitPct - a.profitPct;
    return (b.lastFilledAt || 0) - (a.lastFilledAt || 0);
  });

  return ranked.slice(0, 3).map((t) => ({
    name: t.autotraderName || t.planName || "Autotrader",
    pair: t.assetSymbol ? `${t.assetSymbol}/USDT` : "Pair",
    runtime: t.status === "running" ? "Running" : "Stopped",
    tradeCount: Number(t.closeCount || 0),
    pnl: formatPct(t.profitPct, 2),
    spark: t.spark,
  }));
};

/* ------------------------------------------------------
 * DASHBOARD FETCH (FINAL ENTRY POINT)
 * ------------------------------------------------------ */

export const fetchDashboardData = async () => {
  const [assetSummary, accountsSummary, topAutotraders, alerts] = await Promise.all([
    buildAssetSummary(),
    buildAccountsSummary(),
    buildTopAutotraders(),
    buildAlertsKpis(),
  ]);

  return {
    assetSummary,
    accountsSummary,
    topAutotraders,
    alerts,
    tradeHistory: [],
  };
};
