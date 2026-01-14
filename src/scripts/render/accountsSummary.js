import { renderAccountsDonutChart } from "../charts/accountsDonutChart.js";

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

const renderAccountsPageDonutChart = (container, accounts, colors = []) => {
  if (!container || !Array.isArray(accounts) || accounts.length === 0) {
    return;
  }

  const chartColors =
    colors.length > 0
      ? colors
      : [
          getCssVar("--color-chart-accent-primary", "#3fd37c"),
          getCssVar("--color-chart-secondary", "#7b62ff"),
          getCssVar("--color-chart-tertiary", "#29b3d1"),
          getCssVar("--color-chart-muted", "#4f7dff"),
          getCssVar("--color-chart-muted", "#4f7dff"),
        ];
  const width = 232;
  const height = 232;
  const strokeWidth = 20;
  const radius = (Math.min(width, height) - strokeWidth) / 2;
  const total = accounts.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 1;
  const gapDegrees = 3;

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
    const appliedGap = angle > gapDegrees ? gapDegrees : 0;
    const startAngle = currentAngle + appliedGap / 2;
    const endAngle = currentAngle + angle - appliedGap / 2;
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
    const segmentColor = chartColors[index % chartColors.length];
    path.setAttribute("stroke", segmentColor);
    path.setAttribute("stroke-width", `${strokeWidth}`);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("opacity", "0.82");
    path.classList.add("accounts-donut-segment");
    path.dataset.accountIndex = `${index}`;
    path.style.color = segmentColor;
    path.style.cursor = "pointer";
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

export const renderAccountsSummary = (sectionState) => {
  const { data, status } = sectionState;
  const list = document.querySelector('[data-list="accounts"]');
  const section = list?.closest(".section");
  const chartContainer =
    section?.querySelector('[data-accounts-donut] .chart-placeholder') ||
    section?.querySelector(".summary-total .chart-placeholder");
  const isAccountsPage = document.body?.classList.contains("page-accounts");
  const label = "accounts";
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
    setText('[data-field="accounts.total"]', "--");
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
    setText('[data-field="accounts.total"]', "--");
    return;
  }

  if (!data || data.accounts.length === 0) {
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
    setText('[data-field="accounts.total"]', "--");
    return;
  }

  list.innerHTML = "";
  let accounts = data.accounts;
  let totalValue = data.total;
  let accountsColors = [];

  if (isAccountsPage) {
    accountsColors = [
      getCssVar("--color-chart-accent-primary", "rgba(102, 255, 51, 0.75)"),
      getCssVar("--color-chart-secondary", "rgba(0, 247, 213, 0.6)"),
      getCssVar("--color-chart-tertiary", "rgba(61, 44, 141, 0.6)"),
      getCssVar("--color-status-negative-text-muted", "rgba(255, 95, 95, 0.75)"),
      getCssVar("--color-chart-muted", "rgba(217, 217, 217, 0.5)"),
    ];
    const assetTotalText = document.querySelector('[data-field="asset.totalBalance"]')?.textContent;
    const assetTotal = parseCurrency(assetTotalText);
    const dataTotal = parseCurrency(data.total);
    const sourceTotal = data.accounts.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const targetTotal =
      (Number.isFinite(assetTotal) && assetTotal) ||
      (Number.isFinite(dataTotal) && dataTotal) ||
      sourceTotal;
    const scale = sourceTotal ? targetTotal / sourceTotal : 1;
    const scaledAmounts = data.accounts.map((account) =>
      Math.round(Number(account.amount || 0) * scale)
    );
    const scaledSum = scaledAmounts.reduce((sum, amount) => sum + amount, 0);
    const adjustment = Math.round(targetTotal - scaledSum);
    if (scaledAmounts.length > 0 && adjustment !== 0) {
      scaledAmounts[scaledAmounts.length - 1] += adjustment;
    }
    accounts = data.accounts.map((account, index) => {
      const amount = scaledAmounts[index] ?? Number(account.amount || 0);
      return {
        ...account,
        name: `Accounts ${index + 1}`,
        amount,
        value: formatCurrency.format(amount),
      };
    });
    accounts = accounts.slice(0, 5);
    if (Number.isFinite(targetTotal)) {
      totalValue = formatCurrency.format(targetTotal);
    }
  }

  accounts.forEach((account, index) => {
    const item = document.createElement("div");
    if (isAccountsPage) {
      item.className = "accounts-legend-item";
      item.dataset.accountIndex = `${index}`;
      item.innerHTML = `
        <span class="accounts-legend-dot" style="--legend-color: ${accountsColors[index % accountsColors.length]}"></span>
        <span>${account.name}</span>
      `;
    } else {
      item.className = "summary-item";
      item.innerHTML = `
        <span class="summary-item-name">${account.name}</span>
        <span class="summary-item-value">${account.value}</span>
      `;
    }
    list.appendChild(item);
  });

  setText('[data-field="accounts.total"]', totalValue);
  if (isAccountsPage) {
    renderAccountsPageDonutChart(chartContainer, accounts, accountsColors);
    const segments = chartContainer?.querySelectorAll(".accounts-donut-segment");
    const legendItems = list?.querySelectorAll(".accounts-legend-item");
    if (segments?.length && legendItems?.length) {
      const clearActive = () => {
        segments.forEach((segment) => segment.classList.remove("is-active"));
        legendItems.forEach((item) => item.classList.remove("is-active"));
      };
      const setActive = (index) => {
        clearActive();
        segments[index]?.classList.add("is-active");
        legendItems[index]?.classList.add("is-active");
      };
      segments.forEach((segment) => {
        const index = Number(segment.dataset.accountIndex || 0);
        segment.addEventListener("mouseenter", () => setActive(index));
        segment.addEventListener("mouseleave", clearActive);
      });
      legendItems.forEach((item) => {
        const index = Number(item.dataset.accountIndex || 0);
        item.addEventListener("mouseenter", () => setActive(index));
        item.addEventListener("mouseleave", clearActive);
      });
    }
  } else {
    renderAccountsDonutChart(chartContainer, accounts);
  }
};
