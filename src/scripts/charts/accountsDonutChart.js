import { cssVar } from "./cssVar.js";
import { colorFromId } from "../color.js";

/* ============================================
 * Accounts Summary Donut (Dashboard)
 *
 * This implementation intentionally mirrors the stable
 * hover-glow mechanism used in the Accounts Distribution
 * donut chart (circle + stroke-dasharray).
 *
 * Notes:
 * - Dashboard donut: glow + dim only (NO tooltip / NO center label)
 * - Active segment is moved to the end of the SVG so it renders on top
 * - Uses CSS classes: .accounts-donut-segment, .is-active, .is-dimmed
 * ============================================ */

const SVG_NS = "http://www.w3.org/2000/svg";

const svgEl = (tag) => document.createElementNS(SVG_NS, tag);

const getAccountColor = (account, fallbackIndex = 0) => {
  if (account && account.color_id !== undefined && account.color_id !== null) {
    return colorFromId(account.color_id);
  }
  return colorFromId(fallbackIndex);
};

export const renderAccountsDonutChart = ({
  container,
  accounts,
  onActiveChange,
}) => {
  if (!container || !Array.isArray(accounts) || accounts.length === 0) return;

  // Match the existing dashboard donut placeholder size.
  const size = 214;
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const START_ANGLE = -90;

  const total =
    accounts.reduce((sum, a) => sum + Number(a.totalValueUsd || 0), 0) || 1;

  const svg = svgEl("svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.style.transform = `rotate(${START_ANGLE}deg)`;
  svg.style.transformOrigin = "50% 50%";
  // Avoid any glow clipping.
  svg.setAttribute("overflow", "visible");

  // Group for segments so we can re-append the active segment to the end.
  const segmentsGroup = svgEl("g");

  const segmentById = new Map();
  let activeId = null;

  const setActive = (accountId) => {
    if (!accountId) return;
    activeId = accountId;

    segmentById.forEach((seg, id) => {
      const isOn = id === accountId;
      seg.classList.toggle("is-active", isOn);
      seg.classList.toggle("is-dimmed", !isOn);

      // Bring active segment to front.
      if (isOn) segmentsGroup.appendChild(seg);
    });

    if (typeof onActiveChange === "function") onActiveChange(accountId);
  };

  const clearActive = () => {
    activeId = null;
    segmentById.forEach((seg) => {
      seg.classList.remove("is-active");
      seg.classList.remove("is-dimmed");
    });
    if (typeof onActiveChange === "function") onActiveChange(null);
  };

  // Build segments.
  let offset = 0;
  accounts.forEach((account, index) => {
    const value = Number(account.totalValueUsd || 0);
    if (!Number.isFinite(value) || value <= 0) return;

    const segmentLength = (value / total) * circumference;
    if (!Number.isFinite(segmentLength) || segmentLength <= 0) return;

    const color = getAccountColor(account, index);

    const circle = svgEl("circle");
    circle.setAttribute("cx", String(size / 2));
    circle.setAttribute("cy", String(size / 2));
    circle.setAttribute("r", String(radius));
    circle.setAttribute("fill", "transparent");
    circle.setAttribute("stroke", color);
    circle.setAttribute("stroke-width", String(stroke));
    circle.setAttribute("stroke-dasharray", `${segmentLength} ${circumference}`);
    circle.setAttribute("stroke-dashoffset", String(-offset));
    // Stable appearance for tiny segments.
    circle.setAttribute("stroke-linecap", "butt");
    circle.setAttribute("vector-effect", "non-scaling-stroke");
    circle.setAttribute("pointer-events", "stroke");

    circle.classList.add("accounts-donut-segment");
    circle.dataset.accountId = account.account_id;
    // Make drop-shadow use the segment color (currentColor).
    circle.style.color = color;
    circle.style.cursor = "pointer";

    circle.addEventListener("mouseenter", () => setActive(account.account_id));

    segmentById.set(account.account_id, circle);
    segmentsGroup.appendChild(circle);

    offset += segmentLength;
  });

  svg.appendChild(segmentsGroup);

  // Center disc (keeps the donut feel consistent with dashboard).
  const center = svgEl("circle");
  center.setAttribute("cx", String(size / 2));
  center.setAttribute("cy", String(size / 2));
  center.setAttribute("r", String(radius - stroke / 2));
  center.setAttribute("fill", cssVar("--color-bg-surface"));
  // Prevent center from blocking segment hover.
  center.setAttribute("pointer-events", "none");
  svg.appendChild(center);

  svg.addEventListener("mouseleave", () => clearActive());

  container.innerHTML = "";
  container.appendChild(svg);

  return { setActive, clearActive };
};
