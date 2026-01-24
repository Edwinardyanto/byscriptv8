import { cssVar } from "./cssVar.js";

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
 * Donut Renderer (Stable Hover Version)
 * ============================================ */

export const renderAccountsDonutChart = (container, accounts) => {
  if (!container || !Array.isArray(accounts) || accounts.length === 0) {
    return;
  }

  /* ----------------------------------
   * Layout Constants
   * ---------------------------------- */

  const width = 214;
  const height = 214;
  const strokeWidth = 18;

  const radius = (Math.min(width, height) - strokeWidth) / 2;

  /* ----------------------------------
   * Total Value
   * ---------------------------------- */

  const total =
    accounts.reduce((sum, item) => sum + Number(item.amount || 0), 0) || 1;

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
  svg.setAttribute("preserveAspectRatio", "none");

  /* ----------------------------------
   * Center Hover Label
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
   * Arc Segments
   * ---------------------------------- */

  let currentAngle = 0;

  accounts.forEach((account) => {
    const value = Number(account.amount || 0);
    const angle = (value / total) * 360;

    const arc = createSvgElement("path");
    arc.classList.add("accounts-donut-segment");

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

    const segmentColor =
      account.brandColor || account.brand_color || cssVar("--color-chart-muted");

    arc.setAttribute("stroke", segmentColor);
    arc.setAttribute("stroke-width", `${strokeWidth}`);

    /* ✅ Critical Fix */
    arc.setAttribute("stroke-linecap", "butt");

    arc.setAttribute("opacity", "0.9");
    arc.style.cursor = "pointer";

    /* ----------------------------------
     * Hover Behavior (No Layout Break)
     * ---------------------------------- */

    arc.addEventListener("mouseenter", () => {
      labelName.textContent = account.name || "Account";
      labelValue.textContent =
        account.value || formatCurrency.format(value);

      labelGroup.style.visibility = "visible";
      arc.classList.add("is-hover");
    });

    arc.addEventListener("mouseleave", () => {
      labelGroup.style.visibility = "hidden";
      arc.classList.remove("is-hover");
    });

    svg.appendChild(arc);

    currentAngle += angle;
  });

  /* ----------------------------------
   * Donut Inner Circle
   * ---------------------------------- */

  const center = createSvgElement("circle");
  center.setAttribute("cx", `${width / 2}`);
  center.setAttribute("cy", `${height / 2}`);
  center.setAttribute("r", `${radius - strokeWidth / 2}`);

  center.setAttribute("fill", cssVar("--color-bg-surface"));

  svg.appendChild(center);
  svg.appendChild(labelGroup);

  /* ----------------------------------
   * Mount
   * ---------------------------------- */

  container.innerHTML = "";
  container.appendChild(svg);
};
