// src/scripts/data.js
// ======================================================
// DATA ORCHESTRATION LAYER (STEP 2–6 — LOCKED)
// ======================================================

import {
  getAssetEquityByRange,
  getAccountsWithSummary,
  getAccounts,
  getAutotradersByAccount,
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
 * STATE (SINGLE SOURCE OF TRUTH)  — STEP 2
 * ------------------------------------------------------ */

let activeRange = "7D"; // "7D" | "30D" | "90D" | "ALL"

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
  return series.slice(-days);
};

/* ------------------------------------------------------
 * COMPUTE SUMMARY — STEP 6
 * ------------------------------------------------------ */

const computeSummary = (series) => {
  if (!series || series.length < 2) {
    return { totalValue: 0, percent: 0 };
  }

  const first = series[0].value;
  const last = series[series.length - 1].value;

  const percent = first > 0 ? ((last - first) / first) * 100 : 0;

  return {
    totalValue: last,
    percent,
  };
};

/* ------------------------------------------------------
 * ASSET SUMMARY (HEADER + CHART INPUT) — STEP 5
 * ------------------------------------------------------ */

const buildAssetSummary = async () => {
  // ALWAYS fetch ALL, slice locally
  const rawSeries = await getAssetEquityByRange("ALL");

  const slicedSeries = sliceSeriesByRange(rawSeries, activeRange);

  const { totalValue, percent } = computeSummary(slicedSeries);

  return {
    // HEADER
    totalValue: formatCurrency(totalValue),
    percent,

    // CHART
    chart: {
      series: slicedSeries.map((d) => d.value),
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

  const total = list.reduce((s, a) => s + a.amount, 0);

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
