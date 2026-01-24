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

  /* ============================================
   * ✅ FIXED SVG COORDINATE SYSTEM (Responsive)
   * ============================================ */

  const width = 1000;
  const height = 320;

  const paddingX = 40;
  const paddingTop = 20;
  const paddingBottom = 50;

  const plotHeight = height - paddingTop - paddingBottom;
  const baselineY = paddingTop + plotHeight;

  /* ---------- Normalize Data ---------- */

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;

  const stepX = (width - paddingX * 2) / (series.length - 1 || 1);

  const points = series.map((v, i) => ({
    x: paddingX + i * stepX,
    y: baselineY - ((v - min) / range) * plotHeight,
  }));

  /* ---------- SVG ROOT ---------- */

  const svg = createSvgElement("svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.display = "block";

  /* ---------- Line Path ---------- */

  const path = createSvgElement("path");
  path.setAttribute(
    "d",
    points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ")
  );

  path.setAttribute("fill", "none");
  path.setAttribute("stroke", cssVar("--color-chart-accent-primary"));
  path.setAttribute("stroke-width", "4");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");

  /* ---------- X Axis Labels ---------- */

  const labelGroup = createSvgElement("g");
  const labelIndices = getLabelIndices(series.length);

  labelIndices.forEach((i) => {
    const label = createSvgElement("text");

    label.setAttribute("x", points[i].x);
    label.setAttribute("y", baselineY + 28);

    label.setAttribute("fill", cssVar("--color-text-subtle"));
    label.setAttribute("font-size", "11");
    label.setAttribute("text-anchor", "middle");

    label.textContent = new Date(labels[i]).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

    labelGroup.appendChild(label);
  });

  /* ---------- Hover Line ---------- */

  const hoverLine = createSvgElement("line");
  hoverLine.setAttribute("stroke", cssVar("--color-border-neutral"));
  hoverLine.setAttribute("stroke-width", "1");
  hoverLine.setAttribute("stroke-dasharray", "4 6");
  hoverLine.style.opacity = "0";

  /* ---------- Hover Dot ---------- */

  const hoverDot = createSvgElement("circle");
  hoverDot.setAttribute("r", "5");
  hoverDot.setAttribute("fill", cssVar("--color-chart-accent-primary"));
  hoverDot.setAttribute("stroke", cssVar("--color-bg-surface"));
  hoverDot.setAttribute("stroke-width", "2");
  hoverDot.style.opacity = "0";

  /* ============================================
   * ✅ Hover Value Text (SVG + Stroke Outline)
   * ============================================ */

  const hoverValueText = createSvgElement("text");
  hoverValueText.setAttribute("fill", "#ffffff");
  hoverValueText.setAttribute("font-size", "13");
  hoverValueText.setAttribute("font-weight", "600");
  hoverValueText.setAttribute("text-anchor", "middle");
  hoverValueText.style.opacity = "0";

  /* Stroke outline supaya kebaca di atas line */
  hoverValueText.setAttribute("stroke", "rgba(0,0,0,0.75)");
  hoverValueText.setAttribute("stroke-width", "4");
  hoverValueText.setAttribute("paint-order", "stroke");

  /* ============================================
   * ✅ Hover Date Text (Baseline aligned)
   * ============================================ */

  const hoverDateText = createSvgElement("text");
  hoverDateText.setAttribute("fill", cssVar("--color-text-subtle"));
  hoverDateText.setAttribute("font-size", "11");
  hoverDateText.setAttribute("text-anchor", "middle");
  hoverDateText.style.opacity = "0";

  /* ---------- Overlay Capture ---------- */

  const overlay = createSvgElement("rect");
  overlay.setAttribute("x", paddingX);
  overlay.setAttribute("y", paddingTop);
  overlay.setAttribute("width", width - paddingX * 2);
  overlay.setAttribute("height", plotHeight);
  overlay.setAttribute("fill", "transparent");

  overlay.addEventListener("mousemove", (e) => {
    const rect = svg.getBoundingClientRect();

    const mouseX = ((e.clientX - rect.left) / rect.width) * width;

    const index = Math.min(
      series.length - 1,
      Math.max(0, Math.round((mouseX - paddingX) / stepX))
    );

    const point = points[index];

    /* Hover Line */
    hoverLine.setAttribute("x1", point.x);
    hoverLine.setAttribute("x2", point.x);
    hoverLine.setAttribute("y1", point.y);
    hoverLine.setAttribute("y2", baselineY);
    hoverLine.style.opacity = "1";

    /* Hover Dot */
    hoverDot.setAttribute("cx", point.x);
    hoverDot.setAttribute("cy", point.y);
    hoverDot.style.opacity = "1";

    /* ✅ Hover Value Text */
    hoverValueText.textContent = series[index].toLocaleString();
    hoverValueText.setAttribute("x", point.x);
    hoverValueText.setAttribute("y", point.y - 14);
    hoverValueText.style.opacity = "1";

    /* ✅ Hover Date EXACT baseline position */
    hoverDateText.textContent = new Date(labels[index]).toLocaleDateString(
      undefined,
      { month: "short", day: "numeric" }
    );

    hoverDateText.setAttribute("x", point.x);
    hoverDateText.setAttribute("y", baselineY + 28);
    hoverDateText.style.opacity = "1";
  });

  overlay.addEventListener("mouseleave", () => {
    hoverLine.style.opacity = "0";
    hoverDot.style.opacity = "0";
    hoverValueText.style.opacity = "0";
    hoverDateText.style.opacity = "0";
  });

  /* ---------- Mount ---------- */

  container.innerHTML = "";
  container.style.position = "relative";

  svg.appendChild(path);
  svg.appendChild(labelGroup);

  svg.appendChild(hoverLine);
  svg.appendChild(hoverDot);

  svg.appendChild(hoverValueText); // ✅ always above line
  svg.appendChild(hoverDateText);

  svg.appendChild(overlay);

  container.appendChild(svg);
};
