// src/scripts/data.js
// ======================================================
// DATA ORCHESTRATION LAYER (STEP 2–6 — LOCKED)
// ======================================================

import {
  getAssetEquityByRange,
  getAccountsWithSummary,
  getAccounts,
  getAutotradersByAccount,
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

  const first = Number(series[0]?.value || 0);
  const last = Number(series[series.length - 1]?.value || 0);

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
      series: slicedSeries.map((d) => Number(d.value || 0)),
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

const buildTopAutotraders = async () => {
  const accounts = await getAccounts();

  const traders = (
    await Promise.all(
      accounts.map((a) => getAutotradersByAccount(a.account_id))
    )
  ).flat();

  return traders.slice(0, 3).map((t) => ({
    name: t.tradingPlanName || "Autotrader",
    runtime: t.status === "active" ? "Running" : "Stopped",
    pnl: "—",
  }));
};

/* ------------------------------------------------------
 * TRADE HISTORY (REAL DATA)
 * ------------------------------------------------------ */


const buildTradeHistory = async () => {
  const [trades, assets] = await Promise.all([
    getTrades(),
    getAssets(),
  ]);

  const assetMap = new Map(
    assets.map((a) => [a.asset_id, a.symbol.toLowerCase()])
  );

  return trades.slice(0, 20).map((t) => {
    const symbol = assetMap.get(t.asset_id) || "unknown";
    const notional = t.price_usd * t.size;

    return {
      pair: [symbol, "usdt"],
      action: t.side.toUpperCase(),
      status: "FILLED",
      profitUsd: `$${notional.toFixed(2)}`,
      profitPct: "—",
      profitState: "neutral",
      time: new Date(t.filled_at * 1000).toLocaleTimeString(
        [],
        { hour: "2-digit", minute: "2-digit" }
      ),
    };
  });
};


/* ------------------------------------------------------
 * DASHBOARD FETCH (FINAL ENTRY POINT)
 * ------------------------------------------------------ */

export const fetchDashboardData = async () => {
const [assetSummary, accountsSummary, topAutotraders, tradeHistory] =
  await Promise.all([
    buildAssetSummary(),
    buildAccountsSummary(),
    buildTopAutotraders(),
    buildTradeHistory(),
  ]);

  return {
    assetSummary,
    accountsSummary,
    topAutotraders,
    alerts: [],
    tradeHistory,
  };
};

