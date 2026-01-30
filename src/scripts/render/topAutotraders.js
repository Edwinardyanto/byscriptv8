// src/scripts/render/topAutotraders.js

const safeText = (v) => String(v ?? "").replace(/[<>&"]/g, (c) => ({
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  '"': "&quot;",
}[c]));

const isLive = (runtime) => String(runtime || "").toLowerCase() === "running";

const formatWinRate = (n) => {
  const x = Number(n || 0);
  return `${x.toFixed(2)}%`;
};

const sparkSvg = (series = []) => {
  if (!Array.isArray(series) || series.length < 2) {
    return `
      <svg class="autotrader-sparkline" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
        <polyline class="autotrader-sparkline-path is-flat" points="2,16 98,16"></polyline>
      </svg>
    `;
  }

  const w = 100;
  const h = 32;
  const padX = 2;
  const padY = 4;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;

  const n = series.length;
  const step = (w - padX * 2) / (n - 1);

  const pts = series
    .map((v, i) => {
      const x = padX + i * step;
      const y = padY + (h - padY * 2) * (1 - (v - min) / span);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return `
    <svg class="autotrader-sparkline" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <polyline class="autotrader-sparkline-path" points="${pts}"></polyline>
    </svg>
  `;
};

export const renderTopAutotraders = ({ container, sectionState }) => {
  if (!container) return;

  const list = sectionState?.data || [];

  const html = list
    .map((a) => {
      const name = safeText(a.name || "Autotrader");
      const pair = safeText(a.pair || "");
      const tradeCount = Number(a.tradeCount || 0);
      const winRate = Number(a.winRate || 0);
      const pnl = safeText(a.pnl || "0.00%");
      const live = isLive(a.runtime);

      return `
        <div class="autotrader-card">
          <div class="autotrader-header">
            <div class="autotrader-identity">
              <div class="autotrader-avatar">${safeText(name.slice(0, 2).toUpperCase())}</div>
              <div class="autotrader-name-group">
                <div class="autotrader-name-row">
                  <span class="autotrader-live-dot ${live ? "is-live" : "is-off"}"></span>
                  <span class="autotrader-name" title="${name}">${name}</span>
                </div>
              </div>
            </div>

            <span class="autotrader-pnl ${Number(pnl) > 0 ? "is-positive" : Number(pnl) < 0 ? "is-negative" : "is-flat"}">
              ${pnl}
            </span>
          </div>

          <div class="autotrader-meta">
            <div class="autotrader-meta-left">
              <span class="autotrader-pair">${pair}</span>
              <span class="autotrader-sub">Trades: ${tradeCount}</span>
              <span class="autotrader-winrate">Win rate: ${formatWinRate(winRate)}</span>
            </div>

            <div class="autotrader-spark">
              ${sparkSvg(a.spark)}
            </div>
          </div>

          <div class="autotrader-footer">
            <button class="button">View Autotrader</button>
          </div>
        </div>
      `;
    })
    .join("");

  container.innerHTML = `<div class="autotraders-list">${html}</div>`;
};
