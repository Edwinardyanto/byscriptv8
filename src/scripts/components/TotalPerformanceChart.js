import { renderAssetLineChart } from "../charts/assetLineChart.js";
import {
  applyTimeframe,
  deriveDailyTotalUSD,
} from "../utils/assetSummaryData.js";

const chartMarkup = `
  <div class="asset-summary-bg"></div>
  <div class="asset-summary-content">
    <div class="card card--summary">
      <div class="summary-top">
        <div class="stat">
          <div class="asset-summary-header">
            <div class="stat-value-row">
              <div class="stat-value" data-field="asset.totalBalance"></div>
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
  if (element) {
    element.textContent = value;
  }
};

const setChartMessage = (container, message) => {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  container.textContent = message;
};

const updateTimeframeButtons = (pillsContainer, activeRange) => {
  if (!pillsContainer) {
    return;
  }
  const pills = pillsContainer.querySelectorAll(".timeframe-pill");
  const activeLabel = activeRange === "ALL" ? "All" : activeRange;
  pills.forEach((pill) => {
    const isActive = pill.textContent.trim() === activeLabel;
    pill.classList.toggle("timeframe-pill--active", isActive);
  });
};

const bindTimeframeControls = (pillsContainer, onRangeChange) => {
  if (!pillsContainer) {
    return;
  }
  const pills = pillsContainer.querySelectorAll(".timeframe-pill");
  pills.forEach((pill) => {
    if (pill.dataset.bound) {
      return;
    }
    pill.dataset.bound = "true";
    pill.addEventListener("click", () => {
      const label = pill.textContent.trim();
      const range = label === "All" ? "ALL" : label;
      if (typeof onRangeChange === "function") {
        onRangeChange(range);
      }
    });
  });
};

const resolveTimeframePills = (container, externalContainer) => {
  const internalPills = container.querySelector(".timeframe-pills");
  if (!externalContainer) {
    return internalPills;
  }
  if (internalPills && !externalContainer.contains(internalPills)) {
    while (internalPills.firstChild) {
      externalContainer.appendChild(internalPills.firstChild);
    }
    internalPills.remove();
  }
  return externalContainer;
};

export const renderTotalPerformanceChart = ({
  container,
  dataSource,
  data,
  status = "ready",
  onRangeChange,
  timeframeContainer,
}) => {
  if (!container) {
    return;
  }

  if (!container.dataset.totalPerformanceReady) {
    container.innerHTML = chartMarkup;
    container.dataset.totalPerformanceReady = "true";
  }

  if (dataSource) {
    container.dataset.totalPerformanceSource = dataSource;
  }
  const pillsContainer = resolveTimeframePills(container, timeframeContainer);
  bindTimeframeControls(pillsContainer, onRangeChange);

  const chartContainer = container.querySelector('[data-field="asset.chartLabel"]');

  if (status === "loading") {
    setText(container, '[data-field="asset.totalBalance"]', "Loading...");
    setText(container, '[data-field="asset.change"]', "--");
    setText(container, '[data-field="asset.changeLabel"]', "Loading...");
    setChartMessage(chartContainer, "Loading chart...");
    return;
  }

  if (status === "error") {
    setText(container, '[data-field="asset.totalBalance"]', "--");
    setText(container, '[data-field="asset.change"]', "--");
    setText(container, '[data-field="asset.changeLabel"]', "Unable to load");
    setChartMessage(chartContainer, "Chart unavailable");
    return;
  }

  if (!data) {
    setText(container, '[data-field="asset.totalBalance"]', "--");
    setText(container, '[data-field="asset.change"]', "--");
    setText(container, '[data-field="asset.changeLabel"]', "No data available");
    setChartMessage(chartContainer, "No chart data");
    return;
  }

  setText(container, '[data-field="asset.totalBalance"]', data.totalBalance);
  setText(container, '[data-field="asset.change"]', data.change);
  setText(container, '[data-field="asset.changeLabel"]', data.changeLabel);

  const activeRange = data.activeRange || "7D";
  updateTimeframeButtons(pillsContainer, activeRange);

  const derivedSeries = deriveDailyTotalUSD(data.accountAssetDaily || []);
  const filteredSeries = applyTimeframe(derivedSeries, activeRange);
  if (filteredSeries.length === 0) {
    setChartMessage(chartContainer, "No chart data");
  } else {
    renderAssetLineChart(chartContainer, filteredSeries);
  }
};
