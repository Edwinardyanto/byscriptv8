import { resolveTimeframe } from "../utils/resolveTimeframe.js";
import {
  getAssetEquitySeries,
  listAccountAssetDailyDates,
} from "./assetEquitySeries.js";

export const getAssetSummary = async (timeframe = "7D") => {
  const availableDates = await listAccountAssetDailyDates();
  const { startDate, endDate, timeframe: resolved } = resolveTimeframe(timeframe, availableDates);

  if (!startDate || !endDate) {
    return { timeframe: resolved, total_value_usd: 0, percentage_change: 0, series: [] };
  }

  const series = await getAssetEquitySeries(resolved, availableDates);
  const firstValue = series[0]?.value ?? 0;
  const lastValue = series[series.length - 1]?.value ?? 0;
  const percentageChange =
    firstValue === 0 ? 0 : ((lastValue - firstValue) / firstValue) * 100;

  return {
    timeframe: resolved,
    total_value_usd: lastValue,
    percentage_change: percentageChange,
    series,
  };
};
