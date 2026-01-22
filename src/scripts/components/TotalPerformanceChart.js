// src/scripts/components/TotalPerformanceChart.js
import { renderAssetLineChart } from "../charts/assetLineChart.js";

const setText = (selector, value) => {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
};

const setActivePill = (range) => {
  document.querySelectorAll(".timeframe-pill").forEach((pill) => {
    pill.classList.toggle(
      "active",
      pill.dataset.bound === range
    );
  });
};

export const renderTotalPerformanceChart = ({
  container,
  data,
  status = "ready",
  onRangeChange,
}) => {
  if (!container) return;

  // ======================
  // STATUS HANDLING
  // ======================
  if (status === "loading") {
    setText('[data-field="asset.totalBalance"]', "Loading...");
    setText('[data-field="asset.change"]', "--");
    return;
  }

  if (status === "error" || !data) {
    setText('[data-field="asset.totalBalance"]', "--");
    setText('[data-field="asset.change"]', "--");
    return;
  }

  if (!data.chart) return;

  // ======================
  // TOTAL & CHANGE
  // ======================
  setText('[data-field="asset.totalBalance"]', data.totalBalance);
  setText('[data-field="asset.change"]', data.change);

  // ======================
  // RANGE & PILLS
  // ======================
  const activeRange = data.chart.activeRange || "7D";
  setActivePill(activeRange);

  document.querySelectorAll(".timeframe-pill").forEach((pill) => {
    if (pill.dataset.bound) {
      pill.onclick = () => {
        onRangeChange?.(pill.dataset.bound);
      };
    }
  });

  // ======================
  // CHART
  // ======================
  const labels = data.chart.labels || [];
  const series = data.chart.ranges?.[activeRange] || [];

  if (!Array.isArray(labels) || !Array.isArray(series) || series.length === 0) {
    container.textContent = "No chart data";
    return;
  }

  renderAssetLineChart({
    container,
    series,
    labels,
  });

};
