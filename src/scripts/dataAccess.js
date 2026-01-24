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

  accountAssetsIndex: new URL(
    "../../data/account_assets_daily/index.json",
    import.meta.url
  ),
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

/* =========================
   DAILY SNAPSHOTS
========================= */

export const getAccountAssetsDailyByDate = async (date) => {
  const url = new URL(`${date}.json`, DATA_URLS.accountAssetsBase);
  return fetchJson(url, `account_assets_daily:${date}`);
};

export const getAssetPriceDailyByDate = async (date) => {
  const url = new URL(`${date}.json`, DATA_URLS.assetPriceBase);
  return fetchJson(url, `asset_price_daily:${date}`);
};

/* =========================
   ✅ FIND LATEST VALID DATE
   use account_assets_daily/index.json only
========================= */

const getLatestValidSnapshotDate = async () => {
  const files = await fetchJson(
    DATA_URLS.accountAssetsIndex,
    "index:account_assets"
  );

  if (!Array.isArray(files) || files.length === 0) return null;

  // ambil dari belakang, cari yang punya price juga
  for (let i = files.length - 1; i >= 0; i--) {
    const date = files[i].replace(".json", "");

    try {
      // test price file exists
      await getAssetPriceDailyByDate(date);
      return date;
    } catch (err) {
      continue; // skip missing price date
    }
  }

  return null;
};

/* =========================
   ✅ ACCOUNTS SUMMARY (FINAL)
========================= */

export const getAccountsWithSummary = async () => {
  const accounts = await getAccounts();
  const latestDate = await getLatestValidSnapshotDate();

  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  if (!latestDate) {
    return accounts.map((a) => ({
      account_id: a.account_id,
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
    (priceSnap?.prices || []).map((p) => [
      p.asset_id,
      Number(p.price_usd || 0),
    ])
  );

  const assetsByAccount = new Map(
    (assetsSnap?.accounts || []).map((x) => [x.account_id, x.assets || []])
  );

  return accounts.map((acc) => {
    const accId = acc.account_id;
    const assetList = assetsByAccount.get(accId) || [];

    let totalUsd = 0;

    for (const it of assetList) {
      const qty = Number(it?.value || 0);
      const px = priceMap.get(it?.asset_id) || 0;
      totalUsd += qty * px;
    }

    return {
      account_id: accId,
      name: acc.account_name || acc.name || "Account",
      amount: totalUsd,
      value: fmt.format(totalUsd),
      snapshot_date: latestDate,
    };
  });
};
