import {
  getAccounts,
  getAssets,
  getAssetEquityDaily,
  getAutotraders,
  getTradingPlans,
  getTrades,
} from "./dataAccess.js";

/* ============================================
 * Utils
 * ============================================ */

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const safeNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

export const formatCurrency = (value, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);

export const formatPercent = (value, digits = 2) =>
  `${safeNumber(value, 0).toFixed(digits)}%`;

/**
 * Relative time helper (simple)
 */
export const formatTimeAgo = (iso) => {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";

  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return `${Math.max(sec, 1)}s ago`;
};

const pickTop = (arr, n = 3) => arr.slice(0, n);

const getAssetSymbolById = (assets, id) => {
  const a = assets.find((x) => x.asset_id === id);
  return a?.asset_symbol?.toUpperCase() || "ASSET";
};

/* ============================================
 * Asset Summary (total + series)
 * ============================================ */

const getAssetSummary = async () => {
  // Use derived equity series (asset_equity_daily.json) if available
  const series = await getAssetEquityDaily();

  if (!Array.isArray(series) || series.length < 2) {
    return {
      totalValue: 0,
      changePct: 0,
      labels: [],
      series: [],
    };
  }

  const first = Number(series[0]?.value || 0);
  const last = Number(series[series.length - 1]?.value || 0);

  const changePct =
    first > 0 ? ((last - first) / first) * 100 : 0;

  return {
    totalValue: last,
    changePct,
    labels: series.map((d) => d.date),
    series: series.map((d) => Number(d.value || 0)),
  };
};

/* ============================================
 * Accounts Summary (list + donut)
 * ============================================ */

const getAccountsSummary = async () => {
  const [accounts, assets] = await Promise.all([getAccounts(), getAssets()]);
  if (!Array.isArray(accounts) || !Array.isArray(assets)) return [];

  // This dataset uses accounts + asset_equity_daily for total equity display elsewhere,
  // so here we just mock per-account totals using stable-ish numbers.
  // If you already have getAccountsSummaryByDate in dataAccess.js, prefer that in renderer.
  return accounts
    .slice(0, 6)
    .map((a, i) => ({
      accountId: a.account_id,
      name: a.account_name || `Account ${i + 1}`,
      amount: 0,
      value: "0",
    }));
};

/* ============================================
 * Alerts (mock)
 * ============================================ */

const getAlerts = async () => {
  return [];
};

/* ============================================
 * Top Autotraders
 * - win rate: computed from trades (reduce_only=true)
 * - sparkline: last N closed trades pnl_percent (cumulative line)
 * ============================================ */

const buildAutotraderTradeStats = (trades) => {
  const map = new Map(); // autotrader_id -> { closed, wins, pnlSumPct, lastPcts[] }

  if (!Array.isArray(trades)) return map;

  for (const t of trades) {
    const autoId = t?.autotrader_id;
    if (!autoId) continue;

    // Only count closes (engine-grade rule of thumb)
    if (t?.reduce_only !== true) continue;

    const pnlPct = safeNumber(t?.pnl_percent, 0);

    if (!map.has(autoId)) {
      map.set(autoId, {
        closed: 0,
        wins: 0,
        pnlSumPct: 0,
        lastPcts: [],
      });
    }

    const s = map.get(autoId);
    s.closed += 1;
    if (pnlPct > 0) s.wins += 1;
    s.pnlSumPct += pnlPct;
    s.lastPcts.push(pnlPct);
  }

  // Keep last 24 for each autotrader to keep it lightweight
  for (const s of map.values()) {
    if (s.lastPcts.length > 24) s.lastPcts = s.lastPcts.slice(-24);
  }

  return map;
};

const buildSparkSeries = (pcts, maxPoints = 12) => {
  const arr = Array.isArray(pcts) ? pcts.slice(-maxPoints) : [];
  if (!arr.length) return [0];

  // cumulative for smoother line
  let c = 0;
  const cum = arr.map((v) => {
    c += safeNumber(v, 0);
    return c;
  });

  // If everything identical, return flat
  const minV = Math.min(...cum);
  const maxV = Math.max(...cum);
  if (minV === maxV) return [0, 0, 0, 0];

  return cum;
};

const getTopAutotraders = async () => {
  const [autotraders, plans, assets, trades] = await Promise.all([
    getAutotraders(),
    getTradingPlans(),
    getAssets(),
    getTrades(),
  ]);

  if (!Array.isArray(autotraders) || !Array.isArray(plans) || !Array.isArray(assets)) {
    return [];
  }

  const planMap = new Map(plans.map((p) => [p.plan_id, p]));
  const tradeStats = buildAutotraderTradeStats(trades);

  const enriched = autotraders.map((a, idx) => {
    const plan = planMap.get(a.plan_id);
    const assetIds = Array.isArray(plan?.asset_ids) ? plan.asset_ids : [];

    // Pair placeholder derived from first 2 asset ids (existing behavior)
    const base = getAssetSymbolById(assets, assetIds[0]);
    const quote = getAssetSymbolById(assets, assetIds[1] || assetIds[0]);
    const pairSymbols = [base.toLowerCase(), quote.toLowerCase()];

    const s = tradeStats.get(a.autotrader_id) || {
      closed: 0,
      wins: 0,
      pnlSumPct: 0,
      lastPcts: [],
    };

    const winRate = s.closed > 0 ? (s.wins / s.closed) * 100 : 0;
    const spark = buildSparkSeries(s.lastPcts, 12);

    // PnL percent: use pnlSumPct as a simple "performance" proxy
    const pnlPercent = s.closed > 0 ? s.pnlSumPct : 0;

    return {
      id: a.autotrader_id,
      name: a.name || `Autotrader ${idx + 1}`,
      pairSymbols,
      tradeCount: s.closed,
      winRate, // number
      pnlPercent, // number
      isLive: a.status === "active",
      spark, // number[]
    };
  });

  // sort by pnlPercent desc
  enriched.sort((x, y) => safeNumber(y.pnlPercent) - safeNumber(x.pnlPercent));

  const top3 = pickTop(enriched, 3);

  // Ensure always 3 cards (fallback)
  while (top3.length < 3) {
    const i = top3.length + 1;
    top3.push({
      id: `placeholder-${i}`,
      name: `Autotrader ${i}`,
      pairSymbols: ["btc", "usdt"],
      tradeCount: 0,
      winRate: 0,
      pnlPercent: 0,
      isLive: false,
      spark: [0, 0, 0, 0],
    });
  }

  return top3;
};

/* ============================================
 * Trade History (mock/simple)
 * ============================================ */

const getTradeHistory = async () => {
  // keep existing simple behavior here; your tradeHistory renderer/dataAccess handles real trades
  return [];
};

/* ============================================
 * Public API for dashboard
 * ============================================ */

export const fetchDashboardData = async () => {
  const [
    assetSummary,
    accountsSummary,
    alerts,
    topAutotraders,
    tradeHistory,
  ] = await Promise.all([
    getAssetSummary(),
    getAccountsSummary(),
    getAlerts(),
    getTopAutotraders(),
    getTradeHistory(),
  ]);

  return {
    assetSummary,
    accountsSummary,
    alerts,
    topAutotraders,
    tradeHistory,
  };
};
