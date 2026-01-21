// src/scripts/data.js
import {
  getAssetEquityByRange,
  getAccountsWithSummary,
  getAccounts,
  getAutotradersByAccount,
} from "./dataAccess.js";

const formatCurrency = (value, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const buildAssetSummary = async () => {
  const ranges = ["7D", "30D", "90D", "ALL"];
  const rangeMap = Object.fromEntries(
    await Promise.all(ranges.map(async (r) => [r, await getAssetEquityByRange(r)]))
  );

  const activeRange = "7D";
  const active = rangeMap[activeRange];

  const first = active.series[0] || 0;
  const last = active.series[active.series.length - 1] || 0;
  const change =
    first > 0 ? `${(((last - first) / first) * 100).toFixed(2)}%` : "—";

  return {
    totalBalance: formatCurrency(last),
    change,
    chart: {
      activeRange,
      labels: active.labels,
      ranges: Object.fromEntries(ranges.map((r) => [r, rangeMap[r].series])),
    },
  };
};

const buildAccountsSummary = async () => {
  const accounts = await getAccountsWithSummary();
  const list = accounts.map((a) => ({
    name: a.account_name || a.account_id,
    amount: Number(a.totalValueUsd || 0),
    value: formatCurrency(a.totalValueUsd || 0),
  }));

  const total = list.reduce((s, a) => s + a.amount, 0);
  return { total: formatCurrency(total), accounts: list };
};

const buildTopAutotraders = async () => {
  const accounts = await getAccounts();
  const traders = (
    await Promise.all(accounts.map((a) => getAutotradersByAccount(a.account_id)))
  ).flat();

  return traders.slice(0, 3).map((t) => ({
    name: t.tradingPlanName || "Autotrader",
    runtime: t.status === "active" ? "Running" : "Stopped",
    pnl: "—",
  }));
};

export const fetchDashboardData = async () => {
  const [assetSummary, accountsSummary, topAutotraders] = await Promise.all([
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
