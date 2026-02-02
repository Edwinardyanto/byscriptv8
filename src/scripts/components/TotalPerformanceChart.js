// src/scripts/components/TotalPerformanceChart.js
// Renders the Asset Summary value, percent badge, and line chart.
// IMPORTANT: must be page-safe. Other pages also include main.js.

import { renderAssetLineChart } from "../charts/assetLineChart.js";

const getScope = (container) =>
  container?.closest(".asset-summary") ||
  container?.closest(".accounts-summary-panel") ||
  container?.parentElement ||
  document;

const setText = (scope, selector, value) => {
  const el = scope?.querySelector(selector);
  if (el) el.textContent = value;
};

const setBadge = (scope, selector, value, isPositive) => {
  const el = scope?.querySelector(selector);
  if (!el) return;
  el.textContent = value;

  // Match Dashboard asset summary badge styling.
  // Dashboard uses: .badge.positive / .badge.negative inside .asset-summary-metric
  el.classList.toggle("positive", Boolean(isPositive));
  el.classList.toggle("negative", !isPositive);

  // Keep generic badge variants for other places.
  el.classList.toggle("badge--positive", Boolean(isPositive));
  el.classList.toggle("badge--warning", !isPositive);
};

const normalizeRange = (raw) => {
  const v = String(raw || "").trim();
  if (!v) return "7D";
  if (v.toLowerCase() === "all") return "ALL";
  return v.toUpperCase();
};

const getRangeFromControl = (el) => {
  if (!el) return null;
  if (el.dataset?.range) return normalizeRange(el.dataset.range);
  const label = el.textContent?.trim();
  if (!label) return null;
  return normalizeRange(label);
};

const getControls = (scope) => {
  if (!scope) return [];

  const btns = Array.from(scope.querySelectorAll("[data-range]"));
  if (btns.length) return btns;

  // Fallback support (older experiment markup)
  return Array.from(scope.querySelectorAll(".timeframe-pill"));
};

const setActiveControl = (controls, activeRange) => {
  const target = normalizeRange(activeRange);
  controls.forEach((el) => {
    const r = getRangeFromControl(el);

    // Support both dashboard buttons (".timeframe-btn.active")
    // and pill style (".timeframe-pill.timeframe-pill--active").
    if (el.classList.contains("timeframe-pill")) {
      el.classList.toggle("timeframe-pill--active", r === target);
    } else {
      el.classList.toggle("active", r === target);
    }
  });
};

const bindControls = (controls, onRangeChange) => {
  controls.forEach((el) => {
    if (el.dataset?.bound === "true") return;
    if (el.dataset) el.dataset.bound = "true";

    el.addEventListener("click", () => {
      const range = getRangeFromControl(el);
      if (!range) return;
      if (typeof onRangeChange === "function") onRangeChange(range);
    });
  });
};

export const renderTotalPerformanceChart = ({
  container,
  data,
  status = "ready",
  onRangeChange,
}) => {
  if (!container) return;

  const scope = getScope(container);
  const controls = getControls(scope);
  bindControls(controls, onRangeChange);

  // Loading / Error states
  if (status === "loading") {
    setText(scope, '[data-field="asset.totalBalance"]', "Loading...");
    setBadge(scope, '[data-field="asset.change"]', "--", true);
    container.innerHTML = "";
    container.textContent = "Loading chart...";
    return;
  }

  if (status === "error") {
    setText(scope, '[data-field="asset.totalBalance"]', "--");
    setBadge(scope, '[data-field="asset.change"]', "--", false);
    container.innerHTML = "";
    container.textContent = "Chart unavailable";
    return;
  }

  if (!data || !data.chart) {
    setText(scope, '[data-field="asset.totalBalance"]', "--");
    setBadge(scope, '[data-field="asset.change"]', "--", true);
    container.innerHTML = "";
    container.textContent = "No chart data";
    return;
  }

  // Header
  setText(scope, '[data-field="asset.totalBalance"]', data.totalValue || "--");

  const pct = Number(data.percent || 0);
  const sign = pct > 0 ? "+" : pct < 0 ? "-" : "";
  const label = `${sign}${Math.abs(pct).toFixed(2)}%`;
  setBadge(scope, '[data-field="asset.change"]', label, pct >= 0);

  // Controls
  setActiveControl(controls, data.chart.activeRange || "7D");

  // Chart
  const series = data.chart.series || [];
  const labels = data.chart.labels || [];

  if (!series.length || series.length !== labels.length) {
    container.innerHTML = "";
    container.textContent = "No chart data";
    return;
  }

  container.innerHTML = "";
  renderAssetLineChart({ container, series, labels });
};
