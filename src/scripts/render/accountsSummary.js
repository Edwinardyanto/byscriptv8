import { getAccountsWithSummary } from "../dataAccess.js";
import { renderAccountsDonutChart } from "../charts/accountsDonutChart.js";

const formatUsd = (v) =>
  "$" +
  Number(v || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });

export const renderAccountsSummary = async () => {
  const list = document.querySelector(".summary-list");
  const donutContainer = document.querySelector(
    ".summary-total .chart-placeholder"
  );

  if (!list || !donutContainer) return;

  const accounts = await getAccountsWithSummary();

  list.innerHTML = "";

  for (const acc of accounts) {
    const row = document.createElement("div");
    row.className = "summary-item";

    row.innerHTML = `
      <span class="summary-item-name">${acc.account_name}</span>
      <span class="summary-item-value">${formatUsd(acc.totalValueUsd)}</span>
    `;

    list.appendChild(row);
  }

  renderAccountsDonutChart({
    container: donutContainer,
    accounts,
  });
};
