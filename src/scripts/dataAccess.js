// src/scripts/dataAccess.js
// Data-first access layer (AUTHORITATIVE SOURCE)

const DATA_URLS = {
  accounts: new URL("../../data/accounts.json", import.meta.url),
  assets: new URL("../../data/assets.json", import.meta.url),
  autotraders: new URL("../../data/autotraders.json", import.meta.url),
  tradingPlans: new URL("../../data/trading_plans.json", import.meta.url),

  equityDaily: new URL("../../data/derive/asset_equity_daily.json", import.meta.url),

  accountAssetsBase: new URL("../../data/account_assets_daily/", import.meta.url),
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
   ACCOUNT ASSETS (PER ACCOUNT)
========================= */

export const getAccountAssets = async (accountId) => {
  const url = new URL(`${accountId}.json`, DATA_URLS.accountAssetsBase);
  return fetchJson(url, `accountAssets:${accountId}`);
};

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
   ✅ ACCOUNTS SUMMARY (FINAL)
   1 account = 1 slice
========================= */

export const getAccountsWithSummary = async () => {
  const accounts = await getAccounts();

  const result = [];

  for (const acc of accounts) {
    let totalUsd = 0;

    try {
      const assets = await getAccountAssets(acc.account_id);

      for (const a of assets || []) {
        totalUsd += Number(a.usd_value || 0);
      }
    } catch {
      totalUsd = 0; // fallback jika file kosong
    }

    result.push({
      account_id: acc.account_id,
      name: acc.name,
      amount: totalUsd,
      value: new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(totalUsd),
    });
  }

  return result;
};
