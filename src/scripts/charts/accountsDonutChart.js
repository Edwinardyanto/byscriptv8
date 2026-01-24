import { cssVar } from "./cssVar.js";

/* ============================================
 * Utils
 * ============================================ */

const createSvgElement = (tag) =>
  document.createElementNS("http://www.w3.org/2000/svg", tag);

const polarToCartesian = (cx, cy, r, angle) => {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const describeArc = (x, y, r, startAngle, endAngle) => {
  const start = polarToCartesian(x, y, r, endAngle);
  const end = polarToCartesian(x, y, r, startAngle);

  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `
    M ${start.x} ${start.y}
    A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}
  `;
};

/* ============================================
 * Donut Renderer (FINAL)
 * ============================================ */

export const renderAccountsDonutChart = ({ container, accounts }) => {
  if (!container || !Array.isArray(accounts) || accounts.length === 0) return;

  const width = 214;
  const height = 214;
  const strokeWidth = 18;
  const radius = (Math.min(width, height) - strokeWidth) / 2;

  const total =
    accounts.reduce(
      (sum, a) => sum + Number(a.totalValueUsd || 0),
      0
    ) || 1;

  const formatUsd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const svg = createSvgElement("svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);

  /* Center Hover Label */
  const labelGroup = createSvgElement("g");
  labelGroup.style.visibility = "hidden";

  const labelName = createSvgElement("text");
  labelName.setAttribute("x", width / 2);
  labelName.setAttribute("y", height / 2 - 6);
  labelName.setAttribute("text-anchor", "middle");
  labelName.setAttribute("class", "donut-label donut-label__name");

  const labelValue = createSvgElement("text");
  labelValue.setAttribute("x", width / 2);
  labelValue.setAttribute("y", height / 2 + 16);
  labelValue.setAttribute("text-anchor", "middle");
  labelValue.setAttribute("class", "donut-label donut-label__value");

  labelGroup.appendChild(labelName);
  labelGroup.appendChild(labelValue);

  /* Segments */
  let currentAngle = 0;

  accounts.forEach((acc) => {
    const value = Number(acc.totalValueUsd || 0);
    const angle = (value / total) * 360;

    if (angle <= 0) return;

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
    arc.setAttribute("stroke-width", strokeWidth);
    arc.setAttribute("stroke-linecap", "butt");
    arc.setAttribute("opacity", "0.9");

    arc.setAttribute(
      "stroke",
      acc.brand_color || cssVar("--color-chart-muted")
    );

    arc.style.cursor = "pointer";

    arc.addEventListener("mouseenter", () => {
      labelName.textContent = acc.account_name;
      labelValue.textContent = formatUsd.format(value);
      labelGroup.style.visibility = "visible";
    });

    arc.addEventListener("mouseleave", () => {
      labelGroup.style.visibility = "hidden";
    });

    svg.appendChild(arc);

    currentAngle += angle;
  });

  /* Inner Circle */
  const center = createSvgElement("circle");
  center.setAttribute("cx", width / 2);
  center.setAttribute("cy", height / 2);
  center.setAttribute("r", radius - strokeWidth / 2);
  center.setAttribute("fill", cssVar("--color-bg-surface"));

  svg.appendChild(center);
  svg.appendChild(labelGroup);

  container.innerHTML = "";
  container.appendChild(svg);
};
