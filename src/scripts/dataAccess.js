// src/scripts/dataAccess.js
// Data-first access layer (AUTHORITATIVE SOURCE)

const DATA_URLS = {
  accounts: new URL("../../data/accounts.json", import.meta.url),
  assets: new URL("../../data/assets.json", import.meta.url),
  autotraders: new URL("../../data/autotraders.json", import.meta.url),
  tradingPlans: new URL("../../data/trading_plans.json", import.meta.url),

  latestMeta: new URL("../../data/meta/latest", import.meta.url),

  accountAssetsDailyDir: new URL(
    "../../data/account_assets_daily/",
    import.meta.url
  ),
  assetPriceDailyDir: new URL(
    "../../data/asset_price_daily/",
    import.meta.url
  ),
};

/* ----------------------------------
 * CACHE
 * ---------------------------------- */

const cache = new Map();
const inflight = new Map();

const clone = (d) =>
  typeof structuredClone === "function"
    ? structuredClone(d)
    : JSON.parse(JSON.stringify(d));

const fetchJson = async (url, key = "") => {
  if (key && cache.has(key)) return clone(cache.get(key));
  if (key && inflight.has(key)) return inflight.get(key).then(clone);

  const req = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load ${url}`);
      return r.json();
    })
    .then((d) => {
      if (key) cache.set(key, d);
      inflight.delete(key);
      return d;
    })
    .catch((e) => {
      inflight.delete(key);
      throw e;
    });

  if (key) inflight.set(key, req);
  return req.then(clone);
};

const fetchDataset = (k) => fetchJson(DATA_URLS[k], `dataset:${k}`);

/* ----------------------------------
 * META
 * ---------------------------------- */

const getLatestMeta = () =>
  fetchJson(DATA_URLS.latestMeta, "meta:latest");

export const getLatestDate = async () => {
  const meta = await getLatestMeta();
  return meta.accountAssetDaily.replace(".json", "");
};

/* ----------------------------------
 * CORE DATA
 * ---------------------------------- */

export const getAccounts = () => fetchDataset("accounts");
export const getAssets = () => fetchDataset("assets");
export const getAutotraders = () => fetchDataset("autotraders");
export const getTradingPlans = () => fetchDataset("tradingPlans");

/* ----------------------------------
 * AUTOTRADERS BY ACCOUNT
 * ---------------------------------- */

export const getAutotradersByAccount = async (accountId) => {
  const autotraders = await getAutotraders();
  return autotraders.filter((a) => a.account_id === accountId);
};

/* ----------------------------------
 * LATEST DAILY SNAPSHOT
 * ---------------------------------- */

export const getLatestAccountAssetsDaily = async () => {
  const meta = await getLatestMeta();
  return fetchJson(
    new URL(meta.accountAssetDaily, DATA_URLS.accountAssetsDailyDir),
    `daily:account:${meta.accountAssetDaily}`
  );
};

export const getLatestAssetPriceDaily = async () => {
  const meta = await getLatestMeta();
  return fetchJson(
    new URL(meta.assetPriceDaily, DATA_URLS.assetPriceDailyDir),
    `daily:price:${meta.assetPriceDaily}`
  );
};

/* ----------------------------------
 * ACCOUNT VALUE
 * ---------------------------------- */

export const getAccountAssets = async (accountId) => {
  const [assets, daily, prices] = await Promise.all([
    getAssets(),
    getLatestAccountAssetsDaily(),
    getLatestAssetPriceDaily(),
  ]);

  const priceMap = new Map(
    prices.prices.map((p) => [p.asset_id, Number(p.price_usd || 0)])
  );

  const assetMap = new Map(assets.map((a) => [a.asset_id, a]));

  const row = daily.accounts.find((a) => a.account_id === accountId);
  if (!row) return [];

  return row.assets
    .map((a) => {
      const price = priceMap.get(a.asset_id) || 0;
      return {
        account_id: accountId,
        asset_id: a.asset_id,
        value: Number(a.value || 0),
        price_usd: price,
        usd_value: Number(a.value || 0) * price,
        asset: assetMap.get(a.asset_id),
      };
    })
    .sort((a, b) => b.usd_value - a.usd_value);
};

export const getAccountValue = async (accountId) => {
  const rows = await getAccountAssets(accountId);
  return rows.reduce((s, r) => s + r.usd_value, 0);
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
 * ALL RANGE START DATE
 * ---------------------------------- */

export const getAllStartDate = async () => {
  const accounts = await getAccounts();
  if (!accounts.length) return null;
  return accounts
    .map((a) => new Date(a.connected_at))
    .sort((a, b) => a - b)[0];
};

/* ----------------------------------
 * ASSET EQUITY BY RANGE
 * ---------------------------------- */

const RANGE_DAYS = {
  "7D": 7,
  "30D": 30,
  "90D": 90,
};

export const getAssetEquityByRange = async (range = "7D") => {
  const latestStr = await getLatestDate();
  const latest = new Date(latestStr);

  let start;
  if (range === "ALL") {
    const allStart = await getAllStartDate();
    if (!allStart) return { labels: [], series: [] };
    start = new Date(allStart);
  } else {
    const days = RANGE_DAYS[range] || 7;
    start = new Date(latest);
    start.setDate(latest.getDate() - (days - 1));
  }

  const labels = [];
  const series = [];

  for (let d = new Date(start); d <= latest; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);

    try {
      const [acc, price] = await Promise.all([
        fetchJson(
          new URL(`${ds}.json`, DATA_URLS.accountAssetsDailyDir),
          `daily:acc:${ds}`
        ),
        fetchJson(
          new URL(`${ds}.json`, DATA_URLS.assetPriceDailyDir),
          `daily:price:${ds}`
        ),
      ]);

      const priceMap = new Map(
        price.prices.map((p) => [p.asset_id, Number(p.price_usd || 0)])
      );

      let total = 0;
      for (const a of acc.accounts) {
        for (const as of a.assets) {
          total +=
            Number(as.value || 0) *
            (priceMap.get(as.asset_id) || 0);
        }
      }

      labels.push(ds);
      series.push(total);
    } catch {
      labels.push(ds);
      series.push(0);
    }
  }

  return { labels, series };
};

/* ----------------------------------
 * NOT SUPPORTED
 * ---------------------------------- */

export const getTradeHistory = async () => {
  throw new Error("Trade history not supported");
};
