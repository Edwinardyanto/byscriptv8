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

const CHART_PALETTE = [
  "#f5b94c",
  "#5e7bff",
  "#68d391",
  "#f56565",
  "#9f7aea",
  "#4fd1c5",
];

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
    return Array.from(assetTotals.entries()).map(([label, amount], index) => ({
      label,
      amount,
      color: ASSET_COLORS.get(label) || CHART_PALETTE[index % CHART_PALETTE.length],
    }));
  }

  if (type === "market") {
    const marketTotals = new Map();
    accounts.forEach((account) => {
      const label = capitalize(account.market_type || "spot");
      const current = marketTotals.get(label) || 0;
      marketTotals.set(label, current + Number(account.totalValueUsd || 0));
    });
    return Array.from(marketTotals.entries()).map(([label, amount], index) => ({
      label,
      amount,
      color: CHART_PALETTE[index % CHART_PALETTE.length],
    }));
  }

  return accounts
    .map((account, index) => ({
      label: `${account.provider} · ${formatAccountCode(account.account_code || account.account_id)}`,
      amount: Number(account.totalValueUsd || 0),
      color: CHART_PALETTE[index % CHART_PALETTE.length],
    }))
    .sort((a, b) => b.amount - a.amount);
};

const renderDonutChart = (container, items, onHover) => {
  const size = 220;
  const stroke = 28;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));

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
    circle.addEventListener("mouseenter", () => onHover(index));
    circle.addEventListener("mouseleave", () => onHover(null));
    svg.appendChild(circle);
    offset += segmentLength;
  });

  container.innerHTML = "";
  container.appendChild(svg);
};

const renderDistributionList = (container, items, onHover) => {
  container.innerHTML = "";
  items.forEach((item, index) => {
    const listItem = document.createElement("div");
    listItem.className = "accounts-distribution-item";
    listItem.dataset.index = String(index);
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
    listItem.addEventListener("mouseenter", () => onHover(index));
    listItem.addEventListener("mouseleave", () => onHover(null));
    container.appendChild(listItem);
  });
};

const renderDistribution = (filter, accounts, donutContainer, legendContainer) => {
  const items = buildDistributionData(filter, accounts);
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const normalized = items.map((item) => ({
    ...item,
    percent: totalAmount ? (item.amount / totalAmount) * 100 : 0,
  }));

  const setActive = (index) => {
    const donutSegments = donutContainer.querySelectorAll(".accounts-donut-segment");
    const listItems = legendContainer.querySelectorAll(".accounts-distribution-item");
    donutSegments.forEach((segment) => {
      const isActive = index !== null && Number(segment.dataset.index) === index;
      segment.classList.toggle("is-active", isActive);
    });
    listItems.forEach((item) => {
      const isActive = index !== null && Number(item.dataset.index) === index;
      item.classList.toggle("is-active", isActive);
    });
  };

  renderDonutChart(donutContainer, normalized, setActive);
  renderDistributionList(legendContainer, normalized, setActive);
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
  renderDistribution(filterSelect.value || "accounts", accountsWithMeta, donutContainer, legendContainer);

  filterSelect.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) {
      return;
    }
    renderDistribution(target.value, accountsWithMeta, donutContainer, legendContainer);
  });
};

initAccountsPage();
