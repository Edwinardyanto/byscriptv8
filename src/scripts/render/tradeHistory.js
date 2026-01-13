const setListMessage = (list, message) => {
  if (!list) {
    return;
  }
  list.innerHTML = "";
  const item = document.createElement("div");
  item.className = "trade-history-row";
  item.textContent = message;
  list.appendChild(item);
};

const actionClassMap = {
  BUY: "trade-history-action--buy",
  SELL: "trade-history-action--sell",
  CANCEL: "trade-history-action--cancel",
};

const statusClassMap = {
  FILLED: "trade-history-status--filled",
  FAILED: "trade-history-status--failed",
  ERROR: "trade-history-status--error",
  CANCELLED: "trade-history-status--cancelled",
};

const profitClassMap = {
  positive: "trade-history-profit--positive",
  negative: "trade-history-profit--negative",
  neutral: "trade-history-profit--neutral",
};

const buildPairIcons = (pair) =>
  pair
    .map(
      (asset) =>
        `<span class="trade-history-icon trade-history-icon--${asset}" aria-label="${asset.toUpperCase()} logo"></span>`,
    )
    .join("");

export const renderTradeHistory = (sectionState) => {
  const { data, status } = sectionState;
  const list = document.querySelector('[data-list="tradeHistory"]');

  if (status === "loading") {
    setListMessage(list, "Loading trade history...");
    return;
  }

  if (status === "error") {
    setListMessage(list, "Unable to load trade history");
    return;
  }

  if (!data || data.length === 0) {
    setListMessage(list, "No recent trades");
    return;
  }

  list.innerHTML = "";
  data.forEach((trade) => {
    const row = document.createElement("a");
    row.className = "trade-history-row";
    row.href = "activity.html";
    row.innerHTML = `
      <div class="trade-history-pair">${buildPairIcons(trade.pair)}</div>
      <div class="trade-history-action ${actionClassMap[trade.action] || ""}">${trade.action}</div>
      <div class="trade-history-status ${statusClassMap[trade.status] || ""}">${trade.status}</div>
      <div class="trade-history-profit ${profitClassMap[trade.profitState] || ""}">
        <span>${trade.profitUsd}</span>
        <span>${trade.profitPct}</span>
      </div>
      <div class="trade-history-time">${trade.time}</div>
    `;
    list.appendChild(row);
  });
};
