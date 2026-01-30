// src/scripts/render/topAutotraders.js

const setListMessage = (list, message) => {
  if (!list) return;
  list.innerHTML = "";
  const item = document.createElement("div");
  item.className = "autotrader-card";
  item.textContent = message;
  list.appendChild(item);
};

const parsePct = (p) => {
  const n =
    typeof p === "number"
      ? p
      : parseFloat(String(p || "0").replace("%", ""));
  return Number.isFinite(n) ? n : 0;
};

export const renderTopAutotraders = (sectionState) => {
  const { data, status } = sectionState;
  const list = document.querySelector('[data-list="topAutotraders"]');

  if (status === "loading") {
    setListMessage(list, "Loading autotraders...");
    return;
  }

  if (status === "error") {
    setListMessage(list, "Unable to load autotraders");
    return;
  }

  if (!data || data.length === 0) {
    setListMessage(list, "No autotraders available");
    return;
  }

  list.innerHTML = "";

  data.forEach((trader) => {
    const runtimeText = trader.runtime || "Stopped";
    const isRunning = String(runtimeText).toLowerCase() === "running";
    const dotClass = isRunning ? "is-live" : "is-off";

    const pct = parsePct(trader.pnl);
    const pnlClass = pct > 0 ? "is-positive" : pct < 0 ? "is-negative" : "is-flat";

    const pair = trader.pair || "";
    const assetSymbol = pair ? String(pair).split("/")[0] : "";
    const avatarLabel = (assetSymbol || "AT").slice(0, 2).toUpperCase();

    const tradeCount =
      typeof trader.tradeCount === "number" ? trader.tradeCount : null;

    const subText = tradeCount !== null ? `Trades: ${tradeCount}` : runtimeText;

    const card = document.createElement("div");
    card.className = "autotrader-card";
    card.innerHTML = `
      <div class="autotrader-header">
        <div class="autotrader-identity">
          <span class="autotrader-avatar" aria-hidden="true">${avatarLabel}</span>

          <div class="autotrader-name-group">
            <div class="autotrader-name-row">
              <span class="autotrader-name">${trader.name || "Autotrader"}</span>
              <span class="autotrader-live-dot ${dotClass}" aria-hidden="true"></span>
            </div>
          </div>
        </div>

        <span class="autotrader-pnl ${pnlClass}">${trader.pnl || "0.00%"}</span>
      </div>

      <div class="autotrader-meta">
        <span class="autotrader-pair">${pair || "Pair"}</span>
        <span class="autotrader-sub">${subText}</span>
      </div>

      <div class="autotrader-footer">
        <button class="button" type="button">View Autotrader</button>
      </div>
    `;

    list.appendChild(card);
  });
};
