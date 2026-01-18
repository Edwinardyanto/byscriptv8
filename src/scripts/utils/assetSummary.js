const TIMEFRAMES = new Set(["1D", "7D", "30D", "90D", "ALL"]);

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

const normalizeDateList = (dates) =>
  Array.from(dates)
    .map((date) => {
      const parsed = parseDate(date);
      return parsed ? formatDate(parsed) : null;
    })
    .filter(Boolean)
    .sort();

export const resolveAssetSummaryTimeframe = (timeframe, dates) => {
  const normalized = String(timeframe || "").toUpperCase();
  if (!TIMEFRAMES.has(normalized)) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }

  const normalizedDates = normalizeDateList(dates);
  if (normalizedDates.length === 0) {
    return { start_date: null, end_date: null, timeframe: normalized };
  }

  const endDate = normalizedDates[normalizedDates.length - 1];
  if (normalized === "ALL") {
    return {
      start_date: normalizedDates[0],
      end_date: endDate,
      timeframe: normalized,
    };
  }

  const endDateObj = parseDate(endDate);
  const days = Number.parseInt(normalized, 10);
  const startDateObj = new Date(endDateObj);
  startDateObj.setUTCDate(startDateObj.getUTCDate() - Math.max(days - 1, 0));

  return {
    start_date: formatDate(startDateObj),
    end_date: endDate,
    timeframe: normalized,
  };
};

export const aggregateAssetSummaryRows = (timeframe, rows = []) => {
  const availableDates = new Set(rows.map((row) => row.date).filter(Boolean));
  const { start_date: startDate, end_date: endDate, timeframe: normalized } =
    resolveAssetSummaryTimeframe(timeframe, availableDates);

  if (!startDate || !endDate) {
    return { timeframe: normalized, total_value_usd: 0 };
  }

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

  const total = Array.from(latestByKey.values()).reduce(
    (sum, entry) => sum + Number(entry.value || 0),
    0
  );

  return {
    timeframe: normalized,
    total_value_usd: total,
  };
};
