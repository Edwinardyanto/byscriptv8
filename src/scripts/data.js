// src/scripts/data.js
// ======================================================
// DATA ORCHESTRATION LAYER (STEP 4–7 — LOCKED)
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
 * STATE (SINGLE SOURCE OF TRUTH)
 * ------------------------------------------------------ */

let activeRange = "ALL"; // "7D" | "30D" | "90D" | "ALL"

/* ------------------------------------------------------
 * COMPUTE SUMMARY
 * ------------------------------------------------------ */

const computeSummary = (series) => {
  if (!series || series.length < 2) {
    return { totalValue: 0, percent: 0 };
  }

  const first = series[0]?.value ?? 0;
  const last = series.at(-1)?.value ?? 0;

  const percent =
    first > 0 ? ((last - first) / first) * 100 : 0;

  return {
    totalValue: last,
    percent,
  };
};

/* ------------------------------------------------------
 * ASSET SUMMARY (HEADER + CHART INPUT)
 * ------------------------------------------------------ */

const buildAssetSummary = async () => {
  const series = await getAssetEquityByRange(activeRange);

  const { totalValue, percent } = computeSummary(series);

  return {
    // HEADER
    totalValue: formatCurrency(totalValue),
    percent,

    // CHART
    chart: {
      series: series.map((d) => d.value),
      labels: series.map((d) => d.date),
    },
  };
};

/* ------------------------------------------------------
 * RANGE CONTROLLER (TIMEFRAME PILLS)
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
