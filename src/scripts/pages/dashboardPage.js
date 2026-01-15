import { loadTrades, loadAccounts, loadAutotraders } from "../dataAccess.js";
import { deriveDashboardData } from "../derive/index.js";
import { buildAssetSummary, alerts } from "../data.js";

const formatRelativeTime = (timestamp) => {
  const now = Date.now();
  const diffMs = Math.max(now - timestamp.getTime(), 0);
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 60) {
    return `${minutes || 1}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const buildAccountsSummaryState = (summary, accounts) => {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const totalsByProvider = summary.reduce((acc, item) => {
    const account = accounts.find((entry) => entry.account_id === item.account_id);
    const key = account?.provider || account?.account_id || item.account_id || "Account";
    if (!acc.has(key)) {
      acc.set(key, 0);
    }
    acc.set(key, acc.get(key) + Number(item.value || 0));
    return acc;
  }, new Map());

  const accountsSummaryList = Array.from(totalsByProvider.entries())
    .map(([name, amount]) => ({
      name,
      value: formatter.format(amount),
      amount,
      brandColor: "",
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalAmount = accountsSummaryList.reduce((sum, account) => sum + account.amount, 0);

  return {
    total: formatter.format(totalAmount),
    accounts: accountsSummaryList,
  };
};

const buildTradeHistoryState = (tradeHistory) =>
  tradeHistory.map((trade) => ({
    ...trade,
    time: trade.time ? formatRelativeTime(new Date(trade.time)) : "–",
  }));

export const fetchDashboardData = async () => {
  const [assetSummary, trades, accounts, autotraders] = await Promise.all([
    buildAssetSummary(),
    loadTrades(),
    loadAccounts(),
    loadAutotraders(),
  ]);

  const derived = deriveDashboardData(trades, accounts, autotraders);

  return {
    assetSummary,
    accountsSummary: buildAccountsSummaryState(derived.accountsSummary, accounts),
    alerts,
    topAutotraders: derived.topAutotraders,
    tradeHistory: buildTradeHistoryState(derived.tradeHistory),
  };
};
