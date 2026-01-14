import {
  getAccountAssets,
  getAccountsWithSummary,
  getAutotradersByAccount,
} from "../dataAccess.js";
import { getState } from "../state.js";
import { renderAccountsSummary } from "../render/accountsSummary.js";

const ACCOUNTS_PAGE = "page-accounts";

const formatCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const formatPercent = (value) => {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
};

const getSeedValue = (accountId) =>
  accountId
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);

const buildPerformanceMetric = (accountId, baseline) => {
  const seed = getSeedValue(accountId);
  const variance = (seed % 35) / 10;
  const sign = seed % 2 === 0 ? 1 : -1;
  return sign * (baseline + variance);
};

const buildAssetSegments = (assets, totalValue) => {
  const colors = ["#f5b94c", "#5e7bff", "#68d391", "#f56565", "#38bdf8"];
  return assets.map((asset, index) => {
    const percent = totalValue ? (asset.usd_value / totalValue) * 100 : 0;
    return {
      symbol: asset.asset_symbol,
      percent,
      usd: formatCurrency.format(asset.usd_value),
      color: colors[index % colors.length],
    };
  });
};

const buildAssetsDataset = (segments) =>
  segments
    .map((segment) => `${segment.symbol}:${Math.round(segment.percent)}`)
    .join(",");

const renderAccountRow = ({ account, totalValue, assets, autotraderCount }) => {
  const row = document.createElement("tr");
  const performance7d = buildPerformanceMetric(account.account_id, 1.2);
  const performance30d = buildPerformanceMetric(account.account_id, 3.4);
  const performance90d = buildPerformanceMetric(account.account_id, 6.1);
  const segments = buildAssetSegments(assets, totalValue);

  row.dataset.assets = buildAssetsDataset(segments);

  const buildMetricCell = (value) => {
    const cell = document.createElement("td");
    cell.textContent = formatPercent(value);
    cell.className = value >= 0 ? "metric-positive" : "metric-negative";
    return cell;
  };

  row.innerHTML = `
    <td>
      <div class="account-main">
        <span class="account-id">${account.account_code}</span>
        <span class="account-type"><span>${account.provider}</span> · ${
    account.market_type === "spot" ? "Spot" : "Futures"
  }</span>
      </div>
    </td>
    <td>${formatCurrency.format(totalValue)}</td>
  `;

  row.appendChild(buildMetricCell(performance7d));
  row.appendChild(buildMetricCell(performance30d));
  row.appendChild(buildMetricCell(performance90d));

  const autoTd = document.createElement("td");
  autoTd.innerHTML = `<span class="autotrader-count-pill">${autotraderCount}</span>`;
  row.appendChild(autoTd);

  const assetsTd = document.createElement("td");
  const assetsBar = document.createElement("div");
  assetsBar.className = "assets-bar";
  assetsBar.setAttribute("role", "img");
  assetsBar.setAttribute("aria-label", "Asset distribution");
  segments.forEach((segment) => {
    const span = document.createElement("span");
    span.className = "asset-segment";
    span.style.width = `${segment.percent}%`;
    span.style.setProperty("--asset-color", segment.color);
    span.dataset.asset = segment.symbol;
    span.dataset.percent = segment.percent.toFixed(0);
    span.dataset.usd = segment.usd;
    assetsBar.appendChild(span);
  });
  assetsTd.appendChild(assetsBar);
  row.appendChild(assetsTd);

  const actionsTd = document.createElement("td");
  actionsTd.innerHTML = "<button class=\"table-action\" aria-label=\"Open actions\">⋮</button>";
  row.appendChild(actionsTd);

  return row;
};

const initAccountsPage = async () => {
  if (!document.body.classList.contains(ACCOUNTS_PAGE)) {
    return;
  }

  const tableBody = document.querySelector(".accounts-table tbody");
  if (!tableBody) {
    return;
  }

  const { accounts } = await getAccountsWithSummary();
  const rowsData = await Promise.all(
    accounts.map(async (account) => {
      const [assets, autotraders] = await Promise.all([
        getAccountAssets(account.account_id),
        getAutotradersByAccount(account.account_id),
      ]);
      return {
        account,
        totalValue: account.total_value || 0,
        assets,
        autotraderCount: autotraders.length,
      };
    })
  );

  tableBody.innerHTML = "";
  rowsData.forEach((rowData) => {
    tableBody.appendChild(renderAccountRow(rowData));
  });

  const state = getState();
  if (state?.data?.accountsSummary) {
    renderAccountsSummary({
      data: state.data.accountsSummary,
      status: state.status.accountsSummary,
    });
  }
};

initAccountsPage();
