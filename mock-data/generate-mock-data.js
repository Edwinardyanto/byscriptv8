const fs = require("fs");
const path = require("path");

const OUTPUT_DIR = path.join(__dirname, "data");

const seedRandom = (seed) => {
  let state = seed;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
};

const random = seedRandom(42);
const pick = (list) => list[Math.floor(random() * list.length)];
const randomInt = (min, max) =>
  Math.floor(random() * (max - min + 1)) + min;
const randomFloat = (min, max, decimals = 2) => {
  const value = min + random() * (max - min);
  return Number(value.toFixed(decimals));
};
const formatId = (prefix, index) =>
  `${prefix}_${String(index).padStart(3, "0")}`;
const toIso = (date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

const ASSET_LIBRARY = [
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    asset_type: "equity",
    exchange: "NASDAQ",
    currency: "USD",
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corp.",
    asset_type: "equity",
    exchange: "NASDAQ",
    currency: "USD",
  },
  {
    symbol: "TSLA",
    name: "Tesla, Inc.",
    asset_type: "equity",
    exchange: "NASDAQ",
    currency: "USD",
  },
  {
    symbol: "AMZN",
    name: "Amazon.com, Inc.",
    asset_type: "equity",
    exchange: "NASDAQ",
    currency: "USD",
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corp.",
    asset_type: "equity",
    exchange: "NASDAQ",
    currency: "USD",
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    asset_type: "crypto",
    exchange: "COINBASE",
    currency: "USD",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    asset_type: "crypto",
    exchange: "COINBASE",
    currency: "USD",
  },
  {
    symbol: "SOL",
    name: "Solana",
    asset_type: "crypto",
    exchange: "BINANCE",
    currency: "USD",
  },
];

const ACCOUNT_NAMES = [
  "Primary Brokerage",
  "Retirement IRA",
  "Growth Portfolio",
  "Trading Sandbox",
];
const ACCOUNT_TYPES = ["individual", "retirement", "joint", "corporate"];
const STATUSES = ["active", "active", "active", "suspended"];

const PLAN_TITLES = [
  "Core Growth Plan",
  "Capital Preservation",
  "Momentum Capture",
  "Income Builder",
  "Tactical Allocation",
];
const PLAN_DESCRIPTIONS = [
  "Long-biased growth allocation with moderate risk controls.",
  "Lower volatility strategy focused on capital preservation.",
  "Short-term tactical trades using momentum filters.",
  "Dividend and yield-focused strategy with monthly rebalancing.",
  "Opportunistic rebalancing across asset classes.",
];
const RISK_LEVELS = ["low", "moderate", "high"];
const STRATEGIES = ["breakout", "rebalancing", "mean-reversion", "trend"];
const AUTOTRADER_NAMES = [
  "Momentum Scout",
  "Dividend Rebalancer",
  "Range Navigator",
  "Signal Pulse",
  "Volatility Guard",
];
const TRADE_SIDES = ["buy", "sell"];
const TRADE_STATUSES = ["filled", "filled", "filled", "cancelled"];

const baseDate = new Date("2024-01-01T08:00:00Z");
const dateOffset = (days) => new Date(baseDate.getTime() + days * 86400000);

const generateAccounts = (count) =>
  Array.from({ length: count }, (_, index) => {
    const createdAt = dateOffset(4 + index * 7 + randomInt(0, 3));
    return {
      id: formatId("acct", index + 1),
      account_number: `TRD-${1001 + index}`,
      name: ACCOUNT_NAMES[index % ACCOUNT_NAMES.length],
      account_type: ACCOUNT_TYPES[index % ACCOUNT_TYPES.length],
      base_currency: "USD",
      status: STATUSES[index % STATUSES.length],
      owner_id: formatId("user", index + 1),
      created_at: toIso(createdAt),
    };
  });

const generateAssets = () =>
  ASSET_LIBRARY.map((asset, index) => ({
    id: formatId("asset", index + 1),
    ...asset,
    is_active: true,
    created_at: toIso(dateOffset(9 + index)),
  }));

const generateTradingPlans = (accounts) => {
  let planIndex = 1;
  return accounts.flatMap((account, index) => {
    const planCount = index % 2 === 0 ? 2 : 1;
    return Array.from({ length: planCount }, (_, planOffset) => {
      const titleIndex = (index + planOffset) % PLAN_TITLES.length;
      return {
        id: formatId("plan", planIndex++),
        account_id: account.id,
        name: PLAN_TITLES[titleIndex],
        description: PLAN_DESCRIPTIONS[titleIndex],
        risk_level: pick(RISK_LEVELS),
        max_position_size: randomInt(6000, 20000),
        max_daily_loss: randomInt(400, 2000),
        allowed_asset_types:
          planOffset === 0
            ? ["equity", "crypto"]
            : ["equity"],
        is_active: true,
        created_at: toIso(dateOffset(30 + planIndex)),
      };
    });
  });
};

const generateAutotraders = (plans) =>
  plans.map((plan, index) => {
    const createdAt = dateOffset(45 + index * 2 + randomInt(0, 2));
    return {
      id: formatId("auto", index + 1),
      account_id: plan.account_id,
      trading_plan_id: plan.id,
      name: AUTOTRADER_NAMES[index % AUTOTRADER_NAMES.length],
      strategy: pick(STRATEGIES),
      status: index % 4 === 0 ? "paused" : "active",
      max_open_positions: randomInt(2, 8),
      created_at: toIso(createdAt),
      last_run_at: toIso(dateOffset(55 + index + randomInt(0, 4))),
    };
  });

const generateAccountAssets = (accounts, assets) => {
  const entries = [];
  let entryIndex = 1;
  accounts.forEach((account) => {
    const assetCount = randomInt(2, 5);
    const selected = new Set();
    while (selected.size < assetCount) {
      selected.add(randomInt(0, assets.length - 1));
    }
    selected.forEach((assetIndex) => {
      const asset = assets[assetIndex];
      const quantity =
        asset.asset_type === "crypto"
          ? randomFloat(0.15, 3.5, 4)
          : randomInt(5, 120);
      const averageCost =
        asset.asset_type === "crypto"
          ? randomFloat(1800, 52000, 2)
          : randomFloat(35, 450, 2);
      const marketValue = Number((quantity * averageCost * randomFloat(0.9, 1.2, 2)).toFixed(2));
      entries.push({
        id: formatId("acct_asset", entryIndex++),
        account_id: account.id,
        asset_id: asset.id,
        quantity,
        average_cost: averageCost,
        market_value: marketValue,
        last_updated: toIso(dateOffset(70 + randomInt(0, 6))),
      });
    });
  });
  return entries;
};

const generateTradeHistory = (accounts, assets, plans, autotraders) => {
  const trades = [];
  for (let index = 0; index < 14; index += 1) {
    const account = pick(accounts);
    const accountPlans = plans.filter((plan) => plan.account_id === account.id);
    const plan = pick(accountPlans);
    const autotrader = autotraders.find(
      (auto) => auto.trading_plan_id === plan.id
    );
    const asset = pick(assets);
    const side = pick(TRADE_SIDES);
    const price =
      asset.asset_type === "crypto"
        ? randomFloat(1500, 48000, 2)
        : randomFloat(25, 520, 2);
    const quantity =
      asset.asset_type === "crypto"
        ? randomFloat(0.05, 1.8, 4)
        : randomInt(1, 60);
    trades.push({
      id: formatId("trade", index + 1),
      account_id: account.id,
      asset_id: asset.id,
      trading_plan_id: plan.id,
      autotrader_id: autotrader ? autotrader.id : null,
      side,
      quantity,
      price,
      fees: Number((price * quantity * 0.001).toFixed(2)),
      executed_at: toIso(dateOffset(60 + index)),
      order_id: formatId("ord", 9001 + index),
      status: pick(TRADE_STATUSES),
    });
  }
  return trades;
};

const writeJson = (filename, data) => {
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const generateAll = () => {
  const accounts = generateAccounts(4);
  const assets = generateAssets();
  const tradingPlans = generateTradingPlans(accounts);
  const autotraders = generateAutotraders(tradingPlans);
  const accountAssets = generateAccountAssets(accounts, assets);
  const tradeHistory = generateTradeHistory(
    accounts,
    assets,
    tradingPlans,
    autotraders
  );

  writeJson("accounts.json", accounts);
  writeJson("assets.json", assets);
  writeJson("trading_plans.json", tradingPlans);
  writeJson("autotraders.json", autotraders);
  writeJson("account_assets.json", accountAssets);
  writeJson("trade_history.json", tradeHistory);

  console.log("Mock data generated in", OUTPUT_DIR);
};

generateAll();
