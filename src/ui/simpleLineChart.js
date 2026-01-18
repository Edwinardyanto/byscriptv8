const getChartColors = (container) => {
  if (!container || typeof window === "undefined") {
    return {
      stroke: "#66ff33",
      fill: "rgba(102, 255, 51, 0.15)",
      grid: "rgba(255, 255, 255, 0.1)",
    };
  }
  const styles = getComputedStyle(container);
  const stroke = styles.getPropertyValue("--color-chart-accent-primary").trim() || "#66ff33";
  const fill = styles.getPropertyValue("--color-chart-fill-strong").trim() || "rgba(102, 255, 51, 0.15)";
  const grid = styles.getPropertyValue("--color-chart-muted").trim() || "rgba(255, 255, 255, 0.1)";
  return { stroke, fill, grid };
};

const ensureSeries = (series) => {
  if (Array.isArray(series) && series.length > 0) {
    return series;
  }
  return [
    { date: "", value: 0 },
    { date: "", value: 0 },
  ];
};

export const renderSimpleLineChart = (containerElement, series) => {
  if (!containerElement) {
    return;
  }

  const safeSeries = ensureSeries(series);
  const values = safeSeries.map((point) => Number(point.value || 0));
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const width = 600;
  const height = 220;
  const padding = 16;
  const drawableWidth = width - padding * 2;
  const drawableHeight = height - padding * 2;

  const points = safeSeries.map((point, index) => {
    const ratio = safeSeries.length === 1 ? 0 : index / (safeSeries.length - 1);
    const x = padding + ratio * drawableWidth;
    const normalized = (Number(point.value || 0) - minValue) / range;
    const y = padding + (1 - normalized) * drawableHeight;
    return { x, y };
  });

  if (points.length === 1) {
    points.push({ x: width - padding, y: points[0].y });
  }

  const { stroke, fill, grid } = getChartColors(containerElement);
  const svgNS = "http://www.w3.org/2000/svg";

  containerElement.innerHTML = "";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("preserveAspectRatio", "none");

  const gridLine = document.createElementNS(svgNS, "line");
  gridLine.setAttribute("x1", padding);
  gridLine.setAttribute("x2", width - padding);
  gridLine.setAttribute("y1", height - padding);
  gridLine.setAttribute("y2", height - padding);
  gridLine.setAttribute("stroke", grid);
  gridLine.setAttribute("stroke-width", "1");
  svg.appendChild(gridLine);

  const area = document.createElementNS(svgNS, "path");
  const areaPath = [
    `M ${points[0].x} ${height - padding}`,
    ...points.map((point) => `L ${point.x} ${point.y}`),
    `L ${points[points.length - 1].x} ${height - padding}`,
    "Z",
  ].join(" ");
  area.setAttribute("d", areaPath);
  area.setAttribute("fill", fill);
  svg.appendChild(area);

  const polyline = document.createElementNS(svgNS, "polyline");
  polyline.setAttribute(
    "points",
    points.map((point) => `${point.x},${point.y}`).join(" ")
  );
  polyline.setAttribute("fill", "none");
  polyline.setAttribute("stroke", stroke);
  polyline.setAttribute("stroke-width", "2");
  polyline.setAttribute("stroke-linejoin", "round");
  polyline.setAttribute("stroke-linecap", "round");
  svg.appendChild(polyline);

  containerElement.appendChild(svg);
};
