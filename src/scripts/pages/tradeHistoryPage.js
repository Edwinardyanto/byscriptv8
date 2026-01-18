import { getState } from "../state.js";
import { fetchDashboardData } from "../data.js";

const TRADE_HISTORY_PAGE = "page-trade-history";
const DUMMY_DATA_NOTE =
  "DEV ONLY: Trade History dummy data below. Remove for production.";

const formatNumber = (value, digits = 2) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const formatCompactNumber = (value, digits = 1) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const formatCurrency = (value, digits = 2) =>
  `$${formatNumber(Math.abs(value), digits)}`;

const formatTimestamp = (date) => {
  const datePart = date.toLocaleDateString("en-GB");
  const timePart = date.toLocaleTimeString("en-GB", { hour12: false });
  return { date: datePart, time: timePart };
};

const randBetween = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(randBetween(min, max + 1));
const pick = (items) => items[randInt(0, items.length - 1)];

const createDummyTrades = () => {
  // DEV ONLY: Dummy trade history generator. Remove when wiring real API data.
  const exchanges = [
    { name: "Binance", icon: "B" },
    { name: "OKX", icon: "O" },
    { name: "Bybit", icon: "Y" },
  ];
  const markets = ["Spot", "Futures"];
  const pairs = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "AVAXUSDT", "ADAUSDT"];
  const actions = [
    "Buy Long",
    "Sell Short",
    "Open Long",
    "Close Long",
    "Open Short",
    "Close Short",
    "Buy",
    "Sell",
  ];
  const statuses = ["Filled", "Cancelled", "Failed"];
  const planNames = ["GridBot 2.0", "PingPong Alpha", "Scalper Plan", "Trend Rider"];
  const accounts = ["Main Account", "Futures Desk", "Quant Lab"];

  const now = Date.now();
  return Array.from({ length: 100 }, (_, index) => {
    const exchange = pick(exchanges);
    const market = pick(markets);
    const pair = pick(pairs);
    const action = pick(actions);
    const status = pick(statuses);
    const basePrice = pair.startsWith("BTC")
      ? randBetween(64000, 72000)
      : pair.startsWith("ETH")
        ? randBetween(2800, 3800)
        : randBetween(0.25, 220);
    const quantity = pair.startsWith("BTC")
      ? randBetween(0.05, 0.6)
      : pair.startsWith("ETH")
        ? randBetween(0.5, 4)
        : randBetween(5, 450);
    const value = basePrice * quantity;
    const fee = value * randBetween(0.0002, 0.0008);
    const pnl = randBetween(-0.09, 0.12) * value;
    const timestamp = new Date(now - randInt(0, 1000 * 60 * 60 * 24 * 30));
    const { date, time } = formatTimestamp(timestamp);

    return {
      id: `${exchange.name}-${pair}-${timestamp.getTime()}-${index}`,
      time: { date, time, raw: timestamp },
      exchange: exchange.name,
      exchangeIcon: exchange.icon,
      market,
      pair,
      action,
      price: basePrice,
      quantity,
      value,
      fee,
      pnl,
      status,
      tradingPlan: pick(planNames),
      account: pick(accounts),
    };
  }).sort((a, b) => b.time.raw - a.time.raw);
};

const getTradeHistoryData = async () => {
  const state = getState();
  if (state?.data?.tradeHistoryPage?.length) {
    return state.data.tradeHistoryPage;
  }
  const data = await fetchDashboardData();
  return data?.tradeHistoryPage?.length ? data.tradeHistoryPage : createDummyTrades();
};

const initTradeHistoryPage = async () => {
  if (!document.body.classList.contains(TRADE_HISTORY_PAGE)) {
    return;
  }

  const tableBody = document.querySelector("[data-trade-history-rows]");
  const tableWrap = document.querySelector(".table-wrap");
  const tableHeader = document.querySelector(".trade-table thead");
  const tableFooter = document.querySelector(".table-footer");
  const filtersSection = document.querySelector(".trade-history-filters");
  const contentShell = document.querySelector(".content-shell");
  const dateRangeSelect = document.getElementById("trade-history-date-range");
  const exchangeSelect = document.getElementById("trade-history-exchange");
  const marketSelect = document.getElementById("trade-history-market");
  const pairSelect = document.getElementById("trade-history-pair");
  const sideSelect = document.getElementById("trade-history-side");
  const statusSelect = document.getElementById("trade-history-status");
  const filtersReset = document.getElementById("trade-history-filters-reset");
  const rowsSelect = document.getElementById("trade-history-rows");
  const pagination = document.querySelector("[data-trade-history-pagination]");

  if (
    !tableBody ||
    !tableWrap ||
    !tableHeader ||
    !tableFooter ||
    !filtersSection ||
    !contentShell ||
    !dateRangeSelect ||
    !exchangeSelect ||
    !marketSelect ||
    !pairSelect ||
    !sideSelect ||
    !statusSelect ||
    !filtersReset ||
    !rowsSelect ||
    !pagination
  ) {
    return;
  }

  const updateTableLayout = () => {
    const contentStyles = window.getComputedStyle(contentShell);
    const contentGap = parseFloat(contentStyles.rowGap || contentStyles.gap) || 0;
    const availableHeight =
      contentShell.clientHeight -
      filtersSection.offsetHeight -
      contentGap -
      tableFooter.offsetHeight;
    const headerHeight = tableHeader.offsetHeight;
    const bodyMaxHeight = Math.max(availableHeight - headerHeight, 0);
    tableWrap.style.setProperty("--trade-history-table-head-height", `${headerHeight}px`);
    tableWrap.style.setProperty("--trade-history-body-max-height", `${bodyMaxHeight}px`);
    tableWrap.style.setProperty(
      "--trade-history-table-max-height",
      `${Math.max(bodyMaxHeight + headerHeight, 0)}px`
    );
  };

  const trades = await getTradeHistoryData();

  const state = {
    dateRange: "7d",
    exchange: "all",
    market: "all",
    pair: "all",
    side: "all",
    status: "all",
    rowsPerPage: 10,
    page: 1,
  };

  const pairs = Array.from(new Set(trades.map((trade) => trade.pair)));
  pairSelect.innerHTML = [
    `<option value="all" selected>All pairs</option>`,
    ...pairs.map((pair) => `<option value="${pair}">${pair}</option>`),
  ].join("");

  const renderRows = (items) => {
    tableBody.innerHTML = "";
    if (!items.length) {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td colspan="13">
          <span class="row-hint">No trades match these filters.</span>
        </td>
      `;
      tableBody.appendChild(row);
      return;
    }

    items.forEach((trade) => {
      const pnlClass =
        trade.pnl > 0 ? "positive" : trade.pnl < 0 ? "negative" : "";
      const pnlLabel =
        trade.pnl === 0
          ? "$0.00"
          : `${trade.pnl > 0 ? "+" : "-"}${formatCurrency(trade.pnl)}`;
      const statusClass = `status-pill--${trade.status.toLowerCase()}`;
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <strong>${trade.time.date}</strong><br />
          ${trade.time.time}
        </td>
        <td>
          <div class="exchange">
            <span class="exchange-icon">${trade.exchangeIcon}</span>
            ${trade.exchange}
          </div>
        </td>
        <td><span class="trade-pill">${trade.market}</span></td>
        <td><strong>${trade.pair}</strong></td>
        <td><span class="trade-pill ${pnlClass}">${trade.action}</span></td>
        <td class="numeric">${formatNumber(trade.price, 2)}</td>
        <td class="numeric">${formatNumber(trade.quantity, 3)}</td>
        <td class="numeric">${formatCurrency(trade.value, 2)}</td>
        <td class="numeric">${formatCompactNumber(trade.fee, 2)} USDT</td>
        <td class="numeric"><span class="trade-pill ${pnlClass}">${pnlLabel}</span></td>
        <td><span class="status-pill ${statusClass}">${trade.status}</span></td>
        <td class="wrap">${trade.tradingPlan}</td>
        <td class="wrap">${trade.account} <span class="row-hint">▾</span></td>
      `;
      tableBody.appendChild(row);
    });
  };

  const renderPagination = (totalPages) => {
    pagination.innerHTML = "";
    if (totalPages <= 1) {
      return;
    }
    for (let page = 1; page <= totalPages; page += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `page-button${page === state.page ? " is-active" : ""}`;
      button.textContent = String(page);
      button.addEventListener("click", () => {
        state.page = page;
        updateTable();
      });
      pagination.appendChild(button);
    }
  };

  const isWithinRange = (trade) => {
    const now = new Date();
    if (state.dateRange === "all") {
      return true;
    }
    const rangeDays = state.dateRange === "7d" ? 7 : state.dateRange === "30d" ? 30 : 90;
    const cutoff = new Date(now.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    return trade.time.raw >= cutoff;
  };

  const matchesSide = (trade) => {
    if (state.side === "all") {
      return true;
    }
    const normalized = trade.action.toLowerCase();
    return normalized.includes(state.side.toLowerCase());
  };

  const applyFilters = () =>
    trades.filter((trade) => {
      if (!isWithinRange(trade)) {
        return false;
      }
      if (state.exchange !== "all" && trade.exchange !== state.exchange) {
        return false;
      }
      if (state.market !== "all" && trade.market !== state.market) {
        return false;
      }
      if (state.pair !== "all" && trade.pair !== state.pair) {
        return false;
      }
      if (!matchesSide(trade)) {
        return false;
      }
      if (state.status !== "all" && trade.status !== state.status) {
        return false;
      }
      return true;
    });

  const updateTable = () => {
    const filtered = applyFilters();
    const totalPages = Math.max(1, Math.ceil(filtered.length / state.rowsPerPage));
    if (state.page > totalPages) {
      state.page = totalPages;
    }
    const start = (state.page - 1) * state.rowsPerPage;
    const paged = filtered.slice(start, start + state.rowsPerPage);
    renderRows(paged);
    renderPagination(totalPages);
  };

  const resetFilters = () => {
    state.dateRange = "7d";
    state.exchange = "all";
    state.market = "all";
    state.pair = "all";
    state.side = "all";
    state.status = "all";
    state.page = 1;
    dateRangeSelect.value = state.dateRange;
    exchangeSelect.value = state.exchange;
    marketSelect.value = state.market;
    pairSelect.value = state.pair;
    sideSelect.value = state.side;
    statusSelect.value = state.status;
  };

  dateRangeSelect.addEventListener("change", () => {
    state.dateRange = dateRangeSelect.value;
    state.page = 1;
    updateTable();
  });
  exchangeSelect.addEventListener("change", () => {
    state.exchange = exchangeSelect.value;
    state.page = 1;
    updateTable();
  });
  marketSelect.addEventListener("change", () => {
    state.market = marketSelect.value;
    state.page = 1;
    updateTable();
  });
  pairSelect.addEventListener("change", () => {
    state.pair = pairSelect.value;
    state.page = 1;
    updateTable();
  });
  sideSelect.addEventListener("change", () => {
    state.side = sideSelect.value;
    state.page = 1;
    updateTable();
  });
  statusSelect.addEventListener("change", () => {
    state.status = statusSelect.value;
    state.page = 1;
    updateTable();
  });
  rowsSelect.addEventListener("change", () => {
    state.rowsPerPage = Number(rowsSelect.value);
    state.page = 1;
    updateTable();
  });
  filtersReset.addEventListener("click", () => {
    resetFilters();
    updateTable();
  });

  rowsSelect.value = String(state.rowsPerPage);
  updateTable();
  updateTableLayout();

  window.addEventListener("resize", updateTableLayout);

  if (!document.querySelector("[data-trade-history-dummy-note]")) {
    const note = document.createElement("span");
    note.dataset.tradeHistoryDummyNote = "true";
    note.className = "row-hint";
    note.textContent = DUMMY_DATA_NOTE;
    note.style.display = "none";
    document.body.appendChild(note);
  }
};

initTradeHistoryPage();
