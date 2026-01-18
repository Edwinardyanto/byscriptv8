import { aggregateAssetSummaryRows, resolveAssetSummaryTimeframe } from "./utils/assetSummary.js";

const DATA_URLS = {
  accounts: new URL("../../mock-data/data/accounts.json", import.meta.url),
  accountAssets: new URL("../../mock-data/data/account_assets.json", import.meta.url),
  assets: new URL("../../mock-data/data/assets.json", import.meta.url),
  autotraders: new URL("../../mock-data/data/autotraders.json", import.meta.url),
  tradingPlans: new URL("../../mock-data/data/trading_plans.json", import.meta.url),
};

const ACCOUNT_ASSET_DAILY_URL = new URL("../../data/account_assets_daily/", import.meta.url);

const dataCache = new Map();
const inflight = new Map();

const cloneData = (data) => {
  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
};

const fetchDataset = async (key) => {
  if (dataCache.has(key)) {
    return cloneData(dataCache.get(key));
  }

  if (inflight.has(key)) {
    return inflight.get(key).then(cloneData);
  }

  const url = DATA_URLS[key];
  if (!url) {
    throw new Error(`Unknown dataset: ${key}`);
  }

  const request = fetch(url)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load ${key}`);
      }
      return response.json();
    })
    .then((data) => {
      dataCache.set(key, data);
      inflight.delete(key);
      return data;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, request);
  return request.then(cloneData);
};

const extractDateFromFilename = (filename) => {
  const match = filename.match(/(\\d{4}-\\d{2}-\\d{2})\\.json$/);
  return match ? match[1] : null;
};

const listAccountAssetDailyDates = async () => {
  if (typeof window === "undefined") {
    const { readdir } = await import("fs/promises");
    const { fileURLToPath } = await import("url");
    const directoryPath = fileURLToPath(ACCOUNT_ASSET_DAILY_URL);
    const filenames = await readdir(directoryPath);
    return filenames.map(extractDateFromFilename).filter(Boolean);
  }

  const response = await fetch(ACCOUNT_ASSET_DAILY_URL);
  if (!response.ok) {
    throw new Error("Failed to list account asset daily snapshots");
  }
  const html = await response.text();
  return Array.from(html.matchAll(/href="(\\d{4}-\\d{2}-\\d{2})\\.json"/g)).map(
    (match) => match[1]
  );
};

const readJsonResource = async (url) => {
  if (typeof window === "undefined") {
    const { readFile } = await import("fs/promises");
    const { fileURLToPath } = await import("url");
    const filepath = fileURLToPath(url);
    const contents = await readFile(filepath, "utf8");
    return JSON.parse(contents);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}`);
  }
  return response.json();
};

const normalizeAccountAssetSnapshot = (snapshot, date) => {
  const accounts = Array.isArray(snapshot?.accounts) ? snapshot.accounts : [];
  return accounts.flatMap((account) => {
    const assets = Array.isArray(account?.assets) ? account.assets : [];
    return assets.map((asset) => ({
      date,
      account_id: account.account_id,
      asset_id: asset.asset_id,
      value_usd: asset.value_usd ?? asset.value ?? asset.usd_value ?? 0,
    }));
  });
};

export const getAccounts = async () => fetchDataset("accounts");

export const getAccountAssets = async (accountId) => {
  const [accountAssets, assets] = await Promise.all([
    fetchDataset("accountAssets"),
    fetchDataset("assets"),
  ]);
  const assetMap = new Map(assets.map((asset) => [asset.asset_id, asset]));
  return accountAssets
    .filter((entry) => entry.account_id === accountId)
    .map((entry) => {
      const asset = assetMap.get(entry.asset_id);
      return {
        ...entry,
        asset,
        assetSymbol: asset?.symbol,
        assetName: asset?.name,
      };
    })
    .sort((a, b) => Number(b.usd_value || 0) - Number(a.usd_value || 0));
};

export const getAccountValue = async (accountId) => {
  const assets = await getAccountAssets(accountId);
  return assets.reduce((sum, entry) => sum + Number(entry.usd_value || 0), 0);
};

export const getAccountsWithSummary = async () => {
  const [accounts, accountAssets, assets] = await Promise.all([
    fetchDataset("accounts"),
    fetchDataset("accountAssets"),
    fetchDataset("assets"),
  ]);
  const assetsById = new Map(assets.map((asset) => [asset.asset_id, asset]));
  const assetsByAccount = accountAssets.reduce((acc, entry) => {
    if (!acc.has(entry.account_id)) {
      acc.set(entry.account_id, []);
    }
    acc.get(entry.account_id).push(entry);
    return acc;
  }, new Map());

  return accounts.map((account) => {
    const items = (assetsByAccount.get(account.account_id) || []).map((entry) => {
      const asset = assetsById.get(entry.asset_id);
      return {
        ...entry,
        asset,
        assetSymbol: asset?.symbol,
        assetName: asset?.name,
      };
    });
    const totalValueUsd = items.reduce((sum, entry) => sum + Number(entry.usd_value || 0), 0);
    return {
      ...account,
      totalValueUsd,
      assets: items,
    };
  });
};

export const getAutotradersByAccount = async (accountId) => {
  const [autotraders, tradingPlans] = await Promise.all([
    fetchDataset("autotraders"),
    fetchDataset("tradingPlans"),
  ]);
  const plansById = new Map(tradingPlans.map((plan) => [plan.plan_id, plan]));

  return autotraders
    .filter((autotrader) => autotrader.account_id === accountId)
    .map((autotrader) => {
      const plan = plansById.get(autotrader.plan_id);
      return {
        ...autotrader,
        tradingPlan: plan,
        tradingPlanName: plan?.name,
        marketType: plan?.market_type,
      };
    });
};

export async function loadTrades() {
  const res = await fetch("/mock-data/data/trades.json");
  return res.json();
}

export async function loadAccounts() {
  const res = await fetch("/mock-data/data/accounts.json");
  return res.json();
}

export async function loadAutotraders() {
  const res = await fetch("/mock-data/data/autotraders.json");
  return res.json();
}

export const getTradeHistory = async (filters = {}) => {
  const [tradeHistory, assets, accounts, autotraders, tradingPlans] = await Promise.all([
    loadTrades(),
    fetchDataset("assets"),
    fetchDataset("accounts"),
    fetchDataset("autotraders"),
    fetchDataset("tradingPlans"),
  ]);

  const assetsById = new Map(assets.map((asset) => [asset.asset_id, asset]));
  const accountsById = new Map(accounts.map((account) => [account.account_id, account]));
  const autotradersById = new Map(
    autotraders.map((autotrader) => [autotrader.autotrader_id, autotrader])
  );
  const plansById = new Map(tradingPlans.map((plan) => [plan.plan_id, plan]));

  const normalizedFilters = {
    accountId: filters.accountId || "",
    autotraderId: filters.autotraderId || "",
    assetId: filters.assetId || "",
    side: filters.side || "",
    result: filters.result || "",
    marketType: filters.marketType || "",
    from: filters.from ? new Date(filters.from) : null,
    to: filters.to ? new Date(filters.to) : null,
    limit: filters.limit ? Number(filters.limit) : null,
  };

  const filtered = tradeHistory
    .map((trade) => {
      const asset = assetsById.get(trade.asset_id);
      const account = accountsById.get(trade.account_id);
      const autotrader = autotradersById.get(trade.autotrader_id);
      const plan = autotrader ? plansById.get(autotrader.plan_id) : null;
      const executedAt = new Date(trade.executed_at);
      const quantity = Number(trade.quantity ?? trade.size ?? 0);
      return {
        ...trade,
        tradeId: trade.trade_id,
        assetSymbol: asset?.symbol,
        assetName: asset?.name,
        account,
        accountName: account?.provider,
        accountCode: account?.account_code,
        marketType: plan?.market_type || account?.market_type,
        tradingPlanName: plan?.name,
        executedAt,
        quantity,
        valueUsd: Number(trade.price_usd || 0) * quantity,
        pnl_usd: Number(trade.pnl_usd || 0),
      };
    })
    .filter((trade) => {
      if (normalizedFilters.accountId && trade.account_id !== normalizedFilters.accountId) {
        return false;
      }
      if (normalizedFilters.autotraderId && trade.autotrader_id !== normalizedFilters.autotraderId) {
        return false;
      }
      if (normalizedFilters.assetId && trade.asset_id !== normalizedFilters.assetId) {
        return false;
      }
      if (normalizedFilters.side && trade.side !== normalizedFilters.side) {
        return false;
      }
      if (normalizedFilters.result && trade.result !== normalizedFilters.result) {
        return false;
      }
      if (normalizedFilters.marketType && trade.marketType !== normalizedFilters.marketType) {
        return false;
      }
      if (normalizedFilters.from && trade.executedAt < normalizedFilters.from) {
        return false;
      }
      if (normalizedFilters.to && trade.executedAt > normalizedFilters.to) {
        return false;
      }
      return true;
    })
    .sort((a, b) => b.executedAt - a.executedAt);

  if (Number.isFinite(normalizedFilters.limit) && normalizedFilters.limit > 0) {
    return filtered.slice(0, normalizedFilters.limit);
  }

  return filtered;
};

export const getAssetSummary = async (timeframe = "7D") => {
  const availableDates = await listAccountAssetDailyDates();
  const { start_date: startDate, end_date: endDate, timeframe: resolved } =
    resolveAssetSummaryTimeframe(timeframe, availableDates);

  if (!startDate || !endDate) {
    return { timeframe: resolved, total_value_usd: 0 };
  }

  const datesInRange = availableDates
    .filter((date) => date >= startDate && date <= endDate)
    .sort();

  const snapshots = await Promise.all(
    datesInRange.map((date) => readJsonResource(new URL(`${date}.json`, ACCOUNT_ASSET_DAILY_URL)))
  );

  const rows = snapshots.flatMap((snapshot, index) =>
    normalizeAccountAssetSnapshot(snapshot, datesInRange[index])
  );

  return aggregateAssetSummaryRows(resolved, rows);
};
