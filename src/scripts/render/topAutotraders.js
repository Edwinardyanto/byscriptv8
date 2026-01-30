import { formatPercent } from "../data.js";

/* ============================================
 * Sparkline helper
 * ============================================ */

const buildSparkPath = (values, width = 84, height = 28, pad = 2) => {
  const arr = Array.isArray(values) ? values : [];
  if (arr.length < 2) {
    return {
      d: `M ${pad} ${height / 2} L ${width - pad} ${height / 2}`,
      isFlat: true,
    };
  }

  const minV = Math.min(...arr);
  const maxV = Math.max(...arr);
  const range = maxV - minV;

  const isFlat = range === 0;
  const n = arr.length;
  const xStep = (width - pad * 2) / (n - 1);

  const yFor = (v) => {
    if (isFlat) return height / 2;
    const t = (v - minV) / range; // 0..1
    const y = pad + (1 - t) * (height - pad * 2); // invert
    return y;
  };

  let d = "";
  for (let i = 0; i < n; i++) {
    const x = pad + i * xStep;
    const y = yFor(arr[i]);
    d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  }

  return { d, isFlat };
};

/* ============================================
 * Renderer
 * ============================================ */

export const renderTopAutotraders = ({ container, data }) => {
  if (!container) return;

  const list = container.querySelector(".autotraders-list");
  if (!list) return;

  const items = Array.isArray(data) ? data : [];
  list.innerHTML = "";

  items.forEach((a) => {
    const pnl = Number(a?.pnlPercent || 0);
    const pnlClass =
      pnl > 0 ? "is-positive" : pnl < 0 ? "is-negative" : "is-flat";

    const winRate = Number(a?.winRate || 0);
    const winRateText = `Win rate: ${winRate.toFixed(1)}%`;

    const tradeCount = Number(a?.tradeCount || 0);
    const subText = `Trades: ${tradeCount}`;

    const sparkValues = Array.isArray(a?.spark) ? a.spark : [0, 0, 0, 0];
    const { d, isFlat } = buildSparkPath(sparkValues, 84, 28, 2);

    const card = document.createElement("div");
    card.className = "autotrader-card";

    card.innerHTML = `
      <div class="autotrader-header">
        <div class="autotrader-identity">
          <div class="autotrader-avatar">${(a?.name || "A").slice(0, 2).toUpperCase()}</div>
          <div class="autotrader-name-group">
            <div class="autotrader-name-row">
              <span class="autotrader-live-dot ${a?.isLive ? "is-live" : "is-off"}"></span>
              <div class="autotrader-name" title="${a?.name || ""}">${a?.name || ""}</div>
            </div>
          </div>
        </div>
        <div class="autotrader-pnl ${pnlClass}">
          ${formatPercent(pnl, 2)}
        </div>
      </div>

      <div class="autotrader-meta">
        <div class="autotrader-meta-left">
          <span class="autotrader-pair">${(a?.pairSymbols?.[0] || "btc").toUpperCase()}/${(a?.pairSymbols?.[1] || "usdt").toUpperCase()}</span>
          <span class="autotrader-sub">${subText}</span>
          <span class="autotrader-winrate">${winRateText}</span>
        </div>

        <div class="autotrader-spark" aria-hidden="true">
          <svg class="autotrader-sparkline" viewBox="0 0 84 28" preserveAspectRatio="none">
            <path
              class="autotrader-sparkline-path ${isFlat ? "is-flat" : ""}"
              d="${d}"
            />
          </svg>
        </div>
      </div>

      <div class="autotrader-footer">
        <button class="button">View Autotrader</button>
      </div>
    `;

    list.appendChild(card);
  });
};
