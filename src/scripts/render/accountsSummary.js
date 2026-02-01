import { getAccountsWithSummary } from "../dataAccess.js";
import { renderAccountsDonutChart } from "../charts/accountsDonutChart.js";
import { colorFromId } from "../color.js";

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
  if (!Array.isArray(accounts) || accounts.length === 0) return;

  const total =
    accounts.reduce((sum, a) => sum + Number(a.totalValueUsd || 0), 0) || 1;

  const rows = new Map();

  list.innerHTML = "";

  for (const acc of accounts) {
    const accColor = colorFromId(acc.color_id);
    const pct = (Number(acc.totalValueUsd || 0) / total) * 100;

    const row = document.createElement("div");
    row.className = "summary-item";
    row.dataset.accountId = acc.account_id;

    row.style.setProperty("--acc-color", accColor);
    row.style.setProperty("--share", pct.toFixed(2));

    row.innerHTML = `
      <span class="summary-item-name">
        <span class="color-dot" style="--dot-color: ${accColor};" aria-hidden="true"></span>
        ${acc.account_name}
      </span>
      <span class="summary-item-value">
        <span class="summary-item-amount">${formatUsd(acc.totalValueUsd)}</span>
        <span class="summary-item-pct">${pct.toFixed(1)}%</span>
      </span>
    `;

    list.appendChild(row);
    rows.set(acc.account_id, row);
  }

  const donut = renderAccountsDonutChart({
    container: donutContainer,
    accounts,
    onActiveChange: (id) => {
      rows.forEach((el) => el.classList.remove("is-active"));
      if (id && rows.get(id)) rows.get(id).classList.add("is-active");
    },
  });

  if (donut && typeof donut.setActive === "function") {
    rows.forEach((row, id) => {
      row.addEventListener("mouseenter", () => donut.setActive(id));
      row.addEventListener("mouseleave", () => donut.clearActive());
    });
  }
};
