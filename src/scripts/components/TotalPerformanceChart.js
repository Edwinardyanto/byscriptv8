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

            <div class="timeframe-pills">
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

const updateTimeframeButtons = (pillsContainer, activeRange) => {
  const pills = pillsContainer?.querySelectorAll(".timeframe-pill") || [];
  const activeLabel = activeRange === "ALL" ? "All" : activeRange;

  pills.forEach((pill) => {
    pill.classList.toggle(
      "timeframe-pill--active",
      pill.textContent.trim() === activeLabel
    );
  });
};

/* ----------------------------------
 * Renderer
 * ---------------------------------- */

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
  pillsContainer?.querySelectorAll(".timeframe-pill").forEach((pill) => {
    if (pill.dataset.bound) return;
    pill.dataset.bound = "true";
    pill.addEventListener("click", () => {
      const label = pill.textContent.trim();
      onRangeChange?.(label === "All" ? "ALL" : label);
    });
  });

  const chartContainer = container.querySelector(
    '[data-field="asset.chartLabel"]'
  );

  if (status !== "ready" || !data) return;

  const activeRange = data.chart?.activeRange || "7D";
  const series = data.chart?.ranges?.[activeRange] || [];

  setText(container, '[data-field="asset.totalBalance"]', data.totalBalance);
  setText(
    container,
    '[data-field="asset.change"]',
    data.changeByRange?.[activeRange] ?? "--"
  );
  setText(
    container,
    '[data-field="asset.changeLabel"]',
    activeRange === "ALL"
      ? "Since first account"
      : "vs previous period"
  );

  updateTimeframeButtons(pillsContainer, activeRange);

  if (!series.length) return;

  // ⬅️ INI PENTING (tanggal utk tooltip)
  chartContainer.__assetChartDates =
    data.chart?.labels || [];

  renderAssetLineChart(chartContainer, series);
};
