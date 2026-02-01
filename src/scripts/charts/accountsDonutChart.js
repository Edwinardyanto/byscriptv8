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
  const baseStrokeWidth = 18;
  const activeStrokeWidth = 22;

  const radius = (Math.min(width, height) - baseStrokeWidth) / 2;

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

  /* ----------------------------------
   * Glow Filter
   * ---------------------------------- */

  const defs = createSvgElement("defs");
  const filter = createSvgElement("filter");
  filter.setAttribute("id", "segmentGlow");
  filter.innerHTML = `
    <feGaussianBlur stdDeviation="3" result="blur"></feGaussianBlur>
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

  const arcById = new Map();
  const valueById = new Map();
  let activeId = null;

  const setActive = (accountId) => {
    if (!accountId) return;
    activeId = accountId;

    accounts.forEach((a) => {
      const arc = arcById.get(a.account_id);
      if (!arc) return;

      const isOn = a.account_id === accountId;

      arc.setAttribute("opacity", isOn ? "1" : "0.22");
      arc.setAttribute(
        "stroke-width",
        isOn ? `${activeStrokeWidth}` : `${baseStrokeWidth}`
      );
      arc.setAttribute("filter", isOn ? "url(#segmentGlow)" : "");
      arc.style.cursor = "pointer";
    });

    const a = accounts.find((x) => x.account_id === accountId);
    if (a) {
      labelName.textContent = a.account_name;
      labelValue.textContent = formatCurrency.format(
        Number(valueById.get(accountId) || 0)
      );
      labelGroup.style.visibility = "visible";
    }

    if (typeof onActiveChange === "function") onActiveChange(accountId);
  };

  const clearActive = () => {
    activeId = null;
    labelGroup.style.visibility = "hidden";

    accounts.forEach((a) => {
      const arc = arcById.get(a.account_id);
      if (!arc) return;

      arc.setAttribute("opacity", "0.95");
      arc.setAttribute("stroke-width", `${baseStrokeWidth}`);
      arc.setAttribute("filter", "");
    });

    if (typeof onActiveChange === "function") onActiveChange(null);
  };

  let currentAngle = 0;

  accounts.forEach((account, index) => {
    const value = Number(account.totalValueUsd || 0);
    const angle = (value / total) * 360;

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
    arc.setAttribute("stroke-width", `${baseStrokeWidth}`);
    arc.setAttribute("stroke-linecap", "butt");
    arc.setAttribute("opacity", "0.95");

    arc.dataset.accountId = account.account_id;

    arc.addEventListener("mouseenter", () => setActive(account.account_id));

    arcById.set(account.account_id, arc);
    valueById.set(account.account_id, value);

    svg.appendChild(arc);

    currentAngle += angle;
  });

  /* ----------------------------------
   * Center Circle
   * ---------------------------------- */

  const center = createSvgElement("circle");
  center.setAttribute("cx", `${width / 2}`);
  center.setAttribute("cy", `${height / 2}`);
  center.setAttribute("r", `${radius - baseStrokeWidth / 2}`);
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
