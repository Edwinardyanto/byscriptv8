import { cssVar } from "./cssVar.js";

const createSvgElement = (tag) =>
  document.createElementNS("http://www.w3.org/2000/svg", tag);

const polarToCartesian = (cx, cy, r, angle) => {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const describeArc = (cx, cy, r, startAngle, endAngle) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
};

const getPalette = () => [
  cssVar("--color-chart-accent-primary", "#68FE1D"),
  cssVar("--color-chart-secondary", "#00F7D5"),
  cssVar("--color-chart-tertiary", "#7B62FF"),
  cssVar("--color-chart-muted", "#FF5F5F"),
  cssVar("--color-action-primary", "#68FE1D"),
  cssVar("--color-border-subtle", "#2A2F3A"),
];

export const renderAccountsDonutChart = (container, accounts) => {
  if (!container || !Array.isArray(accounts) || accounts.length === 0) return;

  const width = 214;
  const height = 214;
  const strokeWidth = 18;
  const radius = (Math.min(width, height) - strokeWidth) / 2;

  const total =
    accounts.reduce((sum, a) => sum + Number(a.amount || 0), 0) || 1;

  const palette = getPalette();

  const fmt = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const svg = createSvgElement("svg");
  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  // label hover
  const labelGroup = createSvgElement("g");
  const labelName = createSvgElement("text");
  const labelValue = createSvgElement("text");

  labelGroup.setAttribute("opacity", "0");

  labelName.setAttribute("x", `${width / 2}`);
  labelName.setAttribute("y", `${height / 2 - 6}`);
  labelName.setAttribute("text-anchor", "middle");
  labelName.setAttribute("class", "donut-label donut-label__name");

  labelValue.setAttribute("x", `${width / 2}`);
  labelValue.setAttribute("y", `${height / 2 + 16}`);
  labelValue.setAttribute("text-anchor", "middle");
  labelValue.setAttribute("class", "donut-label donut-label__value");

  labelGroup.appendChild(labelName);
  labelGroup.appendChild(labelValue);

  // render arcs
  const gapDegrees = 3;
  let currentAngle = 0;

  accounts.forEach((a, i) => {
    const value = Number(a.amount || 0);
    const angle = (value / total) * 360;

    // skip tiny zero
    if (angle <= 0) return;

    const appliedGap = angle > gapDegrees ? gapDegrees : 0;
    const start = currentAngle + appliedGap / 2;
    const end = currentAngle + angle - appliedGap / 2;

    const arc = createSvgElement("path");
    arc.setAttribute("d", describeArc(width / 2, height / 2, radius, start, end));
    arc.setAttribute("fill", "none");
    arc.setAttribute("stroke", palette[i % palette.length]);
    arc.setAttribute("stroke-width", `${strokeWidth}`);
    arc.setAttribute("stroke-linecap", "round");
    arc.setAttribute("opacity", "0.9");
    arc.style.cursor = "pointer";

    arc.addEventListener("mouseenter", () => {
      labelName.textContent = a.name || "Account";
      labelValue.textContent = a.value || fmt.format(value);
      labelGroup.setAttribute("opacity", "1");
      arc.setAttribute("opacity", "1");
    });

    arc.addEventListener("mouseleave", () => {
      labelGroup.setAttribute("opacity", "0");
      arc.setAttribute("opacity", "0.9");
    });

    svg.appendChild(arc);
    currentAngle += angle;
  });

  // center hole
  const center = createSvgElement("circle");
  center.setAttribute("cx", `${width / 2}`);
  center.setAttribute("cy", `${height / 2}`);
  center.setAttribute("r", `${radius - strokeWidth / 2}`);
  center.setAttribute("fill", cssVar("--color-bg-surface", "#0d1015"));

  svg.appendChild(center);
  svg.appendChild(labelGroup);

  container.innerHTML = "";
  container.appendChild(svg);
};
