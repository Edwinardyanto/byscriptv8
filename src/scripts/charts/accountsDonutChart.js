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

  const total =
    accounts.reduce((sum, item) => sum + Number(item.totalValueUsd || 0), 0) ||
    1;

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

  // Active halo overlay (so we don't have to fatten the real segment).
  const activeHalo = createSvgElement("path");
  activeHalo.setAttribute("fill", "none");
  activeHalo.setAttribute("opacity", "0");
  activeHalo.setAttribute("pointer-events", "none");
  activeHalo.setAttribute("stroke-linecap", "round");
  activeHalo.setAttribute("stroke-linejoin", "round");
  activeHalo.setAttribute("stroke-width", `${haloWidth}`);
  activeHalo.setAttribute("filter", `url(#${glowId})`);

  const setActive = (accountId) => {
    if (!accountId) return;
    activeId = accountId;

    accounts.forEach((a) => {
      const arc = arcById.get(a.account_id);
      if (!arc) return;

      const isOn = a.account_id === accountId;

      // Bring active segment to front within the segment group.
      if (isOn) segmentsGroup.appendChild(arc);

      arc.setAttribute("opacity", isOn ? "1" : "0.18");
      arc.setAttribute("filter", isOn ? `url(#${glowId})` : "");
      arc.style.cursor = "pointer";
    });

    const a = accounts.find((x) => x.account_id === accountId);
    if (a) {
      const v = Number(valueById.get(accountId) || 0);
      labelName.textContent = a.account_name;
      labelValue.textContent = formatCurrency.format(v);
      labelGroup.style.visibility = "visible";

      // Halo follows the active arc path.
      const arc = arcById.get(accountId);
      if (arc) {
        activeHalo.setAttribute("d", arc.getAttribute("d") || "");
        activeHalo.setAttribute("stroke", arc.getAttribute("stroke") || "");
        activeHalo.setAttribute("opacity", "0.33");
      }
    }

    if (typeof onActiveChange === "function") onActiveChange(accountId);
  };

  const clearActive = () => {
    activeId = null;
    labelGroup.style.visibility = "hidden";
    activeHalo.setAttribute("opacity", "0");

    accounts.forEach((a) => {
      const arc = arcById.get(a.account_id);
      if (!arc) return;

      arc.setAttribute("opacity", "0.95");
      arc.setAttribute("filter", "");
    });

    if (typeof onActiveChange === "function") onActiveChange(null);
  };

  let currentAngle = 0;

  accounts.forEach((account, index) => {
    const value = Number(account.totalValueUsd || 0);
    const angle = (value / total) * 360;

    // Skip 0-values safely (avoid NaN arcs).
    if (!Number.isFinite(angle) || angle <= 0) return;

    const arc = createSvgElement("path");
    const color = getAccountColor(account, index);

    arc.setAttribute(
      "d",
      describeArc(
        width / 2,
        height / 2,
        radius,
        currentAngle,
        currentAngle + angle
      )
    );

    arc.setAttribute("fill", "none");
    arc.setAttribute("stroke", color);
    arc.setAttribute("stroke-width", `${strokeWidth}`);

    // Rounded caps make tiny segments look like a clean "dot", not a broken rectangle.
    arc.setAttribute("stroke-linecap", "round");
    arc.setAttribute("stroke-linejoin", "round");

    arc.setAttribute("opacity", "0.95");

    // Improves hover stability when segments overlap.
    arc.setAttribute("pointer-events", "stroke");

    arc.dataset.accountId = account.account_id;

    arc.addEventListener("mouseenter", () => setActive(account.account_id));

    arcById.set(account.account_id, arc);
    valueById.set(account.account_id, value);

    segmentsGroup.appendChild(arc);

    currentAngle += angle;
  });

  svg.appendChild(segmentsGroup);

  // Put halo above segments (but below the center disc).
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

  // Clear state when leaving the full SVG area
  svg.addEventListener("mouseleave", () => clearActive());

  /* ----------------------------------
   * Mount
   * ---------------------------------- */

  container.innerHTML = "";
  container.appendChild(svg);

  return { setActive, clearActive };
};
