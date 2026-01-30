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

const buildSparkSvg = (values) => {
  const v = Array.isArray(values)
    ? values.map((x) => Number(x)).filter((x) => Number.isFinite(x))
    : [];

  const points = v.length >= 2 ? v : [0, 0];

  const width = 84;
  const height = 28;
  const pad = 3;

  let min = Math.min(...points);
  let max = Math.max(...points);

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    min = 0;
    max = 0;
  }

  const span = max - min || 1;
  const stepX = (width - pad * 2) / (points.length - 1);

  const yOf = (val) => {
    const t = (val - min) / span;
    return pad + (1 - t) * (height - pad * 2);
  };

  let d = "";
  for (let i = 0; i < points.length; i++) {
    const x = pad + stepX * i;
    const y = yOf(points[i]);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }

  return `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${d}"></path>
    </svg>
  `;
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
    const pnlClass =
      pct > 0 ? "is-positive" : pct < 0 ? "is-negative" : "is-flat";

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
              <span class="autotrader-live-dot ${dotClass}" aria-hidden="true"></span>
              <span class="autotrader-name">${trader.name || "Autotrader"}</span>
            </div>
          </div>
        </div>

        <span class="autotrader-pnl ${pnlClass}">${trader.pnl || "0.00%"}</span>
      </div>

      <div class="autotrader-meta">
        <div class="autotrader-meta-left">
          <span class="autotrader-pair">${pair || "Pair"}</span>
          <span class="autotrader-sub">${subText}</span>
        </div>

        <div class="autotrader-spark ${pnlClass}" aria-hidden="true">
          ${buildSparkSvg(trader.spark)}
        </div>
      </div>

      <div class="autotrader-footer">
        <button class="button" type="button">View Autotrader</button>
      </div>
    `;

    list.appendChild(card);
  });
};
