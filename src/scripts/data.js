import {
  getAccounts,
  getAccountsWithSummary,
  getAutotradersByAccount,
  getTradeHistory,
} from "./dataAccess.js";

const buildSeries = (points, start, end) => {
  const trend = (end - start) / Math.max(points - 1, 1);
  return Array.from({ length: points }, (_, index) => {
    const base = start + trend * index;
    const variance = Math.sin(index / 3.5) * 140 + Math.sin(index / 11) * 70;
    return Math.round(base + variance);
  });
};

const formatCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatCurrencyDetailed = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatPercent = (value) => {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
};

const formatRelativeTime = (date) => {
  if (!date) {
    return "--";
  }
  const now = Date.now();
  const diffMs = now - date.getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const formatRuntime = (date, isRunning) => {
  if (!date) {
    return isRunning ? "Running" : "Stopped";
  }
  const diffMs = Date.now() - date.getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  const remainderHours = hours % 24;
  const label = isRunning ? "Running" : "Stopped";
  return `${label} ${days}d ${remainderHours}h`;
};

const buildAssetSummary = async () => {
  const { total_value: totalValue } = await getAccountsWithSummary();
  const now = new Date();
  const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recentTrades = await getTradeHistory({ startDate });
  const recentPnl = recentTrades.reduce(
    (sum, trade) => sum + Number(trade.pnl_usd || 0),
    0
  );
  const changePercent = totalValue ? (recentPnl / totalValue) * 100 : 0;
  const baseValue = totalValue || 0;
  const startValue = baseValue * 0.68;
  const midValue = baseValue * 0.82;
  const endValue = baseValue;

  return {
    totalBalance: formatCurrency.format(baseValue),
    change: formatPercent(changePercent),
    changeLabel: "vs last 30 days",
    chart: {
      activeRange: "7D",
      fullSeries: buildSeries(120, startValue, endValue),
      ranges: {
        "7D": buildSeries(7, midValue, endValue),
        "30D": buildSeries(30, baseValue * 0.74, endValue),
        "90D": buildSeries(90, startValue, endValue),
      },
    },
  };
};

const buildAccountsSummary = async () => {
  const { total_value: totalValue, accounts } = await getAccountsWithSummary();
  return {
    total: formatCurrency.format(totalValue || 0),
    accounts: accounts.map((account) => ({
      name: account.provider,
      value: formatCurrency.format(account.total_value || 0),
      amount: account.total_value || 0,
    })),
  };
};

const buildTopAutotraders = async () => {
  const accounts = await getAccounts();
  const autotradersList = (
    await Promise.all(accounts.map((account) => getAutotradersByAccount(account.account_id)))
  ).flat();
  const trades = await getTradeHistory();
  const latestTradeByAutotrader = new Map();
  trades.forEach((trade) => {
    if (!latestTradeByAutotrader.has(trade.autotrader_id)) {
      latestTradeByAutotrader.set(trade.autotrader_id, trade);
    }
  });

  return autotradersList
    .slice()
    .sort((a, b) => Number(b.pnl_percent || 0) - Number(a.pnl_percent || 0))
    .slice(0, 3)
    .map((autotrader) => {
      const trade = latestTradeByAutotrader.get(autotrader.autotrader_id);
      const assetSymbol = trade?.asset?.symbol || "BTC";
      const pair = `${assetSymbol} / USDT`;
      return {
        name: autotrader.plan?.name || autotrader.autotrader_id,
        pair,
        runtime: formatRuntime(
          autotrader.created_at ? new Date(autotrader.created_at) : null,
          autotrader.is_running
        ),
        pnl: formatPercent(Number(autotrader.pnl_percent || 0)),
      };
    });
};

const buildTradeHistorySummary = async () => {
  const trades = await getTradeHistory({ limit: 6 });
  return trades.map((trade) => {
    const asset = trade.asset?.symbol?.toLowerCase() || "btc";
    const profit = Number(trade.pnl_usd || 0);
    const profitState = profit > 0 ? "positive" : profit < 0 ? "negative" : "neutral";
    const profitPct = trade.value_usd
      ? `${profit > 0 ? "+" : profit < 0 ? "-" : ""}${Math.abs(
          (profit / trade.value_usd) * 100
        ).toFixed(1)}%`
      : "–";
    return {
      pair: [asset, "usdt"],
      action: trade.side?.toUpperCase() === "SELL" ? "SELL" : "BUY",
      status: "FILLED",
      profitUsd:
        profit === 0
          ? "–"
          : `${profit > 0 ? "+" : "-"}${formatCurrencyDetailed.format(Math.abs(profit))}`,
      profitPct,
      profitState,
      time: formatRelativeTime(trade.executed_at_date),
    };
  });
};

export const fetchDashboardData = async () => {
  const [assetSummary, accountsSummary, topAutotraders, tradeHistory] =
    await Promise.all([
      buildAssetSummary(),
      buildAccountsSummary(),
      buildTopAutotraders(),
      buildTradeHistorySummary(),
    ]);

  return {
    assetSummary,
    accountsSummary,
    alerts: [
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
    ],
    topAutotraders,
    tradeHistory,
  };
};
