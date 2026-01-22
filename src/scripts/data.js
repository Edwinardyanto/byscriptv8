// src/scripts/data.js
// ======================================================
// DATA ORCHESTRATION LAYER (STEP 6 & 7 — LOCKED)
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
 * COMPUTE (STEP 7 — LOCKED)
 * ------------------------------------------------------ */

const computeSummary = (series = []) => {
  if (series.length < 2) {
    return { totalValue: 0, percent: 0 };
  }

  const first = series[0]?.value ?? 0;
  const last = series.at(-1)?.value ?? 0;

  const percent =
    first === 0 ? 0 : ((last - first) / first) * 100;

  return { totalValue: last, percent };
};

/* ------------------------------------------------------
 * ASSET SUMMARY (SINGLE ACTIVE RANGE ONLY)
 * ------------------------------------------------------ */

const buildAssetSummary = async (range) => {
  const { series = [], labels = [] } =
    await getAssetEquityByRange(range);

  const { totalValue, percent } = computeSummary(series);

  return {
    totalValue: formatCurrency(totalValue),
    percent,
    chart: {
      series,
      labels,
    },
  };
};

/* ------------------------------------------------------
 * RANGE CONTROLLER (STEP 6)
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
