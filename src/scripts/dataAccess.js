// src/scripts/dataAccess.js
// Data-first access layer (AUTHORITATIVE SOURCE)

const DATA_URLS = {
  accounts: new URL("../../data/accounts.json", import.meta.url),
  assets: new URL("../../data/assets.json", import.meta.url),
  autotraders: new URL("../../data/autotraders.json", import.meta.url),
  tradingPlans: new URL("../../data/trading_plans.json", import.meta.url),
  derivedEquity: new URL("../../data/derive/asset_equity_daily.json", import.meta.url),
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
  if (!r.ok) {
    throw new Error(`Failed to load ${url}`);
  }

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
   ACCOUNT ASSETS (LATEST DAY)
========================= */

// Ambil tanggal TERBARU dari folder account_assets_daily/
export const getLatestAccountAssetsDate = async () => {
  const res = await fetch(DATA_URLS.accountAssetsBase);
  if (!res.ok) {
    throw new Error("Failed to load account_assets_daily directory");
  }

  const text = await res.text();

  // Extract YYYY-MM-DD.json (GitHub Pages directory listing)
  const matches = [...text.matchAll(/(\d{4}-\d{2}-\d{2})\.json/g)]
    .map((m) => m[1])
    .sort();

  if (!matches.length) {
    throw new Error("No account_assets_daily files found");
  }

  return matches[matches.length - 1];
};

// Ambil asset account berdasarkan latest snapshot
export const getAccountAssets = async (accountId) => {
  const latestDate = await getLatestAccountAssetsDate();

  const url = new URL(
    `../../data/account_assets_daily/${latestDate}.json`,
    import.meta.url
  );

  const daily = await fetchJson(
    url,
    `account_assets:${latestDate}`
  );

  const account = daily.accounts?.find(
    (a) => a.account_id === accountId
  );

  return account?.assets || [];
};

/* =========================
   ACCOUNTS SUMMARY (SIMPLE)
========================= */

export const getAccountsWithSummary = async () => {
  const accounts = await getAccounts();

  // NOTE:
  // totalValueUsd BELUM dihitung di sini
  // Accounts Summary pakai calculateTotalAssetUsd()
  return accounts.map((a) => ({
    ...a,
    totalValueUsd: Number(a.totalValueUsd || 0),
  }));
};

/* =========================
   DERIVED EQUITY (DAILY)
========================= */

const RANGE_DAYS = {
  "7D": 7,
  "30D": 30,
  "90D": 90,
};

// Ambil tanggal terakhir langsung dari equity data
const getLatestEquityDate = (equity) => {
  if (!Array.isArray(equity) || equity.length === 0) {
    throw new Error("Equity data is empty");
  }
  return equity[equity.length - 1].date;
};

export const getAssetEquityByRange = async (range = "7D") => {
  const equity = await fetchJson(
    DATA_URLS.derivedEquity,
    "derive:equity"
  );

  const latestDate = getLatestEquityDate(equity);
  const end = new Date(latestDate);

  let start;
  if (range === "ALL") {
    start = new Date(equity[0].date);
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

/* =========================
   ASSET SUMMARY (FINAL)
========================= */

export const getAssetSummaryByRange = async (range = "7D") => {
  const { labels, series } = await getAssetEquityByRange(range);

  if (!series.length) {
    return {
      labels: [],
      series: [],
      totalValueUsd: 0,
      percentChange: 0,
    };
  }

  const first = series[0] ?? 0;
  const last = series[series.length - 1] ?? 0;

  const percentChange =
    first > 0 ? ((last - first) / first) * 100 : 0;

  return {
    labels,
    series,
    totalValueUsd: last,
    percentChange,
  };
};

