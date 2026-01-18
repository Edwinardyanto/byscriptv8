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

const renderEmptyState = (list) => {
  setListMessage(list, "No recent trades");
};

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
    renderEmptyState(list);
    return;
  }

  list.innerHTML = "";
  data.forEach((trade) => {
    const pairValue = Array.isArray(trade.pair)
      ? trade.pair
      : [String(trade.pair || "asset").toLowerCase()];
    const actionValue = (trade.action || "buy").toString().toUpperCase();
    const statusValue = (trade.status || "executed").toString().toUpperCase();
    const profitValue =
      typeof trade.profitUsd === "string"
        ? trade.profitUsd
        : trade.profit
        ? `${trade.profit >= 0 ? "+" : "-"}$${Math.abs(Number(trade.profit)).toFixed(2)}`
        : "–";
    const profitPctValue =
      typeof trade.profitPct === "string"
        ? trade.profitPct
        : trade.profit
        ? `${trade.profit >= 0 ? "+" : "-"}${Math.abs(Number(trade.profit)).toFixed(1)}%`
        : "–";
    const profitStateValue =
      trade.profitState ||
      (Number(trade.profit || 0) > 0
        ? "positive"
        : Number(trade.profit || 0) < 0
        ? "negative"
        : "neutral");
    const row = document.createElement("a");
    row.className = "trade-history-row";
    row.href = "activity.html";
    row.innerHTML = `
      <div class="trade-history-pair">${buildPairIcons(pairValue)}</div>
      <div class="trade-history-action ${actionClassMap[actionValue] || ""}">${actionValue}</div>
      <div class="trade-history-status ${statusClassMap[statusValue] || ""}">${statusValue}</div>
      <div class="trade-history-profit ${profitClassMap[profitStateValue] || ""}">
        <span>${profitValue}</span>
        <span>${profitPctValue}</span>
      </div>
      <div class="trade-history-time">${trade.time || "–"}</div>
    `;
    list.appendChild(row);
  });
};
