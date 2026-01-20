// src/scripts/dataAccess.js
// Data-first access layer:
// - Accounts + Assets -> from /data
// - Account assets summary -> computed from account_assets_daily + asset_price_daily (latest)
// - Trade history sementara tetap dari mock-data agar page lain tidak rusak

const DATA_URLS = {
  // data (real)
  accounts: new URL("../../data/accounts.json", import.meta.url),
  assets: new URL("../../data/assets.json", import.meta.url),
  autotraders: new URL("../../data/autotraders.json", import.meta.url),
  tradingPlans: new URL("../../data/trading_plans.json", import.meta.url),

  // meta (real) -> NOTE: in your zip it's "data/meta/latest" (no .json)
  latestMeta: new URL("../../data/meta/latest", import.meta.url),

  // daily (real)
  accountAssetsDailyDir: new URL("../../data/account_assets_daily/", import.meta.url),
  assetPriceDailyDir: new URL("../../data/asset_price_daily/", import.meta.url),

  // mock (temporary fallback for Trade History page)
  tradeHistory: new URL("../../mock-data/data/trade_history.json", import.meta.url),
};

const dataCache = new Map();
const inflight = new Map();

const cloneData = (data) => {
  if (typeof structuredClone === "function") return structuredClone(data);
  return JSON.parse(JSON.stringify(data));
};

const fetchJson = async (url, cacheKey = "") => {
  if (cacheKey && dataCache.has(cacheKey)) return cloneData(dataCache.get(cacheKey));
  if (cacheKey && inflight.has(cacheKey)) return inflight.get(cacheKey).then(cloneData);

  const req = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load: ${url}`);
      return res.json();
    })
    .then((data) => {
      if (cacheKey) dataCache.set(cacheKey, data);
      if (cacheKey) inflight.delete(cacheKey);
      return data;
    })
    .catch((err) => {
      if (cacheKey) inflight.delete(cacheKey);
      throw err;
    });

  if (cacheKey) inflight.set(cacheKey, req);
  return req.then(cloneData);
};

const fetchDataset = async (key) => {
  const url = DATA_URLS[key];
  if (!url) throw new Error(`Unknown dataset: ${key}`);
  return fetchJson(url, `dataset:${key}`);
};

const getLatestMeta = async () => fetchJson(DATA_URLS.latestMeta, "meta:latest");

export const getLatestAccountAssetsDaily = async () => {
  const meta = await getLatestMeta();
  const file = meta.accountAssetDaily;
  if (!file) throw new Error("latest meta missing: accountAssetDaily");

  const url = new URL(file, DATA_URLS.accountAssetsDailyDir);
  return fetchJson(url, `daily:account_assets:${file}`);
};

export const getLatestAssetPriceDaily = async () => {
  const meta = await getLatestMeta();
  const file = meta.assetPriceDaily;
  if (!file) throw new Error("latest meta missing: assetPriceDaily");

  const url = new URL(file, DATA_URLS.assetPriceDailyDir);
  return fetchJson(url, `daily:asset_price:${file}`);
};

// ---------------------------
// Public APIs (used by UI)
// ---------------------------

export const getAccounts = async () => fetchDataset("accounts");
export const getAssets = async () => fetchDataset("assets");

// IMPORTANT: this now returns computed usd_value based on daily snapshot + daily price
export const getAccountAssets = async (accountId) => {
  const [assets, latestAccountAssetsDaily, latestAssetPriceDaily] = await Promise.all([
    fetchDataset("assets"),
    getLatestAccountAssetsDaily(),
    getLatestAssetPriceDaily(),
  ]);

  const assetsById = new Map(assets.map((a) => [a.asset_id, a]));
  const priceByAssetId = new Map(
    (latestAssetPriceDaily?.prices || []).map((p) => [p.asset_id, Number(p.price_usd || 0)])
  );

  const accountRow = (latestAccountAssetsDaily?.accounts || []).find(
    (a) => a.account_id === accountId
  );

  const rows = (accountRow?.assets || []).map((entry) => {
    const asset = assetsById.get(entry.asset_id);
    const price = priceByAssetId.get(entry.asset_id) || 0;
    const value = Number(entry.value || 0);
    const usd_value = value * price;

    return {
      account_id: accountId,
      asset_id: entry.asset_id,
      value,
      price_usd: price,
      usd_value,

      // keep compatibility with existing UI code
      asset,
      assetSymbol: asset?.asset_symbol,
      assetName: asset?.asset_name,
    };
  });

  return rows.sort((a, b) => Number(b.usd_value || 0) - Number(a.usd_value || 0));
};

export const getAccountValue = async (accountId) => {
  const assets = await getAccountAssets(accountId);
  return assets.reduce((sum, entry) => sum + Number(entry.usd_value || 0), 0);
};

export const getAccountsWithSummary = async () => {
  const accounts = await getAccounts();
  const values = await Promise.all(accounts.map((a) => getAccountValue(a.account_id)));

  return accounts.map((account, idx) => ({
    ...account,
    totalValueUsd: values[idx] || 0,
  }));
};

// keep existing exports used elsewhere (data-backed)
export const getAutotradersByAccount = async (accountId) => {
  const [autotraders, tradingPlans] = await Promise.all([
    fetchDataset("autotraders"),
    fetchDataset("tradingPlans"),
  ]);

  const plansById = new Map(tradingPlans.map((p) => [p.plan_id, p]));

  return autotraders
    .filter((a) => a.account_id === accountId)
    .map((a) => {
      const plan = plansById.get(a.plan_id);
      return {
        ...a,
        tradingPlan: plan,
        tradingPlanName: plan?.plan_name || plan?.name,
        marketType: plan?.market_type,
      };
    });
};

// temporary: Trade History still from mock-data (will migrate later)
export const getTradeHistory = async () => fetchDataset("tradeHistory");
