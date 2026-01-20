import {
  getAccountsWithSummary,
  getAccounts,
  getAccountAssets,
  getAutotradersByAccount,
  getAssetEquitySeries,
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
  const series7D = await getAssetEquitySeries(7);
  const series30D = await getAssetEquitySeries(30);
  const series90D = await getAssetEquitySeries(90);

  const latestValue = series7D.length
    ? series7D[series7D.length - 1].value
    : 0;

  return {
    totalBalance: formatCurrency(latestValue),
    change: "—",
    changeLabel: "vs previous period",
    chart: {
      activeRange: "7D",
      labels: series7D.map((p) => p.date),
      ranges: {
        "7D": series7D.map((p) => p.value),
        "30D": series30D.map((p) => p.value),
        "90D": series90D.map((p) => p.value),
      },
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
      brandColor: "", // reserved for future asset distribution
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

  const autotradersByAccount = await Promise.all(
    accounts.map((account) =>
      getAutotradersByAccount(account.account_id)
    )
  );

  const autotraders = autotradersByAccount.flat();

  // Trade history intentionally disabled → safe placeholders
  return autotraders
    .map((autotrader) => {
      const pnlValue = Number(autotrader.pnl_percent || 0);
      const pnlPrefix =
        pnlValue > 0 ? "+" : pnlValue < 0 ? "-" : "";

      return {
        name: autotrader.tradingPlanName || "Autotrader",
        pair: "—",
        runtime: autotrader.status === "active" ? "Running" : "Stopped",
        pnl: `${pnlPrefix}${Math.abs(pnlValue).toFixed(1)}%`,
        sortKey: Math.abs(pnlValue),
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 3);
};

/* ----------------------------------
 * Trade History (DEPRECATED)
 * ---------------------------------- */

const buildTradeHistory = async () => {
  // Trade history is intentionally disabled
  return [];
};

/* ----------------------------------
 * Alerts (STATIC FOR NOW)
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
 * Dashboard Data (STATE ENTRY POINT)
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
