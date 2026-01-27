// src/scripts/render/tradeHistory.js

import {
  getTrades,
  getAssetSymbolMap,
  getAccountMetaMap,
} from "../dataAccess.js";

/* =========================
   HELPERS
========================= */

const setListMessage = (list, message) => {
  if (!list) return;
  list.innerHTML = "";
  const item = document.createElement("div");
  item.className = "trade-history-row";
  item.textContent = message;
  list.appendChild(item);
};

/* =========================
   TIME AGO FORMAT
========================= */

const formatTimeAgo = (timestamp) => {
  const t = new Date(timestamp).getTime();
  if (!t) return "-";

  const diff = Math.max(0, Date.now() - t);

  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days >= 1) return `${days}d ago`;
  if (hours >= 1) {
    const remM = mins % 60;
    return remM > 0 ? `${hours}h ${remM}m ago` : `${hours}h ago`;
  }
  return `${mins}m ago`;
};

/* =========================
   MAIN RENDER
========================= */

export const renderTradeHistory = async (sectionState) => {
  const { status } = sectionState;

  const list = document.querySelector('[data-list="tradeHistory"]');
  if (!list) return;

  if (status === "loading") {
    setListMessage(list, "Loading trade history...");
    return;
  }

  if (status === "error") {
    setListMessage(list, "Unable to load trade history");
    return;
  }

  const trades = await getTrades();

  if (!Array.isArray(trades) || trades.length === 0) {
    setListMessage(list, "No recent trades");
    return;
  }

  const assetMap = await getAssetSymbolMap();
  const accountMap = await getAccountMetaMap();

  const latestTrades = trades.slice(-20).reverse();

  list.innerHTML = "";

  latestTrades.forEach((t) => {
    const symbol = assetMap.get(t.asset_id) || "UNKNOWN";

    const accountMeta = accountMap.get(t.account_id) || {
      name: t.account_id,
      exchange: "exchange",
    };

    const action = t.reduce_only
      ? "Close"
      : t.side === "buy"
      ? "Buy"
      : "Sell";

    const pnlUsd = `$${Number(t.pnl_usd || 0).toFixed(2)}`;
    const pnlPct = `${Number(t.pnl_percent || 0).toFixed(2)}%`;

    const profitState =
      Number(t.pnl_usd || 0) > 0
        ? "positive"
        : Number(t.pnl_usd || 0) < 0
        ? "negative"
        : "neutral";

    const timeAgo = formatTimeAgo(t.filled_at);

    const row = document.createElement("a");
    row.className = "trade-history-row";
    row.href = "pages/activity.html";

    row.innerHTML = `
      <!-- ASSET CELL (2 LINES) -->
      <div class="trade-history-asset">
        <div class="trade-history-asset-symbol">${symbol}</div>
        <div class="trade-history-asset-meta">
          <span class="exchange-icon exchange-icon--${accountMeta.exchange}"></span>
          <span>${accountMeta.name}</span>
        </div>
      </div>

      <!-- ACTION -->
      <div class="trade-history-action trade-history-action--${action.toLowerCase()}">
        ${action}
      </div>

      <!-- PROFIT -->
      <div class="trade-history-profit trade-history-profit--${profitState}">
        <span>${pnlUsd}</span>
        <span>${pnlPct}</span>
      </div>

      <!-- TIME -->
      <div class="trade-history-time">${timeAgo}</div>

      <!-- SHARE -->
      <button class="trade-history-share" type="button">
        Share
      </button>
    `;

    row.querySelector(".trade-history-share").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      alert("Share popup next step bro ✅");
    };

    list.appendChild(row);
  });
};
