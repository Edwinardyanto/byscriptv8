import { cssVar } from "./cssVar.js";

const createSvgElement = (tag) =>
  document.createElementNS("http://www.w3.org/2000/svg", tag);

/* ✅ fixed neon palette */
const COLORS = [
  "#68FE1D",
  "#00F7D5",
  "#7B62FF",
  "#FF5F5F",
  "#FFD54A",
  "#29B3D1",
];

/* utils */
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

/* =========================
   ✅ DONUT CHART FINAL
========================= */

export const renderAccountsDonutChart = (container, accounts) => {
  if (!container || !accounts?.length) return;

  const width = 214;
  const height = 214;
  const strokeWidth = 18;
  const radius = (Math.min(width, height) - strokeWidth) / 2;

  const total =
    accounts.reduce((sum, a) => sum + Number(a.amount || 0), 0) || 1;

  const svg = createSvgElement("svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  let currentAngle = 0;

  accounts.forEach((acc, i) => {
    const value = Number(acc.amount || 0);
    if (!value) return;

    const angle = (value / total) * 360;

    const arc = createSvgElement("path");
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
    arc.setAttribute("stroke", COLORS[i % COLORS.length]);
    arc.setAttribute("stroke-width", strokeWidth);
    arc.setAttribute("stroke-linecap", "round");
    arc.setAttribute("opacity", "0.92");

    svg.appendChild(arc);
    currentAngle += angle;
  });

  /* ✅ center hole */
  const center = createSvgElement("circle");
  center.setAttribute("cx", width / 2);
  center.setAttribute("cy", height / 2);
  center.setAttribute("r", radius - strokeWidth / 2);
  center.setAttribute("fill", cssVar("--color-bg-surface", "#0d1015"));

  svg.appendChild(center);

  container.innerHTML = "";
  container.appendChild(svg);
};
