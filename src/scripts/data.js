import {
  getAssetEquitySeries,
  getAllStartDate,
  getLatestDate,
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
  // ----- PREDEFINED RANGES -----
  const seriesMap = {
    "7D": await getAssetEquitySeries(7),
    "30D": await getAssetEquitySeries(30),
    "90D": await getAssetEquitySeries(90),
  };

  // ----- ALL RANGE (FROM OLDEST ACCOUNT) -----
  const allStartDate = await getAllStartDate();
  const latestDate = await getLatestDate();

  if (allStartDate && latestDate) {
    const daysAll =
      Math.ceil(
        (new Date(latestDate) - new Date(allStartDate)) /
          (1000 * 60 * 60 * 24)
      ) + 1;

    seriesMap["ALL"] =
      daysAll > 0 ? await getAssetEquitySeries(daysAll) : [];
  } else {
    seriesMap["ALL"] = [];
  }

  // ----- % CHANGE CALCULATOR -----
  const buildChange = (series) => {
    if (!series || series.length < 2) return "—";

    const first = Number(series[0].value || 0);
    const last = Number(series[series.length - 1].value || 0);

    if (first <= 0) return "—";

    const pct = ((last - first) / first) * 100;
    return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  };

  // ----- DEFAULT ACTIVE RANGE -----
  const activeRange = "7D";
  const activeSeries = seriesMap[activeRange] || [];

  return {
    totalBalance: formatCurrency(
      activeSeries.length
        ? activeSeries[activeSeries.length - 1].value
        : 0
    ),

    // ⬅️ WAJIB: nilai change AKTIF (dipakai UI)
    change: buildChange(activeSeries),

    // ⬅️ dipakai saat user ganti range
    changeByRange: {
      "7D": buildChange(seriesMap["7D"]),
      "30D": buildChange(seriesMap["30D"]),
      "90D": buildChange(seriesMap["90D"]),
      "ALL": buildChange(seriesMap["ALL"]),
    },

    // ⬅️ UI yang tentukan wording
    changeLabel: "vs previous period",

    chart: {
      activeRange,
      labels: activeSeries.map((p) => p.date),
      ranges: {
        "7D": seriesMap["7D"].map((p) => p.value),
        "30D": seriesMap["30D"].map((p) => p.value),
        "90D": seriesMap["90D"].map((p) => p.value),
        "ALL": seriesMap["ALL"].map((p) => p.value),
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

  const autotradersByAccount = await Promise.all(
    accounts.map((account) =>
      getAutotradersByAccount(account.account_id)
    )
  );

  const autotraders = autotradersByAccount.flat();

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

const buildTradeHistory = async () => {
  return [];
};

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
