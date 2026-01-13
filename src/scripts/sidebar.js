const sidebarMenu = [
  {
    id: "dashboard",
    label: "Dashboard",
    path: "index.html",
    match: (route) => route === "index.html",
  },
  {
    id: "exchanges",
    label: "Exchanges",
    path: "pages/exchanges.html",
    match: (route) => route === "pages/exchanges.html",
  },
  {
    id: "autotraders",
    label: "Autotraders",
    path: "pages/autotraders.html",
    match: (route) =>
      route === "pages/autotraders.html" ||
      route.startsWith("pages/autotraders/"),
  },
  {
    id: "trade-history",
    label: "Trade History",
    path: "pages/trade-history.html",
    match: (route) => route === "pages/trade-history.html",
  },
];

const getPathSegments = () =>
  window.location.pathname.split("/").filter(Boolean);

const getCurrentRoute = () => {
  const segments = getPathSegments();

  // root → dashboard
  if (segments.length === 0) {
    return "index.html";
  }

  const pagesIndex = segments.indexOf("pages");
  if (pagesIndex !== -1) {
    return segments.slice(pagesIndex).join("/");
  }

  return segments[segments.length - 1];
};

const getBasePath = () => {
  const route = getCurrentRoute();
  const segments = route.split("/").filter(Boolean);

  if (segments.length <= 1) {
    return "";
  }

  return "../".repeat(segments.length - 1);
};

const createSidebarToggle = () => {
  const toggle = document.createElement("button");
  toggle.className = "sidebar-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Toggle sidebar");
  toggle.setAttribute("aria-expanded", "true");

  const icon = document.createElement("span");
  icon.className = "sidebar-toggle-icon";
  icon.setAttribute("aria-hidden", "true");

  const sidebarPanel = document.createElement("span");
  sidebarPanel.className = "sidebar-toggle-panel sidebar-toggle-panel--sidebar";

  const contentPanel = document.createElement("span");
  contentPanel.className = "sidebar-toggle-panel sidebar-toggle-panel--content";

  icon.appendChild(sidebarPanel);
  icon.appendChild(contentPanel);

  const tooltip = document.createElement("span");
  tooltip.className = "sidebar-toggle-tooltip";
  tooltip.textContent = "Collapse sidebar";
  tooltip.setAttribute("role", "tooltip");

  toggle.appendChild(icon);
  toggle.appendChild(tooltip);

  return toggle;
};

const createSidebar = () => {
  const nav = document.createElement("nav");
  nav.className = "sidebar";
  nav.setAttribute("aria-label", "Primary");

  const header = document.createElement("div");
  header.className = "sidebar-header";

  const logo = document.createElement("div");
  logo.className = "sidebar-logo";
  logo.setAttribute("aria-hidden", "true");
  logo.textContent = "B";

  const logoText = document.createElement("span");
  logoText.className = "sidebar-logo-text";
  logoText.textContent = "ByScript";

  header.appendChild(logo);
  header.appendChild(logoText);

  const menu = document.createElement("ul");
  const route = getCurrentRoute();
  const basePath = getBasePath();

  sidebarMenu.forEach((item) => {
    const listItem = document.createElement("li");
    const link = document.createElement("a");

    const isActive = item.match(route);

    link.className = `sidebar-item${
      isActive ? " sidebar-item--active" : ""
    }`;
    link.href = `${basePath}${item.path}`;

    const icon = document.createElement("span");
    icon.className = "sidebar-icon";

    const label = document.createElement("span");
    label.className = "sidebar-label";
    label.textContent = item.label;

    link.appendChild(icon);
    link.appendChild(label);
    listItem.appendChild(link);
    menu.appendChild(listItem);
  });

  nav.appendChild(header);
  nav.appendChild(menu);

  return nav;
};

export const initSidebar = (appRoot) => {
  if (!appRoot) return;

  if (!appRoot.querySelector(".sidebar-toggle")) {
    appRoot.prepend(createSidebarToggle());
  }

  const sidebarSlot = appRoot.querySelector("[data-sidebar-slot]");
  if (!sidebarSlot) return;

  sidebarSlot.innerHTML = "";
  sidebarSlot.appendChild(createSidebar());
};
