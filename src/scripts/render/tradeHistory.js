// src/scripts/render/tradeHistory.js

import {
  getTrades,
  getAssetMetaMap,
  getAccountMetaMap,
} from "../dataAccess.js";

import { colorFromId } from "../color.js";

import { openSharePopup } from "../components/sharePopup.js";

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
   TIME AGO FORMAT (UNIX SEC → REALTIME)
========================= */

const formatTimeAgo = (timestampSec) => {
  if (!timestampSec) return "-";

  // ✅ trades.json timestamp = UNIX seconds → convert to ms
  const t = timestampSec * 1000;

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

let refreshTimer = null;

export const renderTradeHistory = async (sectionState) => {
  const { status } = sectionState;

  const list = document.querySelector('[data-list="tradeHistory"]');
  if (!list) return;

  /* ---------- STATES ---------- */

  if (status === "loading") {
    setListMessage(list, "Loading trade history...");
    return;
  }

  if (status === "error") {
    setListMessage(list, "Unable to load trade history");
    return;
  }

  /* ---------- LOAD DATA ---------- */

  const trades = await getTrades();

  if (!Array.isArray(trades) || trades.length === 0) {
    setListMessage(list, "No recent trades");
    return;
  }

  const assetMap = await getAssetMetaMap();
  const accountMap = await getAccountMetaMap();

  /* ---------- ✅ SORT NEWEST FIRST ---------- */

  const latestTrades = trades
    .slice()
    .sort((a, b) => (b.filled_at * 1000) - (a.filled_at * 1000))
    .slice(0, 20);

  /* ---------- RENDER ---------- */

  list.innerHTML = "";

  latestTrades.forEach((t) => {
    const assetMeta = assetMap.get(t.asset_id) || { symbol: "UNKNOWN" };
    const symbol = assetMeta.symbol || "UNKNOWN";

    const accountMeta = accountMap.get(t.account_id) || {
      name: t.account_id || "-",
      exchange: "exchange",
    };

    const accountColor = colorFromId(accountMeta.color_id);
    const assetColor = colorFromId(assetMeta.color_id);

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
      <!-- ASSET -->
      <div class="trade-history-asset">
        <div class="trade-history-asset-symbol">
          <span class="color-dot" style="--dot-color: ${assetColor};" aria-hidden="true"></span>
          ${symbol}
        </div>
        <div class="trade-history-asset-meta">
          <img
            class="exchange-icon"
            src="${iconUrl}"
            alt="${accountMeta.exchange}"
          />
          <span class="trade-history-account">
            <span class="color-dot" style="--dot-color: ${accountColor};" aria-hidden="true"></span>
            ${accountMeta.name}
          </span>
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

    /* ✅ Share button safe click */
    row.querySelector(".trade-history-share").onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      const pairLabel = `${symbol}/USDT`;

      openSharePopup({
        symbol,
        pairLabel,
        action,
        pnlUsd: Number(t.pnl_usd || 0),
        pnlPct: Number(t.pnl_percent || 0),
        timeLabel: timeAgo,
        accountName: accountMeta.name,
        exchangeLabel: accountMeta.exchange,
        shareUrl: window.location.href,
      });
    };

    list.appendChild(row);
  });

  /* ---------- ✅ AUTO REFRESH TIME LABEL ONLY ---------- */

  if (refreshTimer) clearTimeout(refreshTimer);

  refreshTimer = setTimeout(() => {
    renderTradeHistory({ status: "ready" });
  }, 30000);
};
