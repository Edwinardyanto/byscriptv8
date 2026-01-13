const setListMessage = (list, message) => {
  if (!list) {
    return;
  }
  list.innerHTML = "";
  const item = document.createElement("div");
  item.className = "autotrader-card";
  item.textContent = message;
  list.appendChild(item);
};

export const renderTopAutotraders = (sectionState) => {
  const { data, status } = sectionState;
  const list = document.querySelector('[data-list="topAutotraders"]');

  if (status === "loading") {
    setListMessage(list, "Loading autotraders...");
    return;
  }

  if (status === "error") {
    setListMessage(list, "Unable to load autotraders");
    return;
  }

  if (!data || data.length === 0) {
    setListMessage(list, "No autotraders available");
    return;
  }

  list.innerHTML = "";
  data.forEach((trader) => {
    const card = document.createElement("div");
    card.className = "autotrader-card";
    card.innerHTML = `
      <div class="autotrader-header">
        <div class="autotrader-identity">
          <span class="autotrader-avatar" aria-hidden="true"></span>
          <div class="autotrader-name-group">
            <span class="autotrader-name">${trader.name}</span>
            <span class="autotrader-status">LIVE</span>
          </div>
        </div>
        <span class="autotrader-pnl">${trader.pnl}</span>
      </div>
      <div class="autotrader-meta">
        <span class="autotrader-pair">${trader.pair}</span>
        <span class="autotrader-runtime">${trader.runtime}</span>
      </div>
      <div class="autotrader-footer">
        <button class="button" type="button">View Autotrader</button>
      </div>
    `;
    list.appendChild(card);
  });
};
