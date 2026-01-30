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
  const cacheKey = key || String(url);

  if (cache.has(cacheKey)) return clone(cache.get(cacheKey));

  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to load ${url}`);

  const j = await r.json();
  cache.set(cacheKey, j);
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

export const getAssetEquityDaily = async () => getEquityDaily();

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

  const stableIds = new Set(
    assets
      .filter((a) => a.asset_symbol === "USDT" || a.asset_symbol === "USDC")
      .map((a) => a.asset_id)
  );

  // load account asset snapshot
  const dailyAssets = await fetchJson(
    new URL(`${date}.json`, DATA_URLS.accountAssetsBase),
    `accountAssets-${date}`
  );

  // load asset price snapshot
  const dailyPrices = await fetchJson(
    new URL(`${date}.json`, DATA_URLS.assetPriceBase),
    `assetPrices-${date}`
  );

  // load positions snapshot (for unrealized PnL)
  const dailyPositions = await fetchJson(
    new URL(`${date}.json`, DATA_URLS.positionsDailyBase),
    `positions-${date}`
  );

  // build price map (force stablecoins = 1.0)
  const priceMap = new Map();
  for (const p of dailyPrices.prices || []) {
    priceMap.set(p.asset_id, Number(p.price_usd || 0));
  }
  for (const sid of stableIds) priceMap.set(sid, 1.0);

  // build unrealized map per account
  const unrealizedMap = new Map();
  for (const a of dailyPositions.accounts || []) {
    let u = 0;
    for (const pos of a.positions || []) {
      u += Number(pos.unrealized_pnl || 0);
    }
    unrealizedMap.set(a.account_id, u);
  }

  // compute per account equity
  const accountValues = [];

  for (const acc of dailyAssets.accounts || []) {
    let totalUsd = 0;

    // spot + cash holdings
    for (const asset of acc.assets || []) {
      const qty = Number(asset.value || 0);
      if (!qty) continue;

      const price = priceMap.get(asset.asset_id) || 0;
      totalUsd += qty * price;
    }

    // include unrealized for futures + web3_futures
    totalUsd += unrealizedMap.get(acc.account_id) || 0;

    const meta = accountMap.get(acc.account_id);

    accountValues.push({
      account_id: acc.account_id,
      account_name: meta?.account_name || acc.account_id,
      totalValueUsd: totalUsd,
    });
  }

  // sort DESC
  accountValues.sort((a, b) => b.totalValueUsd - a.totalValueUsd);

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

  for (const a of accounts) {
    map.set(a.account_id, {
      name: a.account_name,
      exchange: a.exchange,
    });
  }

  return map;
};
