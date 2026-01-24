import { cssVar } from "./cssVar.js";

/* ----------------------------------
 * Utils
 * ---------------------------------- */

const createSvgElement = (tag) =>
  document.createElementNS("http://www.w3.org/2000/svg", tag);

const getLabelIndices = (length) => {
  if (length < 2) return [];
  return [0, Math.floor((length - 1) / 2), length - 1];
};

/* ----------------------------------
 * Chart Renderer (FINAL CONTRACT)
 * ---------------------------------- */

export const renderAssetLineChart = ({ container, series, labels }) => {
  if (
    !container ||
    !Array.isArray(series) ||
    !Array.isArray(labels) ||
    series.length === 0 ||
    series.length !== labels.length
  ) {
    return;
  }

  const width = container.clientWidth;
  const height = container.clientHeight || 320;
  if (!width || !height) return;

  const paddingX = 24;
  const plotHeight = height - 40;
  const baselineY = plotHeight + 16;

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;

  const stepX = (width - paddingX * 2) / (series.length - 1 || 1);

  const points = series.map((v, i) => ({
    x: paddingX + i * stepX,
    y: baselineY - ((v - min) / range) * plotHeight,
  }));

  /* ---------- SVG ---------- */

  const svg = createSvgElement("svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.width = "100%";
  svg.style.height = "100%";

  const path = createSvgElement("path");
  path.setAttribute(
    "d",
    points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ")
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", cssVar("--color-chart-accent-primary"));
  path.setAttribute("stroke-width", "4");
  path.setAttribute("stroke-linecap", "round");

  /* ---------- X AXIS LABELS ---------- */

  const labelGroup = createSvgElement("g");
  const labelIndices = getLabelIndices(series.length);

  labelIndices.forEach((i) => {
    const label = createSvgElement("text");
    label.setAttribute("x", points[i].x);
    label.setAttribute("y", baselineY + 18);
    label.setAttribute("fill", cssVar("--color-text-subtle"));
    label.setAttribute("font-size", "11");
    label.setAttribute("text-anchor", "middle");

    label.textContent = new Date(labels[i]).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    labelGroup.appendChild(label);
  });

  /* ---------- HOVER ELEMENTS ---------- */

  const hoverLine = createSvgElement("line");
  hoverLine.setAttribute("stroke", cssVar("--color-border-neutral"));
  hoverLine.setAttribute("stroke-width", "1");
  hoverLine.setAttribute("stroke-dasharray", "4 6");
  hoverLine.style.opacity = "0";

  const hoverDot = createSvgElement("circle");
  hoverDot.setAttribute("r", "4");
  hoverDot.setAttribute("fill", cssVar("--color-chart-accent-primary"));
  hoverDot.setAttribute("stroke", cssVar("--color-bg-surface"));
  hoverDot.setAttribute("stroke-width", "2");
  hoverDot.style.opacity = "0";

  /* ---------- TOOLTIP VALUE (TOP) ---------- */

  const tooltip = document.createElement("div");
  tooltip.style.position = "absolute";
  tooltip.style.opacity = "0";
  tooltip.style.pointerEvents = "none";
  tooltip.style.background = cssVar("--color-bg-surface");
  tooltip.style.color = cssVar("--color-text-primary");
  tooltip.style.padding = "6px 10px";
  tooltip.style.borderRadius = "999px";
  tooltip.style.fontSize = "0.8rem";
  tooltip.style.whiteSpace = "nowrap";

  /* ---------- ✅ NEW: HOVER DATE LABEL (BOTTOM AXIS) ---------- */

  const hoverDate = document.createElement("div");
  hoverDate.style.position = "absolute";
  hoverDate.style.opacity = "0";
  hoverDate.style.pointerEvents = "none";
  hoverDate.style.color = cssVar("--color-text-subtle");
  hoverDate.style.fontSize = "11px";
  hoverDate.style.whiteSpace = "nowrap";
  hoverDate.style.transform = "translateX(-50%)";

  // ✅ anchor exactly where x-axis ticks are
  hoverDate.style.bottom = "2px";

  /* ---------- OVERLAY CAPTURE ---------- */

  const overlay = createSvgElement("rect");
  overlay.setAttribute("x", paddingX);
  overlay.setAttribute("y", 0);
  overlay.setAttribute("width", width - paddingX * 2);
  overlay.setAttribute("height", height);
  overlay.setAttribute("fill", "transparent");

  overlay.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;

    const index = Math.min(
      series.length - 1,
      Math.max(0, Math.round((x - paddingX) / stepX))
    );

    const point = points[index];

    /* ✅ Hover Line */
    hoverLine.setAttribute("x1", point.x);
    hoverLine.setAttribute("x2", point.x);
    hoverLine.setAttribute("y1", point.y);
    hoverLine.setAttribute("y2", baselineY);
    hoverLine.style.opacity = "1";

    /* ✅ Hover Dot */
    hoverDot.setAttribute("cx", point.x);
    hoverDot.setAttribute("cy", point.y);
    hoverDot.style.opacity = "1";

    /* ✅ Tooltip Value */
    tooltip.textContent = series[index].toLocaleString();
    tooltip.style.opacity = "1";
    tooltip.style.left = `${point.x}px`;
    tooltip.style.top = `${point.y - 18}px`;

    /* ✅ NEW: Hover Date aligned with axis ticks */
    hoverDate.textContent = new Date(labels[index]).toLocaleDateString(
      undefined,
      { month: "short", day: "numeric" }
    );

    hoverDate.style.opacity = "1";
    hoverDate.style.left = `${point.x}px`;
  });

  overlay.addEventListener("mouseleave", () => {
    tooltip.style.opacity = "0";
    hoverDate.style.opacity = "0";
    hoverLine.style.opacity = "0";
    hoverDot.style.opacity = "0";
  });

  /* ---------- MOUNT ---------- */

  container.innerHTML = "";
  container.style.position = "relative";

  container.appendChild(tooltip);
  container.appendChild(hoverDate);

  svg.appendChild(path);
  svg.appendChild(hoverLine);
  svg.appendChild(hoverDot);
  svg.appendChild(labelGroup);
  svg.appendChild(overlay);

  container.appendChild(svg);
};
