import { fetchAssetSummary, fetchDashboardData } from "./pages/dashboardPage.js";
import { getState, setSectionStatus, setState, subscribe } from "./state.js";
import { renderAccountsSummary } from "./render/accountsSummary.js";
import { renderAlerts } from "./render/alerts.js";
import { renderTopAutotraders } from "./render/topAutotraders.js";
import { renderTradeHistory } from "./render/tradeHistory.js";
import { renderTotalPerformanceChart } from "./components/TotalPerformanceChart.js";
import { initSidebar } from "./sidebar.js";

const appRoot = document.getElementById("app");

const sectionKeys = [
  "assetSummary",
  "accountsSummary",
  "alerts",
  "topAutotraders",
  "tradeHistory",
];

const setSectionStatuses = (status) => {
  const statuses = sectionKeys.reduce((acc, key) => {
    acc[key] = status;
    return acc;
  }, {});
  setState({ status: statuses });
};

const evaluateStatus = (data, key) => {
  if (!data) {
    return "empty";
  }

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
    return data.length === 0 ? "empty" : "ready";
  }

  return "ready";
};

const renderDashboard = (state) => {
  renderTotalPerformanceChart({
    container: document.querySelector('[data-total-performance="dashboard"]'),
    dataSource: "dashboard",
    data: state.data.assetSummary,
    status: state.status.assetSummary,
    onRangeChange: async (range) => {
      const currentState = getState();
      const assetSummary = currentState.data.assetSummary;
      if (!assetSummary?.chart) {
        return;
      }
      setSectionStatus("assetSummary", "loading");
      try {
        const updated = await fetchAssetSummary(range);
        setState({
          data: {
            assetSummary: updated,
          },
          status: {
            assetSummary: "ready",
          },
          errors: {
            assetSummary: null,
          },
        });
      } catch (error) {
        setState({
          status: {
            assetSummary: "error",
          },
          errors: {
            assetSummary: error,
          },
        });
      }
    },
  });
  renderAccountsSummary({
    data: state.data.accountsSummary,
    status: state.status.accountsSummary,
  });
  renderAlerts({ data: state.data.alerts, status: state.status.alerts });
  renderTopAutotraders({
    data: state.data.topAutotraders,
    status: state.status.topAutotraders,
  });
  renderTradeHistory({
    data: state.data.tradeHistory,
    status: state.status.tradeHistory,
  });
};

const bindSidebarToggle = () => {
  const toggle = document.querySelector(".sidebar-toggle");
  if (!toggle) {
    return;
  }
  const tooltip = toggle.querySelector(".sidebar-toggle-tooltip");
  const syncSidebarState = () => {
    const isCollapsed = appRoot?.classList.contains("has-sidebar-collapsed");
    document.body.classList.toggle("sidebar-collapsed", Boolean(isCollapsed));
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    if (tooltip) {
      tooltip.textContent = isCollapsed ? "Expand sidebar" : "Collapse sidebar";
    }
  };

  syncSidebarState();
  toggle.addEventListener("click", () => {
    const isCollapsed = appRoot?.classList.toggle("has-sidebar-collapsed");
    document.body.classList.toggle("sidebar-collapsed", Boolean(isCollapsed));
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    if (tooltip) {
      tooltip.textContent = isCollapsed ? "Expand sidebar" : "Collapse sidebar";
    }
  });
};

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

if (appRoot) {
  appRoot.dataset.ready = "true";
  initSidebar(appRoot);
  subscribe(renderDashboard);
  bindSidebarToggle();
  renderDashboard(getState());
  loadDashboardData();
}
