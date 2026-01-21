// src/scripts/dataAccess.js
// Data-first access layer (AUTHORITATIVE SOURCE)

const DATA_URLS = {
  // core datasets
  accounts: new URL("../../data/accounts.json", import.meta.url),
  assets: new URL("../../data/assets.json", import.meta.url),
  autotraders: new URL("../../data/autotraders.json", import.meta.url),
  tradingPlans: new URL("../../data/trading_plans.json", import.meta.url),

  // meta (no .json extension by design)
  latestMeta: new URL("../../data/meta/latest", import.meta.url),

  // daily snapshots (directories)
  accountAssetsDailyDir: new URL("../../data/account_assets_daily/", import.meta.url),
  assetPriceDailyDir: new URL("../../data/asset_price_daily/", import.meta.url),
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

const fetchJson = async (url, key = "", opts = {}) => {
  const { allowMissing = false } = opts;

  if (key && cache.has(key)) return clone(cache.get(key));
  if (key && inflight.has(key)) return inflight.get(key).then(clone);

  const req = fetch(url)
    .then(async (r) => {
      if (!r.ok) {
        if (allowMissing) return null;
        throw new Error(`Failed to load ${url}`);
      }
      return r.json();
    })
    .then((d) => {
      if (key) cache.set(key, d);
      inflight.delete(key);
      return d;
    })
    .catch((e) => {
      inflight.delete(key);
      if (allowMissing) return null;
      throw e;
    });

  if (key) inflight.set(key, req);
  return req.then(clone);
};

const fetchDataset = (k) => {
  const url = DATA_URLS[k];
  if (!url) throw new Error(`Unknown dataset: ${k}`);
  return fetchJson(url, `dataset:${k}`);
};

/* ----------------------------------
 * META
 * ---------------------------------- */

const getLatestMeta = () => fetchJson(DATA_URLS.latestMeta, "meta:latest");

export const getLatestDate = async () => {
  const meta = await getLatestMeta();
  if (!meta?.accountAssetDaily) throw new Error("latestMeta missing accountAssetDaily");
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
 * AUTOTRADERS BY ACCOUNT (ENRICHED)
 * ---------------------------------- */

export const getAutotradersByAccount = async (accountId) => {
  const [autotraders, tradingPlans] = await Promise.all([
    getAutotraders(),
    getTradingPlans(),
  ]);

  const plansById = new Map((tradingPlans || []).map((p) => [p.plan_id, p]));

  return (autotraders || [])
    .filter((a) => a.account_id === accountId)
    .map((a) => {
      const plan = plansById.get(a.plan_id);
      return {
        ...a,
        tradingPlan: plan,
        tradingPlanName: plan?.plan_name || plan?.name || "",
        marketType: plan?.market_type || "",
      };
    });
};

/* ----------------------------------
 * LATEST DAILY SNAPSHOT
 * ---------------------------------- */

export const getLatestAccountAssetsDaily = async () => {
  const meta = await getLatestMeta();
  if (!meta?.accountAssetDaily) throw new Error("latest meta missing: accountAssetDaily");
  return fetchJson(
    new URL(meta.accountAssetDaily, DATA_URLS.accountAssetsDailyDir),
    `daily:account:${meta.accountAssetDaily}`
  );
};

export const getLatestAssetPriceDaily = async () => {
  const meta = await getLatestMeta();
  if (!meta?.assetPriceDaily) throw new Error("latest meta missing: assetPriceDaily");
  return fetchJson(
    new URL(meta.assetPriceDaily, DATA_URLS.assetPriceDailyDir),
    `daily:price:${meta.assetPriceDaily}`
  );
};

/* ----------------------------------
 * ACCOUNT VALUE (USD)
 * ---------------------------------- */

export const getAccountAssets = async (accountId) => {
  const [assets, daily, prices] = await Promise.all([
    getAssets(),
    getLatestAccountAssetsDaily(),
    getLatestAssetPriceDaily(),
  ]);

  const priceMap = new Map(
    ((prices?.prices || [])).map((p) => [p.asset_id, Number(p.price_usd || 0)])
  );

  const assetMap = new Map((assets || []).map((a) => [a.asset_id, a]));

  const row = (daily?.accounts || []).find((a) => a.account_id === accountId);
  if (!row) return [];

  return (row.assets || [])
    .map((a) => {
      const asset = assetMap.get(a.asset_id);
      const price = priceMap.get(a.asset_id) || 0;
      const value = Number(a.value || 0);
      const usd = value * price;

      return {
        account_id: accountId,
        asset_id: a.asset_id,
        value,
        price_usd: price,
        usd_value: usd,

        asset,
        assetSymbol: asset?.asset_symbol,
        assetName: asset?.asset_name,
      };
    })
    .sort((x, y) => Number(y.usd_value || 0) - Number(x.usd_value || 0));
};

export const getAccountValue = async (accountId) => {
  const rows = await getAccountAssets(accountId);
  return rows.reduce((s, r) => s + Number(r.usd_value || 0), 0);
};

export const getAccountsWithSummary = async () => {
  const accounts = await getAccounts();
  const values = await Promise.all((accounts || []).map((a) => getAccountValue(a.account_id)));

  return (accounts || []).map((a, i) => ({
    ...a,
    totalValueUsd: values[i] || 0,
  }));
};

/* ----------------------------------
 * ALL RANGE START DATE (CLAMP TO AVAILABLE DAILY WINDOW)
 * ---------------------------------- */

// your dataset is a fixed daily window (not "since connected_at")
const AVAILABLE_DAILY_DAYS = 380;

export const getAllStartDate = async () => {
  const latestStr = await getLatestDate();
  const latest = new Date(latestStr);
  const start = new Date(latest);
  start.setDate(latest.getDate() - (AVAILABLE_DAILY_DAYS - 1));
  return start;
};

/* ----------------------------------
 * EQUITY HELPERS
 * ---------------------------------- */

const computeEquityForDate = async (dateStr) => {
  const [acc, price] = await Promise.all([
    fetchJson(
      new URL(`${dateStr}.json`, DATA_URLS.accountAssetsDailyDir),
      `daily:acc:${dateStr}`,
      { allowMissing: true }
    ),
    fetchJson(
      new URL(`${dateStr}.json`, DATA_URLS.assetPriceDailyDir),
      `daily:price:${dateStr}`,
      { allowMissing: true }
    ),
  ]);

  if (!acc || !price) return 0;

  const priceMap = new Map(
    (price.prices || []).map((p) => [p.asset_id, Number(p.price_usd || 0)])
  );

  let total = 0;

  for (const a of (acc.accounts || [])) {
    for (const as of (a.assets || [])) {
      total += Number(as.value || 0) * (priceMap.get(as.asset_id) || 0);
    }
  }

  return total;
};

/* ----------------------------------
 * ASSET EQUITY (RANGE)
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
    start = await getAllStartDate();
  } else {
    const days = RANGE_DAYS[range] || 7;
    start = new Date(latest);
    start.setDate(latest.getDate() - (days - 1));
  }

  const labels = [];
  const series = [];

  for (let d = new Date(start); d <= latest; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    labels.push(ds);
    series.push(await computeEquityForDate(ds));
  }

  return { labels, series };
};

/* ----------------------------------
 * BACKWARD COMPAT (OLD DASHBOARD API)
 * returns [{ date, value }]
 * ---------------------------------- */

export const getAssetEquitySeries = async (days = 7) => {
  const latestStr = await getLatestDate();
  const latest = new Date(latestStr);

  const start = new Date(latest);
  start.setDate(latest.getDate() - (Number(days || 7) - 1));

  const out = [];

  for (let d = new Date(start); d <= latest; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    out.push({
      date: ds,
      value: await computeEquityForDate(ds),
    });
  }

  return out;
};

/* ----------------------------------
 * NOT SUPPORTED
 * ---------------------------------- */

export const getTradeHistory = async () => {
  throw new Error("Trade history not supported");
};
