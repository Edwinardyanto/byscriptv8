import { cssVar } from "./cssVar.js";

/* ----------------------------------
 * Utils
 * ---------------------------------- */

const createSvgElement = (tag) =>
  document.createElementNS("http://www.w3.org/2000/svg", tag);

const getLabelIndices = (length) => {
  if (length === 7) return [0, 3, 6];
  return [];
};

/* ----------------------------------
 * Chart Renderer
 * ---------------------------------- */

export const renderAssetLineChart = (container, series) => {
  if (!container || !Array.isArray(series) || !series.length) return;

  const values = series.map(Number);

  let dates = container.__assetChartDates;
  if (!Array.isArray(dates) || dates.length !== values.length) {
    dates = [];
  }

  const width = container.clientWidth;
  if (!width) return;

  const height = 220;
  const paddingX = 24;
  const plotHeight = 190;
  const baselineY = plotHeight + 12;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const stepX = (width - paddingX * 2) / (values.length - 1 || 1);

  const points = values.map((v, i) => ({
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

  /* ---------- X AXIS LABELS (7D ONLY) ---------- */

  const labelGroup = createSvgElement("g");
  const labelIndices = getLabelIndices(values.length);

  labelIndices.forEach((i) => {
    if (!dates[i]) return;

    const label = createSvgElement("text");
    label.setAttribute("x", points[i].x);
    label.setAttribute("y", baselineY + 16);
    label.setAttribute("fill", cssVar("--color-text-subtle"));
    label.setAttribute("font-size", "11");
    label.setAttribute("text-anchor", "middle");
    label.textContent = new Date(dates[i]).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    labelGroup.appendChild(label);
  });

  /* ---------- HOVER ELEMENTS ---------- */

  const hoverLine = createSvgElement("line");
  hoverLine.setAttribute("y1", 0);
  hoverLine.setAttribute("y2", height);
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

  /* ---------- TOOLTIP (VALUE ONLY) ---------- */

  const tooltip = document.createElement("div");
  tooltip.style.position = "absolute";
  tooltip.style.opacity = "0";
  tooltip.style.pointerEvents = "none";
  tooltip.style.background = cssVar("--color-bg-surface");
  tooltip.style.color = cssVar("--color-text-primary");
  tooltip.style.padding = "6px 10px";
  tooltip.style.borderRadius = "999px";
  tooltip.style.fontSize = "0.8rem";

  /* ---------- OVERLAY ---------- */

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
      values.length - 1,
      Math.max(0, Math.round((x - paddingX) / stepX))
    );

    const point = points[index];
    const value = values[index];

    hoverLine.setAttribute("x1", point.x);
    hoverLine.setAttribute("x2", point.x);
    hoverLine.style.opacity = "1";

    hoverDot.setAttribute("cx", point.x);
    hoverDot.setAttribute("cy", point.y);
    hoverDot.style.opacity = "1";

    tooltip.textContent = value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });

    tooltip.style.opacity = "1";
    tooltip.style.left = `${point.x}px`;
    tooltip.style.top = `${point.y - 14}px`;
  });

  overlay.addEventListener("mouseleave", () => {
    tooltip.style.opacity = "0";
    hoverLine.style.opacity = "0";
    hoverDot.style.opacity = "0";
  });

  /* ---------- MOUNT ---------- */

  container.innerHTML = "";
  container.style.position = "relative";

  container.appendChild(tooltip);
  svg.appendChild(path);
  svg.appendChild(hoverLine);
  svg.appendChild(hoverDot);
  svg.appendChild(labelGroup);
  svg.appendChild(overlay);
  container.appendChild(svg);
};
