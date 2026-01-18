import { loadTrades, loadAccounts, loadAutotraders } from "../dataAccess.js";
import { buildAssetSummary, alerts } from "../data.js";
import {
  adaptTradeHistoryForUI,
  adaptAccountsSummary,
  adaptTopAutotraders,
} from "../adapters/dashboardAdapters.js";

const parseAccountValue = (value) => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value !== "string") {
    return 0;
  }
  const numeric = Number(value.replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
};

export const fetchDashboardData = async () => {
  const [assetSummary, trades, accounts, autotraders] = await Promise.all([
    buildAssetSummary(),
    loadTrades(),
    loadAccounts(),
    loadAutotraders(),
  ]);

  const tradeRows = adaptTradeHistoryForUI(trades);
  const accountRows = adaptAccountsSummary(accounts, trades);
  const topAutotraders = adaptTopAutotraders(autotraders);
  const totalAccountsValue = accountRows.reduce(
    (sum, account) => sum + parseAccountValue(account.value),
    0
  );

  return {
    assetSummary,
    accountsSummary: {
      total: `$${totalAccountsValue}`,
      accounts: accountRows.map((account) => ({
        ...account,
        amount: parseAccountValue(account.value),
        brandColor: "",
      })),
    },
    alerts,
    topAutotraders,
    tradeHistory: tradeRows,
  };
};
