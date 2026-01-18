import { loadAccountAssetsDaily } from "../data/loadAccountAssetsDaily.js";
import { deriveDailyTotalUSD, applyTimeframe } from "../utils/assetSummaryData.js";

export async function renderTotalPerformanceChart() {
  const container = document.querySelector(".chart-placeholder");
  if (!container) return;

  container.innerText = "Loading chart...";

  const accountAssetDaily = await loadAccountAssetsDaily();
  const derived = deriveDailyTotalUSD(accountAssetDaily);
  const data = applyTimeframe(derived, "7D");

  container.innerHTML = "";

  // TEMP VISUAL (bukti render jalan)
  const ul = document.createElement("ul");
  ul.style.color = "#68FE1D";
  ul.style.fontSize = "12px";

  data.forEach(d => {
    const li = document.createElement("li");
    li.textContent = `${d.date}: $${d.total_usd}`;
    ul.appendChild(li);
  });

  container.appendChild(ul);
}
