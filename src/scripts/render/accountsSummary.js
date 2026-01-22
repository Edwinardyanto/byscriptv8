import { renderAccountsDonutChart } from "../charts/accountsDonutChart.js";

/* ---------------- utils ---------------- */

const setText = (selector, value) => {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
};

const setListMessage = (list, message) => {
  if (!list) return;
  list.innerHTML = "";
  const item = document.createElement("div");
  item.className = "summary-item";
  item.textContent = message;
  list.appendChild(item);
};

const getCssVar = (name, fallback) => {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
};

const createSvgElement = (tag) =>
  document.createElementNS("http://www.w3.org/2000/svg", tag);

/* ---------------- donut (accounts page) ---------------- */

const renderAccountsPageDonutChart = (container, accounts, colors = []) => {
  if (!container || !Array.isArray(accounts) || accounts.length === 0) return;

  const chartColors =
    colors.length > 0
      ? colors
      : [
          getCssVar("--color-chart-accent-primary", "#3fd37c"),
          getCssVar("--color-chart-secondary", "#7b62ff"),
          getCssVar("--color-chart-tertiary", "#29b3d1"),
          getCssVar("--color-chart-muted", "#4f7dff"),
        ];

  const width = 232;
  const height = 232;
  const strokeWidth = 20;
  const radius = (Math.min(width, height) - strokeWidth) / 2;
  const total =
    accounts.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 1;

  const gapDegrees = 3;
  const START_ANGLE = -90;

  const svg = createSvgElement("svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  let currentAngle = 0;

  accounts.forEach((account, index) => {
    const value = Number(account.amount || 0);
    const angle = (value / total) * 360;
    const appliedGap = angle > gapDegrees ? gapDegrees : 0;

    const startAngle = currentAngle + appliedGap / 2;
    const endAngle = currentAngle + angle - appliedGap / 2;

    const start = {
      x:
        width / 2 +
        radius * Math.cos(((endAngle + START_ANGLE) * Math.PI) / 180),
      y:
        height / 2 +
        radius * Math.sin(((endAngle + START_ANGLE) * Math.PI) / 180),
    };
    const end = {
      x:
        width / 2 +
        radius * Math.cos(((startAngle + START_ANGLE) * Math.PI) / 180),
      y:
        height / 2 +
        radius * Math.sin(((startAngle + START_ANGLE) * Math.PI) / 180),
    };

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    const path = createSvgElement("path");
    path.setAttribute(
      "d",
      `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`
    );
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", chartColors[index % chartColors.length]);
    path.setAttribute("stroke-width", strokeWidth);
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("opacity", "0.82");
    path.classList.add("accounts-donut-segment");
    path.dataset.accountIndex = index;

    svg.appendChild(path);
    currentAngle += angle;
  });

  const center = createSvgElement("circle");
  center.setAttribute("cx", width / 2);
  center.setAttribute("cy", height / 2);
  center.setAttribute("r", radius - strokeWidth / 2);
  center.setAttribute("fill", getCssVar("--color-bg-surface", "#0d1015"));
  svg.appendChild(center);

  container.innerHTML = "";
  container.appendChild(svg);
};

/* ---------------- main render ---------------- */

export const renderAccountsSummary = async (sectionState) => {
  const { data, status } = sectionState;

  const list = document.querySelector('[data-list="accounts"]');
  const section = list?.closest(".section");
  const chartContainer =
    section?.querySelector('[data-accounts-donut] .chart-placeholder') ||
    section?.querySelector(".summary-total .chart-placeholder");

  const isAccountsPage =
    document.body?.classList.contains("page-accounts");

  const totalFromData = data?.accountsSummary?.total || "--";

  const formatCurrency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  /* ---------- loading ---------- */

  if (status === "loading") {
    if (list) setListMessage(list, "Loading accounts...");
    if (chartContainer) chartContainer.textContent = "Loading chart...";
    setText('[data-field="accounts.total"]', "--");
    return;
  }

  /* ---------- error ---------- */

  if (status === "error") {
    if (list) setListMessage(list, "Unable to load accounts");
    if (chartContainer) chartContainer.textContent = "Chart unavailable";
    setText('[data-field="accounts.total"]', "--");
    return;
  }

  /* ---------- empty ---------- */

  if (!data || !data.accounts || data.accounts.length === 0) {
    if (list) setListMessage(list, "No accounts data");
    if (chartContainer) chartContainer.textContent = "No chart data";
    setText('[data-field="accounts.total"]', "--");
    return;
  }

  /* ---------- dashboard ---------- */

  if (!isAccountsPage) {
    list.innerHTML = "";
    data.accounts.forEach((account) => {
      const item = document.createElement("div");
      item.className = "summary-item";
      item.innerHTML = `
        <span class="summary-item-name">${account.name}</span>
        <span class="summary-item-value">${account.value}</span>
      `;
      list.appendChild(item);
    });

    setText('[data-field="accounts.total"]', totalFromData);
    renderAccountsDonutChart(chartContainer, data.accounts);
    return;
  }

  /* ---------- accounts page ---------- */

  const items = data.accounts.map((a) => ({
    name: a.name,
    amount: Number(
      typeof a.amount === "number"
        ? a.amount
        : Number(a.value?.replace(/[^0-9.-]/g, "")) || 0
    ),
    value: a.value,
  }));

  list.innerHTML = "";
  items.forEach((account) => {
    const row = document.createElement("div");
    row.className = "accounts-distribution-item";
    row.innerHTML = `
      <div class="accounts-distribution-item-header">
        <span>${account.name}</span>
        <span>${account.value}</span>
      </div>
    `;
    list.appendChild(row);
  });

  renderAccountsPageDonutChart(chartContainer, items);
  setText('[data-field="accounts.total"]', totalFromData);
};
