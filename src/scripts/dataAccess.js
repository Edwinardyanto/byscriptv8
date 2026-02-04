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
  positionsDailyBase: new URL("../../data/positions_daily/", import.meta.url),

  trades: new URL("../../data/trades.json", import.meta.url),
  providerRules: new URL("../../data/provider_market_rules.json", import.meta.url),
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

export const getTrades = async () =>
  fetchJson(DATA_URLS.trades, "trades");

// Trade History: execution ledger enriched for UI.
//
// opts:
// - accountId: filter to a single account
// - from: Date or ms timestamp (inclusive)
// - to: Date or ms timestamp (exclusive)
// - limit: max rows returned
export const getTradeHistory = async (opts = {}) => {
  const { accountId, from, to, limit } = opts;

  const [trades, accounts, assets, plans] = await Promise.all([
    getTrades(),
    getAccounts(),
    getAssets(),
    getTradingPlans(),
  ]);

  const accountMap = new Map(
    (accounts || []).map((a) => [a.account_id, a])
  );
  const assetMap = new Map(
    (assets || []).map((a) => [a.asset_id, a])
  );
  const planMap = new Map(
    (plans || []).map((p) => [p.plan_id, p])
  );

  const fromMs = from
    ? from instanceof Date
      ? from.getTime()
      : Number(from)
    : null;
  const toMs = to
    ? to instanceof Date
      ? to.getTime()
      : Number(to)
    : null;

  let rows = Array.isArray(trades) ? trades.slice() : [];

  if (accountId) {
    rows = rows.filter((t) => String(t.account_id) === String(accountId));
  }

  if (fromMs != null) {
    rows = rows.filter((t) => Number(t.filled_at || 0) * 1000 >= fromMs);
  }

  if (toMs != null) {
    rows = rows.filter((t) => Number(t.filled_at || 0) * 1000 < toMs);
  }

  rows.sort((a, b) => Number(b.filled_at || 0) - Number(a.filled_at || 0));

  const enriched = rows.map((t) => {
    const acc = accountMap.get(t.account_id);
    const asset = assetMap.get(t.asset_id);
    const plan = planMap.get(t.plan_id);
    const filledAt = Number(t.filled_at || 0) * 1000;

    return {
      ...t,
      filled_at_ms: filledAt,
      account_name: acc?.account_name || t.account_id,
      exchange: acc?.exchange || acc?.provider,
      market_type: acc?.market_type,
      account_color_id: acc?.color_id,
      asset_symbol: asset?.asset_symbol || t.asset_id,
      asset_color_id: asset?.color_id,
      trading_plan_name: plan?.name,
      action:
        t.reduce_only === true
          ? "Close"
          : String(t.side || "").toLowerCase() === "buy"
          ? "Buy"
          : "Sell",
    };
  });

  return typeof limit === "number" ? enriched.slice(0, limit) : enriched;
};

export const getAssetSymbolMap = async () => {
  const assets = await getAssets();
  const map = new Map();
  for (const a of assets) map.set(a.asset_id, a.asset_symbol);
  return map;
};

/* =========================
   DERIVED EQUITY (CHART SOURCE)
========================= */

export const getEquityDaily = async () => {
  const data = await fetchJson(DATA_URLS.equityDaily, "derive:equity");
  if (!Array.isArray(data)) return [];

  // Support both value and equity_usd (value is UI-friendly)
  return data
    .filter((d) => d && d.date && (typeof d.value === "number" || typeof d.equity_usd === "number"))
    .map((d) => ({
      date: d.date,
      value: typeof d.value === "number" ? d.value : Number(d.equity_usd || 0),
      equity_usd: typeof d.equity_usd === "number" ? d.equity_usd : Number(d.value || 0),
    }))
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
      tradingPlanName: planMap.get(a.plan_id)?.name || "",
    }));
};

/* =========================
   ACCOUNTS SUMMARY (REAL USD + INCLUDE UNREALIZED)
========================= */

export const getAccountsSummaryByDate = async (date) => {
  const [accounts, assets] = await Promise.all([getAccounts(), getAssets()]);
  const accountMap = new Map(accounts.map((a) => [a.account_id, a]));

  // Fast lookup for asset branding
  const assetMeta = new Map(
    (assets || []).map((a) => [
      a.asset_id,
      { symbol: a.asset_symbol, color_id: a.color_id },
    ])
  );

  const stableIds = new Set(
    assets
      .filter((a) => a.asset_symbol === "USDT" || a.asset_symbol === "USDC")
      .map((a) => a.asset_id)
  );

  // load account asset snapshot
  const dailyAssets = await fetchJson(
    new URL(`${date}.json`, DATA_URLS.accountAssetsBase),
    `accountAssets-${date}`
  );

  // load asset price snapshot
  const dailyPrices = await fetchJson(
    new URL(`${date}.json`, DATA_URLS.assetPriceBase),
    `assetPrices-${date}`
  );

  // load positions snapshot (for unrealized PnL)
  const dailyPositions = await fetchJson(
    new URL(`${date}.json`, DATA_URLS.positionsDailyBase),
    `positions-${date}`
  );

  // build price map (force stablecoins = 1.0)
  const priceMap = new Map();
  for (const p of dailyPrices.prices || []) {
    priceMap.set(p.asset_id, Number(p.price_usd || 0));
  }
  for (const sid of stableIds) priceMap.set(sid, 1.0);

  // build unrealized map per account
  const unrealizedMap = new Map();
  for (const a of dailyPositions.accounts || []) {
    let u = 0;
    for (const pos of a.positions || []) {
      u += Number(pos.unrealized_pnl || 0);
    }
    unrealizedMap.set(a.account_id, u);
  }

  // compute per account equity
  const accountValues = [];

  for (const acc of dailyAssets.accounts || []) {
    let totalUsd = 0;

    const holdings = [];

    // spot + cash holdings
    for (const asset of acc.assets || []) {
      const qty = Number(asset.value || 0);
      if (!qty) continue;

      const price = priceMap.get(asset.asset_id) || 0;
      const usd = qty * price;
      totalUsd += usd;

      const meta = assetMeta.get(asset.asset_id) || {};
      holdings.push({
        asset_id: asset.asset_id,
        assetSymbol: meta.symbol || "UNKNOWN",
        value: qty,
        usd_value: usd,
        color_id: meta.color_id,
      });
    }

    // include unrealized for futures + web3_futures
    totalUsd += unrealizedMap.get(acc.account_id) || 0;

    const meta = accountMap.get(acc.account_id);

    accountValues.push({
      account_id: acc.account_id,
      account_name: meta?.account_name || acc.account_id,
      account_code: meta?.account_code,
      provider: meta?.exchange,
      market_type: meta?.market_type,
      color_id: meta?.color_id,
      totalValueUsd: totalUsd,
      assets: holdings,
    });
  }

  // sort DESC
  accountValues.sort((a, b) => b.totalValueUsd - a.totalValueUsd);

  return accountValues;
};

/* =========================
   LATEST ACCOUNTS SUMMARY
========================= */

export const getAccountsWithSummary = async () => {
  const equity = await getEquityDaily();

  if (!Array.isArray(equity) || equity.length === 0) {
    return getAccountsSummaryByDate("2025-01-03");
  }

  const latestDate = equity[equity.length - 1].date;
  return getAccountsSummaryByDate(latestDate);
};

export const getProviderRules = async () =>
  fetchJson(DATA_URLS.providerRules, "providerRules");

export const getAccountMetaMap = async () => {
  const accounts = await getAccounts();
  const map = new Map();

  for (const a of accounts) {
    map.set(a.account_id, {
      name: a.account_name || a.account_id,
      exchange: a.exchange || a.provider || "exchange",
      color_id: a.color_id,
    });
  }

  return map;
};

export const getAssetMetaMap = async () => {
  const assets = await getAssets();
  const map = new Map();

  for (const a of assets || []) {
    map.set(a.asset_id, {
      symbol: a.asset_symbol,
      color_id: a.color_id,
    });
  }

  return map;
};
