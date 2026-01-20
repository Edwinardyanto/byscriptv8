import { getAssetEquitySeries } from "./dataAccess.js";
import { renderAssetLineChart } from "./charts/assetLineChart.js";

export const renderAssetSummaryDaily = async (days = 7) => {
  const series = await getAssetEquitySeries(days);

  renderAssetLineChart(
    "#asset-summary-line-chart",
    series.map(p => p.value),
    series.map(p => p.date)
  );
};
