// src/scripts/render/accountsSummary.js

import { getAccountsWithSummary } from "../dataAccess.js";
import { renderAccountsDonutChart } from "../charts/accountsDonutChart.js";

/* -----------------------------
   Helpers
----------------------------- */

const formatUsd = (v) =>
  "$" +
  Number(v || 0).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  });

/* -----------------------------
   Renderer
----------------------------- */

export const renderAccountsSummary = async () => {
  const list = document.querySelector(".summary-list");
  const donut = document.querySelector(".accounts-donut");

  if (!list || !donut) return;

  // Load computed accounts equity
  const accounts = await getAccountsWithSummary();

  // Reset list
  list.innerHTML = "";

  // Render list rows
  for (const acc of accounts) {
    const row = document.createElement("div");
    row.className = "summary-item";

    row.innerHTML = `
      <span class="summary-item-name">${acc.account_name}</span>
      <span class="summary-item-value">${formatUsd(acc.totalValueUsd)}</span>
    `;

    list.appendChild(row);
  }

  // Render donut chart
  renderAccountsDonutChart({
    container: donut,
    accounts,
  });
};
