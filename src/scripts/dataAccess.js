// src/scripts/dataAccess.js
// Data-first access layer (AUTHORITATIVE SOURCE)

const DATA_URLS = {
  accounts: new URL("../../data/accounts.json", import.meta.url),
  assets: new URL("../../data/assets.json", import.meta.url),
  autotraders: new URL("../../data/autotraders.json", import.meta.url),
  tradingPlans: new URL("../../data/trading_plans.json", import.meta.url),
  latestMeta: new URL("../../data/meta/latest", import.meta.url),
  accountAssetsDailyDir: new URL("../../data/account_assets_daily/", import.meta.url),
  assetPriceDailyDir: new URL("../../data/asset_price_daily/", import.meta.url),
};

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

const getLatestMeta = () =>
  fetchJson(DATA_URLS.latestMeta, "meta:latest");

export const getLatestDate = async () => {
  const meta = await getLatestMeta();
  return meta.latestDate;
};

export const getAssetEquityByRange = async (range = "7D") => {
  const meta = await getLatestMeta();
  const equity = await fetchJson(
    new URL("../derive/asset_equity_daily.json", import.meta.url),
    "derive:equity"
  );

  const allDates = equity.map((e) => e.date);
  const end = new Date(meta.latestDate);

  let start;
  if (range === "ALL") {
    start = new Date(allDates[0]);
  } else {
    const days = { "7D": 7, "30D": 30, "90D": 90 }[range] || 7;
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
