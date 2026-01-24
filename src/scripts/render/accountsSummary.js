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

const toMoney = (n) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

const pickName = (a) => a?.name || a?.account_name || "Account";
const pickAmount = (a) =>
  typeof a?.amount === "number"
    ? a.amount
    : Number(a?.totalValueUsd || 0) || 0;

const pickValueText = (a) => a?.value || toMoney(pickAmount(a));

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

  if (!data || !Array.isArray(data.accounts) || data.accounts.length === 0) {
    if (list) setListMessage(list, "No accounts data");
    if (chartContainer) chartContainer.textContent = "No chart data";
    setText('[data-field="accounts.total"]', "--");
    return;
  }

  const accounts = data.accounts.map((a) => ({
    ...a,
    name: pickName(a),
    amount: pickAmount(a),
    value: pickValueText(a),
  }));

  const totalUsd = accounts.reduce((s, a) => s + Number(a.amount || 0), 0);
  const totalText = data?.accountsSummary?.total || toMoney(totalUsd);

  /* =========================
     ✅ LIST SCROLL RAPi
  ========================= */

  if (list) {
    list.innerHTML = "";

    // scroll rapi tanpa ngacak layout
    list.style.maxHeight = "168px";
    list.style.overflowY = "auto";
    list.style.paddingRight = "6px";

    accounts.forEach((account) => {
      const item = document.createElement("div");
      item.className = isAccountsPage ? "accounts-distribution-item" : "summary-item";

      item.innerHTML = isAccountsPage
        ? `
          <div class="accounts-distribution-item-header">
            <span>${account.name}</span>
            <span>${account.value}</span>
          </div>
        `
        : `
          <span class="summary-item-name">${account.name}</span>
          <span class="summary-item-value">${account.value}</span>
        `;

      list.appendChild(item);
    });
  }

  /* =========================
     ✅ DONUT SLICE PER ACCOUNT
  ========================= */

  if (chartContainer) {
    renderAccountsDonutChart(chartContainer, accounts);
  }

  setText('[data-field="accounts.total"]', totalText);
};
