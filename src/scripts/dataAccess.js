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
  accountAssetsIndex: new URL("../../data/account_assets_daily/index.json", import.meta.url),
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
   DERIVED EQUITY (SINGLE SOURCE)
========================= */

export const getEquityDaily = async () => {
  const data = await fetchJson(DATA_URLS.equityDaily, "derive:equity");
  if (!Array.isArray(data)) return [];

  return data
    .filter((d) => d && d.date && typeof d.value === "number")
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
   DAILY SNAPSHOTS (PER DATE)
========================= */

const getLatestAccountAssetsDate = async () => {
  const files = await fetchJson(DATA_URLS.accountAssetsIndex, "index:account_assets_daily");
  if (!Array.isArray(files) || files.length === 0) return null;

  // index.json sudah urut dari awal ke akhir, ambil paling akhir
  const last = files[files.length - 1]; // "2026-01-17.json"
  if (typeof last !== "string") return null;

  return last.replace(".json", "");
};

export const getAccountAssetsDailyByDate = async (date) => {
  const url = new URL(`${date}.json`, DATA_URLS.accountAssetsBase);
  return fetchJson(url, `account_assets_daily:${date}`);
};

export const getAssetPriceDailyByDate = async (date) => {
  const url = new URL(`${date}.json`, DATA_URLS.assetPriceBase);
  return fetchJson(url, `asset_price_daily:${date}`);
};

/* =========================
   ✅ ACCOUNTS SUMMARY (FINAL)
   level = ACCOUNT (bukan provider)
   source = latest daily snapshot
========================= */

export const getAccountsWithSummary = async () => {
  const [accounts, latestDate] = await Promise.all([
    getAccounts(),
    getLatestAccountAssetsDate(),
  ]);

  if (!latestDate) {
    return accounts.map((a) => ({
      ...a,
      name: a.account_name || a.name || "Account",
      amount: 0,
      value: "$0",
    }));
  }

  const [assetsSnap, priceSnap] = await Promise.all([
    getAccountAssetsDailyByDate(latestDate),
    getAssetPriceDailyByDate(latestDate),
  ]);

  const priceMap = new Map(
    (priceSnap?.prices || []).map((p) => [p.asset_id, Number(p.price_usd || 0)])
  );

  const assetsByAccount = new Map(
    (assetsSnap?.accounts || []).map((x) => [x.account_id, x.assets || []])
  );

  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return accounts.map((a) => {
    const accId = a.account_id;
    const list = assetsByAccount.get(accId) || [];

    let totalUsd = 0;
    for (const it of list) {
      const qty = Number(it?.value || 0);
      const px = priceMap.get(it?.asset_id) || 0;
      totalUsd += qty * px;
    }

    return {
      ...a,
      name: a.account_name || a.name || "Account",
      amount: totalUsd,
      value: fmt.format(totalUsd),
      snapshot_date: latestDate,
    };
  });
};
