const ACCOUNT_ASSET_DAILY_INDEX = "/data/account_assets_daily/index.json";

const normalizeAccountAssetDailyEntry = (date, entry) => ({
  date,
  accounts: (entry?.accounts || []).map((account) => ({
    account_id: account.account_id,
    assets: (account.assets || []).map((asset) => ({
      asset_id: asset.asset_id,
      value_usd:
        typeof asset.value_usd === "number"
          ? asset.value_usd
          : typeof asset.value === "number"
          ? asset.value
          : 0,
    })),
  })),
});

export const fetchAccountAssetDaily = async () => {
  try {
    const response = await fetch(ACCOUNT_ASSET_DAILY_INDEX);
    if (!response.ok) {
      throw new Error("Failed to load account asset daily index");
    }
    const filenames = await response.json();
    const sorted = [...filenames].sort();
    const recent = sorted.slice(-120);
    const entries = await Promise.all(
      recent.map(async (filename) => {
        const dayResponse = await fetch(`/data/account_assets_daily/${filename}`);
        if (!dayResponse.ok) {
          return null;
        }
        const raw = await dayResponse.json();
        const date = filename.replace(/\.json$/, "");
        return normalizeAccountAssetDailyEntry(date, raw);
      })
    );
    return entries.filter(Boolean);
  } catch (error) {
    console.warn(error);
    return [];
  }
};

const buildAccountAssetDaily = (points, start, end) => {
  const totals = buildSeries(points, start, end);
  const now = new Date();
  return totals.map((total, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (totals.length - 1 - index));
    const primary = total * 0.62;
    const secondary = total - primary;
    return {
      date: date.toISOString().slice(0, 10),
      accounts: [
        {
          assets: [
            { value_usd: Number((primary * 0.68).toFixed(2)) },
            { value_usd: Number((primary * 0.32).toFixed(2)) },
          ],
        },
        {
          assets: [
            { value_usd: Number((secondary * 0.54).toFixed(2)) },
            { value_usd: Number((secondary * 0.46).toFixed(2)) },
          ],
        },
      ],
    };
  });
};

export const dashboardData = {
  assetSummary: {
    totalBalance: "$12,430",
    change: "+3.4%",
    changeLabel: "vs last 7 days",
    activeRange: "7D",
    accountAssetDaily: [],
  },
  exchangesSummary: {
    total: "$21,240",
    exchanges: [
      { name: "Binance", value: "$9,150", amount: 9150 },
      { name: "Bybit", value: "$6,050", amount: 6050 },
      { name: "Kraken", value: "$3,150", amount: 3150 },
      { name: "Coinbase", value: "$2,400", amount: 2400 },
      { name: "Others", value: "$490", amount: 490 },
    ],
  },
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
  ],
  topAutotraders: [
    {
      name: "alexayu",
      pair: "USDT / AVAX",
      runtime: "Running 12d 4h",
      pnl: "+9.2%",
    },
    {
      name: "testing 3",
      pair: "USDT / BTC",
      runtime: "Running 31d 16h",
      pnl: "+7.8%",
    },
    {
      name: "aklayu",
      pair: "USDT / AVAX",
      runtime: "Running 44d 6h",
      pnl: "+5.5%",
    },
  ],
  tradeHistory: [
    {
      pair: ["avax", "usdt"],
      action: "BUY",
      status: "FILLED",
      profitUsd: "+$124.30",
      profitPct: "+2.1%",
      profitState: "positive",
      time: "2m",
    },
    {
      pair: ["btc", "usdt"],
      action: "SELL",
      status: "FAILED",
      profitUsd: "–",
      profitPct: "–",
      profitState: "neutral",
      time: "18m",
    },
    {
      pair: ["eth", "usdt"],
      action: "SELL",
      status: "FILLED",
      profitUsd: "-$48.90",
      profitPct: "-0.6%",
      profitState: "negative",
      time: "1h",
    },
    {
      pair: ["sol", "usdt"],
      action: "CANCEL",
      status: "CANCELLED",
      profitUsd: "–",
      profitPct: "–",
      profitState: "neutral",
      time: "3h",
    },
    {
      pair: ["ada", "usdt"],
      action: "BUY",
      status: "ERROR",
      profitUsd: "–",
      profitPct: "–",
      profitState: "neutral",
      time: "7h",
    },
    {
      pair: ["btc", "usdt"],
      action: "CANCEL",
      status: "CANCELLED",
      profitUsd: "+$0.00",
      profitPct: "0.0%",
      profitState: "neutral",
      time: "1d",
    },
  ],
};

export const fetchDashboardData = () =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve(structuredClone(dashboardData));
    }, 700);
  });
