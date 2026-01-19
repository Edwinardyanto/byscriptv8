import { calculateTotalAssetUsd } from "../calculateTotalAssetUsd.js";
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
  const START_ANGLE = -90;

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
      x: width / 2 + radius * Math.cos(((endAngle + START_ANGLE) * Math.PI) / 180),
      y: height / 2 + radius * Math.sin(((endAngle + START_ANGLE) * Math.PI) / 180),
    };
    const end = {
      x: width / 2 + radius * Math.cos(((startAngle + START_ANGLE) * Math.PI) / 180),
      y: height / 2 + radius * Math.sin(((startAngle + START_ANGLE) * Math.PI) / 180),
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
    const title = createSvgElement("title");
    title.textContent = `${account.name || "Account"} — Value: ${account.value || ""}`;
    path.appendChild(title);
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

const parseAssetsData = (value) => {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .map((item) => {
      const [name, percent] = item.split(":");
      return {
        name: name?.trim(),
        percent: Number(percent),
      };
    })
    .filter((item) => item.name && Number.isFinite(item.percent));
};

const setupAssetSegmentTooltip = () => {
  const table = document.querySelector(".accounts-table");
  if (!table || table.dataset.assetTooltipBound) {
    return;
  }

  table.dataset.assetTooltipBound = "true";
  const tooltip = document.createElement("div");
  tooltip.className = "asset-tooltip";
  tooltip.innerHTML = `
    <span class="asset-tooltip-accent"></span>
    <span class="asset-tooltip-name"></span>
    <span class="asset-tooltip-percent"></span>
    <span class="asset-tooltip-value"></span>
  `;
  document.body.appendChild(tooltip);

  const nameEl = tooltip.querySelector(".asset-tooltip-name");
  const percentEl = tooltip.querySelector(".asset-tooltip-percent");
  const valueEl = tooltip.querySelector(".asset-tooltip-value");
  let activeSegment = null;

  const updateTooltip = (segment) => {
    const assetName = segment.dataset.asset || "Asset";
    const percent = segment.dataset.percent || "--";
    const usd = segment.dataset.usd || "--";
    nameEl.textContent = assetName;
    percentEl.textContent = `${percent}% of account value`;
    valueEl.textContent = `${usd} USD`;
    const color = getComputedStyle(segment).getPropertyValue("--asset-color").trim();
    if (color) {
      tooltip.style.setProperty("--asset-color", color);
    }
  };

  const positionTooltip = (event) => {
    const offsetX = 14;
    const offsetY = 16;
    const { innerWidth, innerHeight } = window;
    const rect = tooltip.getBoundingClientRect();
    let x = event.clientX + offsetX;
    let y = event.clientY + offsetY;
    if (x + rect.width > innerWidth - 12) {
      x = innerWidth - rect.width - 12;
    }
    if (y + rect.height > innerHeight - 12) {
      y = innerHeight - rect.height - 12;
    }
    tooltip.style.left = `${Math.max(12, x)}px`;
    tooltip.style.top = `${Math.max(12, y)}px`;
  };

  table.addEventListener("mouseover", (event) => {
    const segment = event.target.closest(".asset-segment");
    if (!segment || !table.contains(segment)) {
      return;
    }
    if (segment !== activeSegment) {
      activeSegment = segment;
      updateTooltip(segment);
    }
    tooltip.classList.add("is-visible");
    positionTooltip(event);
  });

  table.addEventListener("mousemove", (event) => {
    if (!activeSegment) {
      return;
    }
    positionTooltip(event);
  });

  table.addEventListener("mouseout", (event) => {
    const segment = event.target.closest(".asset-segment");
    if (!segment || segment.contains(event.relatedTarget)) {
      return;
    }
    activeSegment = null;
    tooltip.classList.remove("is-visible");
  });
};

const getMarketType = (label) => {
  if (!label) {
    return "Spot";
  }
  const normalized = label.toLowerCase();
  if (normalized.includes("spot")) {
    return "Spot";
  }
  if (normalized.includes("usdt") || normalized.includes("future")) {
    return "Futures";
  }
  if (normalized.includes("cold") || normalized.includes("web3")) {
    return "Web3";
  }
  return "Spot";
};

const buildAccountsTableData = (formatCurrency) => {
  const rows = Array.from(document.querySelectorAll(".accounts-table tbody tr"));
  if (rows.length === 0) {
    return null;
  }
  const parseCurrency = (value) => {
    if (typeof value === "number") {
      return value;
    }
    if (typeof value !== "string") {
      return 0;
    }
    const numeric = Number(value.replace(/[^0-9.-]+/g, ""));
    return Number.isFinite(numeric) ? numeric : 0;
  };
  return rows.map((row) => {
    const name = row.querySelector(".account-name")?.textContent?.trim() || "Account";
    const type = row.querySelector(".account-type")?.textContent?.trim() || "";
    const usdValue = parseCurrency(row.querySelectorAll("td")[4]?.textContent || "");
    return {
      name,
      type,
      usdValue,
      assets: parseAssetsData(row.dataset.assets),
      value: formatCurrency.format(usdValue),
    };
  });
};

const normalizeDistribution = (items, formatCurrency) => {
  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 1;
  const sorted = [...items].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  const topItems = sorted.length > 5 ? sorted.slice(0, 4) : sorted;
  const remaining = sorted.slice(topItems.length);
  if (remaining.length > 0) {
    const othersAmount = remaining.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    topItems.push({
      name: "Others",
      amount: othersAmount,
      value: formatCurrency.format(othersAmount),
    });
  }
  return {
    total,
    items: topItems.map((item) => ({
      ...item,
      value: item.value || formatCurrency.format(Number(item.amount || 0)),
      percentage: total ? (Number(item.amount || 0) / total) * 100 : 0,
    })),
  };
};

export const renderAccountsSummary = async (sectionState) => {
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
  let accountsColors = [];

  if (isAccountsPage) {
    const filterSelect = section?.querySelector("[data-accounts-filter]");
    const tableData = buildAccountsTableData(formatCurrency);
    if (!tableData) {
      if (chartContainer) {
        chartContainer.innerHTML = "<div class=\"accounts-distribution-empty\"></div>";
      }
      return;
    }

    accountsColors = [
      getCssVar("--color-chart-accent-primary", "rgba(102, 255, 51, 0.75)"),
      getCssVar("--color-chart-secondary", "rgba(0, 247, 213, 0.6)"),
      getCssVar("--color-chart-tertiary", "rgba(61, 44, 141, 0.6)"),
      getCssVar("--color-status-negative-text-muted", "rgba(255, 95, 95, 0.75)"),
      getCssVar("--color-chart-muted", "rgba(217, 217, 217, 0.5)"),
    ];

    const buildFilterItems = (filterValue) => {
      if (filterValue === "market") {
        const grouped = tableData.reduce((acc, account) => {
          const key = getMarketType(account.type);
          acc[key] = (acc[key] || 0) + account.usdValue;
          return acc;
        }, {});
        return Object.entries(grouped).map(([name, amount]) => ({
          name,
          amount,
          value: formatCurrency.format(amount),
        }));
      }

      if (filterValue === "assets") {
        const grouped = tableData.reduce((acc, account) => {
          account.assets.forEach((asset) => {
            acc[asset.name] =
              (acc[asset.name] || 0) + (account.usdValue * asset.percent) / 100;
          });
          return acc;
        }, {});
        return Object.entries(grouped).map(([name, amount]) => ({
          name,
          amount,
          value: formatCurrency.format(amount),
        }));
      }

      return tableData.map((account) => ({
        name: account.name,
        amount: account.usdValue,
        value: account.value,
      }));
    };

    const renderDistribution = async (filterValue) => {
      list.innerHTML = "";
      const { items, total } = normalizeDistribution(buildFilterItems(filterValue), formatCurrency);
      const totalUsd = await calculateTotalAssetUsd();
      items.forEach((account, index) => {
        const item = document.createElement("div");
        item.className = "accounts-distribution-item";
        item.dataset.accountIndex = `${index}`;
        item.innerHTML = `
          <div class="accounts-distribution-item-header">
            <span class="accounts-distribution-item-name">
              <span class="accounts-legend-dot" style="--legend-color: ${
                accountsColors[index % accountsColors.length]
              }"></span>
              <span>${account.name}</span>
            </span>
            <span class="accounts-distribution-item-meta">
              <span>${account.value}</span>
              <span>${account.percentage.toFixed(1)}%</span>
            </span>
          </div>
          <div class="accounts-distribution-bar">
            <span style="--fill-width: ${Math.min(
              100,
              account.percentage
            ).toFixed(2)}%; --fill-color: ${
              accountsColors[index % accountsColors.length]
            }"></span>
          </div>
        `;
        list.appendChild(item);
      });

      renderAccountsPageDonutChart(chartContainer, items, accountsColors);
      const segments = chartContainer?.querySelectorAll(".accounts-donut-segment");
      const legendItems = list?.querySelectorAll(".accounts-distribution-item");
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
      setText('[data-field="accounts.total"]', formatCurrency.format(totalUsd));
    };

    if (filterSelect && !filterSelect.dataset.listenerBound) {
      filterSelect.dataset.listenerBound = "true";
      filterSelect.addEventListener("change", () => {
        renderDistribution(filterSelect.value);
      });
    }

    const activeFilter = filterSelect?.value || "accounts";
    renderDistribution(activeFilter);
    setupAssetSegmentTooltip();
  } else {
    accounts.forEach((account) => {
      const item = document.createElement("div");
      item.className = "summary-item";
      item.innerHTML = `
        <span class="summary-item-name">${account.name}</span>
        <span class="summary-item-value">${account.value}</span>
      `;
      list.appendChild(item);
    });

    const totalUsd = await calculateTotalAssetUsd();
    setText('[data-field="accounts.total"]', formatCurrency.format(totalUsd));
    renderAccountsDonutChart(chartContainer, accounts);
  }
};
