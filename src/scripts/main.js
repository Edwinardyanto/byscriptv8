import { fetchDashboardData } from "./data.js";
import { getState, setState, subscribe } from "./state.js";

import { renderTotalPerformanceChart } from "./components/TotalPerformanceChart.js";
import { renderAccountsSummary } from "./render/accountsSummary.js";
import { renderAlerts } from "./render/alerts.js";
import { renderTopAutotraders } from "./render/topAutotraders.js";
import { renderTradeHistory } from "./render/tradeHistory.js";

import { initSidebar } from "./sidebar.js";

import { setAssetRange } from "./data.js";


const appRoot = document.getElementById("app");

// Guard: main.js is the Dashboard bootstrap.
// Other pages still import it to get the shared sidebar behavior.
const IS_DASHBOARD = document.body?.classList?.contains("page-dashboard");

/**
 * Dashboard sections controlled by state
 */
const sectionKeys = [
  "assetSummary",
  "accountsSummary",
  "alerts",
  "topAutotraders",
  "tradeHistory",
];

/**
 * Helper: set same status to all sections
 */
const setSectionStatuses = (status) => {
  const statuses = sectionKeys.reduce((acc, key) => {
    acc[key] = status;
    return acc;
  }, {});
  setState({ status: statuses });
};

/**
 * Determine section readiness based on data shape
 */
const evaluateStatus = (data, key) => {
  if (!data) return "empty";

  if (key === "topAutotraders") {
    return data.length === 0 ? "empty" : "ready";
  }

  if (key === "accountsSummary") {
    return data.accounts?.length ? "ready" : "empty";
  }

  if (key === "tradeHistory") {
    return data.length === 0 ? "empty" : "ready";
  }

  if (key === "alerts") {
    return data && typeof data === "object" ? "ready" : "empty";
  }

// assetSummary & default
  return "ready";
};

/**
 * Render dashboard based on current state
 * NOTE: Semua render HARUS idempotent
 */
const renderDashboard = (state) => {
  // ===============================
  // Asset Summary (TOTAL + % + CHART + RANGE)
  // ===============================
  renderTotalPerformanceChart({
    container: document.querySelector(
      '[data-total-performance="dashboard"]'
    ),
    dataSource: "dashboard",
    data: state.data.assetSummary,
    status: state.status.assetSummary,
    onRangeChange: async (range) => {
    const next = await setAssetRange(range);
  
    setState({
      data: {
        ...getState().data,
        assetSummary: {
          ...next,
          chart: {
            ...next.chart,
            activeRange: range,
          },
        },
      },
    });
  },
  });

  // ===============================
  // Accounts Summary
  // ===============================
  renderAccountsSummary({
    data: state.data.accountsSummary,
    status: state.status.accountsSummary,
  });

  // ===============================
  // Alerts
  // ===============================
  renderAlerts({
    data: state.data.alerts,
    status: state.status.alerts,
  });

  // ===============================
  // Top Autotraders
  // ===============================
  renderTopAutotraders({
    data: state.data.topAutotraders,
    status: state.status.topAutotraders,
  });

  // ===============================
  // Trade History
  // ===============================
  renderTradeHistory({
    data: state.data.tradeHistory,
    status: state.status.tradeHistory,
  });
};

/**
 * Sidebar collapse / expand handling
 */
const bindSidebarToggle = () => {
  const toggle = document.querySelector(".sidebar-toggle");
  if (!toggle) return;

  const tooltip = toggle.querySelector(".sidebar-toggle-tooltip");

  const syncSidebarState = () => {
    const isCollapsed =
      appRoot?.classList.contains("has-sidebar-collapsed");
    document.body.classList.toggle(
      "sidebar-collapsed",
      Boolean(isCollapsed)
    );
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    if (tooltip) {
      tooltip.textContent = isCollapsed
        ? "Expand sidebar"
        : "Collapse sidebar";
    }
  };

  syncSidebarState();

  toggle.addEventListener("click", () => {
    const isCollapsed =
      appRoot?.classList.toggle("has-sidebar-collapsed");
    document.body.classList.toggle(
      "sidebar-collapsed",
      Boolean(isCollapsed)
    );
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    if (tooltip) {
      tooltip.textContent = isCollapsed
        ? "Expand sidebar"
        : "Collapse sidebar";
    }
  });
};

/**
 * Load dashboard data via state system ONLY
 */
const loadDashboardData = async () => {
  setSectionStatuses("loading");

  try {
    const data = await fetchDashboardData();

    const statuses = sectionKeys.reduce((acc, key) => {
      acc[key] = evaluateStatus(data[key], key);
      return acc;
    }, {});

    setState({ data, status: statuses });
  } catch (error) {
    const statuses = sectionKeys.reduce((acc, key) => {
      acc[key] = "error";
      return acc;
    }, {});

    const errors = sectionKeys.reduce((acc, key) => {
      acc[key] = error;
      return acc;
    }, {});

    setState({ status: statuses, errors });
  }
};

/**
 * App bootstrap
 */
if (appRoot) {
  appRoot.dataset.ready = "true";

  initSidebar(appRoot);

  // Sidebar behavior is shared across pages
  bindSidebarToggle();

  // Dashboard bootstrapping should run only on Dashboard page
  if (IS_DASHBOARD) {
    // Subscribe render ke perubahan state
    subscribe(renderDashboard);

    // Initial render (empty / loading-safe)
    renderDashboard(getState());

    // Load real data
    loadDashboardData();
  }
}
