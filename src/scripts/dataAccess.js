// src/scripts/dataAccess.js
// Data-first access layer (AUTHORITATIVE SOURCE)

const DATA_URLS = {
  accounts: new URL("../../data/accounts.json", import.meta.url),
  assets: new URL("../../data/assets.json", import.meta.url),
  autotraders: new URL("../../data/autotraders.json", import.meta.url),
  tradingPlans: new URL("../../data/trading_plans.json", import.meta.url),

  equityDaily: new URL("../../data/derive/asset_equity_daily.json", import.meta.url),

  accountAssetsBase: new URL("../../data/account_assets_daily/", import.meta.url),
  assetPriceBase: new URL("../../data/asset_price_daily/", import.meta.url),
  positionsDailyBase: new URL("../../data/positions_daily/", import.meta.url),

  trades: new URL("../../data/trades.json", import.meta.url),
  providerRules: new URL("../../data/provider_market_rules.json", import.meta.url),
};

/* =========================
   UTILITIES
========================= */

const cache = new Map();

const clone = (d) =>
  typeof structuredClone === "function"
    ? structuredClone(d)
    : JSON.parse(JSON.stringify(d));

const fetchJson = async (url, key) => {
  if (cache.has(key)) return clone(cache.get(key));

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load ${url}`);

  const j = await r.json();
  cache.set(key, j);
  return clone(j);
};

/* =========================
   CORE DATA
========================= */

export const getAccounts = async () =>
  fetchJson(DATA_URLS.accounts, "accounts");

export const getAssets = async () =>
  fetchJson(DATA_URLS.assets, "assets");

export const getAutotraders = async () =>
  fetchJson(DATA_URLS.autotraders, "autotraders");

export const getTradingPlans = async () =>
  fetchJson(DATA_URLS.tradingPlans, "plans");

export const getTrades = async () =>
  fetchJson(DATA_URLS.trades, "trades");

export const getAssetSymbolMap = async () => {
  const assets = await getAssets();
  const map = new Map();
  for (const a of assets) map.set(a.asset_id, a.asset_symbol);
  return map;
};

/* =========================
   TRADE HISTORY (NORMALIZED)
========================= */

const normalizeTradeResult = (trade) => {
  if (trade?.reduce_only !== true) return "open";
  const pnl = Number(trade?.pnl_usd || 0);
  if (pnl < 0) return "loss";
  if (pnl > 0) return "win";
  return "flat";
};

const buildTradeCache = async () => {
  if (cache.has("tradeHistory:v1")) return clone(cache.get("tradeHistory:v1"));

  const [trades, assets, accounts, autotraders, plans] = await Promise.all([
    getTrades(),
    getAssets(),
    getAccounts(),
    getAutotraders(),
    getTradingPlans(),
  ]);

  const assetMap = new Map((assets || []).map((a) => [a.asset_id, a]));
  const accountMap = new Map((accounts || []).map((a) => [a.account_id, a]));
  const autotraderMap = new Map((autotraders || []).map((a) => [a.autotrader_id, a]));
  const planMap = new Map((plans || []).map((p) => [p.plan_id, p]));

  const normalized = (trades || []).map((t) => {
    const asset = assetMap.get(t.asset_id);
    const account = accountMap.get(t.account_id);
    const autotrader = autotraderMap.get(t.autotrader_id);
    const plan = planMap.get(t.plan_id);

    const filledAt = Number(t.filled_at || 0);
    const createdAt = Number(t.created_at || 0);
    const executedAtSec = filledAt || createdAt;

    const priceUsd = Number(t.price_usd || 0);
    const qty = Number(t.size || 0);
    const valueUsd = priceUsd * qty;

    return {
      tradeId: t.trade_id,
      trade_id: t.trade_id,

      order_id: t.order_id,
      custom_id: t.custom_id,

      account_id: t.account_id,
      accountName: account?.exchange || account?.account_name || t.account_id,
      accountCode: t.account_id,
      account,

      marketType: plan?.market_type || account?.market_type || "",
      tradingPlanName: plan?.name || "",
      tradingPlan: plan,
      plan_id: t.plan_id,
      plan,

      autotrader_id: t.autotrader_id,
      autotrader,

      asset_id: t.asset_id,
      assetSymbol: asset?.asset_symbol || "",
      assetName: asset?.asset_name || "",
      asset,

      order_type: t.order_type,
      side: t.side,
      reduce_only: t.reduce_only === true,

      executedAt: executedAtSec ? new Date(executedAtSec * 1000) : null,
      executed_at: executedAtSec,

      price: priceUsd,
      price_usd: priceUsd,
      quantity: qty,
      size: qty,
      valueUsd,
      value: valueUsd,
      fee: 0,

      pnl_usd: Number(t.pnl_usd || 0),
      pnl_percent: Number(t.pnl_percent || 0),
      result: normalizeTradeResult(t),
      status: "filled",
    };
  });

  // sort DESC by executed time
  normalized.sort((a, b) => Number(b.executed_at || 0) - Number(a.executed_at || 0));

  cache.set("tradeHistory:v1", normalized);
  return clone(normalized);
};

export const getTradeHistory = async (filters = {}) => {
  const trades = await buildTradeCache();

  const accountId = filters.accountId || filters.account_id;
  const marketType = filters.marketType || filters.market_type;
  const side = filters.side;
  const assetId = filters.assetId || filters.asset_id;
  const planId = filters.planId || filters.plan_id;
  const autotraderId = filters.autotraderId || filters.autotrader_id;
  const result = filters.result;

  const from = filters.from instanceof Date ? filters.from : null;
  const to = filters.to instanceof Date ? filters.to : null;

  return trades.filter((t) => {
    if (accountId && t.account_id !== accountId) return false;
    if (assetId && t.asset_id !== assetId) return false;
    if (planId && (t.plan_id !== planId) && (t.plan?.plan_id !== planId)) return false;
    if (autotraderId && t.autotrader_id !== autotraderId) return false;

    if (marketType && String(t.marketType || "").toLowerCase() !== String(marketType).toLowerCase())
      return false;

    if (side && String(t.side || "").toLowerCase() !== String(side).toLowerCase()) return false;

    if (result && String(t.result || "").toLowerCase() !== String(result).toLowerCase()) return false;

    if (from) {
      const ts = Number(t.executed_at || 0) * 1000;
      if (ts && ts < from.getTime()) return false;
    }
    if (to) {
      const ts = Number(t.executed_at || 0) * 1000;
      if (ts && ts > to.getTime()) return false;
    }

    return true;
  });
};

/* =========================
   DERIVED EQUITY (CHART SOURCE)
========================= */

export const getEquityDaily = async () => {
  const data = await fetchJson(DATA_URLS.equityDaily, "derive:equity");
  if (!Array.isArray(data)) return [];

  // Support both value and equity_usd (value is UI-friendly)
  return data
    .filter((d) => d && d.date && (typeof d.value === "number" || typeof d.equity_usd === "number"))
    .map((d) => ({
      date: d.date,
      value: typeof d.value === "number" ? d.value : Number(d.equity_usd || 0),
      equity_usd: typeof d.equity_usd === "number" ? d.equity_usd : Number(d.value || 0),
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
};

export const getAssetEquityByRange = async (range = "ALL") => {
  const series = await getEquityDaily();
  if (!series.length) return [];

  switch (range) {
    case "7D":
      return series.slice(-7);
    case "30D":
      return series.slice(-30);
    case "90D":
      return series.slice(-90);
    case "ALL":
    default:
      return series;
  }
};

/* =========================
   AUTOTRADERS BY ACCOUNT
========================= */

export const getAutotradersByAccount = async (accountId) => {
  const [autotraders, plans] = await Promise.all([
    getAutotraders(),
    getTradingPlans(),
  ]);

  const planMap = new Map(plans.map((p) => [p.plan_id, p]));

  return autotraders
    .filter((a) => a.account_id === accountId)
    .map((a) => ({
      ...a,
      tradingPlanName: planMap.get(a.plan_id)?.name || "",
    }));
};

/* =========================
   ACCOUNTS SUMMARY (REAL USD + INCLUDE UNREALIZED)
========================= */

export const getAccountsSummaryByDate = async (date) => {
  const [accounts, assets] = await Promise.all([getAccounts(), getAssets()]);

  const accountMap = new Map(accounts.map((a) => [a.account_id, a]));
  const assetMap = new Map(assets.map((a) => [a.asset_id, a]));

  const stableIds = new Set(
    assets
      .filter((a) => a.asset_symbol === "USDT" || a.asset_symbol === "USDC")
      .map((a) => a.asset_id)
  );

  // load snapshots
  const [dailyAssets, dailyPrices, dailyPositions] = await Promise.all([
    fetchJson(
      new URL(`${date}.json`, DATA_URLS.accountAssetsBase),
      `accountAssets-${date}`
    ),
    fetchJson(
      new URL(`${date}.json`, DATA_URLS.assetPriceBase),
      `assetPrices-${date}`
    ),
    fetchJson(
      new URL(`${date}.json`, DATA_URLS.positionsDailyBase),
      `positions-${date}`
    ),
  ]);

  // price map (force stablecoins = 1.0)
  const priceMap = new Map();
  for (const p of dailyPrices.prices || []) {
    priceMap.set(p.asset_id, Number(p.price_usd || 0));
  }
  for (const sid of stableIds) priceMap.set(sid, 1.0);

  // unrealized map per account (futures positions)
  const unrealizedMap = new Map();
  for (const a of dailyPositions.accounts || []) {
    let u = 0;
    for (const pos of a.positions || []) {
      u += Number(pos.unrealized_pnl || 0);
    }
    unrealizedMap.set(a.account_id, u);
  }

  const accountValues = [];

  for (const acc of dailyAssets.accounts || []) {
    const meta = accountMap.get(acc.account_id);

    const items = [];
    let assetsUsd = 0;

    for (const row of acc.assets || []) {
      const qty = Number(row.value || 0);
      if (!qty) continue;

      const price = priceMap.get(row.asset_id) || 0;
      const usd = qty * price;
      if (!usd) continue;

      const asset = assetMap.get(row.asset_id);
      items.push({
        ...row,
        usd_value: usd,
        asset,
        assetSymbol: asset?.asset_symbol,
        assetName: asset?.asset_name,
        color_id: asset?.color_id,
      });

      assetsUsd += usd;
    }

    // sort assets DESC
    items.sort((a, b) => Number(b.usd_value || 0) - Number(a.usd_value || 0));

    // include unrealized for account total equity
    const unrealized = Number(unrealizedMap.get(acc.account_id) || 0);
    const totalUsd = assetsUsd + unrealized;

    accountValues.push({
      ...(meta || {}),
      account_id: acc.account_id,
      account_name: meta?.account_name || acc.account_id,
      provider: meta?.exchange || meta?.provider || meta?.exchange_name || meta?.exchange || "",
      exchange: meta?.exchange || "",
      market_type: meta?.market_type || "",
      color_id: meta?.color_id,
      totalValueUsd: totalUsd,
      assets: items,
    });
  }

  accountValues.sort((a, b) => Number(b.totalValueUsd || 0) - Number(a.totalValueUsd || 0));
  return accountValues;
};

/* =========================
   LATEST ACCOUNTS SUMMARY
========================= */

export const getAccountsWithSummary = async () => {
  const equity = await getEquityDaily();

  if (!Array.isArray(equity) || equity.length === 0) {
    return getAccountsSummaryByDate("2025-01-03");
  }

  const latestDate = equity[equity.length - 1].date;
  return getAccountsSummaryByDate(latestDate);
};

export const getProviderRules = async () =>
  fetchJson(DATA_URLS.providerRules, "providerRules");

export const getAccountMetaMap = async () => {
  const accounts = await getAccounts();
  const map = new Map();

  for (const a of accounts || []) {
    map.set(a.account_id, {
      account_id: a.account_id,
      account_name: a.account_name,
      exchange: a.exchange,
      provider: a.exchange,
      market_type: a.market_type,
      color_id: a.color_id,
      connected_at: a.connected_at,
    });
  }

  return map;
};

export const getAssetMetaMap = async () => {
  const assets = await getAssets();
  const map = new Map();

  for (const a of assets || []) {
    map.set(a.asset_id, {
      symbol: a.asset_symbol,
      color_id: a.color_id,
    });
  }

  return map;
};
