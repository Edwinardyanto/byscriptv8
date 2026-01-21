// src/scripts/dataAccess.js
// Data-first access layer (AUTHORITATIVE SOURCE)

const DATA_URLS = {
  accounts: new URL("../../data/accounts.json", import.meta.url),
  assets: new URL("../../data/assets.json", import.meta.url),
  autotraders: new URL("../../data/autotraders.json", import.meta.url),
  tradingPlans: new URL("../../data/trading_plans.json", import.meta.url),
  latestMeta: new URL("../../data/meta/latest.json", import.meta.url),
  derivedEquity: new URL("../../data/derive/asset_equity_daily.json", import.meta.url),
  latestAccountAssets: new URL("../../data/account_assets_daily/", import.meta.url),
};

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

/* ---------------- META ---------------- */

export const getLatestDate = async () => {
  const meta = await fetchJson(DATA_URLS.latestMeta, "meta:latest");
  return meta.latestDate;
};

/* ---------------- CORE ---------------- */

export const getAccounts = async () =>
  fetchJson(DATA_URLS.accounts, "accounts");

export const getAutotraders = async () =>
  fetchJson(DATA_URLS.autotraders, "autotraders");

export const getTradingPlans = async () =>
  fetchJson(DATA_URLS.tradingPlans, "plans");

/* ---------------- AUTOTRADERS BY ACCOUNT ---------------- */

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

/* ---------------- ACCOUNTS SUMMARY (LATEST SNAPSHOT) ---------------- */

export const getAccountsWithSummary = async () => {
  const accounts = await getAccounts();
  // summary placeholder using zero; historical equity is NOT computed here
  return accounts.map((a) => ({
    ...a,
    totalValueUsd: Number(a.totalValueUsd || 0),
  }));
};

/* ---------------- DERIVED EQUITY ONLY ---------------- */

const RANGE_DAYS = { "7D": 7, "30D": 30, "90D": 90 };

export const getAssetEquityByRange = async (range = "7D") => {
  const [equity, latestDate] = await Promise.all([
    fetchJson(DATA_URLS.derivedEquity, "derive:equity"),
    getLatestDate(),
  ]);

  const end = new Date(latestDate);

  let start;
  if (range === "ALL") {
    start = new Date(equity[0]?.date);
  } else {
    const days = RANGE_DAYS[range] || 7;
    start = new Date(end);
    start.setDate(end.getDate() - (days - 1));
  }

  const labels = [];
  const series = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const ds = d.toISOString().slice(0, 10);
    const row = equity.find((e) => e.date === ds);
    labels.push(ds);
    series.push(row ? row.value : 0);
  }

  return { labels, series };
};
