// src/scripts/components/TotalPerformanceChart.js
import { renderAssetLineChart } from "../charts/assetLineChart.js";

const setText = (selector, value) => {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
};

const setBadge = (percent) => {
  const el = document.querySelector('[data-field="asset.change"]');
  if (!el) return;

  const isPositive = percent >= 0;
  el.textContent = `${percent.toFixed(2)}%`;
  el.classList.toggle("positive", isPositive);
  el.classList.toggle("negative", !isPositive);
};

/* --------------------------------
 * TIMEFRAME PILLS (INIT ONCE)
 * -------------------------------- */

const initTimeframePills = (onRangeChange) => {
  const buttons = document.querySelectorAll(
    ".asset-summary-pills button"
  );

  buttons.forEach((btn) => {
    btn.onclick = () => {
      const range = btn.dataset.range;
      if (!range) return;

      // active state
      buttons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      onRangeChange?.(range);
    };
  });
};

let pillsInitialized = false;

/* --------------------------------
 * MAIN RENDER
 * -------------------------------- */

export const renderTotalPerformanceChart = ({
  container,
  data,
  status = "ready",
  onRangeChange,
}) => {
  if (!container) return;

  /* -----------------------------
   * STATUS
   * ----------------------------- */

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

  /* -----------------------------
   * VALUE + BADGE
   * ----------------------------- */

  setText('[data-field="asset.totalBalance"]', data.totalValue);
  setBadge(data.percent);

  /* -----------------------------
   * TIMEFRAME PILLS
   * ----------------------------- */

  if (!pillsInitialized) {
    initTimeframePills(onRangeChange);
    pillsInitialized = true;
  }

  /* -----------------------------
   * CHART (RENDER CLEAN)
   * ----------------------------- */

  const { series = [], labels = [] } = data.chart || {};

  container.innerHTML = "";

  if (!series.length) {
    container.textContent = "No chart data";
    return;
  }

  renderAssetLineChart({
    container,
    series,
    labels,
  });
};
