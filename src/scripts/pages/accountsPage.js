import {
  getAccountsWithSummary,
  getAutotradersByAccount,
  getTradeHistory,
} from "../dataAccess.js";

const PAGE_SIZE = 5;
const PERFORMANCE_RANGES = [
  { label: "7D", days: 7 },
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
];

const ASSET_COLORS = new Map([
  ["BTC", "#f5b94c"],
  ["ETH", "#5e7bff"],
  ["SOL", "#68d391"],
  ["AVAX", "#f56565"],
  ["BNB", "#ecc94b"],
]);

const NEUTRAL_COLOR = "#8a8f98";
const GOLDEN_ANGLE = 137.508;

const hashString = (value) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const formatHsl = (hue, saturation = 70, lightness = 55) =>
  `hsl(${hue.toFixed(2)}deg ${saturation}% ${lightness}%)`;

const resolveUniqueColor = (key, usedColors, preferredColor = null) => {
  if (preferredColor && !usedColors.has(preferredColor)) {
    return preferredColor;
  }
  let hue = hashString(key) % 360;
  let color = formatHsl(hue);
  let guard = 0;
  while (usedColors.has(color) && guard < 360) {
    hue = (hue + GOLDEN_ANGLE) % 360;
    color = formatHsl(hue);
    guard += 1;
  }
  return color;
};

const buildUniqueColorMap = (items, getKey, getPreferredColor) => {
  const usedColors = new Set();
  const colorMap = new Map();
  const keys = Array.from(new Set(items.map(getKey))).sort();
  keys.forEach((key) => {
    const preferred = getPreferredColor ? getPreferredColor(key) : null;
    const color = resolveUniqueColor(key, usedColors, preferred);
    colorMap.set(key, color);
    usedColors.add(color);
  });
  return colorMap;
};

const formatCurrency = (value, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const formatPercent = (value) => {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
};

const formatAccountCode = (code = "") =>
  code.length > 8 ? `${code.slice(0, 4)}...${code.slice(-4)}` : code;

const capitalize = (value = "") =>
  value ? value.charAt(0).toUpperCase() + value.slice(1) : value;

const buildAccountPerformance = async (accountId, totalValue) => {
  const now = Date.now();
  const performance = {};
  await Promise.all(
    PERFORMANCE_RANGES.map(async ({ label, days }) => {
      const from = new Date(now - days * 24 * 60 * 60 * 1000);
      const trades = await getTradeHistory({ accountId, from });
      const pnl = trades.reduce((sum, trade) => sum + Number(trade.pnl_usd || 0), 0);
      performance[label] = totalValue ? (pnl / totalValue) * 100 : 0;
    })
  );
  return performance;
};

const buildAssetsBar = (assets, tooltip) => {
  const total = assets.reduce((sum, asset) => sum + Number(asset.usd_value || 0), 0);
  const container = document.createElement("div");
  container.className = "assets-bar";
  container.setAttribute("role", "img");
  container.setAttribute("aria-label", "Asset distribution");

  assets.forEach((asset) => {
    const value = Number(asset.usd_value || 0);
    const percent = total ? (value / total) * 100 : 0;
    const symbol = asset.assetSymbol || asset.asset?.symbol || "ASSET";
    const color = ASSET_COLORS.get(symbol) || "rgba(86, 221, 97, 0.5)";
    const segment = document.createElement("span");
    segment.className = "asset-segment";
    segment.style.width = `${percent}%`;
    segment.style.setProperty("--asset-color", color);
    segment.dataset.asset = symbol;
    segment.dataset.percent = percent.toFixed(1);
    segment.dataset.usd = formatCurrency(value);

    segment.addEventListener("mouseenter", (event) => {
      if (!tooltip) {
        return;
      }
      tooltip.innerHTML = `
        <span class="asset-tooltip-accent" style="--asset-color: ${color};"></span>
        <span class="asset-tooltip-name">${symbol}</span>
        <span>${segment.dataset.percent}% · ${segment.dataset.usd}</span>
      `;
      tooltip.classList.add("is-visible");
      tooltip.style.setProperty("--asset-color", color);
      tooltip.style.left = `${event.clientX + 12}px`;
      tooltip.style.top = `${event.clientY - 12}px`;
    });

    segment.addEventListener("mousemove", (event) => {
      if (!tooltip) {
        return;
      }
      tooltip.style.left = `${event.clientX + 12}px`;
      tooltip.style.top = `${event.clientY - 12}px`;
    });

    segment.addEventListener("mouseleave", () => {
      if (!tooltip) {
        return;
      }
      tooltip.classList.remove("is-visible");
    });

    container.appendChild(segment);
  });

  return container;
};

const buildDistributionData = (type, accounts) => {
  if (type === "assets") {
    const assetTotals = new Map();
    accounts.forEach((account) => {
      account.assets.forEach((asset) => {
        const symbol = asset.assetSymbol || asset.asset?.symbol || "ASSET";
        const current = assetTotals.get(symbol) || 0;
        assetTotals.set(symbol, current + Number(asset.usd_value || 0));
      });
    });
    const sortedAssets = Array.from(assetTotals.entries())
      .map(([label, amount]) => ({
        label,
        amount,
        colorKey: label,
      }))
      .sort((a, b) => b.amount - a.amount);
    const assetColors = buildUniqueColorMap(
      sortedAssets,
      (item) => item.colorKey,
      (key) => ASSET_COLORS.get(key)
    );
    sortedAssets.forEach((item) => {
      item.color = assetColors.get(item.colorKey);
    });
    const listItems = sortedAssets.slice(0, 4).map((item) => ({
      ...item,
      listIndex: null,
    }));
    const remainder = sortedAssets.slice(4);
    if (remainder.length) {
      const othersAmount = remainder.reduce((sum, item) => sum + item.amount, 0);
      listItems.push({
        label: "Others",
        amount: othersAmount,
        color: NEUTRAL_COLOR,
        isOther: true,
        colorKey: "others",
        listIndex: null,
      });
    }
    sortedAssets.forEach((item, index) => {
      item.listIndex = index < 4 ? index : listItems.length - 1;
    });
    return { listItems, donutItems: sortedAssets };
  }

  if (type === "market") {
    const marketTotals = new Map();
    accounts.forEach((account) => {
      const label = capitalize(account.market_type || "spot");
      const current = marketTotals.get(label) || 0;
      marketTotals.set(label, current + Number(account.totalValueUsd || 0));
    });
    const items = Array.from(marketTotals.entries()).map(([label, amount], index) => ({
      label,
      amount,
      colorKey: label,
      listIndex: index,
    }));
    const marketColors = buildUniqueColorMap(items, (item) => item.colorKey);
    items.forEach((item) => {
      item.color = marketColors.get(item.colorKey);
    });
    return { listItems: items, donutItems: items };
  }

  const sortedAccounts = accounts
    .map((account) => ({
      label: formatAccountCode(account.account_code || account.account_id),
      colorKey: account.account_id || account.account_code,
      provider: account.provider || "Provider",
      market: capitalize(account.market_type || "spot"),
      amount: Number(account.totalValueUsd || 0),
    }))
    .sort((a, b) => b.amount - a.amount);
  const accountColors = buildUniqueColorMap(sortedAccounts, (item) => item.colorKey || item.label);
  sortedAccounts.forEach((item) => {
    item.color = accountColors.get(item.colorKey || item.label);
  });
  const listItems = sortedAccounts.slice(0, 4).map((item) => ({
    ...item,
    listIndex: null,
  }));
  const remainingAccounts = sortedAccounts.slice(4);
  const othersAmount = remainingAccounts.reduce((sum, item) => sum + item.amount, 0);
  listItems.push({
    label: "Others",
    amount: othersAmount,
    color: NEUTRAL_COLOR,
    isOther: true,
    colorKey: "others",
    listIndex: null,
  });
  sortedAccounts.forEach((item, index) => {
    item.listIndex = index < 4 ? index : listItems.length - 1;
  });
  return { listItems, donutItems: sortedAccounts };
};

const renderDonutChart = (container, items, onHover, tooltip) => {
  const size = 220;
  const stroke = 28;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.transform = "rotate(-90deg)";

  let offset = 0;
  items.forEach((item, index) => {
    const segmentLength = (item.percent / 100) * circumference;
    if (segmentLength <= 0) {
      return;
    }
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", String(size / 2));
    circle.setAttribute("cy", String(size / 2));
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", "transparent");
    circle.setAttribute("stroke", item.color);
    circle.setAttribute("stroke-width", String(stroke));
    circle.setAttribute("stroke-dasharray", `${segmentLength} ${circumference}`);
    circle.setAttribute("stroke-dashoffset", String(-offset));
    circle.setAttribute("class", "accounts-donut-segment");
    circle.dataset.index = String(index);
    circle.addEventListener("mouseenter", (event) => {
      onHover(index);
      if (!tooltip) {
        return;
      }
      tooltip.innerHTML = `
        <span class="asset-tooltip-accent" style="--asset-color: ${item.color};"></span>
        <span class="asset-tooltip-name">${item.label}</span>
        <span>${item.percent.toFixed(1)}% · ${formatCurrency(item.amount)}</span>
      `;
      tooltip.classList.add("is-visible");
      tooltip.style.setProperty("--asset-color", item.color);
      tooltip.style.left = `${event.clientX + 12}px`;
      tooltip.style.top = `${event.clientY - 12}px`;
    });
    circle.addEventListener("mousemove", (event) => {
      if (!tooltip) {
        return;
      }
      tooltip.style.left = `${event.clientX + 12}px`;
      tooltip.style.top = `${event.clientY - 12}px`;
    });
    circle.addEventListener("mouseleave", () => {
      onHover(null);
      if (!tooltip) {
        return;
      }
      tooltip.classList.remove("is-visible");
    });
    svg.appendChild(circle);
    offset += segmentLength;
  });

  container.innerHTML = "";
  container.appendChild(svg);
};

const renderDistributionList = (container, items, filter) => {
  container.innerHTML = "";
  items.forEach((item, index) => {
    const listItem = document.createElement("div");
    listItem.className = "accounts-distribution-item";
    listItem.dataset.index = String(index);
    if (filter === "assets") {
      listItem.classList.add("accounts-distribution-item--compact");
      listItem.innerHTML = `
        <div class="accounts-distribution-item-line">
          <span class="accounts-legend-dot" style="--legend-color: ${item.color};"></span>
          <span class="accounts-distribution-item-label">${item.label}</span>
          <span class="accounts-distribution-item-percent">${item.percent.toFixed(1)}%</span>
          <span class="accounts-distribution-item-value">${formatCurrency(item.amount)}</span>
        </div>
      `;
    } else if (filter === "accounts") {
      listItem.classList.add("accounts-distribution-item--compact");
      const headerLabel = item.isOther ? item.label : `${item.provider} · ${item.market}`;
      const accountLabel = item.isOther ? "" : item.label;
      const accountLabelHtml = accountLabel ? `<span>${accountLabel}</span>` : "";
      listItem.innerHTML = `
        <div class="accounts-distribution-item-line">
          <span class="accounts-legend-dot" style="--legend-color: ${item.color};"></span>
          <div class="accounts-distribution-item-details">
            <div class="accounts-distribution-item-provider">${headerLabel}</div>
            <div class="accounts-distribution-item-stats">
              ${accountLabelHtml}
              <span>${item.percent.toFixed(1)}%</span>
              <span>${formatCurrency(item.amount)}</span>
            </div>
          </div>
        </div>
      `;
    } else {
      listItem.innerHTML = `
        <div class="accounts-distribution-item-header">
          <div class="accounts-distribution-item-name">
            <span class="accounts-legend-dot" style="--legend-color: ${item.color};"></span>
            <span>${item.label}</span>
          </div>
          <strong>${formatCurrency(item.amount)}</strong>
        </div>
        <div class="accounts-distribution-item-meta">
          <span>${item.percent.toFixed(1)}%</span>
          <span>${formatCurrency(item.amount)}</span>
        </div>
        <div class="accounts-distribution-bar">
          <span style="--fill-width: ${item.percent}%; --fill-color: ${item.color};"></span>
        </div>
      `;
    }
    container.appendChild(listItem);
  });
};

const renderDistribution = (filter, accounts, donutContainer, legendContainer, tooltip) => {
  const { listItems, donutItems } = buildDistributionData(filter, accounts);
  const totalAmount = donutItems.reduce((sum, item) => sum + item.amount, 0);
  const normalizedDonut = donutItems.map((item) => ({
    ...item,
    percent: totalAmount ? (item.amount / totalAmount) * 100 : 0,
  }));
  const normalizedList = listItems.map((item) => ({
    ...item,
    percent: totalAmount ? (item.amount / totalAmount) * 100 : 0,
  }));

  const setActive = (index) => {
    const donutSegments = donutContainer.querySelectorAll(".accounts-donut-segment");
    const listRows = legendContainer.querySelectorAll(".accounts-distribution-item");
    const hasActive = index !== null;
    const targetListIndex = hasActive ? normalizedDonut[index]?.listIndex : null;
    donutSegments.forEach((segment) => {
      const isActive = hasActive && Number(segment.dataset.index) === index;
      segment.classList.toggle("is-active", isActive);
      segment.classList.toggle("is-dimmed", hasActive && !isActive);
    });
    listRows.forEach((item) => {
      const isActive = hasActive && Number(item.dataset.index) === targetListIndex;
      item.classList.toggle("is-active", isActive);
    });
  };

  renderDonutChart(donutContainer, normalizedDonut, setActive, tooltip);
  renderDistributionList(legendContainer, normalizedList, filter);
};

const renderAccountsTable = (accounts, tableBody, pagination, tooltip) => {
  const totalPages = Math.ceil(accounts.length / PAGE_SIZE);
  let currentPage = 1;

  const renderRows = () => {
    tableBody.innerHTML = "";
    const start = (currentPage - 1) * PAGE_SIZE;
    const pageItems = accounts.slice(start, start + PAGE_SIZE);
    pageItems.forEach((account) => {
      const row = document.createElement("tr");
      const accountLabel = formatAccountCode(account.account_code || account.account_id);
      const marketLabel = capitalize(account.market_type || "spot");
      const performanceCells = PERFORMANCE_RANGES.map(({ label }) => {
        const value = account.performance?.[label] || 0;
        const className = value > 0 ? "metric-positive" : value < 0 ? "metric-negative" : "";
        return `<td class="${className}">${formatPercent(value)}</td>`;
      }).join("");

      row.innerHTML = `
        <td>
          <div class="account-main">
            <span class="account-id">${accountLabel}</span>
            <span class="account-type"><span>${account.provider}</span> · ${marketLabel}</span>
          </div>
        </td>
        <td>${formatCurrency(account.totalValueUsd)}</td>
        ${performanceCells}
        <td><span class="autotrader-count-pill">${account.autotradersCount}</span></td>
        <td></td>
        <td><button class="table-action" aria-label="Open actions">⋮</button></td>
      `;

      const assetsCell = row.querySelector("td:nth-child(7)");
      if (assetsCell) {
        assetsCell.appendChild(buildAssetsBar(account.assets, tooltip));
      }

      tableBody.appendChild(row);
    });
  };

  const renderPagination = () => {
    pagination.innerHTML = "";
    if (totalPages <= 1) {
      return;
    }
    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `page-button${page === currentPage ? " active" : ""}`;
      button.textContent = String(page);
      button.addEventListener("click", () => {
        currentPage = page;
        renderRows();
        renderPagination();
      });
      pagination.appendChild(button);
    }
  };

  renderRows();
  renderPagination();
};

const syncDistributionHeight = () => {
  const summaryPanel = document.querySelector(".accounts-summary-left");
  const distributionPanel = document.querySelector(".accounts-distribution");
  if (!summaryPanel || !distributionPanel) {
    return;
  }

  const applyHeight = () => {
    const { height } = summaryPanel.getBoundingClientRect();
    if (height) {
      distributionPanel.style.height = `${height}px`;
    }
  };

  applyHeight();

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => applyHeight());
    observer.observe(summaryPanel);
  }

  window.addEventListener("resize", applyHeight);
};

const initAccountsPage = async () => {
  if (!document.body.classList.contains("page-accounts")) {
    return;
  }

  const tableBody = document.querySelector("[data-accounts-rows]");
  const pagination = document.querySelector("[data-accounts-pagination]");
  const filterSelect = document.querySelector("[data-accounts-filter]");
  const donutContainer = document.querySelector("[data-accounts-donut]");
  const legendContainer = document.querySelector("[data-accounts-legend]");

  if (!tableBody || !pagination || !filterSelect || !donutContainer || !legendContainer) {
    return;
  }

  syncDistributionHeight();

  const tooltip = document.createElement("div");
  tooltip.className = "asset-tooltip";
  document.body.appendChild(tooltip);

  const accounts = await getAccountsWithSummary();
  const accountsWithMeta = await Promise.all(
    accounts.map(async (account) => {
      const autotraders = await getAutotradersByAccount(account.account_id);
      const performance = await buildAccountPerformance(
        account.account_id,
        account.totalValueUsd
      );
      return {
        ...account,
        autotradersCount: autotraders.length,
        performance,
      };
    })
  );

  renderAccountsTable(accountsWithMeta, tableBody, pagination, tooltip);
  renderDistribution(
    filterSelect.value || "accounts",
    accountsWithMeta,
    donutContainer,
    legendContainer,
    tooltip
  );

  filterSelect.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    renderDistribution(target.value, accountsWithMeta, donutContainer, legendContainer, tooltip);
  });
};

initAccountsPage();
