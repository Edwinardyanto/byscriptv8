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

export const resolveTimeframe = (timeframe, dates) => {
  const normalized = String(timeframe || "").toUpperCase();
  if (!TIMEFRAMES.has(normalized)) {
    throw new Error(`Unsupported timeframe: ${timeframe}`);
  }

  const normalizedDates = normalizeDateList(dates);
  if (normalizedDates.length === 0) {
    return { startDate: null, endDate: null, timeframe: normalized };
  }

  const endDate = normalizedDates[normalizedDates.length - 1];
  if (normalized === "ALL") {
    return {
      startDate: normalizedDates[0],
      endDate,
      timeframe: normalized,
    };
  }

  const endDateObj = parseDate(endDate);
  const days = Number.parseInt(normalized, 10);
  const startDateObj = new Date(endDateObj);
  startDateObj.setUTCDate(startDateObj.getUTCDate() - Math.max(days - 1, 0));

  return {
    startDate: formatDate(startDateObj),
    endDate,
    timeframe: normalized,
  };
};
