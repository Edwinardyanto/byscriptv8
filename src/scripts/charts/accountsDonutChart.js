import { cssVar } from "./cssVar.js";

const createSvgElement = (tag) =>
  document.createElementNS("http://www.w3.org/2000/svg", tag);

const polarToCartesian = (cx, cy, r, angle) => {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const describeArc = (cx, cy, r, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);

  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${start.x} ${start.y}
          A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
};

const getPalette = () => [
  cssVar("--color-chart-accent-primary", "#68FE1D"),
  cssVar("--color-chart-secondary", "#00F7D5"),
  cssVar("--color-chart-tertiary", "#7B62FF"),
  cssVar("--color-chart-muted", "#FF5F5F"),
  cssVar("--color-action-primary", "#68FE1D"),
];

/* =========================
   DONUT RENDER
========================= */

export const renderAccountsDonutChart = (container, accounts) => {
  if (!container || !accounts?.length) return;

  const width = 214;
  const height = 214;
  const strokeWidth = 18;
  const radius = (Math.min(width, height) - strokeWidth) / 2;

  const total =
    accounts.reduce((sum, a) => sum + Number(a.amount || 0), 0) || 1;

  const palette = getPalette();

  const svg = createSvgElement("svg");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  let currentAngle = 0;
  const gapDegrees = 3;

  accounts.forEach((acc, i) => {
    const value = Number(acc.amount || 0);
    if (!value) return;

    const angle = (value / total) * 360;
    const appliedGap = angle > gapDegrees ? gapDegrees : 0;

    const start = currentAngle + appliedGap / 2;
    const end = currentAngle + angle - appliedGap / 2;

    const arc = createSvgElement("path");
    arc.setAttribute("d", describeArc(width / 2, height / 2, radius, start, end));

    arc.setAttribute("fill", "none");
    arc.setAttribute("stroke", palette[i % palette.length]);
    arc.setAttribute("stroke-width", strokeWidth);
    arc.setAttribute("stroke-linecap", "round");
    arc.setAttribute("opacity", "0.9");

    svg.appendChild(arc);
    currentAngle += angle;
  });

  // center hole
  const center = createSvgElement("circle");
  center.setAttribute("cx", width / 2);
  center.setAttribute("cy", height / 2);
  center.setAttribute("r", radius - strokeWidth / 2);
  center.setAttribute("fill", cssVar("--color-bg-surface", "#0d1015"));

  svg.appendChild(center);

  container.innerHTML = "";
  container.appendChild(svg);
};
