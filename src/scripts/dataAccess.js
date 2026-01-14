const dataRoot = new URL("../../mock-data/data/", import.meta.url);
const dataCache = new Map();

const cloneData = (data) => {
  if (typeof structuredClone === "function") {
    return structuredClone(data);
  }
  return JSON.parse(JSON.stringify(data));
};

const fetchJson = async (fileName) => {
  if (dataCache.has(fileName)) {
    return cloneData(dataCache.get(fileName));
  }
  const response = await fetch(new URL(fileName, dataRoot));
  if (!response.ok) {
    throw new Error(`Unable to load ${fileName}`);
  }
  const data = await response.json();
  dataCache.set(fileName, data);
  return cloneData(data);
};

const buildIndex = (items, key) =>
  items.reduce((map, item) => {
    map.set(item[key], item);
    return map;
  }, new Map());

export const getAccounts = async () => fetchJson("accounts.json");

export const getAccountAssets = async (accountId) => {
  const [accountAssets, assets] = await Promise.all([
    fetchJson("account_assets.json"),
    fetchJson("assets.json"),
  ]);
  const assetsById = buildIndex(assets, "asset_id");
  return accountAssets
    .filter((holding) => holding.account_id === accountId)
    .map((holding) => {
      const asset = assetsById.get(holding.asset_id);
      return {
        ...holding,
        asset,
        asset_symbol: asset?.symbol || "",
        asset_name: asset?.name || "",
      };
    });
};

export const getAccountValue = async (accountId) => {
  const holdings = await getAccountAssets(accountId);
  return holdings.reduce((sum, holding) => sum + Number(holding.usd_value || 0), 0);
};

export const getAccountsWithSummary = async () => {
  const [accounts, accountAssets] = await Promise.all([
    fetchJson("accounts.json"),
    fetchJson("account_assets.json"),
  ]);
  const totalsByAccount = accountAssets.reduce((acc, holding) => {
    acc[holding.account_id] = (acc[holding.account_id] || 0) + Number(holding.usd_value || 0);
    return acc;
  }, {});
  const accountsWithTotals = accounts.map((account) => ({
    ...account,
    total_value: totalsByAccount[account.account_id] || 0,
  }));
  const totalValue = accountsWithTotals.reduce(
    (sum, account) => sum + Number(account.total_value || 0),
    0
  );
  return {
    total_value: totalValue,
    accounts: accountsWithTotals,
  };
};

export const getAutotradersByAccount = async (accountId) => {
  const [autotraders, tradingPlans] = await Promise.all([
    fetchJson("autotraders.json"),
    fetchJson("trading_plans.json"),
  ]);
  const plansById = buildIndex(tradingPlans, "plan_id");
  return autotraders
    .filter((autotrader) => autotrader.account_id === accountId)
    .map((autotrader) => ({
      ...autotrader,
      plan: plansById.get(autotrader.plan_id) || null,
    }));
};

const normalizeDate = (value) => {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getTradeHistory = async (filters = {}) => {
  const {
    accountId,
    assetId,
    autotraderId,
    side,
    result,
    startDate,
    endDate,
    limit,
    sort = "desc",
  } = filters;

  const [trades, accounts, assets, autotraders, tradingPlans] = await Promise.all([
    fetchJson("trade_history.json"),
    fetchJson("accounts.json"),
    fetchJson("assets.json"),
    fetchJson("autotraders.json"),
    fetchJson("trading_plans.json"),
  ]);

  const accountsById = buildIndex(accounts, "account_id");
  const assetsById = buildIndex(assets, "asset_id");
  const autotradersById = buildIndex(autotraders, "autotrader_id");
  const plansById = buildIndex(tradingPlans, "plan_id");

  const start = normalizeDate(startDate);
  const end = normalizeDate(endDate);

  const filtered = trades
    .filter((trade) => {
      if (accountId && trade.account_id !== accountId) {
        return false;
      }
      if (assetId && trade.asset_id !== assetId) {
        return false;
      }
      if (autotraderId && trade.autotrader_id !== autotraderId) {
        return false;
      }
      if (side && trade.side?.toLowerCase() !== side.toLowerCase()) {
        return false;
      }
      if (result && trade.result?.toLowerCase() !== result.toLowerCase()) {
        return false;
      }
      const executedAt = normalizeDate(trade.executed_at);
      if (start && executedAt && executedAt < start) {
        return false;
      }
      if (end && executedAt && executedAt > end) {
        return false;
      }
      return true;
    })
    .map((trade) => {
      const account = accountsById.get(trade.account_id) || null;
      const asset = assetsById.get(trade.asset_id) || null;
      const autotrader = autotradersById.get(trade.autotrader_id) || null;
      const plan = autotrader ? plansById.get(autotrader.plan_id) || null : null;
      const valueUsd = Number(trade.price_usd || 0) * Number(trade.quantity || 0);
      return {
        ...trade,
        executed_at_date: normalizeDate(trade.executed_at),
        account,
        asset,
        autotrader,
        plan,
        value_usd: valueUsd,
      };
    })
    .sort((a, b) => {
      const aTime = a.executed_at_date ? a.executed_at_date.getTime() : 0;
      const bTime = b.executed_at_date ? b.executed_at_date.getTime() : 0;
      return sort === "asc" ? aTime - bTime : bTime - aTime;
    });

  if (limit) {
    return filtered.slice(0, limit);
  }

  return filtered;
};
