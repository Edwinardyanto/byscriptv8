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
   TIME AGO FORMAT (REALTIME)
========================= */

const formatTimeAgo = (timestamp) => {
  const t = new Date(timestamp).getTime();
  if (!t) return "-";

  // ✅ realtime now
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

  /* ✅ FIX: sort by filled_at timestamp (newest first) */
  const latestTrades = trades
    .slice()
    .sort(
      (a, b) =>
        new Date(b.filled_at).getTime() -
        new Date(a.filled_at).getTime()
    )
    .slice(0, 20);

  list.innerHTML = "";

  latestTrades.forEach((t) => {
    const symbol = assetMap.get(t.asset_id) || "UNKNOWN";

    const accountMeta = accountMap.get(t.account_id) || {
      name: t.account_id,
      exchange: "exchange",
    };

    const iconUrl = `assets/exchanges/${accountMeta.exchange}.svg`;

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
      <div class="trade-history-asset">
        <div class="trade-history-asset-symbol">${symbol}</div>
        <div class="trade-history-asset-meta">
          <img class="exchange-icon" src="${iconUrl}" alt="${accountMeta.exchange}" />
          <span>${accountMeta.name}</span>
        </div>
      </div>

      <div class="trade-history-action trade-history-action--${action.toLowerCase()}">
        ${action}
      </div>

      <div class="trade-history-profit trade-history-profit--${profitState}">
        <span>${pnlUsd}</span>
        <span>${pnlPct}</span>
      </div>

      <div class="trade-history-time">${timeAgo}</div>

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

  /* ✅ OPTIONAL: auto-refresh time label every 30s */
  setTimeout(() => {
    renderTradeHistory({ status: "ready" });
  }, 30000);
};
