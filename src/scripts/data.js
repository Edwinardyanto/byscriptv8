import {
  getAccountsWithSummary,
  getTradeHistory,
  getAccounts,
  getAccountAssets,
  getAutotradersByAccount,
} from "./dataAccess.js";

const buildSeries = (points, start, end) => {
  const trend = (end - start) / Math.max(points - 1, 1);
  return Array.from({ length: points }, (_, index) => {
    const base = start + trend * index;
    const variance = Math.sin(index / 3.5) * 140 + Math.sin(index / 11) * 70;
    return Math.round(base + variance);
  });
};

const formatCurrency = (value, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

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

const buildAccountsSummary = async () => {
  const accounts = await getAccountsWithSummary();
  const totalsByProvider = accounts.reduce((acc, account) => {
    const key = account.provider || "Unknown";
    const current = acc.get(key) || 0;
    acc.set(key, current + Number(account.totalValueUsd || 0));
    return acc;
  }, new Map());

  const accountsSummaryList = Array.from(totalsByProvider.entries())
    .map(([name, amount]) => ({
      name,
      value: formatCurrency(amount),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalAmount = accountsSummaryList.reduce((sum, account) => sum + account.amount, 0);

  return {
    total: formatCurrency(totalAmount),
    accounts: accountsSummaryList,
  };
};

const buildAssetSummary = async () => {
  const accounts = await getAccounts();
  const accountValues = await Promise.all(
    accounts.map(async (account) => ({
      accountId: account.account_id,
      value: await getAccountAssets(account.account_id),
    }))
  );
  const totalBalance = accountValues.reduce((sum, entry) => {
    const accountTotal = entry.value.reduce((sub, asset) => sub + Number(asset.usd_value || 0), 0);
    return sum + accountTotal;
  }, 0);

  const startValue = Math.max(totalBalance * 0.7, totalBalance - 2500);

  return {
    totalBalance: formatCurrency(totalBalance),
    change: "+3.4%",
    changeLabel: "vs last 7 days",
    chart: {
      activeRange: "7D",
      fullSeries: buildSeries(120, startValue, totalBalance),
      ranges: {
        "7D": buildSeries(7, startValue * 0.9, totalBalance),
        "30D": buildSeries(30, startValue * 0.8, totalBalance),
        "90D": buildSeries(90, startValue * 0.7, totalBalance),
      },
    },
  };
};

const buildTopAutotraders = async () => {
  const accounts = await getAccounts();
  const autotradersByAccount = await Promise.all(
    accounts.map((account) => getAutotradersByAccount(account.account_id))
  );
  const autotraders = autotradersByAccount.flat();
  const trades = await getTradeHistory();
  const tradesByAutotrader = trades.reduce((acc, trade) => {
    if (!acc.has(trade.autotrader_id)) {
      acc.set(trade.autotrader_id, trade);
    }
    return acc;
  }, new Map());

  const now = Date.now();

  return autotraders
    .map((autotrader) => {
      const trade = tradesByAutotrader.get(autotrader.autotrader_id);
      const assetSymbol = trade?.assetSymbol || "BTC";
      const runtimeMs = Math.max(now - new Date(autotrader.created_at).getTime(), 0);
      const runtimeDays = Math.floor(runtimeMs / (1000 * 60 * 60 * 24));
      const runtimeHours = Math.floor((runtimeMs / (1000 * 60 * 60)) % 24);
      const runtimeLabel = `${autotrader.is_running ? "Running" : "Stopped"} ${runtimeDays}d ${runtimeHours}h`;
      const pnlValue = Number(autotrader.pnl_percent || 0);
      const pnlPrefix = pnlValue > 0 ? "+" : pnlValue < 0 ? "-" : "";

      return {
        name: autotrader.tradingPlanName || "Autotrader",
        pair: `${assetSymbol} / USDT`,
        runtime: runtimeLabel,
        pnl: `${pnlPrefix}${Math.abs(pnlValue).toFixed(1)}%`,
        sortKey: Math.abs(pnlValue),
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 3);
};

const buildTradeHistory = async () => {
  const trades = await getTradeHistory({ limit: 6 });

  return trades.map((trade) => {
    const pnl = Number(trade.pnl_usd || 0);
    const profitState = pnl > 0 ? "positive" : pnl < 0 ? "negative" : "neutral";
    const profitUsd = pnl === 0 ? "–" : `${pnl > 0 ? "+" : "-"}$${Math.abs(pnl).toFixed(2)}`;
    const profitPct = trade.valueUsd
      ? `${pnl >= 0 ? "+" : "-"}${Math.abs((pnl / trade.valueUsd) * 100).toFixed(1)}%`
      : "–";
    const action = trade.side?.toUpperCase() === "BUY" ? "BUY" : "SELL";
    const status = trade.result === "loss" ? "FAILED" : "FILLED";
    return {
      pair: [trade.assetSymbol?.toLowerCase() || "btc", "usdt"],
      action,
      status,
      profitUsd,
      profitPct,
      profitState,
      time: formatRelativeTime(trade.executedAt),
    };
  });
};

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
  {
    title: "Autotrader Paused",
    message: "Trading paused for ETH / USDT due to volatility",
    type: "Action Needed",
    time: "35 minutes ago",
    cta: "Resume Autotrader",
    alertState: "error",
    alertStatus: "active",
  },
  {
    title: "Deposit Confirmed",
    message: "$1,200 USDT deposit confirmed",
    type: "Update",
    time: "1 hour ago",
    cta: "View Wallet",
    alertState: "error",
    alertStatus: "active",
  },
  {
    title: "Price Alert",
    message: "SOL reached $182.40 target",
    type: "Update",
    time: "3 hours ago",
    cta: "View Chart",
    alertState: "error",
    alertStatus: "active",
  },
  {
    title: "Risk Review Needed",
    message: "One or more positions require review",
    type: "Action Needed",
    time: "Yesterday",
    cta: "Review Positions",
    alertState: "error",
    alertStatus: "active",
  },
];

export const fetchDashboardData = async () => {
  const [assetSummary, accountsSummary, topAutotraders, tradeHistory] = await Promise.all([
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
