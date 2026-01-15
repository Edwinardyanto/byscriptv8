export function deriveTradeHistory(trades) {
  return trades
    .filter((t) => t.reduce_only === true)
    .slice(0, 10)
    .map((t) => ({
      pair: t.asset_id,
      action: t.side,
      status: "executed",
      profit: 0,
      time: t.executed_at,
    }));
}
