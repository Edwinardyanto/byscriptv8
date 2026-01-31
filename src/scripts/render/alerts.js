// src/scripts/render/alerts.js
// Re-purposed: 4 KPI cards inside the existing Alerts section (section--alerts)

const setText = (el, value) => {
  if (!el) return;
  el.textContent = value == null ? "" : String(value);
};

const setHtml = (el, value) => {
  if (!el) return;
  el.innerHTML = value == null ? "" : String(value);
};

const setStateClass = (el, state) => {
  if (!el) return;
  el.classList.remove("is-positive", "is-negative", "is-accent");
  if (state === "positive") el.classList.add("is-positive");
  if (state === "negative") el.classList.add("is-negative");
  if (state === "accent") el.classList.add("is-accent");
};

const getSection = () => document.querySelector(".section--alerts");
const getTrack = () =>
  document.querySelector(".section--alerts .alerts-slider__track");

const getControls = () => document.querySelector(".section--alerts .alerts-controls");

const createKpiCard = (opts = {}) => {
  const {
    title,
    value,
    sub,
    meta,
    subHtml,
    metaHtml,
    valueRaw,
    roiRaw,
    winRateRaw,
  } = opts || {};

  const card = document.createElement("div");
  card.className = "data-kpi-card";
  card.innerHTML = `
    <div class="data-kpi-title"></div>
    <div class="data-kpi-value"></div>
    <div class="data-kpi-sub"></div>
    <div class="data-kpi-meta"></div>
  `;

  const titleEl = card.querySelector(".data-kpi-title");
  const valueEl = card.querySelector(".data-kpi-value");
  const subEl = card.querySelector(".data-kpi-sub");
  const metaEl = card.querySelector(".data-kpi-meta");

  setText(titleEl, title);
  setText(valueEl, value);

  if (typeof subHtml === "string") setHtml(subEl, subHtml);
  else setText(subEl, sub);

  if (typeof metaHtml === "string") setHtml(metaEl, metaHtml);
  else setText(metaEl, meta);

  // Conditional coloring rules for Data Overview
  // - Total PnL value: green if >0, red if <0, neutral otherwise
  if (typeof valueRaw === "number" && Number.isFinite(valueRaw)) {
    setStateClass(valueEl, valueRaw > 0 ? "positive" : valueRaw < 0 ? "negative" : "neutral");
  }

  // - ROI sub (Total PnL card): green if positive
  if (typeof roiRaw === "number" && Number.isFinite(roiRaw)) {
    setStateClass(subEl, roiRaw > 0 ? "accent" : "neutral");
  }

  // - Win rate (Trades card): green if above 50%
  if (typeof winRateRaw === "number" && Number.isFinite(winRateRaw)) {
    setStateClass(subEl, winRateRaw > 50 ? "accent" : "neutral");
  }

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
