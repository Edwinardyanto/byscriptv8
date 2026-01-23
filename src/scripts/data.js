// src/scripts/data.js
// ======================================================
// DATA ORCHESTRATION LAYER (STEP 4–7 — LOCKED)
// ======================================================

import {
  getEquityDaily,
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

let equityDaily = null;      // FULL daily equity (loaded once)
let activeRange = "ALL";    // "7D" | "30D" | "90D" | "ALL"

/* ------------------------------------------------------
 * INIT (STEP 2 — LOAD ONCE)
 * ------------------------------------------------------ */

export const initDashboardData = async () => {
  if (equityDaily !== null) return;
  equityDaily = await getEquityDaily();
};

/* ------------------------------------------------------
 * INTERNAL GUARD
 * ------------------------------------------------------ */

const requireEquity = () => {
  if (!Array.isArray(equityDaily)) {
    throw new Error(
      "equityDaily not initialized. Call initDashboardData() first."
    );
  }
};

/* ------------------------------------------------------
 * STEP 3 — FILTER TIMEFRAME (DATA LAYER)
 * ------------------------------------------------------ */

const filterByRange = (data, range) => {
  const days =
    range === "7D" ? 7 :
    range === "30D" ? 30 :
    range === "90D" ? 90 :
    data.length; // ALL

  return data.slice(-days);
};

/* ------------------------------------------------------
 * STEP 4 — COMPUTE TOTAL & PERCENT
 * ------------------------------------------------------ */

const computeSummary = (series) => {
  if (series.length < 2) {
    return { totalValue: 0, percent: 0 };
  }

  const first = series[0]?.value ?? 0;
  const last  = series.at(-1)?.value ?? 0;

  const percent =
    first > 0 ? ((last - first) / first) * 100 : 0;

  return { totalValue: last, percent };
};

/* ------------------------------------------------------
 * STEP 5 & 6 — ASSET SUMMARY (HEADER + CHART INPUT)
 * ------------------------------------------------------ */

const buildAssetSummary = () => {
  requireEquity();

  const series = filterByRange(equityDaily, activeRange);
  const { totalValue, percent } = computeSummary(series);

  return {
    // HEADER DATA (STEP 5)
    totalValue: formatCurrency(totalValue),
    percent,

    // CHART DATA (STEP 6)
    chart: {
      series: series.map(d => d.value),
      labels: series.map(d => d.date),
    },
  };
};

/* ------------------------------------------------------
 * STEP 7 — RANGE CONTROLLER (TRIGGER RECOMPUTE)
 * ------------------------------------------------------ */

export const setAssetRange = (range) => {
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
  await initDashboardData();

  const [accountsSummary, topAutotraders] = await Promise.all([
    buildAccountsSummary(),
    buildTopAutotraders(),
  ]);

  return {
    assetSummary: buildAssetSummary(), // STEP 4–6 applied
    accountsSummary,
    topAutotraders,
    alerts: [],
    tradeHistory: [],
  };
};
