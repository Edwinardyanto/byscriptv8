import { resolveTimeframe } from "../utils/resolveTimeframe.js";

const ACCOUNT_ASSET_DAILY_URL = new URL("../../data/account_assets_daily/", import.meta.url);

const parseDate = (value) => {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const formatDate = (date) => date.toISOString().slice(0, 10);

const extractDateFromFilename = (filename) => {
  const match = filename.match(/(\d{4}-\d{2}-\d{2})\.json$/);
  return match ? match[1] : null;
};

const listSnapshotDates = async () => {
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

const aggregateAssetSummaryRows = (rows, startDate, endDate) => {
  const latestByKey = new Map();

  rows.forEach((row) => {
    if (!row?.account_id || !row?.asset_id) {
      return;
    }
    const parsed = parseDate(row.date);
    if (!parsed) {
      return;
    }
    const rowDate = formatDate(parsed);
    if (rowDate < startDate || rowDate > endDate) {
      return;
    }

    const key = `${row.account_id}::${row.asset_id}`;
    const existing = latestByKey.get(key);
    if (!existing || rowDate > existing.date) {
      latestByKey.set(key, {
        date: rowDate,
        value: Number(row.value_usd ?? row.value ?? row.usd_value ?? 0),
      });
    }
  });

  return Array.from(latestByKey.values()).reduce(
    (sum, entry) => sum + Number(entry.value || 0),
    0
  );
};

export const getAssetSummary = async (timeframe = "7D") => {
  const availableDates = await listSnapshotDates();
  const { startDate, endDate, timeframe: resolved } = resolveTimeframe(timeframe, availableDates);

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

  const total = aggregateAssetSummaryRows(rows, startDate, endDate);

  return {
    timeframe: resolved,
    total_value_usd: total,
  };
};
