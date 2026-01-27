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

/* =========================
   DERIVED EQUITY (CHART SOURCE)
========================= */

export const getEquityDaily = async () => {
  const data = await fetchJson(DATA_URLS.equityDaily, "derive:equity");

  if (!Array.isArray(data)) return [];

  return data
    .filter((d) => d && d.date && typeof d.equity_usd === "number")
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
      tradingPlanName: planMap.get(a.plan_id)?.plan_name || "",
    }));
};

/* =========================
   ACCOUNTS SUMMARY (REAL USD)
========================= */

export const getAccountsSummaryByDate = async (date) => {
  const accounts = await getAccounts();
  const accountMap = new Map(accounts.map((a) => [a.account_id, a]));

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

  // build price map
  const priceMap = new Map();
  for (const p of dailyPrices.prices || []) {
    priceMap.set(p.asset_id, Number(p.price_usd || 0));
  }

  // compute per account equity
  const accountValues = [];

  for (const acc of dailyAssets.accounts || []) {
    let totalUsd = 0;

    for (const asset of acc.assets || []) {
      const price = priceMap.get(asset.asset_id) || 0;
      totalUsd += Number(asset.value || 0);
    }

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

