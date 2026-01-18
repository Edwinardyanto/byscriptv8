import { renderAssetLineChart } from "../charts/assetLineChart.js";
import { loadAccountAssetsDaily } from "../data/loadAccountAssetsDaily.js";
import {
  applyTimeframe,
  deriveDailyTotalUSD,
} from "../utils/assetSummaryData.js";

let derivedData = [];
let derivedStatus = "idle";
let derivedLoadPromise = null;

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
              <span class="timeframe-pill timeframe-pill--active" data-timeframe="7D">7D</span>
              <span class="timeframe-pill" data-timeframe="30D">30D</span>
              <span class="timeframe-pill" data-timeframe="90D">90D</span>
              <span class="timeframe-pill" data-timeframe="ALL">All</span>
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

const setActivePill = (pillsContainer, activePill) => {
  if (!pillsContainer || !activePill) {
    return;
  }
  const pills = pillsContainer.querySelectorAll(".timeframe-pill");
  pills.forEach((pill) => {
    pill.classList.toggle("timeframe-pill--active", pill === activePill);
  });
};

const bindTimeframeControls = (
  pillsContainer,
  onRangeChange,
  renderChartWithTimeframe
) => {
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
      const range = pill.dataset.timeframe || "7D";
      setActivePill(pillsContainer, pill);
      renderChartWithTimeframe(range);
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

const loadDerivedData = async () => {
  if (derivedLoadPromise) {
    return derivedLoadPromise;
  }
  derivedStatus = "loading";
  derivedLoadPromise = (async () => {
    const accountAssetDaily = await loadAccountAssetsDaily();
    if (!Array.isArray(accountAssetDaily)) {
      throw new Error("accountAssetDaily must be an array");
    }
    derivedData = deriveDailyTotalUSD(accountAssetDaily);
    derivedStatus = "ready";
    return derivedData;
  })().catch((error) => {
    console.warn(error);
    derivedData = [];
    derivedStatus = "error";
    return derivedData;
  });
  return derivedLoadPromise;
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
  const renderChartWithTimeframe = async (timeframe) => {
    if (derivedStatus === "idle") {
      setChartMessage(chartContainer, "Loading chart...");
      await loadDerivedData();
    }

    if (derivedStatus === "loading") {
      setChartMessage(chartContainer, "Loading chart...");
      return;
    }

    if (derivedStatus === "error") {
      setChartMessage(chartContainer, "Chart unavailable");
      return;
    }

    const series = applyTimeframe(derivedData, timeframe);
    if (series.length === 0) {
      setChartMessage(chartContainer, "No chart data");
    } else {
      renderAssetLineChart(chartContainer, series);
    }
  };

  bindTimeframeControls(pillsContainer, onRangeChange, renderChartWithTimeframe);

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

  renderChartWithTimeframe(activeRange);
};
