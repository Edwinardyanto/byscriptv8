import { renderAssetLineChart } from "../charts/assetLineChart.js";

/* ----------------------------------
 * Markup
 * ---------------------------------- */

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
              <span class="badge" data-field="asset.change"></span>
            </div>
            <div class="stat-meta" data-field="asset.changeLabel"></div>

            <div class="timeframe-pills" aria-label="Asset summary timeframe">
              <span class="timeframe-pill timeframe-pill--active">7D</span>
              <span class="timeframe-pill">30D</span>
              <span class="timeframe-pill">90D</span>
              <span class="timeframe-pill">All</span>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-placeholder" data-field="asset.chartLabel"></div>
    </div>
  </div>
`;

/* ----------------------------------
 * Helpers
 * ---------------------------------- */

const setText = (container, selector, value) => {
  const el = container?.querySelector(selector);
  if (el) el.textContent = value ?? "";
};

const setChartMessage = (container, message) => {
  if (!container) return;
  container.innerHTML = "";
  container.textContent = message;
};

const updateTimeframeButtons = (pillsContainer, activeRange) => {
  if (!pillsContainer) return;

  const pills = pillsContainer.querySelectorAll(".timeframe-pill");
  const activeLabel = activeRange === "ALL" ? "All" : activeRange;

  pills.forEach((pill) => {
    pill.classList.toggle(
      "timeframe-pill--active",
      pill.textContent.trim() === activeLabel
    );
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
      const range = label === "All" ? "ALL" : label;

      if (typeof onRangeChange === "function") {
        onRangeChange(range);
      }
    });
  });
};

const resolveTimeframePills = (container, externalContainer) => {
  const internal = container.querySelector(".timeframe-pills");
  if (!externalContainer) return internal;

  if (internal && !externalContainer.contains(internal)) {
    while (internal.firstChild) {
      externalContainer.appendChild(internal.firstChild);
    }
    internal.remove();
  }
  return externalContainer;
};

/* ----------------------------------
 * Renderer
 * ---------------------------------- */

export const renderTotalPerformanceChart = ({
  container,
  dataSource,
  data,
  status = "ready",
  onRangeChange,
  timeframeContainer,
}) => {
  if (!container) return;

  // Mount once
  if (!container.dataset.totalPerformanceReady) {
    container.innerHTML = chartMarkup;
    container.dataset.totalPerformanceReady = "true";
  }

  if (dataSource) {
    container.dataset.totalPerformanceSource = dataSource;
  }

  const pillsContainer = resolveTimeframePills(container, timeframeContainer);
  bindTimeframeControls(pillsContainer, onRangeChange);

  const chartContainer = container.querySelector(
    '[data-field="asset.chartLabel"]'
  );

  /* ---------- STATE HANDLING ---------- */

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

  /* ---------- DATA ---------- */

  const activeRange = data.chart?.activeRange || "7D";
  const series = data.chart?.ranges?.[activeRange] || [];

  const changeValue =
    data.changeByRange?.[activeRange] ?? data.change ?? "--";

  const changeLabel =
    activeRange === "ALL"
      ? "Since first account"
      : "vs previous period";

  // Text
  setText(
    container,
    '[data-field="asset.totalBalance"]',
    data.totalBalance
  );

  setText(container, '[data-field="asset.change"]', changeValue);
  setText(container, '[data-field="asset.changeLabel"]', changeLabel);

  // Badge color
  const badge = container.querySelector('[data-field="asset.change"]');
  if (badge) {
    badge.classList.remove(
      "badge--positive",
      "badge--negative",
      "badge--neutral"
    );

    if (typeof changeValue === "string" && changeValue.startsWith("-")) {
      badge.classList.add("badge--negative");
    } else if (
      typeof changeValue === "string" &&
      changeValue !== "—"
    ) {
      badge.classList.add("badge--positive");
    } else {
      badge.classList.add("badge--neutral");
    }
  }

  updateTimeframeButtons(pillsContainer, activeRange);

  // Chart
  if (!series.length) {
    setChartMessage(chartContainer, "No chart data");
    return;
  }

  renderAssetLineChart(chartContainer, series);
};
