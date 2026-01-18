import { renderSimpleLineChart } from "../../ui/simpleLineChart.js";

const setText = (selector, value) => {
  const element = document.querySelector(selector);
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

const updateTimeframeButtons = (activeRange) => {
  const pills = document.querySelectorAll(".timeframe-pill");
  const activeLabel = activeRange === "all" ? "All" : activeRange;
  pills.forEach((pill) => {
    const isActive = pill.textContent.trim() === activeLabel;
    pill.classList.toggle("timeframe-pill--active", isActive);
  });
};

export const renderAssetSummary = (sectionState) => {
  const { data, status } = sectionState;
  const chartContainer = document.querySelector('[data-field="asset.chartLabel"]');

  if (status === "loading") {
    setText('[data-field="asset.totalBalance"]', "Loading...");
    setText('[data-field="asset.change"]', "--");
    setText('[data-field="asset.changeLabel"]', "Loading...");
    setChartMessage(chartContainer, "Loading chart...");
    return;
  }

  if (status === "error") {
    setText('[data-field="asset.totalBalance"]', "--");
    setText('[data-field="asset.change"]', "--");
    setText('[data-field="asset.changeLabel"]', "Unable to load");
    setChartMessage(chartContainer, "Chart unavailable");
    return;
  }

  if (!data) {
    setText('[data-field="asset.totalBalance"]', "--");
    setText('[data-field="asset.change"]', "--");
    setText('[data-field="asset.changeLabel"]', "No data available");
    setChartMessage(chartContainer, "No chart data");
    return;
  }

  setText('[data-field="asset.totalBalance"]', data.totalBalance);
  setText('[data-field="asset.change"]', data.change);
  setText('[data-field="asset.changeLabel"]', data.changeLabel);

  const activeRange = data.chart?.activeRange || "7D";
  updateTimeframeButtons(activeRange);

  const series =
    activeRange === "all"
      ? data.chart?.fullSeries || []
      : data.chart?.ranges?.[activeRange] || [];
  renderSimpleLineChart(chartContainer, series);
};
