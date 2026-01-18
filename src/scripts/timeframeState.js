const ALLOWED_TIMEFRAMES = ["7D", "30D", "90D", "ALL"];
const listeners = new Set();
const boundContainers = new Set();

let currentTimeframe = "7D";

const normalizeTimeframe = (value) => {
  const normalized = String(value || "").toUpperCase();
  if (ALLOWED_TIMEFRAMES.includes(normalized)) {
    return normalized;
  }
  return "7D";
};

const updateActiveButtons = (container) => {
  if (!container) {
    return;
  }
  const pills = container.querySelectorAll(".timeframe-pill");
  pills.forEach((pill) => {
    const label = pill.textContent.trim();
    const normalized = label.toUpperCase() === "ALL" ? "ALL" : label.toUpperCase();
    pill.classList.toggle("timeframe-pill--active", normalized === currentTimeframe);
  });
};

const notifyListeners = () => {
  listeners.forEach((callback) => callback(currentTimeframe));
};

export const getTimeframe = () => currentTimeframe;

export const setTimeframe = (next) => {
  const normalized = normalizeTimeframe(next);
  if (normalized === currentTimeframe) {
    return;
  }
  currentTimeframe = normalized;
  boundContainers.forEach((container) => updateActiveButtons(container));
  notifyListeners();
};

export const subscribeTimeframe = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const initTimeframeControls = (container) => {
  if (!container) {
    return;
  }
  const pillsContainer = container.querySelector(".timeframe-pills");
  if (!pillsContainer) {
    return;
  }

  if (!boundContainers.has(pillsContainer)) {
    boundContainers.add(pillsContainer);
  }

  const pills = pillsContainer.querySelectorAll(".timeframe-pill");
  pills.forEach((pill) => {
    if (pill.dataset.bound) {
      return;
    }
    pill.dataset.bound = "true";
    pill.addEventListener("click", () => {
      const label = pill.textContent.trim();
      const normalized = label.toUpperCase() === "ALL" ? "ALL" : label.toUpperCase();
      setTimeframe(normalized);
    });
  });

  updateActiveButtons(pillsContainer);
};

export const resetTimeframe = () => {
  currentTimeframe = "7D";
  boundContainers.forEach((container) => updateActiveButtons(container));
  notifyListeners();
};
