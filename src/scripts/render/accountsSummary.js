import { getAccountsWithSummary } from "../dataAccess.js";
import { renderAccountsDonutChart } from "../charts/accountsDonutChart.js";

/* ---------------- helpers ---------------- */

const setListMessage = (list, message) => {
  list.innerHTML = "";
  const item = document.createElement("div");
  item.className = "summary-item";
  item.textContent = message;
  list.appendChild(item);
};

/* =========================
   ✅ MAIN RENDER
========================= */

export const renderAccountsSummary = async () => {
  const list = document.querySelector('[data-list="accounts"]');
  const section = list?.closest(".section");

  const chartContainer =
    section?.querySelector(".summary-total .chart-placeholder");

  if (!list || !chartContainer) return;

  /* ---------- loading ---------- */

  setListMessage(list, "Loading accounts...");

  /* ---------- fetch ---------- */

  const accounts = await getAccountsWithSummary();

  if (!accounts.length) {
    setListMessage(list, "No accounts found");
    chartContainer.textContent = "No chart data";
    return;
  }

  /* =========================
     ✅ LIST SCROLL RAPi
  ========================= */

  list.innerHTML = "";
  list.style.maxHeight = "180px";
  list.style.overflowY = "auto";
  list.style.paddingRight = "6px";

  accounts.forEach((acc) => {
    const row = document.createElement("div");
    row.className = "summary-item";

    row.innerHTML = `
      <span class="summary-item-name">${acc.name}</span>
      <span class="summary-item-value">${acc.value}</span>
    `;

    list.appendChild(row);
  });

  /* =========================
     ✅ DONUT PER ACCOUNT
  ========================= */

  renderAccountsDonutChart(chartContainer, accounts);
};
