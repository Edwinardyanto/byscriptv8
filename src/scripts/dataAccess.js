// src/scripts/dataAccess.js
// Data-first access layer (AUTHORITATIVE SOURCE)
//
// Principles:
// - UI never guesses date
// - Chart never generates labels
// - Range logic lives here (7D / 30D / 90D / ALL)
// - Missing daily files are SAFE to skip
// - latestMeta is the single source of truth

/* ----------------------------------
 * DATA URLS
 * ---------------------------------- */

const DATA_URLS = {
  // core datasets
  accounts: new URL("../../data/accounts.json", import.meta.url),
  assets: new URL("../../data/assets.json", import.meta.url),
  autotraders: new URL("../../data/autotraders.json", import.meta.url),
  tradingPlans: new URL("../../data/trading_plans.json", import.meta.url),

  // meta (no .json extension by design)
  latestMeta: new URL("../../data/meta/latest", import.meta.url),

  // daily snapshots
  accountAssetsDailyDir: new URL("../../data/account_assets_daily/", import.meta.url),
  assetPriceDailyDir: new URL("../../data/asset_price_daily/", import.meta.url),
};

/* ----------------------------------
 * CACHE LAYER
 * ---------------------------------- */

const dataCache = new Map();
const inflight = new Map();

const cloneData = (data) => {
  if (typeof structuredClone === "function") return structuredClone(data);
  return JSON.parse(JSON.stringify(data));
};

const fetchJson = async (url, cacheKey = "") => {
  if (cacheKey && dataCache.has(cacheKey)) {
    return cloneData(dataCache.get(cacheKey));
  }

  if (cacheKey && inflight.has(cacheKey)) {
    return inflight.get(cacheKey).then(cloneData);
  }

  const req = fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load: ${url}`);
      return res.json();
    })
    .then((data) => {
      if (cacheKey) dataCache.set(cacheKey, data);
      inflight.delete(cacheKey);
      return data;
    })
    .catch((err) => {
      inflight.delete(cacheKey);
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

/* ----------------------------------
 * META
 * ---------------------------------- */

const getLatestMeta = async () =>
  fetchJson(DATA_URLS.latestMeta, "meta:latest");

export const getLatestDate = async () => {
  const meta = await getLatestMeta();
  if (!meta?.accountAssetDaily) {
    throw new Error("latestMeta missing accountAssetDaily");
  }
  return meta.accountAssetDaily.replace(".json", "");
};

/* ----------------------------------
 * CORE DATASETS
 * ---------------------------------- */

export const getAccounts = async () => fetchDataset("accounts");
export const getAssets = async () => fetchDataset("assets");
export const getAutotraders = async () => fetchDataset("autotraders");
export const getTradingPlans = async () => fetchDataset("tradingPlans");

/* ----------------------------------
 * DAILY SNAPSHOTS (LATEST)
 * ---------------------------------- */

export const getLatestAccountAssetsDaily = async () => {
  const meta = await getLatestMeta();
  const file = meta.accountAssetDaily;
  if (!file) throw new Error("latest meta missing: accountAssetDaily");

  return fetchJson(
    new URL(file, DATA_URLS.accountAssetsDailyDir),
    `daily:account_assets:${file}`
  );
};

export const getLatestAssetPriceDaily = async () => {
  const meta = await getLatestMeta();
  const file = meta.assetPriceDaily;
  if (!file) throw new Error("latest meta missing: assetPriceDaily");

  return fetchJson(
    new URL(file, DATA_URLS.assetPriceDailyDir),
    `daily:asset_price:${file}`
  );
};

/* ----------------------------------
 * ACCOUNT VALUE (USD)
 * ---------------------------------- */

export const getAccountAssets = async (accountId) => {
  const [assets, accountDaily, priceDaily] = await Promise.all([
    getAssets(),
    getLatestAccountAssetsDaily(),
    getLatestAssetPriceDaily(),
  ]);

  const assetsById = new Map(assets.map((a) => [a.asset_id, a]));
  const priceByAssetId = new Map(
    (priceDaily.prices || []).map((p) => [
      p.asset_id,
      Number(p.price_usd || 0),
    ])
  );

  const accountRow = (accountDaily.accounts || []).find(
    (a) => a.account_id === accountId
  );

  const rows = (accountRow?.assets || []).map((entry) => {
    const asset = assetsById.get(entry.asset_id);
    const price = priceByAssetId.get(entry.asset_id) || 0;
    const value = Number(entry.value || 0);

    return {
      account_id: accountId,
      asset_id: entry.asset_id,
      value,
      price_usd: price,
      usd_value: value * price,

      // compatibility fields
      asset,
      assetSymbol: asset?.asset_symbol,
      assetName: asset?.asset_name,
    };
  });

  return rows.sort((a, b) => b.usd_value - a.usd_value);
};

export const getAccountValue = async (accountId) => {
  const assets = await getAccountAssets(accountId);
  return assets.reduce((sum, a) => sum + a.usd_value, 0);
};

export const getAccountsWithSummary = async () => {
  const accounts = await getAccounts();
  const values = await Promise.all(
    accounts.map((a) => getAccountValue(a.account_id))
  );

  return accounts.map((a, i) => ({
    ...a,
    totalValueUsd: values[i] || 0,
  }));
};

/* ----------------------------------
 * ACCOUNT START DATE (FOR ALL RANGE)
 * ---------------------------------- */

export const getAllStartDate = async () => {
  const accounts = await getAccounts();
  if (!accounts.length) return null;

  return accounts
    .map((a) => new Date(a.connected_at))
    .sort((a, b) => a - b)[0];
};

/* ----------------------------------
 * ASSET EQUITY SERIES (FINAL, RANGE-BASED)
 * ---------------------------------- */

const RANGE_DAYS = {
  "7D": 7,
  "30D": 30,
  "90D": 90,
};

export const getAssetEquityByRange = async (range = "7D") => {
  const latestDateStr = await getLatestDate();
  const latestDate = new Date(latestDateStr);

  let startDate;

  if (range === "ALL") {
    const allStart = await getAllStartDate();
    if (!allStart) return { labels: [], series: [] };
    startDate = new Date(allStart);
  } else {
    const days = RANGE_DAYS[range] || 7;
    startDate = new Date(latestDate);
    startDate.setDate(latestDate.getDate() - (days - 1));
  }

  const labels = [];
  const series = [];

  for (
    let d = new Date(startDate);
    d <= latestDate;
    d.setDate(d.getDate() + 1)
  ) {
    const dateStr = d.toISOString().slice(0, 10);

    try {
      const [accountDaily, priceDaily] = await Promise.all([
      fetchJson(
        new URL(`${dateStr}.json`, DATA_URLS.accountAssetsDailyDir),
        `daily:account_assets:${dateStr}`
      ),
      fetchJson(
        new URL(`${dateStr}.json`, DATA_URLS.assetPriceDailyDir),
        `daily:asset_price:${dateStr}`
      ),
      ]);

      let totalUsd = 0;
      const priceMap = new Map(
        priceDaily.prices.map((p) => [
          p.asset_id,
          Number(p.price_usd || 0),
        ])
      );

      for (const acc of accountDaily.accounts) {
        for (const asset of acc.assets) {
          const price = priceMap.get(asset.asset_id) || 0;
          totalUsd += Number(asset.value || 0) * price;
        }
      }

      labels.push(dateStr);
      series.push(totalUsd);
    } catch {
      // missing day → SAFE SKIP
    }
  }

  return { labels, series };
};

/* ----------------------------------
 * DEPRECATED / NOT SUPPORTED
 * ---------------------------------- */

export const getTradeHistory = async () => {
  throw new Error("Trade History is deprecated");
};
