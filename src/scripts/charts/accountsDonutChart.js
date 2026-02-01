import { cssVar } from "./cssVar.js";
import { colorFromId } from "../color.js";

/* ============================================
 * Utils
 * ============================================ */

const createSvgElement = (tag) =>
  document.createElementNS("http://www.w3.org/2000/svg", tag);

const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const describeArc = (x, y, radius, startAngle, endAngle) => {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return [
    "M",
    start.x,
    start.y,
    "A",
    radius,
    radius,
    0,
    largeArcFlag,
    0,
    end.x,
    end.y,
  ].join(" ");
};

/* ============================================
 * Color
 * ============================================ */

const getAccountColor = (account, fallbackIndex = 0) => {
  // Primary: color_id (new standard)
  if (account && account.color_id !== undefined && account.color_id !== null) {
    return colorFromId(account.color_id);
  }

  // Last resort: deterministic by index
  return colorFromId(fallbackIndex);
};

/* ============================================
 * Donut Renderer (Colored Segments)
 * ============================================ */

export const renderAccountsDonutChart = ({
  container,
  accounts,
  onActiveChange,
}) => {
  if (!container || !Array.isArray(accounts) || accounts.length === 0) return;

  const width = 214;
  const height = 214;

  // Keep stroke width stable (small segments look broken if we inflate stroke width).
  const strokeWidth = 18;

  // A soft halo is rendered as a separate overlay path.
  const haloWidth = 30;

  const radius = (Math.min(width, height) - strokeWidth) / 2;

  // Use only positive values for donut denominator so the ring always closes to 100%.
  const total =
    accounts.reduce((sum, item) => {
      const v = Number(item.totalValueUsd || 0);
      return sum + (v > 0 ? v : 0);
    }, 0) || 1;

  const formatCurrency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  /* ----------------------------------
   * SVG Root
   * ---------------------------------- */

  const svg = createSvgElement("svg");
  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  // Prevent hover glow from being clipped.
  svg.setAttribute("overflow", "visible");

  /* ----------------------------------
   * Glow / Halo Filter (non-clipped)
   * ---------------------------------- */

  // Unique id to avoid collisions if multiple charts exist.
  const glowId = `segmentGlow-${Math.random().toString(36).slice(2, 9)}`;

  const defs = createSvgElement("defs");
  const filter = createSvgElement("filter");
  filter.setAttribute("id", glowId);
  filter.setAttribute("x", "-60%");
  filter.setAttribute("y", "-60%");
  filter.setAttribute("width", "220%");
  filter.setAttribute("height", "220%");
  filter.innerHTML = `
    <feGaussianBlur stdDeviation="3.2" result="blur"></feGaussianBlur>
    <feMerge>
      <feMergeNode in="blur"></feMergeNode>
      <feMergeNode in="SourceGraphic"></feMergeNode>
    </feMerge>
  `;
  defs.appendChild(filter);
  svg.appendChild(defs);

  /* ----------------------------------
   * Hover Label
   * ---------------------------------- */

  const labelGroup = createSvgElement("g");
  labelGroup.style.visibility = "hidden";

  const labelName = createSvgElement("text");
  labelName.setAttribute("x", `${width / 2}`);
  labelName.setAttribute("y", `${height / 2 - 6}`);
  labelName.setAttribute("text-anchor", "middle");
  labelName.setAttribute("class", "donut-label donut-label__name");

  const labelValue = createSvgElement("text");
  labelValue.setAttribute("x", `${width / 2}`);
  labelValue.setAttribute("y", `${height / 2 + 16}`);
  labelValue.setAttribute("text-anchor", "middle");
  labelValue.setAttribute("class", "donut-label donut-label__value");

  labelGroup.appendChild(labelName);
  labelGroup.appendChild(labelValue);

  /* ----------------------------------
   * Segments
   * ---------------------------------- */

  const segmentsGroup = createSvgElement("g");
  const arcById = new Map();
  const valueById = new Map();
  let activeId = null;

  // Circle segment math
  const centerX = width / 2;
  const centerY = height / 2;
  const circumference = 2 * Math.PI * radius;


  // Active halo overlay (separate circle segment so we do not fatten the real segment).
  const activeHalo = createSvgElement("circle");
  activeHalo.setAttribute("cx", String(centerX));
  activeHalo.setAttribute("cy", String(centerY));
  activeHalo.setAttribute("r", String(radius));
  activeHalo.setAttribute("fill", "transparent");
  activeHalo.setAttribute("opacity", "0");
  activeHalo.setAttribute("pointer-events", "none");
  activeHalo.setAttribute("stroke-linecap", "round");
  activeHalo.setAttribute("stroke-width", String(haloWidth));
  activeHalo.style.filter = "drop-shadow(0 0 10px rgba(104,254,29,0.35))";

  const setActive = (accountId) => {
    if (!accountId) return;
    activeId = accountId;

    segmentsGroup.childNodes.forEach((n) => {
      if (n && n.nodeType === 1) n.style.opacity = "0.35";
    });

    const active = arcById.get(accountId);
    if (active) active.style.opacity = "1";

    // Halo follows the active segment by copying dash settings.
    const halo = arcById.get(accountId);
    if (halo) {
      const dasharray = halo.getAttribute("stroke-dasharray") || "";
      const dashoffset = halo.getAttribute("stroke-dashoffset") || "0";
      activeHalo.setAttribute("stroke", halo.getAttribute("stroke") || cssVar("--color-accent"));
      activeHalo.setAttribute("stroke-dasharray", dasharray);
      activeHalo.setAttribute("stroke-dashoffset", dashoffset);
      activeHalo.setAttribute("opacity", "0.9");
    } else {
      activeHalo.setAttribute("opacity", "0");
    }

    const account = accounts.find((a) => a.account_id === accountId);
    if (account) {
      labelName.textContent = account.account_name || account.account_id;
      labelValue.textContent = formatCurrency.format(
        Number(account.totalValueUsd || 0)
      );
      labelGroup.style.visibility = "visible";
    }

    if (typeof onActiveChange === "function") onActiveChange(accountId);
  };

  const clearActive = () => {
    activeId = null;
    segmentsGroup.childNodes.forEach((n) => {
      if (n && n.nodeType === 1) n.style.opacity = "1";
    });
    activeHalo.setAttribute("opacity", "0");
    labelGroup.style.visibility = "hidden";
    if (typeof onActiveChange === "function") onActiveChange(null);
  };

  // Build circle segments with dasharray so the ring always closes cleanly.
  let offset = 0;
  const visibleAccounts = accounts
    .map((a, idx) => ({ a, idx, v: Number(a.totalValueUsd || 0) }))
    .filter((x) => x.v > 0);

  visibleAccounts.forEach((item, i) => {
    const account = item.a;
    const value = item.v;
    const pct = value / total;
    let segLen = pct * circumference;

    // Force the last visible segment to close the ring exactly to avoid floating drift.
    if (i === visibleAccounts.length - 1) {
      segLen = Math.max(0, circumference - offset);
    }

    if (segLen <= 0) return;

    const color = getAccountColor(account, item.idx);

    const circle = createSvgElement("circle");
    circle.setAttribute("cx", String(centerX));
    circle.setAttribute("cy", String(centerY));
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", "transparent");
    circle.setAttribute("stroke", color);
    circle.setAttribute("stroke-width", String(strokeWidth));
    circle.setAttribute("stroke-linecap", "round");
    circle.setAttribute("stroke-dasharray", `${segLen} ${circumference}`);
    circle.setAttribute("stroke-dashoffset", String(-offset));
    circle.setAttribute("class", "donut-segment");
    circle.style.transition = "opacity 0.18s ease, filter 0.18s ease";
    circle.style.filter = "none";
    circle.style.opacity = "1";

    circle.addEventListener("mouseenter", () => setActive(account.account_id));
    circle.addEventListener("mouseleave", () => {
      // Do not clear on segment leave; the svg handles global leave so label stays while inside.
    });

    arcById.set(account.account_id, circle);
    valueById.set(account.account_id, value);

    segmentsGroup.appendChild(circle);
    offset += segLen;
  });

  // Rotate so the first segment starts at the top like the distribution donut.
  segmentsGroup.setAttribute("transform", `rotate(-90 ${centerX} ${centerY})`);
  activeHalo.setAttribute("transform", `rotate(-90 ${centerX} ${centerY})`);

  // Keep active state while the cursor stays within the chart area.
  svg.addEventListener("mouseleave", clearActive);


  svg.appendChild(segmentsGroup);
  svg.appendChild(activeHalo);

  /* ----------------------------------
   * Center Circle
   * ---------------------------------- */

  const center = createSvgElement("circle");
  center.setAttribute("cx", `${width / 2}`);
  center.setAttribute("cy", `${height / 2}`);
  center.setAttribute("r", `${radius - strokeWidth / 2}`);
  center.setAttribute("fill", cssVar("--color-bg-surface"));

  svg.appendChild(center);
  svg.appendChild(labelGroup);


  /* ----------------------------------
   * Mount
   * ---------------------------------- */

  container.innerHTML = "";
  container.appendChild(svg);

  return { setActive, clearActive };
};
