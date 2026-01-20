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

            <div class="timeframe-pills">
              <span class="timeframe-pill timeframe-pill--active">7D</span>
              <span class="timeframe-pill">30D</span>
              <span class="timeframe-pill">90D</span>
              <span class="timeframe-pill">All</span>
            </div>
          </div>
        </div>
      </div>

      <div class="chart-placeholder" data-field="asset.chart"></div>
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

const updateTimeframeButtons = (container, activeRange) => {
  container
    .querySelectorAll(".timeframe-pill")
    .forEach((pill) => {
      pill.classList.toggle(
        "timeframe-pill--active",
        pill.textContent.trim() === (activeRange === "ALL" ? "All" : activeRange)
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

  /* ---------- INIT MARKUP ---------- */

  if (!container.dataset.ready) {
    container.innerHTML = chartMarkup;
    container.dataset.ready = "true";
  }

  const pillsContainer = container.querySelector(".timeframe-pills");
  const chartContainer = container.querySelector('[data-field="asset.chart"]');

  /* ---------- BIND TIMEFRAME ---------- */

  pillsContainer.querySelectorAll(".timeframe-pill").forEach((pill) => {
    if (pill.dataset.bound) return;
    pill.dataset.bound = "true";

    pill.addEventListener("click", () => {
      const label = pill.textContent.trim();
      onRangeChange?.(label === "All" ? "ALL" : label);
    });
  });

  if (status !== "ready" || !data?.chart?.ranges) return;

  /* ---------- RESOLVE RANGE ---------- */

  const activeRange = data.chart.activeRange || "7D";
  const rangeData = data.chart.ranges[activeRange];

  if (!rangeData) return;

  const { series = [], labels = [] } = rangeData;

  if (!series.length || !labels.length) return;

  /* ---------- HEADER ---------- */

  setText(container, '[data-field="asset.totalBalance"]', data.totalBalance);
  setText(
    container,
    '[data-field="asset.change"]',
    data.changeByRange?.[activeRange] ?? "--"
  );

  // ⛔️ HAPUS TOTAL:
  // - "vs previous period"
  // - "Since first account"

  updateTimeframeButtons(pillsContainer, activeRange);

  /* ---------- CHART ---------- */

  chartContainer.__assetChartDates = labels;

  renderAssetLineChart(chartContainer, series);
};
