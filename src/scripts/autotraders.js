import { renderAssetLineChart } from "./charts/assetLineChart.js";

const chartContainer = document.querySelector(
  ".page-autotraders [data-chart='autotraders-performance']"
);

if (chartContainer) {
  const values = chartContainer.dataset.values
    ? chartContainer.dataset.values
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => !Number.isNaN(value))
    : [];

  if (values.length) {
    renderAssetLineChart(chartContainer, values);
  }
}
