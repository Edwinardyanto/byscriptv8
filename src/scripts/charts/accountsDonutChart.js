// src/scripts/charts/accountsDonutChart.js

export const renderAccountsDonutChart = ({ container, accounts }) => {
  if (!container || !accounts?.length) return;

  container.innerHTML = "";
  container.style.position = "relative";

  const total = accounts.reduce((sum, a) => sum + a.totalValueUsd, 0);
  if (!total) return;

  /* =========================
     SVG Setup
  ========================= */

  const size = 180;
  const radius = 70;
  const stroke = 18;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);

  // rotate so start from top
  svg.style.transform = "rotate(-90deg)";

  container.appendChild(svg);

  /* =========================
     Center Hover Label
  ========================= */

  const centerLabel = document.createElement("div");
  centerLabel.className = "donut-center-label";
  container.appendChild(centerLabel);

  /* =========================
     Donut Slices (Circle Stroke)
  ========================= */

  let offset = 0;

  accounts.forEach((acc, i) => {
    const portion = acc.totalValueUsd / total;
    const dash = portion * circumference;

    const circle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle"
    );

    circle.setAttribute("cx", center);
    circle.setAttribute("cy", center);
    circle.setAttribute("r", radius);

    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke-width", stroke);

    circle.setAttribute(
      "stroke-dasharray",
      `${dash} ${circumference - dash}`
    );

    circle.setAttribute("stroke-dashoffset", -offset);

    // color variation
    circle.setAttribute("stroke", `hsl(${i * 55},90%,55%)`);
    circle.style.cursor = "pointer";

    // Hover label
    circle.addEventListener("mouseenter", () => {
      centerLabel.innerHTML = `
        <div class="donut-name">${acc.account_name}</div>
        <div class="donut-value">
          $${acc.totalValueUsd.toLocaleString()}
        </div>
      `;
    });

    circle.addEventListener("mouseleave", () => {
      centerLabel.innerHTML = "";
    });

    svg.appendChild(circle);

    offset += dash;
  });
};
