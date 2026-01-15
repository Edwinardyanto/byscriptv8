const formatTimeAgo = (timestamp) => {
  if (!timestamp) {
    return "-";
  }

  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const now = Date.now();
  const diffMs = Math.max(now - date.getTime(), 0);
  const minutes = Math.floor(diffMs / (1000 * 60));
  if (minutes < 60) {
    return `${minutes || 1}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export function adaptTradeHistoryForUI(trades) {
  return trades.slice(0, 8).map((t) => ({
    pair: t.asset_id || "-",
    action: t.side?.toUpperCase() || "-",
    status: "EXECUTED",
    profit: "-",
    time: formatTimeAgo(t.executed_at),
  }));
}

export function adaptAccountsSummary(accounts, trades) {
  return accounts.map((acc) => ({
    name: acc.exchange || acc.account_id,
    value: `$${trades.filter((t) => t.account_id === acc.account_id).length}`,
  }));
}

export function adaptTopAutotraders(autotraders) {
  return autotraders.slice(0, 3).map((a) => ({
    name: a.name || "Autotrader",
    pair: a.pair || "-",
    status: "LIVE",
    performance: "+--%",
  }));
}
