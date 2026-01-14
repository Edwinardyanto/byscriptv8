import {
  getAccounts,
  getAutotradersByAccount,
  getTradeHistory,
} from "../dataAccess.js";
import { renderTotalPerformanceChart } from "../components/TotalPerformanceChart.js";

const PAGE_CLASS = "page-autotraders";
const PAGE_SIZE = 10;

const buildSeries = (points, start, end) => {
  const trend = (end - start) / Math.max(points - 1, 1);
  return Array.from({ length: points }, (_, index) => {
    const base = start + trend * index;
    const variance = Math.sin(index / 4) * 90 + Math.sin(index / 12) * 45;
    return Math.round(base + variance);
  });
};

const formatCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const getRangeStart = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);

const getRangeKey = (range) => (range === "all" ? "All" : range);

const computeMetrics = (trades, autotraders, days) => {
  const filteredTrades = days
    ? trades.filter((trade) => trade.executed_at_date >= getRangeStart(days))
    : trades;
  const pnl = filteredTrades.reduce((sum, trade) => sum + Number(trade.pnl_usd || 0), 0);
  const volume = filteredTrades.reduce((sum, trade) => sum + Number(trade.value_usd || 0), 0);
  const win = filteredTrades.filter((trade) => trade.result === "win").length;
  const totalTrades = filteredTrades.length;
  const lossCount = totalTrades - win;
  const capital = autotraders.reduce((sum, bot) => sum + Number(bot.capital || 0), 0);
  const profit = filteredTrades
    .filter((trade) => Number(trade.pnl_usd || 0) > 0)
    .reduce((sum, trade) => sum + Number(trade.pnl_usd || 0), 0);
  const loss = filteredTrades
    .filter((trade) => Number(trade.pnl_usd || 0) < 0)
    .reduce((sum, trade) => sum + Math.abs(Number(trade.pnl_usd || 0)), 0);
  const active = autotraders.filter((bot) => bot.status === "ACTIVE").length;
  const stopped = autotraders.length - active;

  return {
    pnl,
    pnlPct: capital ? (pnl / capital) * 100 : 0,
    volume,
    trades: { total: totalTrades, win, loss: lossCount },
    capital,
    profit,
    loss,
    autotraders: { active, stopped },
  };
};

const buildAutotradersMetrics = (trades, autotraders) => ({
  "7D": {
    chart: buildSeries(7, 120, 190),
    metrics: computeMetrics(trades, autotraders, 7),
  },
  "30D": {
    chart: buildSeries(30, 90, 240),
    metrics: computeMetrics(trades, autotraders, 30),
  },
  "90D": {
    chart: buildSeries(90, 60, 300),
    metrics: computeMetrics(trades, autotraders, 90),
  },
  All: {
    chart: buildSeries(120, 80, 360),
    metrics: computeMetrics(trades, autotraders, null),
  },
});

const buildAutotradersList = async () => {
  const accounts = await getAccounts();
  const trades = await getTradeHistory();
  const latestTradeByAutotrader = new Map();
  trades.forEach((trade) => {
    if (!latestTradeByAutotrader.has(trade.autotrader_id)) {
      latestTradeByAutotrader.set(trade.autotrader_id, trade);
    }
  });

  const dataAutotraders = (
    await Promise.all(accounts.map((account) => getAutotradersByAccount(account.account_id)))
  ).flat();

  const normalized = dataAutotraders.map((autotrader) => {
    const trade = latestTradeByAutotrader.get(autotrader.autotrader_id);
    const assetSymbol = trade?.asset?.symbol || "BTC";
    const account = accounts.find((entry) => entry.account_id === autotrader.account_id);
    return {
      id: autotrader.autotrader_id,
      name: autotrader.plan?.name || autotrader.autotrader_id,
      pair: `${assetSymbol}_USDT`,
      exchange: account?.provider || "Exchange",
      capital: Number(autotrader.capital_usd || 0),
      pnl: Number(autotrader.pnl_usd || 0),
      winRate: Number(autotrader.win_rate || 0),
      running: autotrader.is_running ? 1 : 0,
      status: autotrader.is_running ? "ACTIVE" : "STOPPED",
    };
  });

  const storedAutotraders = JSON.parse(
    localStorage.getItem("byscript_custom_autotraders") || "[]"
  );

  return {
    trades,
    autotraders: [...storedAutotraders, ...normalized],
  };
};

const initAutotradersPage = async () => {
  if (!document.body.classList.contains(PAGE_CLASS)) {
    return;
  }

  const performanceContainer = document.querySelector(
    ".page-autotraders [data-total-performance=\"autotraders\"]"
  );
  const { trades, autotraders } = await buildAutotradersList();
  const autotradersData = buildAutotradersMetrics(trades, autotraders);

  const autotradersPerformance = {
    totalBalance: "",
    change: "",
    changeLabel: "",
    chart: {
      activeRange: "7D",
      fullSeries: autotradersData.All.chart,
      ranges: {
        "7D": autotradersData["7D"].chart,
        "30D": autotradersData["30D"].chart,
        "90D": autotradersData["90D"].chart,
      },
    },
  };

  let currentPage = 1;

  const updatePerformanceSummary = (range) => {
    const rangeKey = getRangeKey(range);
    const metrics = autotradersData[rangeKey]?.metrics;
    if (!metrics) {
      return;
    }
    const pnlPctValue = Number(metrics.pnlPct);
    const pnlPctSign = pnlPctValue > 0 ? "+" : pnlPctValue < 0 ? "-" : "";
    const pnlValue = Number(metrics.pnl || 0);
    const pnlSign = pnlValue > 0 ? "+" : pnlValue < 0 ? "-" : "";

    autotradersPerformance.totalBalance = `${pnlSign}${formatCurrency.format(
      Math.abs(pnlValue)
    )}`;
    autotradersPerformance.change = `${pnlPctSign}${Math.abs(pnlPctValue).toFixed(1)}%`;
    autotradersPerformance.changeLabel =
      rangeKey === "All" ? "vs all time" : `vs last ${rangeKey.toLowerCase()}`;
    autotradersPerformance.chart.activeRange = range;
  };

  const renderAutotradersPerformance = () => {
    if (!performanceContainer) {
      return;
    }
    renderTotalPerformanceChart({
      container: performanceContainer,
      dataSource: "autotraders",
      data: autotradersPerformance,
      status: "ready",
      onRangeChange: handleRangeChange,
      timeframeContainer: document.querySelector(
        ".autotraders-performance .section-header .timeframe-pills"
      ),
    });
  };

  const renderRow = (row) => {
    const pnlClass = row.pnl < 0 ? "pnl-negative" : "pnl-positive";
    const statusClass = row.status === "ACTIVE" ? "active" : "stopped";
    const actionLabel = row.status === "ACTIVE" ? "Stop" : "Start";
    return `
      <tr>
        <td><span class="status-pill ${statusClass}">${row.status}</span></td>
        <td class="col-trading-plan"><span class="trading-plan-name">${row.name}</span></td>
        <td>${row.pair}</td>
        <td>${row.exchange}</td>
        <td>${formatCurrency.format(row.capital)}</td>
        <td class="${pnlClass}">${row.pnl < 0 ? "-" : "+"}${formatCurrency.format(
      Math.abs(row.pnl)
    )}</td>
        <td>${row.winRate}%</td>
        <td>${row.running}</td>
        <td><button class="table-action action-btn" type="button" data-id="${row.id}">${actionLabel}</button></td>
        <td><button class="table-action detail-btn" type="button" data-id="${row.id}">View</button></td>
      </tr>
    `;
  };

  const renderAutotradersPage = (page) => {
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const rows = autotraders.slice(start, end);

    const tbody = document.querySelector("#autotraders-tbody");
    if (!tbody) {
      return;
    }
    tbody.innerHTML = "";

    rows.forEach((row) => {
      tbody.insertAdjacentHTML("beforeend", renderRow(row));
    });
  };

  const updateGlobalMetrics = (range) => {
    const rangeKey = getRangeKey(range);
    const metrics = autotradersData[rangeKey]?.metrics;
    if (!metrics) {
      return;
    }
    const profitFactor = metrics.loss ? (metrics.profit / metrics.loss).toFixed(1) : "0.0";
    const profitFactorEl = document.querySelector("#metric-profit-factor");
    const tradesEl = document.querySelector("#metric-trades");
    const volumeEl = document.querySelector("#metric-volume");
    if (profitFactorEl) {
      profitFactorEl.innerText = profitFactor;
    }
    if (tradesEl) {
      tradesEl.innerText = `${metrics.trades.total.toLocaleString()}`;
    }
    if (volumeEl) {
      volumeEl.innerText = formatCurrency.format(metrics.volume);
    }
    updateCapitalAllocation();
  };

  const updateCapitalAllocation = () => {
    const activeCapital = autotraders
      .filter((bot) => bot.status === "ACTIVE")
      .reduce((sum, bot) => sum + bot.capital, 0);
    const liveCapitalEl = document.querySelector("#live-capital-value");
    if (liveCapitalEl) {
      liveCapitalEl.innerText = formatCurrency.format(activeCapital);
    }
  };

  const computeLiveAutotraders = () => {
    const active = autotraders.filter((bot) => bot.status === "ACTIVE").length;
    const stopped = autotraders.filter((bot) => bot.status === "STOPPED").length;
    return { total: autotraders.length, active, stopped };
  };

  const updateLiveAutotraders = () => {
    const live = computeLiveAutotraders();
    const totalEl = document.querySelector("#live-autotraders-total");
    const activeEl = document.querySelector("#live-autotraders-active");
    const stoppedEl = document.querySelector("#live-autotraders-stopped");
    if (totalEl) {
      totalEl.innerText = live.total;
    }
    if (activeEl) {
      activeEl.innerText = live.active;
    }
    if (stoppedEl) {
      stoppedEl.innerText = live.stopped;
    }
  };

  function handleRangeChange(range) {
    updatePerformanceSummary(range);
    updateGlobalMetrics(range);
    renderAutotradersPerformance();
  }

  document.querySelectorAll(".pagination-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentPage = Number(btn.dataset.page);
      renderAutotradersPage(currentPage);

      document.querySelectorAll(".pagination-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    if (target.classList.contains("detail-btn")) {
      const id = target.dataset.id;
      if (!id) {
        return;
      }
      window.location.href = `autotraders/detail.html?id=${id}`;
      return;
    }

    if (!target.classList.contains("action-btn")) {
      return;
    }

    const id = target.dataset.id;
    const bot = autotraders.find((entry) => entry.id === id);

    if (!bot) {
      return;
    }

    if (bot.status === "ACTIVE") {
      bot.status = "STOPPED";
      bot.running = 0;
    } else {
      bot.status = "ACTIVE";
      bot.running = 1;
    }

    renderAutotradersPage(currentPage);
    updateLiveAutotraders();
    updateCapitalAllocation();
  });

  updatePerformanceSummary("7D");
  updateGlobalMetrics("7D");
  renderAutotradersPerformance();
  renderAutotradersPage(currentPage);
  updateLiveAutotraders();
  updateCapitalAllocation();
};

initAutotradersPage();
