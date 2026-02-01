// src/scripts/components/TotalPerformanceChart.js
import { renderAssetLineChart } from "../charts/assetLineChart.js";

const chartMarkup = `
  <div class="asset-summary-bg"></div>
  <div class="asset-summary-content">
    <div class="card card--summary">
      <div class="summary-top">
        <div class="stat">
          <div class="asset-summary-header">
            <div class="stat-value-row">
              <div class="stat-value" data-field="asset.totalBalance"></div>
              <span class="stat-status-dot" aria-hidden="true"></span>
              <span class="badge badge--positive" data-field="asset.change"></span>
            </div>
            <div class="timeframe-pills" aria-label="Asset summary timeframe">
              <span class="timeframe-pill timeframe-pill--active">7D</span>
              <span class="timeframe-pill">30D</span>
              <span class="timeframe-pill">90D</span>
              <span class="timeframe-pill">All</span>
            </div>
          </div>
        </div>
      </div>
      <div class="chart-placeholder" data-field="asset.chartLabel">Chart Placeholder</div>
    </div>
  </div>
`;

const setText = (container, selector, value) => {
  const element = container?.querySelector(selector);
  if (element) element.textContent = value;
};

const setBadge = (container, selector, value, isPositive) => {
  const element = container?.querySelector(selector);
  if (!element) return;
  element.textContent = value;
  element.classList.toggle("badge--positive", Boolean(isPositive));
  element.classList.toggle("badge--negative", !isPositive);
};

const setChartMessage = (chartContainer, message) => {
  if (!chartContainer) return;
  chartContainer.innerHTML = "";
  chartContainer.textContent = message;
};

const updateTimeframeButtons = (pillsContainer, activeRange) => {
  if (!pillsContainer) return;

  const pills = pillsContainer.querySelectorAll(".timeframe-pill");
  const activeLabel = String(activeRange || "7D").toUpperCase() === "ALL" ? "All" : activeRange;

  pills.forEach((pill) => {
    const label = pill.textContent.trim();
    const isActive = label.toLowerCase() === String(activeLabel || "").toLowerCase();
    pill.classList.toggle("timeframe-pill--active", isActive);
  });
};

const bindTimeframeControls = (pillsContainer, onRangeChange) => {
  if (!pillsContainer) return;

  const pills = pillsContainer.querySelectorAll(".timeframe-pill");
  pills.forEach((pill) => {
    if (pill.dataset.bound) return;
    pill.dataset.bound = "true";

    pill.addEventListener("click", () => {
      const label = pill.textContent.trim();
      const range = label.toLowerCase() === "all" ? "ALL" : label.toUpperCase();
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

  if (!container.dataset.totalPerformanceReady) {
    container.innerHTML = chartMarkup;
    container.dataset.totalPerformanceReady = "true";
  }

  const pillsContainer = container.querySelector(".timeframe-pills");
  bindTimeframeControls(pillsContainer, onRangeChange);

  const chartContainer = container.querySelector('[data-field="asset.chartLabel"]');
  const isAccountsPage = document.body?.classList.contains("page-accounts");

  if (status === "loading") {
    setText(container, '[data-field="asset.totalBalance"]', "Loading...");
    setBadge(container, '[data-field="asset.change"]', "--", true);
    setChartMessage(chartContainer, "Loading chart...");
    return;
  }

  if (status === "error") {
    setText(container, '[data-field="asset.totalBalance"]', "--");
    setBadge(container, '[data-field="asset.change"]', "--", false);
    setChartMessage(chartContainer, "Chart unavailable");
    return;
  }

  if (!data || !data.chart) {
    setText(container, '[data-field="asset.totalBalance"]', "--");
    setBadge(container, '[data-field="asset.change"]', "--", true);
    setChartMessage(chartContainer, "No chart data");
    return;
  }

  if (isAccountsPage) {
    setText(container, '[data-field="asset.totalBalance"]', "--");
    setText(container, '[data-field="asset.change"]', "");
  } else {
    setText(container, '[data-field="asset.totalBalance"]', data.totalValue || "--");

    const pct = Number(data.percent || 0);
    const sign = pct > 0 ? "+" : pct < 0 ? "-" : "";
    const label = `${sign}${Math.abs(pct).toFixed(2)}%`;
    setBadge(container, '[data-field="asset.change"]', label, pct >= 0);
  }

  const activeRange = data.chart.activeRange || "7D";
  updateTimeframeButtons(pillsContainer, activeRange);

  const series = data.chart.series || [];
  const labels = data.chart.labels || [];

  if (!series.length || series.length !== labels.length) {
    setChartMessage(chartContainer, "No chart data");
    return;
  }

  chartContainer.innerHTML = "";
  renderAssetLineChart({ container: chartContainer, series, labels });
};
