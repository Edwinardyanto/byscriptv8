// src/scripts/components/TotalPerformanceChart.js
// ======================================================
// TOTAL PERFORMANCE CHART (STATE CONTROLLED)
// ======================================================

import { renderAssetLineChart } from "../charts/assetLineChart.js";

/* ------------------------------------------------------
 * Component Renderer
 * ------------------------------------------------------ */

export const renderTotalPerformanceChart = ({
  container,
  data,
  status,
  onRangeChange,
}) => {
  if (!container) return;

  // ===============================
  // Loading / Empty Guards
  // ===============================
  if (status === "loading") {
    container.innerHTML = "Loading...";
    return;
  }

  if (!data?.chart) {
    container.innerHTML = "No data";
    return;
  }

  // ===============================
  // HEADER FIELDS (match index.html)
  // ===============================
  const totalField = document.querySelector(
    "[data-field='asset.totalBalance']"
  );

  const changeField = document.querySelector(
    "[data-field='asset.change']"
  );

  if (totalField) totalField.textContent = data.totalValue;

  if (changeField) {
    const pct = data.percent || 0;
    changeField.textContent = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;

    changeField.classList.toggle("positive", pct >= 0);
    changeField.classList.toggle("negative", pct < 0);
  }

  // ===============================
  // TIMEFRAME PILLS (controlled)
  // ===============================
  const pills = document.querySelectorAll("[data-range]");
  pills.forEach((btn) => {
    btn.classList.toggle(
      "active",
      btn.dataset.range === data.chart.activeRange
    );

    btn.onclick = () => {
      if (onRangeChange) onRangeChange(btn.dataset.range);
    };
  });

  // ===============================
  // CHART RENDER (SVG)
  // ===============================
  container.innerHTML = "";

  renderAssetLineChart({
    container,
    series: data.chart.series,
    labels: data.chart.labels,
  });
};
