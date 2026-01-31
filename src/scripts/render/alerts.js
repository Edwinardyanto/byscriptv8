// src/scripts/render/alerts.js
// Re-purposed: 4 KPI cards inside the existing Alerts section (section--alerts)

const setText = (el, value) => {
  if (!el) return;
  el.textContent = value == null ? "" : String(value);
};

const getSection = () => document.querySelector(".section--alerts");
const getTrack = () =>
  document.querySelector(".section--alerts .alerts-slider__track");

const getControls = () => document.querySelector(".section--alerts .alerts-controls");

const createKpiCard = ({ title, value, sub, meta }) => {
  const card = document.createElement("div");
  card.className = "data-kpi-card";
  card.innerHTML = `
    <div class="data-kpi-title"></div>
    <div class="data-kpi-value"></div>
    <div class="data-kpi-sub"></div>
    <div class="data-kpi-meta"></div>
  `;

  setText(card.querySelector(".data-kpi-title"), title);
  setText(card.querySelector(".data-kpi-value"), value);
  setText(card.querySelector(".data-kpi-sub"), sub);
  setText(card.querySelector(".data-kpi-meta"), meta);

  return card;
};

const renderGrid = (track, kpis) => {
  track.innerHTML = "";
  track.classList.add("data-overview-track");

  const grid = document.createElement("div");
  grid.className = "data-kpi-grid";

  grid.append(
    createKpiCard(kpis.accounts),
    createKpiCard(kpis.autotraders),
    createKpiCard(kpis.trades),
    createKpiCard(kpis.pnl)
  );

  track.append(grid);
};

const getFallbackKpis = (stateLabel) => ({
  accounts: {
    title: "Accounts Connected",
    value: stateLabel,
    sub: "-",
    meta: "-",
  },
  autotraders: {
    title: "Autotraders",
    value: stateLabel,
    sub: "-",
    meta: "-",
  },
  trades: {
    title: "Trades",
    value: stateLabel,
    sub: "-",
    meta: "-",
  },
  pnl: {
    title: "Total PnL",
    value: stateLabel,
    sub: "-",
    meta: "-",
  },
});

export const renderAlerts = ({ data, status }) => {
  const section = getSection();
  const track = getTrack();
  if (!section || !track) return;

  // Hide slider controls (we keep DOM as-is, only replace content)
  const controls = getControls();
  if (controls) controls.classList.add("alerts-controls--hidden");

  if (status === "loading") {
    renderGrid(track, getFallbackKpis("Loading..."));
    return;
  }

  if (status === "error") {
    renderGrid(track, getFallbackKpis("Error"));
    return;
  }

  const hasAll =
    data &&
    typeof data === "object" &&
    data.accounts &&
    data.autotraders &&
    data.trades &&
    data.pnl;

  if (!hasAll) {
    renderGrid(track, getFallbackKpis("-"));
    return;
  }

  renderGrid(track, data);
};
