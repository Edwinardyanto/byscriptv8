// src/scripts/data.js

import {
  getAssetEquityByRange,
  getAccountsWithSummary,
  getAutotraders,
  getTradingPlans,
  getTrades,
  getAssets,
} from "./dataAccess.js";

/* ------------------------------------------------------
 * Utils
 * ------------------------------------------------------ */

const formatCurrency = (value, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

/* ------------------------------------------------------
 * STATE (SINGLE SOURCE OF TRUTH)
 * ------------------------------------------------------ */

let activeRange = "7D";

export const setActiveRange = (range) => {
  activeRange = range;
};

export const getActiveRange = () => activeRange;

/* ------------------------------------------------------
 * RANGE CONFIG
 * ------------------------------------------------------ */

const RANGE_DAYS = {
  "7D": 7,
  "30D": 30,
  "90D": 90,
  ALL: "ALL",
};

const sliceSeriesByRange = (series = [], range) => {
  if (!series.length) return [];
  if (range === "ALL") return series;

  const days = RANGE_DAYS[range];
  if (!days) return series;

  return series.slice(-days);
};

/* ------------------------------------------------------
 * COMPUTE SUMMARY
 * ------------------------------------------------------ */

const computeSummary = (series) => {
  if (!series || series.length < 2) {
    return { totalValue: 0, percent: 0 };
  }

  const first = Number(series[0]?.equity_usd || 0);
  const last = Number(series[series.length - 1]?.equity_usd || 0);

  const percent = first > 0 ? ((last - first) / first) * 100 : 0;

  return { totalValue: last, percent };
};

/* ------------------------------------------------------
 * ASSET SUMMARY
 * ------------------------------------------------------ */

const buildAssetSummary = async () => {
  const rawSeries = await getAssetEquityByRange("ALL");
  const slicedSeries = sliceSeriesByRange(rawSeries, activeRange);

  const { totalValue, percent } = computeSummary(slicedSeries);

  return {
    totalValue: formatCurrency(totalValue),
    percent,
    chart: {
      series: slicedSeries.map((d) => Number(d.equity_usd || 0)),
      labels: slicedSeries.map((d) => d.date),
    },
  };
};

export const setAssetRange = async (range) => {
  activeRange = range;
  return buildAssetSummary();
};

/* ------------------------------------------------------
 * ACCOUNTS SUMMARY
 * ------------------------------------------------------ */

const buildAccountsSummary = async () => {
  const accounts = await getAccountsWithSummary();

  const list = accounts.map((a) => ({
    name: a.account_name || a.account_id,
    amount: Number(a.totalValueUsd || 0),
    value: formatCurrency(a.totalValueUsd || 0),
  }));

  const total = list.reduce((sum, x) => sum + x.amount, 0);

  return {
    total: formatCurrency(total),
    accounts: list,
  };
};

/* ------------------------------------------------------
 * TOP AUTOTRADERS
 * ------------------------------------------------------ */

const formatPct = (value, digits = 2) => {
  const n = Number(value || 0);
  return `${n.toFixed(digits)}%`;
};

const buildTopAutotraders = async () => {
  const [autotraders, plans, trades, assets] = await Promise.all([
    getAutotraders(),
    getTradingPlans(),
    getTrades(),
    getAssets(),
  ]);

  const planNameById = new Map(plans.map((p) => [p.plan_id, p.name || ""]));
  const assetSymbolById = new Map(
    assets.map((a) => [a.asset_id, a.asset_symbol || ""])
  );

  // Aggregate realized performance per autotrader (reduce_only only)
  const agg = new Map();

  for (const t of trades || []) {
    if (!t || !t.autotrader_id) continue;
    if (t.reduce_only !== true) continue;

    // engine-grade fields
    const qty = Math.abs(Number(t.size || 0));        // <-- size, not qty
    const price = Number(t.price_usd || 0);           // <-- price_usd, not price
    const notional = qty * price;

    const pnlUsd = Number(t.pnl_usd || 0);

    const cur = agg.get(t.autotrader_id) || {
      pnlUsd: 0,
      notionalClosed: 0,
      closeCount: 0,
      lastFilledAt: 0,
    };

    cur.pnlUsd += pnlUsd;
    cur.notionalClosed += notional;
    cur.closeCount += 1;

    // filled_at is unix seconds number in your dataset
    const filledAtMs =
      typeof t.filled_at === "number"
        ? t.filled_at * 1000
        : Date.parse(t.filled_at || "");
    if (!Number.isNaN(filledAtMs)) cur.lastFilledAt = Math.max(cur.lastFilledAt, filledAtMs);

    agg.set(t.autotrader_id, cur);
  }

  const rows = (autotraders || []).map((a) => {
    const s =
      agg.get(a.autotrader_id) || {
        pnlUsd: 0,
        notionalClosed: 0,
        closeCount: 0,
        lastFilledAt: 0,
      };

    // Profit% vs allocated capital (more stable than notionalClosed)
    const capital = Number(a.capital_usd || 0);
    const pct = capital > 0 ? (s.pnlUsd / capital) * 100 : 0;

    const planName = planNameById.get(a.plan_id) || "";
    const sym = assetSymbolById.get(a.asset_id) || "";

    return {
      autotrader_id: a.autotrader_id,
      status: a.status,
      autotraderName: a.autotrader_name || "",
      planName,
      assetSymbol: sym,
      profitPct: pct,
      closeCount: s.closeCount,
      lastFilledAt: s.lastFilledAt,
    };
  });

  // Prefer those with realized closes
  let ranked = rows.filter((r) => r.closeCount > 0);

  // Fallback if none (should not happen, but safe)
  if (!ranked.length) ranked = rows;

  // Sort by profit% desc, tie-breaker by recency
  ranked.sort((a, b) => {
    if (b.profitPct !== a.profitPct) return b.profitPct - a.profitPct;
    return (b.lastFilledAt || 0) - (a.lastFilledAt || 0);
  });

  return ranked.slice(0, 3).map((t) => ({
    name: t.autotraderName || t.planName || "Autotrader",
    pair: t.assetSymbol ? `${t.assetSymbol}/USDT` : "Pair",
    runtime: t.status === "running" ? "Running" : "Stopped",
    pnl: formatPct(t.profitPct, 2),
  }));
};

/* ------------------------------------------------------
 * DASHBOARD FETCH (FINAL ENTRY POINT)
 * ------------------------------------------------------ */

export const fetchDashboardData = async () => {
  const [assetSummary, accountsSummary, topAutotraders] = await Promise.all([
    buildAssetSummary(),
    buildAccountsSummary(),
    buildTopAutotraders(),
  ]);

  return {
    assetSummary,
    accountsSummary,
    topAutotraders,
    alerts: [],
    tradeHistory: [],
  };
};
