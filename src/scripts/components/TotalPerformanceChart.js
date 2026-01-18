import { loadAccountAssetsDaily } from "../data/loadAccountAssetsDaily.js";
import { deriveDailyTotalUSD, applyTimeframe } from "../utils/assetSummaryData.js";

document.addEventListener("DOMContentLoaded", async () => {
  const container = document.querySelector(".chart-placeholder");
  if (!container) return;

  // STEP 1: load & derive
  const accountAssetDaily = await loadAccountAssetsDaily();
  const derived = deriveDailyTotalUSD(accountAssetDaily);

  // STEP 2: clear placeholder
  container.innerHTML = "";

  // STEP 3: render chart (7D default)
  const data = applyTimeframe(derived, "7D");
  renderChart(container, data);
});
