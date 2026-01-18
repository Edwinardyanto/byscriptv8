import { renderSimpleLineChart } from "../../ui/simpleLineChart.js";

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
  if (element) {
    element.textContent = value;
  }
};

const renderAssetSummaryChart = (container, series) => {
  if (!container) {
    return;
  }
  const safeSeries = Array.isArray(series) && series.length > 0 ? series : [];
  renderSimpleLineChart(container, safeSeries);
};

const updateTimeframeButtons = (pillsContainer, activeRange) => {
  if (!pillsContainer) {
    return;
  }
  const pills = pillsContainer.querySelectorAll(".timeframe-pill");
  const activeLabel = activeRange === "all" ? "All" : activeRange;
  pills.forEach((pill) => {
    const isActive = pill.textContent.trim() === activeLabel;
    pill.classList.toggle("timeframe-pill--active", isActive);
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

  const chartContainer = container.querySelector('[data-field="asset.chartLabel"]');
  const isAccountsPage = document.body?.classList.contains("page-accounts");
  const summaryCard = container.querySelector(".card--summary");
  const summaryTop = container.querySelector(".card--summary .summary-top");

  if (summaryCard) {
    summaryCard.classList.toggle("data-ready", status === "ready" && Boolean(data));
  }
  if (summaryTop) {
    summaryTop.classList.toggle("data-ready", status === "ready" && Boolean(data));
  }

  if (status === "loading" || status === "idle") {
    setText(container, '[data-field="asset.totalBalance"]', "--");
    setText(container, '[data-field="asset.change"]', "--");
    setText(container, '[data-field="asset.changeLabel"]', "");
    renderAssetSummaryChart(chartContainer, []);
    return;
  }

  if (status === "error") {
    setText(container, '[data-field="asset.totalBalance"]', "--");
    setText(container, '[data-field="asset.change"]', "--");
    setText(container, '[data-field="asset.changeLabel"]', "Unable to load");
    renderAssetSummaryChart(chartContainer, []);
    return;
  }

  if (!data) {
    setText(container, '[data-field="asset.totalBalance"]', "--");
    setText(container, '[data-field="asset.change"]', "--");
    setText(container, '[data-field="asset.changeLabel"]', "No data available");
    renderAssetSummaryChart(chartContainer, []);
    return;
  }

  if (isAccountsPage) {
    setText(container, '[data-field="asset.totalBalance"]', "--");
    setText(container, '[data-field="asset.change"]', "");
    setText(container, '[data-field="asset.changeLabel"]', "");
  } else {
    setText(container, '[data-field="asset.totalBalance"]', data.totalBalance);
    setText(container, '[data-field="asset.change"]', data.change);
    setText(container, '[data-field="asset.changeLabel"]', data.changeLabel);
  }

  const activeRange = data.chart?.activeRange || "7D";
  updateTimeframeButtons(pillsContainer, activeRange);

  const series = data.chart?.series || [];
  renderAssetSummaryChart(chartContainer, series);
};
