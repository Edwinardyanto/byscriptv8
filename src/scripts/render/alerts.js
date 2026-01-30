const maxVisibleAlerts = 5;
let currentAlertIndex = 0;
let navHandlersBound = false;

const setText = (element, value) => {
  if (element) {
    element.textContent = value;
  }
};

const getAlertsSection = () => document.querySelector(".section--alerts");

const getAlertsTrack = () =>
  document.querySelector(".section--alerts .alerts-slider__track");

const getNavButtons = () => ({
  prev: document.querySelector('[data-alert-nav="prev"]'),
  next: document.querySelector('[data-alert-nav="next"]'),
  controls: document.querySelector(".alerts-controls"),
});

const clearAlertCardState = (card) => {
  if (!card) return;
  card.removeAttribute("data-alert-state");
  card.removeAttribute("data-alert-status");
};

const setAlertCardState = (card, alertState, alertStatus) => {
  if (!card) return;

  if (!alertState || !alertStatus) {
    clearAlertCardState(card);
    return;
  }

  card.dataset.alertState = alertState;
  card.dataset.alertStatus = alertStatus;
};

const createAlertCard = () => {
  const card = document.createElement("div");
  card.className = "alert-card";
  card.innerHTML = `
    <div class="alert-title" data-field="alerts.title"></div>
    <div class="alert-message" data-field="alerts.message"></div>
    <div class="alert-meta">
      <span class="badge badge--warning" data-field="alerts.type"></span>
      <span class="alert-time" data-field="alerts.time"></span>
    </div>
    <button class="button button--ghost" type="button" data-field="alerts.cta"></button>
  `;
  return card;
};

const populateAlertCard = (card, data) => {
  setAlertCardState(card, data.alertState, data.alertStatus);
  setText(card.querySelector('[data-field="alerts.title"]'), data.title);
  setText(card.querySelector('[data-field="alerts.message"]'), data.message);
  setText(card.querySelector('[data-field="alerts.type"]'), data.type);
  setText(card.querySelector('[data-field="alerts.time"]'), data.time);
  setText(card.querySelector('[data-field="alerts.cta"]'), data.cta);
};

const createViewAllCard = () => {
  const card = createAlertCard();
  card.classList.add("alert-card--view-all");
  clearAlertCardState(card);
  setText(card.querySelector('[data-field="alerts.title"]'), "View All Alerts");
  card.setAttribute("role", "link");
  card.setAttribute("tabindex", "0");
  card.addEventListener("click", () => {
    window.location.href = "/alerts";
  });
  card.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      window.location.href = "/alerts";
    }
  });
  return card;
};

const updateSlider = (totalSlides) => {
  const track = getAlertsTrack();
  const { prev, next } = getNavButtons();
  if (!track || !prev || !next) return;

  track.style.transform = `translateX(-${currentAlertIndex * 100}%)`;
  prev.disabled = currentAlertIndex <= 0;
  next.disabled = currentAlertIndex >= totalSlides - 1;
};

const updateControlsVisibility = (totalSlides) => {
  const { controls } = getNavButtons();
  if (!controls) return;
  controls.classList.toggle("alerts-controls--hidden", totalSlides <= 1);
};

const bindNavigation = () => {
  if (navHandlersBound) return;
  const { prev, next } = getNavButtons();
  if (!prev || !next) return;

  prev.addEventListener("click", () => {
    currentAlertIndex = Math.max(0, currentAlertIndex - 1);
    const track = getAlertsTrack();
    if (!track) return;
    const totalSlides = track.children.length;
    updateSlider(totalSlides);
  });

  next.addEventListener("click", () => {
    const track = getAlertsTrack();
    if (!track) return;
    const totalSlides = track.children.length;
    currentAlertIndex = Math.min(totalSlides - 1, currentAlertIndex + 1);
    updateSlider(totalSlides);
  });

  navHandlersBound = true;
};

export const renderAlerts = (sectionState) => {
  const { data, status } = sectionState;
  const track = getAlertsTrack();
  if (!track) return;

  if (status === "loading") {
    track.innerHTML = "";
    const card = createAlertCard();
    clearAlertCardState(card);
    populateAlertCard(card, {
      title: "Loading alerts...",
      message: "",
      type: "",
      time: "",
      cta: "",
    });
    track.append(card);
    currentAlertIndex = 0;
    updateControlsVisibility(1);
    updateSlider(1);
    return;
  }

  if (status === "error") {
    track.innerHTML = "";
    const card = createAlertCard();
    clearAlertCardState(card);
    populateAlertCard(card, {
      title: "Unable to load alerts",
      message: "",
      type: "",
      time: "",
      cta: "",
    });
    track.append(card);
    currentAlertIndex = 0;
    updateControlsVisibility(1);
    updateSlider(1);
    return;
  }

  if (!data) {
    track.innerHTML = "";
    const card = createAlertCard();
    clearAlertCardState(card);
    populateAlertCard(card, {
      title: "No alerts",
      message: "",
      type: "",
      time: "",
      cta: "",
    });
    track.append(card);
    currentAlertIndex = 0;
    updateControlsVisibility(1);
    updateSlider(1);
    return;
  }

  const alerts = Array.isArray(data) ? data : [data];
  if (alerts.length === 0) {
    track.innerHTML = "";
    const card = createAlertCard();
    clearAlertCardState(card);
    populateAlertCard(card, {
      title: "No alerts",
      message: "",
      type: "",
      time: "",
      cta: "",
    });
    track.append(card);
    currentAlertIndex = 0;
    updateControlsVisibility(1);
    updateSlider(1);
    return;
  }
  const limitedAlerts = alerts.slice(0, maxVisibleAlerts);
  const shouldShowViewAll = alerts.length > maxVisibleAlerts;
  const totalSlides = limitedAlerts.length + (shouldShowViewAll ? 1 : 0);

  track.innerHTML = "";
  const fragment = document.createDocumentFragment();
  limitedAlerts.forEach((alert) => {
    const card = createAlertCard();
    populateAlertCard(card, alert);
    fragment.append(card);
  });

  if (shouldShowViewAll) {
    fragment.append(createViewAllCard());
  }

  track.append(fragment);
  currentAlertIndex = Math.min(currentAlertIndex, totalSlides - 1);
  updateControlsVisibility(totalSlides);
  updateSlider(totalSlides);
  bindNavigation();
};
