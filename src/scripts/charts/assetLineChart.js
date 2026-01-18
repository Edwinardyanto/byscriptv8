import { cssVar } from "./cssVar.js";

const createSvgElement = (tag) => document.createElementNS("http://www.w3.org/2000/svg", tag);

const buildLabelIndices = (length, count) => {
  if (length <= 1 || count <= 1) {
    return [0];
  }
  const indices = new Set();
  for (let i = 0; i < count; i += 1) {
    indices.add(Math.round((i * (length - 1)) / (count - 1)));
  }
  return Array.from(indices).sort((a, b) => a - b);
};

const getLabelIndices = (length) => {
  if (length === 7) {
    return [0, 3, 6];
  }
  if (length === 30) {
    return buildLabelIndices(length, 5);
  }
  if (length === 90) {
    return buildLabelIndices(length, 4);
  }
  return buildLabelIndices(length, 3);
};

export const renderAssetLineChart = (container, series) => {
  if (!container || !Array.isArray(series) || series.length === 0) {
    return;
  }

  container.__assetChartSeries = series;
  if (!container.__assetChartResizeHandler) {
    const resizeHandler = () => {
      renderAssetLineChart(container, container.__assetChartSeries);
    };
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        resizeHandler();
      });
      observer.observe(container);
      container.__assetChartResizeObserver = observer;
    }
    window.addEventListener("resize", resizeHandler);
    container.__assetChartResizeHandler = resizeHandler;
  }

  const containerWidth = container.clientWidth || container.getBoundingClientRect().width;
  if (!containerWidth) {
    return;
  }
  const width = containerWidth;
  const plotHeight = 190;
  const plotTop = 12;
  const labelZoneHeight = 18;
  const paddingX = 24;
  const labelPaddingX = paddingX * 1.5;
  const plotBottomPadding = Math.max(4, Math.round(plotHeight * 0.04));
  const height = plotTop + plotHeight + labelZoneHeight;
  const baselineY = plotTop + plotHeight;
  const values = series.map((point) =>
    typeof point.total_usd === "number" ? point.total_usd : Number(point.total_usd) || 0
  );
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const plotInnerHeight = plotHeight - plotBottomPadding;

  const svg = createSvgElement("svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  const stepX = (width - paddingX * 2) / (values.length - 1 || 1);
  const points = values.map((value, index) => {
    const x = paddingX + index * stepX;
    const y = baselineY - plotBottomPadding - ((value - min) / range) * plotInnerHeight;
    return { x, y };
  });

  const pathData = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
    .join(" ");

  const baseline = createSvgElement("line");
  baseline.setAttribute("x1", paddingX);
  baseline.setAttribute("x2", width - paddingX);
  baseline.setAttribute("y1", baselineY);
  baseline.setAttribute("y2", baselineY);
  const baselineColor = cssVar("--color-divider");
  baseline.setAttribute("stroke", baselineColor);
  baseline.setAttribute("stroke-width", "1");
  baseline.setAttribute("stroke-dasharray", "4 6");

  const glow = createSvgElement("path");
  glow.setAttribute("d", pathData);
  glow.setAttribute("fill", "none");
  const glowColor = cssVar("--color-chart-muted");
  glow.setAttribute("stroke", glowColor);
  glow.setAttribute("stroke-width", "12");
  glow.setAttribute("stroke-linecap", "round");
  glow.setAttribute("stroke-linejoin", "round");

  const line = createSvgElement("path");
  line.setAttribute("d", pathData);
  line.setAttribute("fill", "none");
  const lineColor = cssVar("--color-chart-accent-primary");
  line.setAttribute("stroke", lineColor);
  line.setAttribute("stroke-width", "5");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");

  const hoverLine = createSvgElement("line");
  hoverLine.setAttribute("y1", plotTop);
  hoverLine.setAttribute("y2", baselineY);
  const hoverLineColor = cssVar("--color-border-neutral");
  hoverLine.setAttribute("stroke", hoverLineColor);
  hoverLine.setAttribute("stroke-width", "1");
  hoverLine.setAttribute("stroke-dasharray", "4 6");
  hoverLine.style.opacity = "0";

  const hoverDot = createSvgElement("circle");
  hoverDot.setAttribute("r", "4");
  hoverDot.setAttribute("fill", lineColor);
  hoverDot.setAttribute("stroke", glowColor);
  hoverDot.setAttribute("stroke-width", "3");
  hoverDot.style.opacity = "0";

  const overlay = createSvgElement("rect");
  overlay.setAttribute("x", paddingX);
  overlay.setAttribute("y", plotTop);
  overlay.setAttribute("width", width - paddingX * 2);
  overlay.setAttribute("height", plotHeight);
  overlay.setAttribute("fill", "transparent");

  const labelGroup = createSvgElement("g");
  const labelY = baselineY + 12;
  const labelFontSize = "11";

  const formatLabelDate = (index) => {
    const rawDate = series[index]?.date;
    if (!rawDate) {
      return "";
    }
    const date = new Date(`${rawDate}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) {
      return rawDate;
    }
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const labelIndices = getLabelIndices(values.length);
  labelIndices.forEach((index) => {
    const point = points[index];
    if (!point) {
      return;
    }
    const minLabelX = labelPaddingX;
    const maxLabelX = width - labelPaddingX;
    const labelX = Math.min(Math.max(point.x, minLabelX), maxLabelX);
    const label = createSvgElement("text");
    label.setAttribute("x", point.x);
    label.setAttribute("y", labelY);
    const labelColor = cssVar("--color-text-subtle");
    label.setAttribute("fill", labelColor);
    label.setAttribute("font-size", labelFontSize);
    if (index === 0) {
      label.setAttribute("text-anchor", "start");
    } else if (index === points.length - 1) {
      label.setAttribute("text-anchor", "end");
    } else {
      label.setAttribute("text-anchor", "middle");
    }
    label.textContent = formatLabelDate(index);
    labelGroup.appendChild(label);
  });

  const tooltip = document.createElement("div");
  tooltip.textContent = "";
  tooltip.style.position = "absolute";
  tooltip.style.top = "0";
  tooltip.style.left = "0";
  tooltip.style.padding = "6px 10px";
  tooltip.style.borderRadius = "999px";
  const tooltipBackground = cssVar("--color-bg-surface");
  const tooltipColor = cssVar("--color-text-primary");
  tooltip.style.background = tooltipBackground;
  tooltip.style.color = tooltipColor;
  tooltip.style.fontSize = "0.8rem";
  tooltip.style.whiteSpace = "nowrap";
  tooltip.style.pointerEvents = "none";
  tooltip.style.opacity = "0";
  tooltip.style.transition = "opacity 0.1s ease";

  container.innerHTML = "";
  container.style.position = "relative";
  container.appendChild(tooltip);
  svg.appendChild(baseline);
  svg.appendChild(glow);
  svg.appendChild(line);
  svg.appendChild(labelGroup);
  svg.appendChild(hoverLine);
  svg.appendChild(hoverDot);
  svg.appendChild(overlay);
  container.appendChild(svg);

  const updateHover = (clientX) => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width) {
      return;
    }
    const relativeX = ((clientX - rect.left) / rect.width) * width;
    const clampedX = Math.min(Math.max(relativeX, paddingX), width - paddingX);
    const index = Math.min(
      points.length - 1,
      Math.max(0, Math.round((clampedX - paddingX) / stepX))
    );
    const point = points[index];
    const value = values[index];
    if (!point) {
      return;
    }
    hoverLine.setAttribute("x1", point.x);
    hoverLine.setAttribute("x2", point.x);
    hoverDot.setAttribute("cx", point.x);
    hoverDot.setAttribute("cy", point.y);
    hoverLine.style.opacity = "1";
    hoverDot.style.opacity = "1";

    tooltip.textContent = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    tooltip.style.opacity = "1";
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    const xPx = (point.x / width) * rect.width;
    const yPx = (point.y / height) * rect.height;
    const clampedLeft = Math.min(
      Math.max(xPx - tooltipWidth / 2, 0),
      rect.width - tooltipWidth
    );
    const offsetY = 12;
    const clampedTop = Math.min(
      Math.max(yPx - tooltipHeight - offsetY, 0),
      rect.height - tooltipHeight
    );
    tooltip.style.left = `${clampedLeft}px`;
    tooltip.style.top = `${clampedTop}px`;
  };

  overlay.addEventListener("mousemove", (event) => {
    updateHover(event.clientX);
  });

  overlay.addEventListener("mouseleave", () => {
    hoverLine.style.opacity = "0";
    hoverDot.style.opacity = "0";
    tooltip.style.opacity = "0";
  });
};
