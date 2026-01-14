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
const randomInt = (min, max) => Math.floor(random() * (max - min + 1)) + min;
const randomFloat = (min, max, decimals = 2) => {
  const value = min + random() * (max - min);
  return Number(value.toFixed(decimals));
};
const toIso = (date) => date.toISOString().replace(/\.\d{3}Z$/, "Z");

const ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const buildId = (length) =>
  Array.from({ length }, () => ID_CHARS[Math.floor(random() * ID_CHARS.length)]).join("");

const uniqueIds = (count, length) => {
  const ids = new Set();
  while (ids.size < count) {
    ids.add(buildId(length));
  }
  return Array.from(ids);
};

const ASSET_TYPES = [
  { type: "crypto", decimals: 8 },
  { type: "equity", decimals: 2 },
];
const ASSET_SYMBOLS = [
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "AVAX",
  "ADA",
  "XRP",
  "DOGE",
  "DOT",
  "MATIC",
  "LINK",
  "UNI",
  "ATOM",
  "LTC",
  "BCH",
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "TSLA",
  "META",
  "GOOGL",
  "NFLX",
  "ORCL",
  "INTC",
  "AMD",
  "IBM",
  "SAP",
  "CRM",
  "ADBE",
];

const PROVIDERS = ["Binance", "Coinbase", "Kraken", "Gemini", "Interactive Brokers"];
const PROVIDER_TYPES = ["exchange", "broker", "custodian"];
const MARKET_TYPES = ["spot", "futures", "margin"];
const ACCOUNT_STATUSES = ["active", "active", "active", "inactive", "suspended"];

const PLAN_STATUSES = ["active", "active", "paused"];

const AUTOTRADER_STATUSES = ["running", "paused", "error", "stopped"];

const TRADE_SIDES = ["buy", "sell"];

const baseDate = new Date("2024-10-01T08:00:00Z");
const dateOffset = (days) => new Date(baseDate.getTime() + days * 86400000);

const buildAssetName = (symbol) => {
  if (symbol.length <= 4) {
    return symbol === "BTC" ? "Bitcoin" : symbol === "ETH" ? "Ethereum" : `${symbol} Token`;
  }
  return `${symbol} Holdings`;
};

const generateAssets = (count) =>
  Array.from({ length: count }, (_, index) => {
    const assetType = pick(ASSET_TYPES);
    const symbolBase = ASSET_SYMBOLS[index % ASSET_SYMBOLS.length];
    const symbol = index < ASSET_SYMBOLS.length ? symbolBase : `${symbolBase}${index}`;
    return {
      asset_id: String(index + 1).padStart(7, "0"),
      symbol,
      name: buildAssetName(symbol),
      type: assetType.type,
      decimals: assetType.decimals,
      is_active: true,
    };
  });

const generateAccounts = (count) => {
  const ids = uniqueIds(count, 10);
  return ids.map((id, index) => ({
    account_id: id,
    account_code: buildId(10),
    provider: PROVIDERS[index % PROVIDERS.length],
    provider_type: PROVIDER_TYPES[index % PROVIDER_TYPES.length],
    market_type: pick(MARKET_TYPES),
    status: pick(ACCOUNT_STATUSES),
    created_at: toIso(dateOffset(2 + index)),
  }));
};

const generateTradingPlans = (count) =>
  uniqueIds(count, 10).map((id, index) => ({
    plan_id: id,
    name: `Trading Plan ${index + 1}`,
    market_type: pick(MARKET_TYPES),
    status: pick(PLAN_STATUSES),
    created_at: toIso(dateOffset(10 + index)),
  }));

const generateAutotraders = (count, accounts, plans) =>
  uniqueIds(count, 10).map((id, index) => {
    const status = pick(AUTOTRADER_STATUSES);
    const capital = randomFloat(250, 75000, 2);
    const pnlPercent = randomFloat(-35, 45, 2);
    const pnlUsd = Number(((capital * pnlPercent) / 100).toFixed(2));
    const isRunning = status === "running";
    return {
      autotrader_id: id,
      plan_id: plans[index % plans.length].plan_id,
      account_id: accounts[index % accounts.length].account_id,
      status,
      capital_usd: capital,
      pnl_percent: pnlPercent,
      pnl_usd: pnlUsd,
      win_rate: randomInt(32, 88),
      is_running: isRunning,
      created_at: toIso(dateOffset(20 + index)),
    };
  });

const generateAccountAssets = (accounts, assets) => {
  const entries = [];
  accounts.forEach((account, index) => {
    const assetCount = randomInt(1, 140);
    const selected = new Set();
    while (selected.size < assetCount) {
      selected.add(randomInt(0, assets.length - 1));
    }
    selected.forEach((assetIndex) => {
      const asset = assets[assetIndex];
      const amount =
        asset.type === "crypto" ? randomFloat(0.01, 4.5, 6) : randomFloat(1, 240, 4);
      const priceUsd =
        asset.type === "crypto" ? randomFloat(5, 52000, 2) : randomFloat(10, 800, 2);
      const usdValue = Number((amount * priceUsd).toFixed(2));
      entries.push({
        account_id: account.account_id,
        asset_id: asset.asset_id,
        amount,
        price_usd: priceUsd,
        usd_value: usdValue,
        last_updated: toIso(dateOffset(90 + index)),
      });
    });
  });
  return entries;
};

const generateTradeHistory = (count, assets, autotraders) =>
  Array.from({ length: count }, (_, index) => {
    const autotrader = pick(autotraders);
    const asset = pick(assets);
    const side = pick(TRADE_SIDES);
    const priceUsd =
      asset.type === "crypto" ? randomFloat(15, 60000, 2) : randomFloat(10, 980, 2);
    const quantity =
      asset.type === "crypto" ? randomFloat(0.01, 2.5, 6) : randomFloat(1, 120, 4);
    const pnlUsd = randomFloat(-120, 180, 2);
    const result = pnlUsd >= 0 ? "win" : "loss";

    return {
      trade_id: `${1768378203049}${String(index + 1).padStart(8, "0")}`,
      autotrader_id: autotrader.autotrader_id,
      account_id: autotrader.account_id,
      asset_id: asset.asset_id,
      side,
      quantity,
      price_usd: priceUsd,
      pnl_usd: pnlUsd,
      result,
      executed_at: toIso(dateOffset(100 + index)),
    };
  });

const writeJson = (filename, data) => {
  const filePath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
};

const generateAll = () => {
  const accounts = generateAccounts(51);
  const assets = generateAssets(150);
  const tradingPlans = generateTradingPlans(73);
  const autotraders = generateAutotraders(103, accounts, tradingPlans);
  const accountAssets = generateAccountAssets(accounts, assets);
  const tradeHistory = generateTradeHistory(1017, assets, autotraders);

  writeJson("accounts.json", accounts);
  writeJson("assets.json", assets);
  writeJson("trading_plans.json", tradingPlans);
  writeJson("autotraders.json", autotraders);
  writeJson("account_assets.json", accountAssets);
  writeJson("trade_history.json", tradeHistory);

  console.log("Mock data generated in", OUTPUT_DIR);
};

generateAll();
