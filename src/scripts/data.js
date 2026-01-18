import {
  getAccountsWithSummary,
  getTradeHistory,
  getAccounts,
  getAutotradersByAccount,
  loadTrades,
} from "./dataAccess.js";
import { getAssetSummary } from "../data/assetSummary.js";
import { deriveTradeHistory } from "./derive/deriveTradeHistory.js";

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

export const buildAssetSummary = async (timeframe = "7D") => {
  const normalizedTimeframe = String(timeframe || "7D").toUpperCase();
  const summary = await getAssetSummary(normalizedTimeframe);
  const totalBalance = Number(summary.total_value_usd || 0);
  const normalized = summary.timeframe || normalizedTimeframe;
  const activeRange = normalized === "ALL" ? "all" : normalized;
  const seriesValues = Array.isArray(summary.series)
    ? summary.series.map((point) => ({
        date: point.date,
        value: Number(point.value || 0),
      }))
    : [];
  const changeValue = Number(summary.percentage_change || 0);
  const changePrefix = changeValue > 0 ? "+" : changeValue < 0 ? "-" : "";
  const changeLabel =
    normalized === "ALL" ? "vs all time" : `vs last ${normalized.toLowerCase()}`;

  return {
    totalBalance: formatCurrency(totalBalance, 2),
    totalValueUsd: totalBalance,
    change: `${changePrefix}${Math.abs(changeValue).toFixed(1)}%`,
    changeLabel,
    chart: {
      activeRange,
      series: seriesValues,
      fullSeries: seriesValues,
      ranges: {
        [normalized]: seriesValues,
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
