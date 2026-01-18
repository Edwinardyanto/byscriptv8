import { renderAssetLineChart } from "../charts/assetLineChart.js";
import { loadAccountAssetsDaily } from "../data/loadAccountAssetsDaily.js";
import { applyTimeframe, deriveDailyTotalUSD } from "../utils/assetSummaryData.js";

const RANGE_LABELS = ["7D", "30D", "90D", "ALL"];

let __accountAssetsDailyPromise = null;

const formatUSD0 = (value) => {
  const n = typeof value === "number" ? value : Number(value) || 0;
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
};

const formatPct1 = (value) => {
  const n = typeof value === "number" ? value : Number(value) || 0;
  const sign = n > 0 ? "+" : n < 0 ? "" : "";
  return `${sign}${n.toFixed(1)}%`;
};

const computeChangePct = (series) => {
  if (!Array.isArray(series) || series.length < 2) return 0;
  const first = Number(series[0]?.total_usd) || 0;
  const last = Number(series[series.length - 1]?.total_usd) || 0;
  if (!first) return 0;
  return ((last - first) / first) * 100;
};

const ensureShell = (container) => {
  if (container.__byscriptAssetSummaryReady) return;

  container.innerHTML = `
    <div class="asset-summary-bg"></div>
    <div class="asset-summary-content">
      <div class="card card--summary">
        <div class="summary-top">
          <div class="asset-summary-header">
            <div class="stat">
              <div class="stat-label">Asset Summary</div>
              <div class="stat-value-row">
                <div class="stat-value" data-field="asset.totalBalance">--</div>
                <div class="badge badge--success" data-field="asset.change">--</div>
              </div>
              <div class="stat-caption" data-field="asset.changeLabel">--</div>
            </div>

            <div class="timeframe-pills" aria-label="Asset summary timeframe">
              ${RANGE_LABELS.map((r) => `<span class="timeframe-pill" data-range="${r}">${r === "ALL" ? "All" : r}</span>`).join("")}
            </div>
          </div>
        </div>

        <div class="chart-placeholder" data-field="asset.chartLabel">Loading chart...</div>
      </div>
    </div>
  `;

  container.__byscriptAssetSummaryReady = true;
};

const setText = (container, selector, value) => {
  const el = container.querySelector(selector);
  if (el) el.textContent = value;
};

const setActiveRange = (container, activeRange) => {
  const pills = container.querySelectorAll(".timeframe-pill");
  const activeLabel = activeRange === "ALL" ? "All" : activeRange;
  pills.forEach((pill) => {
    const isActive = pill.textContent.trim() === activeLabel;
    pill.classList.toggle("timeframe-pill--active", isActive);
  });
};

const bindPillsOnce = (container, onRangeChange) => {
  if (container.__byscriptAssetSummaryBound) return;

  container.addEventListener("click", (e) => {
    const pill = e.target?.closest?.(".timeframe-pill");
    if (!pill) return;
    const range = pill.getAttribute("data-range");
    if (!range) return;
    onRangeChange?.(range);
  });

  container.__byscriptAssetSummaryBound = true;
};

const getAccountAssetsDaily = async () => {
  if (!__accountAssetsDailyPromise) {
    __accountAssetsDailyPromise = loadAccountAssetsDaily();
  }
  return __accountAssetsDailyPromise;
};

export async function renderTotalPerformanceChart({
  container,
  data,
  status,
  onRangeChange,
}) {
  if (!container) return;

  ensureShell(container);
  bindPillsOnce(container, onRangeChange);

  const activeRange = data?.activeRange || "7D";
  setActiveRange(container, activeRange);

  const chartHost = container.querySelector('[data-field="asset.chartLabel"]');

  if (status === "loading") {
    setText(container, '[data-field="asset.totalBalance"]', "Loading...");
    setText(container, '[data-field="asset.change"]', "--");
    setText(container, '[data-field="asset.changeLabel"]', "Loading...");
    if (chartHost) chartHost.textContent = "Loading chart...";
    return;
  }

  if (status === "error") {
    setText(container, '[data-field="asset.totalBalance"]', "--");
    setText(container, '[data-field="asset.change"]', "--");
    setText(container, '[data-field="asset.changeLabel"]', "Unable to load");
    if (chartHost) chartHost.textContent = "Chart unavailable";
    return;
  }

  try {
    // Source of truth: account_assets_daily
    const days = await getAccountAssetsDaily();
    const derived = deriveDailyTotalUSD(days);
    const filtered = applyTimeframe(derived, activeRange);

    if (!filtered.length) {
      setText(container, '[data-field="asset.totalBalance"]', "--");
      setText(container, '[data-field="asset.change"]', "--");
      setText(container, '[data-field="asset.changeLabel"]', "No data");
      if (chartHost) chartHost.textContent = "No chart data";
      return;
    }

    const last = filtered[filtered.length - 1];
    const total = Number(last.total_usd) || 0;
    const changePct = computeChangePct(filtered);

    setText(container, '[data-field="asset.totalBalance"]', formatUSD0(total));
    setText(container, '[data-field="asset.change"]', formatPct1(changePct));

    const label =
      activeRange === "ALL"
        ? "vs inception"
        : `vs last ${activeRange.replace("D", "")} days`;
    setText(container, '[data-field="asset.changeLabel"]', label);

    if (chartHost) {
      chartHost.innerHTML = "";
      renderAssetLineChart(chartHost, filtered);
    }
  } catch (err) {
    // Fail-safe UI
    setText(container, '[data-field="asset.totalBalance"]', "--");
    setText(container, '[data-field="asset.change"]', "--");
    setText(container, '[data-field="asset.changeLabel"]', "Unable to load");
    if (chartHost) chartHost.textContent = "Chart unavailable";

    // eslint-disable-next-line no-console
    console.error("Asset summary chart error:", err);
  }
}
