import {
  getAssetEquityByRange,
  getAccountsWithSummary,
  getAccounts,
  getAutotradersByAccount,
} from "./dataAccess.js";

/* ----------------------------------
 * Helpers
 * ---------------------------------- */

const formatCurrency = (value, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

/* ----------------------------------
 * Asset Summary (TOTAL PERFORMANCE)
 * ---------------------------------- */

const buildAssetSummary = async () => {
  const ranges = ["7D", "30D", "90D", "ALL"];

  const rangeMap = Object.fromEntries(
    await Promise.all(
      ranges.map(async (r) => [r, await getAssetEquityByRange(r)])
    )
  );

  const activeRange = "7D";
  const active = rangeMap[activeRange];

  const buildChange = (series) => {
    if (!Array.isArray(series) || series.length < 2) return "—";
    const first = series[0];
    const last = series[series.length - 1];
    if (first <= 0) return "—";
    const pct = ((last - first) / first) * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  };

  return {
    totalBalance: formatCurrency(
      active.series.length
        ? active.series[active.series.length - 1]
        : 0
    ),

    change: buildChange(active.series),

    chart: {
      activeRange,
      labels: active.labels,
      ranges: Object.fromEntries(
        ranges.map((r) => [r, rangeMap[r].series])
      ),
    },
  };
};

/* ----------------------------------
 * Accounts Summary
 * ---------------------------------- */

const buildAccountsSummary = async () => {
  const accounts = await getAccountsWithSummary();

  const list = accounts
    .map((account) => ({
      name: account.account_name || account.account_id,
      amount: Number(account.totalValueUsd || 0),
      value: formatCurrency(account.totalValueUsd || 0),
      brandColor: "",
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalAmount = list.reduce((sum, acc) => sum + acc.amount, 0);

  return {
    total: formatCurrency(totalAmount),
    accounts: list,
  };
};

/* ----------------------------------
 * Top Autotraders
 * ---------------------------------- */

const buildTopAutotraders = async () => {
  const accounts = await getAccounts();

  const autotraders = (
    await Promise.all(
      accounts.map((account) =>
        getAutotradersByAccount(account.account_id)
      )
    )
  ).flat();

  return autotraders
    .map((autotrader) => {
      const pnlValue = Number(autotrader.pnl_percent || 0);
      const sign = pnlValue > 0 ? "+" : pnlValue < 0 ? "-" : "";

      return {
        name: autotrader.tradingPlanName || "Autotrader",
        pair: "—",
        runtime: autotrader.status === "active" ? "Running" : "Stopped",
        pnl: `${sign}${Math.abs(pnlValue).toFixed(1)}%`,
        sortKey: Math.abs(pnlValue),
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 3);
};

/* ----------------------------------
 * Trade History (DISABLED)
 * ---------------------------------- */

const buildTradeHistory = async () => [];

/* ----------------------------------
 * Alerts (STATIC)
 * ---------------------------------- */

const alerts = [
  {
    title: "Autotrader Error",
    message: "Insufficient balance for USDT / AVAX",
    type: "Action Needed",
    time: "2 minutes ago",
    cta: "View Autotrader",
    alertState: "error",
    alertStatus: "active",
  },
  {
    title: "Margin Warning",
    message: "Maintenance margin below 20% on BTC / USDT",
    type: "Warning",
    time: "10 minutes ago",
    cta: "Review Margin",
    alertState: "error",
    alertStatus: "active",
  },
];

/* ----------------------------------
 * Dashboard Data (ENTRY POINT)
 * ---------------------------------- */

export const fetchDashboardData = async () => {
  const [
    assetSummary,
    accountsSummary,
    topAutotraders,
    tradeHistory,
  ] = await Promise.all([
    buildAssetSummary(),
    buildAccountsSummary(),
    buildTopAutotraders(),
    buildTradeHistory(),
  ]);

  return {
    assetSummary,
    accountsSummary,
    alerts,
    topAutotraders,
    tradeHistory,
  };
};
