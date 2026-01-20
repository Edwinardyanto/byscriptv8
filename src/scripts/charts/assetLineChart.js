import { cssVar } from "./cssVar.js";

const createSvgElement = (tag) =>
  document.createElementNS("http://www.w3.org/2000/svg", tag);

const buildLabelIndices = (length, count) => {
  const indices = new Set();
  for (let i = 0; i < count; i++) {
    indices.add(Math.round((i * (length - 1)) / (count - 1)));
  }
  return [...indices].sort((a, b) => a - b);
};

const getLabelIndices = (length) => {
  if (length === 7) return [0, 3, 6];
  if (length === 30) return buildLabelIndices(length, 5);
  if (length === 90) return buildLabelIndices(length, 4);
  return buildLabelIndices(length, 3);
};

export const renderAssetLineChart = (container, series) => {
  if (!container || !Array.isArray(series) || !series.length) return;

  const values = series.map(Number);
  const dates = container.__assetChartDates || [];

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

  const svg = createSvgElement("svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.width = "100%";

  const path = createSvgElement("path");
  path.setAttribute(
    "d",
    points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ")
  );
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", cssVar("--color-chart-accent-primary"));
  path.setAttribute("stroke-width", "4");
  path.setAttribute("stroke-linecap", "round");

  const labelGroup = createSvgElement("g");
  const labelIndices = getLabelIndices(values.length);

  labelIndices.forEach((i) => {
    const date = dates[i];
    if (!date) return;

    const label = createSvgElement("text");
    label.setAttribute("x", points[i].x);
    label.setAttribute("y", baselineY + 16);
    label.setAttribute("fill", cssVar("--color-text-subtle"));
    label.setAttribute("font-size", "11");
    label.setAttribute("text-anchor", "middle");
    label.textContent = new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
    labelGroup.appendChild(label);
  });

  const tooltip = document.createElement("div");
  tooltip.style.position = "absolute";
  tooltip.style.opacity = "0";
  tooltip.style.pointerEvents = "none";
  tooltip.style.background = cssVar("--color-bg-surface");
  tooltip.style.color = cssVar("--color-text-primary");
  tooltip.style.padding = "6px 10px";
  tooltip.style.borderRadius = "999px";
  tooltip.style.fontSize = "0.8rem";

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

  const value = values[index];
  const dates = container.__assetChartDates;

  const dateText =
    Array.isArray(dates) && dates[index]
      ? new Date(dates[index]).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "";

  tooltip.innerHTML = `
    <strong>${value.toLocaleString(undefined, {
      maximumFractionDigits: 2,
    })}</strong><br/>
    <span style="opacity:.7">${dateText}</span>
  `;

  tooltip.style.opacity = "1";
  tooltip.style.left = `${points[index].x}px`;
  tooltip.style.top = `${points[index].y - 12}px`;
});


  overlay.addEventListener("mouseleave", () => {
    tooltip.style.opacity = "0";
  });

  container.innerHTML = "";
  container.style.position = "relative";
  container.appendChild(tooltip);
  svg.appendChild(path);
  svg.appendChild(labelGroup);
  svg.appendChild(overlay);
  container.appendChild(svg);
};
