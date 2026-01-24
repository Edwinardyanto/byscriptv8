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
  const stroke = 16;
  const center = size / 2;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);

  container.appendChild(svg);

  /* =========================
     Center Hover Label
  ========================= */

  const centerLabel = document.createElement("div");
  centerLabel.className = "donut-center-label";
  container.appendChild(centerLabel);

  /* =========================
     Donut Slices
  ========================= */

  let angleStart = 0;

  accounts.forEach((acc, i) => {
    const portion = acc.totalValueUsd / total;
    const angle = portion * Math.PI * 2;
    const angleEnd = angleStart + angle;

    const x1 = center + radius * Math.cos(angleStart);
    const y1 = center + radius * Math.sin(angleStart);

    const x2 = center + radius * Math.cos(angleEnd);
    const y2 = center + radius * Math.sin(angleEnd);

    const largeArc = angle > Math.PI ? 1 : 0;

    const pathData = `
      M ${x1} ${y1}
      A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}
    `;

    const path = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );

    path.setAttribute("d", pathData);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-width", stroke);
    path.setAttribute("stroke-linecap", "round");

    // simple rotating color variation
    path.setAttribute("stroke", `hsl(${i * 55},90%,55%)`);

    // Hover display
    path.addEventListener("mouseenter", () => {
      centerLabel.innerHTML = `
        <div class="donut-name">${acc.account_name}</div>
        <div class="donut-value">
          $${acc.totalValueUsd.toLocaleString()}
        </div>
      `;
    });

    path.addEventListener("mouseleave", () => {
      centerLabel.innerHTML = "";
    });

    svg.appendChild(path);

    angleStart = angleEnd;
  });
};
