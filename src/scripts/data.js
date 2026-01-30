// src/scripts/data.js

import {
  getAssetEquityByRange,
  getAccountsWithSummary,
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
  }).format(value);

/* ------------------------------------------------------
 * STATE (SINGLE SOURCE OF TRUTH) — STEP 2
 * ------------------------------------------------------ */

let activeRange = "7D";

export const setActiveRange = (range) => {
  activeRange = range;
};

export const getActiveRange = () => activeRange;

/* ------------------------------------------------------
 * RANGE CONFIG — STEP 3
 * ------------------------------------------------------ */

const RANGE_DAYS = {
  "7D": 7,
  "30D": 30,
  "90D": 90,
  "ALL": "ALL",
};

/* ------------------------------------------------------
 * RANGE SLICE HELPER — STEP 3
 * ------------------------------------------------------ */

const sliceSeriesByRange = (series = [], range) => {
  if (!series.length) return [];

  if (range === "ALL") return series;

  const days = RANGE_DAYS[range];

  // ✅ Guard: kalau range invalid → fallback ALL
  if (!days) return series;

  return series.slice(-days);
};

/* ------------------------------------------------------
 * COMPUTE SUMMARY — STEP 6
 * ------------------------------------------------------ */

const computeSummary = (series) => {
  if (!series || series.length < 2) {
    return {
      totalValue: 0,
      percent: 0,
    };
  }

  const first = Number(series[0]?.equity_usd || 0);
  const last = Number(series[series.length - 1]?.equity_usd || 0);

  const percent =
    first > 0 ? ((last - first) / first) * 100 : 0;

  return {
    totalValue: last,
    percent,
  };
};

/* ------------------------------------------------------
 * ASSET SUMMARY (HEADER + CHART INPUT) — STEP 5
 * ------------------------------------------------------ */

const buildAssetSummary = async () => {
  // ✅ Always fetch ALL series first
  const rawSeries = await getAssetEquityByRange("ALL");

  // ✅ Slice locally based on activeRange
  const slicedSeries = sliceSeriesByRange(rawSeries, activeRange);

  // ✅ Compute header numbers
  const { totalValue, percent } = computeSummary(slicedSeries);

  return {
    // HEADER
    totalValue: formatCurrency(totalValue),
    percent,

    // CHART INPUT (render-ready)
    chart: {
      series: slicedSeries.map((d) => Number(d.equity_usd || 0)),
      labels: slicedSeries.map((d) => d.date),
    },
  };
};

/* ------------------------------------------------------
 * RANGE CONTROLLER (TIMEFRAME PILLS) — STEP 4
 * ------------------------------------------------------ */

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
 * TOP AUTOTRADERS
 * ------------------------------------------------------ */

const formatPct = (value, digits = 2) => {
  const n = Number(value || 0);
  return `${n.toFixed(digits)}%`;
};

const buildTopAutotraders = async () => {
  const [autotraders, plans, trades, assets] = await Promise.all([
    getAutotraders(),
    getTradingPlans(),
    getTrades(),
    getAssets(),
  ]);

  const planNameById = new Map(plans.map((p) => [p.plan_id, p.name || ""]));
  const assetSymbolById = new Map(
    assets.map((a) => [a.asset_id, a.asset_symbol || ""])
  );

  // Aggregate realized performance per autotrader (reduce_only only)
  const agg = new Map();
  for (const t of trades || []) {
    if (!t || !t.autotrader_id) continue;
    if (t.reduce_only !== true) continue;

    const qty = Math.abs(Number(t.qty || 0));
    const price = Number(t.price || 0);
    const notional = qty * price;

    const pnlUsd = Number(t.pnl_usd || 0);

    const cur = agg.get(t.autotrader_id) || {
      pnlUsd: 0,
      notionalClosed: 0,
      lastFilledAt: 0,
    };

    cur.pnlUsd += pnlUsd;
    cur.notionalClosed += notional;

    const filledAt = Date.parse(t.filled_at || "");
    if (!Number.isNaN(filledAt)) {
      cur.lastFilledAt = Math.max(cur.lastFilledAt, filledAt);
    }

    agg.set(t.autotrader_id, cur);
  }

  const rows = (autotraders || []).map((a) => {
    const s = agg.get(a.autotrader_id) || { pnlUsd: 0, notionalClosed: 0 };
    const pct =
      s.notionalClosed > 0 ? (s.pnlUsd / s.notionalClosed) * 100 : 0;

    const planName = planNameById.get(a.plan_id) || "";
    const sym = assetSymbolById.get(a.asset_id) || "";

    return {
      autotrader_id: a.autotrader_id,
      status: a.status,
      planName,
      assetSymbol: sym,
      profitPct: pct,
    };
  });

  // Top 3 by profit%
  rows.sort((a, b) => b.profitPct - a.profitPct);

  return rows.slice(0, 3).map((t) => ({
    name: t.planName || "Autotrader",
    pair: t.assetSymbol ? `${t.assetSymbol}/USDT` : "Pair",
    runtime: t.status === "running" ? "Running" : "Stopped",
    pnl: formatPct(t.profitPct, 2),
  }));
};

/* ------------------------------------------------------
 * DASHBOARD FETCH (FINAL ENTRY POINT)
 * ------------------------------------------------------ */

export const fetchDashboardData = async () => {
  const [assetSummary, accountsSummary, topAutotraders] =
    await Promise.all([
      buildAssetSummary(),
      buildAccountsSummary(),
      buildTopAutotraders(),
    ]);

  return {
    assetSummary,
    accountsSummary,
    topAutotraders,
    alerts: [],
    tradeHistory: [],
  };
};
