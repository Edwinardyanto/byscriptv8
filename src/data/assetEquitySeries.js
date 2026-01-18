import { resolveTimeframe } from "../utils/resolveTimeframe.js";

const ACCOUNT_ASSET_DAILY_URL = new URL("../../data/account_assets_daily/", import.meta.url);

const extractDateFromFilename = (filename) => {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})\.json$/);
  return match ? match[1] : null;
};

export const listAccountAssetDailyDates = async () => {
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
  return Array.from(html.matchAll(/href="(\d{4}-\d{2}-\d{2})\.json"/g)).map(
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

const aggregateDailyEquity = (rows) => {
  const latestByKey = new Map();
  rows.forEach((row) => {
    if (!row?.account_id || !row?.asset_id) {
      return;
    }
    const key = `${row.account_id}::${row.asset_id}`;
    latestByKey.set(key, Number(row.value_usd ?? row.value ?? row.usd_value ?? 0));
  });

  return Array.from(latestByKey.values()).reduce((sum, value) => sum + Number(value || 0), 0);
};

export const getAssetEquitySeries = async (timeframe = "7D", availableDates = null) => {
  const dates = Array.isArray(availableDates) ? availableDates : await listAccountAssetDailyDates();
  const { startDate, endDate } = resolveTimeframe(timeframe, dates);

  if (!startDate || !endDate) {
    return [];
  }

  const datesInRange = dates.filter((date) => date >= startDate && date <= endDate).sort();
  if (datesInRange.length === 0) {
    return [];
  }

  const snapshots = await Promise.all(
    datesInRange.map((date) => readJsonResource(new URL(`${date}.json`, ACCOUNT_ASSET_DAILY_URL)))
  );

  return snapshots.map((snapshot, index) => {
    const date = datesInRange[index];
    const rows = normalizeAccountAssetSnapshot(snapshot, date);
    return {
      date,
      value: aggregateDailyEquity(rows),
    };
  });
};
