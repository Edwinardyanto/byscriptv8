import { cssVar } from "./cssVar.js";

const createSvgElement = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag);

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

export const renderAccountsDonutChart = (container, accounts) => {
  if (!container || !Array.isArray(accounts) || accounts.length === 0) {
    return;
  }

  const width = 214;
  const height = 214;
  const strokeWidth = 18;
  const radius = (Math.min(width, height) - strokeWidth) / 2;
  const total = accounts.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 1;
  const formatCurrency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const svg = createSvgElement("svg");
  svg.setAttribute("width", `${width}`);
  svg.setAttribute("height", `${height}`);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");

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

  let currentAngle = 0;
  accounts.forEach((account, index) => {
    const value = Number(account.amount || 0);
    const angle = (value / total) * 360;
    const arc = createSvgElement("path");
    arc.setAttribute(
      "d",
      describeArc(width / 2, height / 2, radius, currentAngle, currentAngle + angle)
    );
    arc.setAttribute("fill", "none");
    const segmentColor = account.brandColor || account.brand_color || "";
    arc.setAttribute("stroke", segmentColor);
    arc.setAttribute("stroke-width", `${strokeWidth}`);
    arc.setAttribute("stroke-linecap", "round");
    arc.setAttribute("opacity", "0.9");
    arc.style.cursor = "pointer";
    arc.addEventListener("mouseenter", () => {
      labelName.textContent = account.name || "Account";
      labelValue.textContent = account.value || formatCurrency.format(value);
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

  const center = createSvgElement("circle");
  center.setAttribute("cx", `${width / 2}`);
  center.setAttribute("cy", `${height / 2}`);
  center.setAttribute("r", `${radius - strokeWidth / 2}`);
  const centerFill = cssVar("--color-bg-surface");
  center.setAttribute("fill", centerFill);
  svg.appendChild(center);
  svg.appendChild(labelGroup);

  container.innerHTML = "";
  container.appendChild(svg);
};
