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

const setChartMessage = (container, message) => {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  container.textContent = message;
};

const renderAssetSummaryChart = (container, { timeframe, totalValueUsd, totalLabel }) => {
  if (!container) {
    return;
  }
  container.innerHTML = "";

  const label = timeframe === "all" ? "ALL" : String(timeframe || "7D").toUpperCase();
  const value = Number.isFinite(totalValueUsd) ? totalValueUsd : 0;
  const valueLabel = totalLabel || "—";
  const description = document.createElement("div");
  description.textContent = `Total assets for ${label} timeframe: ${valueLabel}`;

  const bar = document.createElement("div");
  bar.style.marginTop = "12px";
  bar.style.height = "10px";
  bar.style.background = "rgba(255, 255, 255, 0.12)";
  bar.style.borderRadius = "999px";
  bar.style.overflow = "hidden";

  const fill = document.createElement("div");
  const percent = Math.min(100, Math.max(6, (value / (value + 10000)) * 100));
  fill.style.width = `${percent}%`;
  fill.style.height = "100%";
  fill.style.background = "linear-gradient(90deg, #7c3aed, #22c55e)";
  fill.style.borderRadius = "999px";

  bar.appendChild(fill);
  container.appendChild(description);
  container.appendChild(bar);
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
    setChartMessage(chartContainer, "Chart Placeholder");
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

  renderAssetSummaryChart(chartContainer, {
    timeframe: activeRange,
    totalValueUsd: data.totalValueUsd,
    totalLabel: data.totalBalance,
  });
};
