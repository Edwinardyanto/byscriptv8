// src/scripts/components/TotalPerformanceChart.js
// ======================================================
// TOTAL PERFORMANCE CHART (TIMEFRAME READY)
// ======================================================

import { setAssetRange, getActiveRange } from "../data.js";
import { renderAssetLineChart } from "../charts/assetLineChart.js";

/* ------------------------------------------------------
 * DOM Helpers
 * ------------------------------------------------------ */

const setText = (selector, value) => {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
};

const setActivePill = (range) => {
  document.querySelectorAll("[data-range]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.range === range);
  });
};

/* ------------------------------------------------------
 * MAIN RENDER
 * ------------------------------------------------------ */

const renderAssetSummaryUI = (summary) => {
  // HEADER
  setText("#asset-total-value", summary.totalValue);

  const pct = summary.percent || 0;
  setText(
    "#asset-total-percent",
    `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`
  );

  // CHART
  const container = document.querySelector("#asset-chart");
  if (!container) return;

  renderAssetLineChart({
    container,
    series: summary.chart.series,
    labels: summary.chart.labels,
  });
};

/* ------------------------------------------------------
 * INIT TIMEFRAME EVENTS
 * ------------------------------------------------------ */

const initTimeframePills = () => {
  document.querySelectorAll("[data-range]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const range = btn.dataset.range;

      // ✅ update state + rebuild sliced series
      const nextSummary = await setAssetRange(range);

      // ✅ update pill UI
      setActivePill(range);

      // ✅ rerender header + chart
      renderAssetSummaryUI(nextSummary);
    });
  });
};

/* ------------------------------------------------------
 * PUBLIC ENTRY
 * ------------------------------------------------------ */

export const initTotalPerformanceChart = async () => {
  // ✅ initial render
  const range = getActiveRange();
  const summary = await setAssetRange(range);

  setActivePill(range);
  renderAssetSummaryUI(summary);

  // ✅ enable pills
  initTimeframePills();
};
