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

const getCssVar = (name, fallback) => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
};

const createSvgElement = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag);

const renderAccountsDonutChart = (container, accounts) => {
  if (!container || !Array.isArray(accounts) || accounts.length === 0) {
    return;
  }

  const colors = [
    getCssVar("--color-chart-accent-primary", "#3fd37c"),
    getCssVar("--color-chart-secondary", "#7b62ff"),
    getCssVar("--color-chart-tertiary", "#29b3d1"),
    getCssVar("--color-chart-muted", "#4f7dff"),
    getCssVar("--color-chart-muted", "#4f7dff"),
  ];
  const width = 220;
  const height = 220;
  const strokeWidth = 22;
  const radius = (Math.min(width, height) - strokeWidth) / 2;
  const total = accounts.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 1;

  const svg = createSvgElement("svg");
  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");

  const defs = createSvgElement("defs");
  const filter = createSvgElement("filter");
  filter.setAttribute("id", "accounts-inner-shadow");
  filter.setAttribute("x", "-50%");
  filter.setAttribute("y", "-50%");
  filter.setAttribute("width", "200%");
  filter.setAttribute("height", "200%");
  const feGaussian = createSvgElement("feGaussianBlur");
  feGaussian.setAttribute("in", "SourceAlpha");
  feGaussian.setAttribute("stdDeviation", "6");
  const feOffset = createSvgElement("feOffset");
  feOffset.setAttribute("dx", "0");
  feOffset.setAttribute("dy", "2");
  const feComposite = createSvgElement("feComposite");
  feComposite.setAttribute("operator", "arithmetic");
  feComposite.setAttribute("k2", "-1");
  feComposite.setAttribute("k3", "1");
  const feColor = createSvgElement("feColorMatrix");
  feColor.setAttribute(
    "values",
    "0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.6 0"
  );
  const feMerge = createSvgElement("feMerge");
  const feMergeNode1 = createSvgElement("feMergeNode");
  const feMergeNode2 = createSvgElement("feMergeNode");
  feMergeNode2.setAttribute("in", "SourceGraphic");
  feMerge.appendChild(feMergeNode1);
  feMerge.appendChild(feMergeNode2);
  filter.appendChild(feGaussian);
  filter.appendChild(feOffset);
  filter.appendChild(feComposite);
  filter.appendChild(feColor);
  filter.appendChild(feMerge);
  defs.appendChild(filter);
  svg.appendChild(defs);

  let currentAngle = 0;
  accounts.forEach((account, index) => {
    const value = Number(account.amount || 0);
    const angle = (value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    const start = {
      x: width / 2 + radius * Math.cos(((endAngle - 90) * Math.PI) / 180),
      y: height / 2 + radius * Math.sin(((endAngle - 90) * Math.PI) / 180),
    };
    const end = {
      x: width / 2 + radius * Math.cos(((startAngle - 90) * Math.PI) / 180),
      y: height / 2 + radius * Math.sin(((startAngle - 90) * Math.PI) / 180),
    };
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    const path = createSvgElement("path");
    path.setAttribute(
      "d",
      `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
    );
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", colors[index % colors.length]);
    path.setAttribute("stroke-width", `${strokeWidth}`);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("opacity", "0.95");
    svg.appendChild(path);
    currentAngle += angle;
  });

  const center = createSvgElement("circle");
  center.setAttribute("cx", `${width / 2}`);
  center.setAttribute("cy", `${height / 2}`);
  center.setAttribute("r", `${radius - strokeWidth / 2}`);
  center.setAttribute("fill", getCssVar("--color-bg-surface", "#0d1015"));
  center.setAttribute("filter", "url(#accounts-inner-shadow)");
  svg.appendChild(center);

  container.innerHTML = "";
  container.appendChild(svg);
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
  const chartContainer =
    section?.querySelector('[data-accounts-donut] .chart-placeholder') ||
    section?.querySelector(".summary-total .chart-placeholder");
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
    if (isAccountsPage) {
      if (chartContainer) {
        chartContainer.innerHTML = "<div class=\"accounts-distribution-empty\"></div>";
      }
      if (list) {
        list.innerHTML = "";
      }
    } else {
      setListMessage(list, `Loading ${label}...`);
      setChartMessage(chartContainer, "Loading chart...");
    }
    setText('[data-field="exchanges.total"]', "--");
    return;
  }

  if (status === "error") {
    if (isAccountsPage) {
      if (chartContainer) {
        chartContainer.innerHTML = "<div class=\"accounts-distribution-empty\"></div>";
      }
      if (list) {
        list.innerHTML = "";
      }
    } else {
      setListMessage(list, `Unable to load ${label}`);
      setChartMessage(chartContainer, "Chart unavailable");
    }
    setText('[data-field="exchanges.total"]', "--");
    return;
  }

  if (!data || data.exchanges.length === 0) {
    if (isAccountsPage) {
      if (chartContainer) {
        chartContainer.innerHTML = "<div class=\"accounts-distribution-empty\"></div>";
      }
      if (list) {
        list.innerHTML = "";
      }
    } else {
      setListMessage(list, `No ${label} data`);
      setChartMessage(chartContainer, "No chart data");
    }
    setText('[data-field="exchanges.total"]', "--");
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

  exchanges.forEach((exchange, index) => {
    const item = document.createElement("div");
    if (isAccountsPage) {
      item.className = "accounts-legend-item";
      item.innerHTML = `
        <span class="accounts-legend-dot" style="--legend-color: ${getCssVar(
          index === 0
            ? "--color-chart-accent-primary"
            : index === 1
              ? "--color-chart-secondary"
              : index === 2
                ? "--color-chart-tertiary"
                : "--color-chart-muted",
          "#4f7dff"
        )}"></span>
        <span>${exchange.name}</span>
      `;
    } else {
      item.className = "summary-item";
      item.innerHTML = `
        <span class="summary-item-name">${exchange.name}</span>
        <span class="summary-item-value">${exchange.value}</span>
      `;
    }
    list.appendChild(item);
  });

  setText('[data-field="exchanges.total"]', totalValue);
  if (isAccountsPage) {
    renderAccountsDonutChart(chartContainer, exchanges);
  } else {
    renderExchangesDonutChart(chartContainer, exchanges);
  }
};
