import { renderExchangesDonutChart } from "../charts/exchangesDonutChart.js";

const setText = (selector, value) => {
  const element = document.querySelector(selector);
  if (element) {
    element.textContent = value;
  }
};

const setListMessage = (list, message) => {
  if (!list) {
    return;
  }
  list.innerHTML = "";
  const item = document.createElement("div");
  item.className = "summary-item";
  item.textContent = message;
  list.appendChild(item);
};

const setChartMessage = (container, message) => {
  if (!container) {
    return;
  }
  container.innerHTML = "";
  container.textContent = message;
};

export const renderExchangesSummary = (sectionState) => {
  const { data, status } = sectionState;
  const list = document.querySelector('[data-list="exchanges"]');
  const section = list?.closest(".section");
  const chartContainer = section?.querySelector(".summary-total .chart-placeholder");

  if (status === "loading") {
    setListMessage(list, "Loading exchanges...");
    setText('[data-field="exchanges.total"]', "--");
    setChartMessage(chartContainer, "Loading chart...");
    return;
  }

  if (status === "error") {
    setListMessage(list, "Unable to load exchanges");
    setText('[data-field="exchanges.total"]', "--");
    setChartMessage(chartContainer, "Chart unavailable");
    return;
  }

  if (!data || data.exchanges.length === 0) {
    setListMessage(list, "No exchanges data");
    setText('[data-field="exchanges.total"]', "--");
    setChartMessage(chartContainer, "No chart data");
    return;
  }

  list.innerHTML = "";
  data.exchanges.forEach((exchange) => {
    const item = document.createElement("div");
    item.className = "summary-item";
    item.innerHTML = `
      <span class="summary-item-name">${exchange.name}</span>
      <span class="summary-item-value">${exchange.value}</span>
    `;
    list.appendChild(item);
  });

  setText('[data-field="exchanges.total"]', data.total);
  renderExchangesDonutChart(chartContainer, data.exchanges);
};
