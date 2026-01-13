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
  const isAccountsPage = document.body?.classList.contains("page-accounts");
  const label = isAccountsPage ? "accounts" : "exchanges";
  const formatCurrency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const parseCurrency = (value) => {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value !== "string") {
      return null;
    }
    const numeric = Number(value.replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(numeric) ? numeric : null;
  };

  if (status === "loading") {
    setListMessage(list, `Loading ${label}...`);
    setText('[data-field="exchanges.total"]', "--");
    setChartMessage(chartContainer, "Loading chart...");
    return;
  }

  if (status === "error") {
    setListMessage(list, `Unable to load ${label}`);
    setText('[data-field="exchanges.total"]', "--");
    setChartMessage(chartContainer, "Chart unavailable");
    return;
  }

  if (!data || data.exchanges.length === 0) {
    setListMessage(list, `No ${label} data`);
    setText('[data-field="exchanges.total"]', "--");
    setChartMessage(chartContainer, "No chart data");
    return;
  }

  list.innerHTML = "";
  let exchanges = data.exchanges;
  let totalValue = data.total;

  if (isAccountsPage) {
    const assetTotalText = document.querySelector('[data-field="asset.totalBalance"]')?.textContent;
    const assetTotal = parseCurrency(assetTotalText);
    const dataTotal = parseCurrency(data.total);
    const sourceTotal = data.exchanges.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const targetTotal =
      (Number.isFinite(assetTotal) && assetTotal) ||
      (Number.isFinite(dataTotal) && dataTotal) ||
      sourceTotal;
    const scale = sourceTotal ? targetTotal / sourceTotal : 1;
    const scaledAmounts = data.exchanges.map((exchange) =>
      Math.round(Number(exchange.amount || 0) * scale)
    );
    const scaledSum = scaledAmounts.reduce((sum, amount) => sum + amount, 0);
    const adjustment = Math.round(targetTotal - scaledSum);
    if (scaledAmounts.length > 0 && adjustment !== 0) {
      scaledAmounts[scaledAmounts.length - 1] += adjustment;
    }
    exchanges = data.exchanges.map((exchange, index) => {
      const amount = scaledAmounts[index] ?? Number(exchange.amount || 0);
      return {
        ...exchange,
        name: `Accounts ${index + 1}`,
        amount,
        value: formatCurrency.format(amount),
      };
    });
    if (Number.isFinite(targetTotal)) {
      totalValue = formatCurrency.format(targetTotal);
    }
  }

  exchanges.forEach((exchange) => {
    const item = document.createElement("div");
    item.className = "summary-item";
    item.innerHTML = `
      <span class="summary-item-name">${exchange.name}</span>
      <span class="summary-item-value">${exchange.value}</span>
    `;
    list.appendChild(item);
  });

  setText('[data-field="exchanges.total"]', totalValue);
  renderExchangesDonutChart(chartContainer, exchanges);
};
