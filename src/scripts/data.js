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

const getAssetBrandColor = (asset) =>
  asset?.brand_color || asset?.asset?.brand_color || "";

const getTopAssetColor = (assets = []) => {
  if (!Array.isArray(assets) || assets.length === 0) {
    return "";
  }
  const topAsset = assets.reduce((best, current) => {
    const currentValue = Number(current.usd_value || 0);
    const bestValue = Number(best?.usd_value || 0);
    return currentValue > bestValue ? current : best;
  }, assets[0]);
  return getAssetBrandColor(topAsset);
};

const buildAccountsSummary = async () => {
  const accounts = await getAccountsWithSummary();
  const totalsByProvider = accounts.reduce((acc, account) => {
    const key = account.provider || "Unknown";
    if (!acc.has(key)) {
      acc.set(key, { amount: 0, assets: [] });
    }
    const current = acc.get(key);
    current.amount += Number(account.totalValueUsd || 0);
    current.assets.push(...account.assets);
    return acc;
  }, new Map());

  const accountsSummaryList = Array.from(totalsByProvider.entries())
    .map(([name, details]) => ({
      name,
      value: formatCurrency(details.amount),
      amount: details.amount,
      brandColor: getTopAssetColor(details.assets),
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalAmount = accountsSummaryList.reduce((sum, account) => sum + account.amount, 0);

  return {
    total: formatCurrency(totalAmount),
    accounts: accountsSummaryList,
  };
};

export const buildAssetSummary = async () => {
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

export const alerts = [
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
