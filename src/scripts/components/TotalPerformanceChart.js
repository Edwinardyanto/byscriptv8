// src/scripts/components/TotalPerformanceChart.js
import { renderAssetLineChart } from "../charts/assetLineChart.js";

export const renderTotalPerformanceChart = ({
  container,
  data,
  status = "ready",
  onRangeChange,
}) => {
  if (!container || status !== "ready") return;

  const activeRange = data.chart.activeRange || "7D";
  const series = data.chart.ranges[activeRange];
  const labels = data.chart.labels;

  if (!series || !labels || !series.length) return;

renderAssetLineChart(
  container,
  data.chart.ranges[data.chart.activeRange],
  data.chart.labels
);
