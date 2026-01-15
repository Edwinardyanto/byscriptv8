export function deriveTradeHistory(trades) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return [];
  }

  return trades.slice(0, 10).map((t) => ({
    pair: t.asset_id,
    action: t.side,
    status: "executed",
    profit: 0,
    time: t.executed_at,
  }));
}
