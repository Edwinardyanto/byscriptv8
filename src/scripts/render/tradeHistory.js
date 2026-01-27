// src/scripts/render/tradeHistory.js

import { getTrades, getAssetSymbolMap } from "../dataAccess.js";

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
  const now = Date.now();
  const t = new Date(timestamp).getTime();
  const diff = Math.max(0, now - t);

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
   SHARE POPUP (9:16)
========================= */

const openSharePopup = ({ pair, action, pnlUsd, pnlPct, timeAgo }) => {
  const overlay = document.createElement("div");
  overlay.className = "share-overlay";

  overlay.innerHTML = `
    <div class="share-modal">
      <button class="share-close">✕</button>

      <div class="share-card">
        <div class="share-title">byScript.io</div>

        <div class="share-pair">${pair}</div>
        <div class="share-action">${action}</div>

        <div class="share-profit">
          ${pnlUsd}
          <span>${pnlPct}</span>
        </div>

        <div class="share-time">${timeAgo}</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".share-close").onclick = () => {
    overlay.remove();
  };

  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
};

/* =========================
   MAIN RENDER
========================= */

export const renderTradeHistory = async (sectionState) => {
  const { status } = sectionState;

  const list = document.querySelector('[data-list="tradeHistory"]');
  if (!list) return;

  /* ---- LOADING ---- */
  if (status === "loading") {
    setListMessage(list, "Loading trade history...");
    return;
  }

  /* ---- ERROR ---- */
  if (status === "error") {
    setListMessage(list, "Unable to load trade history");
    return;
  }

  /* ---- LOAD DATA DIRECTLY ---- */
  const trades = await getTrades();

  if (!Array.isArray(trades) || trades.length === 0) {
    setListMessage(list, "No recent trades");
    return;
  }

  const assetMap = await getAssetSymbolMap();

  /* ---- TAKE LAST 20 ---- */
  const latestTrades = trades.slice(-20).reverse();

  list.innerHTML = "";

  latestTrades.forEach((t) => {
    const pair = assetMap.get(t.asset_id) || "UNKNOWN";

    /* ACTION LOGIC */
    const action = t.reduce_only
      ? "Close"
      : t.side === "buy"
      ? "Buy"
      : "Sell";

    /* PROFIT */
    const pnlUsd = `$${Number(t.pnl_usd || 0).toFixed(2)}`;
    const pnlPct = `${Number(t.pnl_percent || 0).toFixed(2)}%`;

    /* PROFIT STATE */
    const profitState =
      Number(t.pnl_usd || 0) > 0
        ? "positive"
        : Number(t.pnl_usd || 0) < 0
        ? "negative"
        : "neutral";

    /* TIME */
    const timeAgo = formatTimeAgo(t.filled_at);

    /* ROW */
    const row = document.createElement("a");
    row.className = "trade-history-row";
    row.href = "pages/activity.html";

    row.innerHTML = `
      <div class="trade-history-pair">${pair}</div>

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

    /* SHARE BUTTON */
    row.querySelector(".trade-history-share").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      openSharePopup({
        pair,
        action,
        pnlUsd,
        pnlPct,
        timeAgo,
      });
    };

    list.appendChild(row);
  });
};
