// src/scripts/data.js
// ======================================================
// DATA ORCHESTRATION LAYER (LOCKED)
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
 * STATE (STEP 6 — LOCKED)
 * ------------------------------------------------------ */

let activeRange = "ALL";

/* ------------------------------------------------------
 * COMPUTE HELPERS (STEP 7 PREP)
 * ------------------------------------------------------ */

const computeChangePercent = (series = []) => {
  if (series.length < 2) return "—";

  const first = series[0] ?? 0;
  const last = series[series.length - 1] ?? 0;

  if (first <= 0) return "—";

  const percent = ((last - first) / first) * 100;
  return `${percent.toFixed(2)}%`;
};

/* ------------------------------------------------------
 * ASSET SUMMARY (SINGLE RANGE ONLY)
 * ------------------------------------------------------ */

const buildAssetSummary = async (range) => {
  const { series = [], labels = [] } = await getAssetEquityByRange(range);

  const lastValue = series.length
    ? series[series.length - 1]
    : 0;

  return {
    totalBalance: formatCurrency(lastValue),
    change: computeChangePercent(series),
    chart: {
      series,
      labels,
    },
  };
};

/* ------------------------------------------------------
 * STATE CONTROLLER (STEP 6 — LOCKED)
 * ------------------------------------------------------ */

export const setAssetRange = async (range) => {
  activeRange = range;
  return buildAssetSummary(activeRange);
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

  const total = list.reduce((sum, a) => sum + a.amount, 0);

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
 * DASHBOARD FETCH (SINGLE SOURCE OF TRUTH)
 * ------------------------------------------------------ */

export const fetchDashboardData = async () => {
  const [assetSummary, accountsSummary, topAutotraders] =
    await Promise.all([
      buildAssetSummary(activeRange),
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
