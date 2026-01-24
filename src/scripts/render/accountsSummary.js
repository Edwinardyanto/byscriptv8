import { renderAccountsDonutChart } from "../charts/accountsDonutChart.js";

/* ---------------- utils ---------------- */

const setText = (selector, value) => {
  const el = document.querySelector(selector);
  if (el) el.textContent = value;
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

/* ---------------- main render ---------------- */

export const renderAccountsSummary = async (sectionState) => {
  const { data, status } = sectionState;

  const list = document.querySelector('[data-list="accounts"]');
  const section = list?.closest(".section");

  const chartContainer =
    section?.querySelector(".summary-total .chart-placeholder");

  /* ---------- loading ---------- */

  if (status === "loading") {
    if (list) setListMessage(list, "Loading accounts...");
    if (chartContainer) chartContainer.textContent = "";
    setText('[data-field="accounts.total"]', "--");
    return;
  }

  /* ---------- error ---------- */

  if (status === "error") {
    if (list) setListMessage(list, "Unable to load accounts");
    setText('[data-field="accounts.total"]', "--");
    return;
  }

  /* ---------- empty ---------- */

  if (!data || !Array.isArray(data.accounts) || data.accounts.length === 0) {
    if (list) setListMessage(list, "No accounts data");
    setText('[data-field="accounts.total"]', "--");
    return;
  }

  /* ---------- normalize ---------- */

  const accounts = data.accounts.map((a) => ({
    name: a.name || a.account_name || "Account",
    amount: Number(a.amount || 0),
    value: a.value || toMoney(a.amount),
  }));

  /* ---------- total ---------- */

  const totalUsd = accounts.reduce((s, a) => s + a.amount, 0);
  setText('[data-field="accounts.total"]', toMoney(totalUsd));

  /* ---------- list ---------- */

  if (list) {
    list.innerHTML = "";

    accounts.forEach((acc) => {
      const item = document.createElement("div");
      item.className = "summary-item";

      item.innerHTML = `
        <span class="summary-item-name">${acc.name}</span>
        <span class="summary-item-value">${acc.value}</span>
      `;

      list.appendChild(item);
    });
  }

  /* ---------- donut ---------- */

  if (chartContainer) {
    renderAccountsDonutChart(chartContainer, accounts);
  }
};
