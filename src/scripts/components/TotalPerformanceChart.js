// src/scripts/components/TotalPerformanceChart.js
import { renderAssetLineChart } from "../charts/assetLineChart.js";

export const renderTotalPerformanceChart = ({
  container,
  data,
  status = "ready",
  onRangeChange,
}) => {
  if (!container || status !== "ready" || !data?.chart) return;

  const activeRange = data.chart.activeRange || "7D";
  const series = data.chart.ranges?.[activeRange];
  const labels = data.chart.labels;

  if (!Array.isArray(series) || !Array.isArray(labels) || series.length === 0) {
    return;
  }

  renderAssetLineChart(
    container,
    series,
    labels
  );
};
