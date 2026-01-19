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

const getAssetBrandColor = (asset) =>
  asset?.brand_color || asset?.asset?.brand_color || "";

const getTopAssetColor = (assets = []) => {
  if (!Array.isArray(assets) || assets.length === 0) {
    return "";
  }
  const topAsset = assets.reduce((best, current) => {
    const currentValue = Number(current.usd_value || 0);
    const bestValue = Number(best?.usd_value || 0);
    return currentValue > bestValue ? current : best;
  }, assets[0]);
  return getAssetBrandColor(topAsset);
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
    const color = getAssetBrandColor(asset);
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
        const current = assetTotals.get(symbol) || {
          amount: 0,
          color: getAssetBrandColor(asset),
        };
        assetTotals.set(symbol, {
          amount: current.amount + Number(asset.usd_value || 0),
          color: current.color || getAssetBrandColor(asset),
        });
      });
    });
    const sortedAssets = Array.from(assetTotals.entries())
      .map(([label, details]) => ({
        label,
        amount: details.amount,
        color: details.color,
        colorKey: label,
        listIndex: null,
      }))
      .sort((a, b) => b.amount - a.amount);
    const donutItems = sortedAssets.map((item, index) => ({
      ...item,
      donutIndex: index,
    }));
    if (sortedAssets.length <= 5) {
      return {
        donutItems,
        listItems: sortedAssets.map((item) => ({
          ...item,
          listKeys: [item.colorKey],
        })),
      };
    }
    const topItems = sortedAssets.slice(0, 4).map((item) => ({
      ...item,
      listKeys: [item.colorKey],
    }));
    const remainder = sortedAssets.slice(4);
    const othersAmount = remainder.reduce((sum, item) => sum + item.amount, 0);
    const othersColor = remainder.find((item) => item.color)?.color || sortedAssets[0]?.color;
    const othersKeys = remainder.map((item) => item.colorKey);
    return {
      donutItems,
      listItems: [
        ...topItems,
        {
          label: "Others",
          amount: othersAmount,
          color: othersColor,
          isOther: true,
          colorKey: "others",
          listKeys: othersKeys,
        },
      ],
    };
  }

  if (type === "market") {
    const marketTotals = new Map();
    accounts.forEach((account) => {
      const label = capitalize(account.market_type || "spot");
      if (!marketTotals.has(label)) {
        marketTotals.set(label, { amount: 0, assets: [] });
      }
      const current = marketTotals.get(label);
      current.amount += Number(account.totalValueUsd || 0);
      current.assets.push(...account.assets);
    });
    const items = Array.from(marketTotals.entries())
      .map(([label, details]) => ({
        label,
        amount: details.amount,
        color: getTopAssetColor(details.assets),
        colorKey: label,
      }))
      .sort((a, b) => b.amount - a.amount);
    const donutItems = items.map((item, index) => ({
      ...item,
      donutIndex: index,
    }));
    if (items.length <= 5) {
      return {
        donutItems,
        listItems: items.map((item) => ({
          ...item,
          listKeys: [item.colorKey],
        })),
      };
    }
    const topItems = items.slice(0, 4).map((item) => ({
      ...item,
      listKeys: [item.colorKey],
    }));
    const remainder = items.slice(4);
    const othersAmount = remainder.reduce((sum, item) => sum + item.amount, 0);
    const othersColor = remainder.find((item) => item.color)?.color || items[0]?.color;
    const othersKeys = remainder.map((item) => item.colorKey);
    return {
      donutItems,
      listItems: [
        ...topItems,
        {
          label: "Others",
          amount: othersAmount,
          color: othersColor,
          isOther: true,
          colorKey: "others",
          listKeys: othersKeys,
        },
      ],
    };
  }

  const sortedAccounts = accounts
    .map((account) => ({
      label: formatAccountCode(account.account_code || account.account_id),
      colorKey: account.account_id || account.account_code,
      provider: account.provider || "Provider",
      market: capitalize(account.market_type || "spot"),
      amount: Number(account.totalValueUsd || 0),
      color: getTopAssetColor(account.assets),
      assets: account.assets,
      listIndex: null,
    }))
    .sort((a, b) => b.amount - a.amount);
  const donutItems = sortedAccounts.map((item, index) => ({
    ...item,
    donutIndex: index,
  }));
  if (sortedAccounts.length <= 5) {
    return {
      donutItems,
      listItems: sortedAccounts.map((item) => ({
        ...item,
        listKeys: [item.colorKey],
      })),
    };
  }
  const topItems = sortedAccounts.slice(0, 4).map((item) => ({
    ...item,
    listKeys: [item.colorKey],
  }));
  const remainder = sortedAccounts.slice(4);
  const othersAmount = remainder.reduce((sum, item) => sum + item.amount, 0);
  const othersAssets = remainder.flatMap((item) => item.assets || []);
  const othersKeys = remainder.map((item) => item.colorKey);
  return {
    donutItems,
    listItems: [
      ...topItems,
      {
        label: "Others",
        amount: othersAmount,
        color: getTopAssetColor(othersAssets) || sortedAccounts[0]?.color,
        isOther: true,
        colorKey: "others",
        listKeys: othersKeys,
      },
    ],
  };
};

const renderDonutChart = (container, items, onHover, tooltip) => {
  const size = 220;
  const stroke = 28;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const START_ANGLE = -90;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.transform = `rotate(${START_ANGLE}deg)`;
  svg.style.transformOrigin = "50% 50%";

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
    circle.dataset.index = String(item.donutIndex ?? index);
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
    listItem.dataset.keys = (item.listKeys || []).join("|");
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

let updateDistributionHeight = null;

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
    const targetKey = hasActive ? normalizedDonut[index]?.colorKey : null;
    const targetDonutIndex = hasActive ? normalizedDonut[index]?.donutIndex : null;
    donutSegments.forEach((segment) => {
      const isActive = hasActive && Number(segment.dataset.index) === targetDonutIndex;
      segment.classList.toggle("is-active", isActive);
      segment.classList.toggle("is-dimmed", hasActive && !isActive);
    });
    listRows.forEach((item) => {
      const keys = item.dataset.keys ? item.dataset.keys.split("|") : [];
      const isActive = hasActive && targetKey && keys.includes(targetKey);
      item.classList.toggle("is-active", isActive);
    });
  };

  renderDonutChart(donutContainer, normalizedDonut, setActive, tooltip);
  renderDistributionList(legendContainer, normalizedList, filter);
  if (typeof updateDistributionHeight === "function") {
    updateDistributionHeight();
  }
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

  let lockedHeight = 0;
  const applyHeight = () => {
    const { height } = summaryPanel.getBoundingClientRect();
    const header = distributionPanel.querySelector(".accounts-distribution-header");
    const layout = distributionPanel.querySelector(".accounts-distribution-layout");
    const gap = Number.parseFloat(getComputedStyle(distributionPanel).gap || "0");
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const layoutHeight = layout ? layout.scrollHeight : 0;
    const requiredHeight = headerHeight + gap + layoutHeight;
    const nextHeight = Math.max(height || 0, requiredHeight, lockedHeight);
    if (nextHeight) {
      lockedHeight = nextHeight;
      distributionPanel.style.height = `${nextHeight}px`;
    }
  };

  applyHeight();

  if (typeof ResizeObserver !== "undefined") {
    const observer = new ResizeObserver(() => applyHeight());
    observer.observe(summaryPanel);
  }

  window.addEventListener("resize", applyHeight);

  return applyHeight;
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

  updateDistributionHeight = syncDistributionHeight();

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
