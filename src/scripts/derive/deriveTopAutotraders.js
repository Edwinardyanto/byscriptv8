export function deriveTopAutotraders(trades, autotraders) {
  if (!Array.isArray(autotraders) || autotraders.length === 0) {
    return [];
  }

  const tradesByAutotrader = new Map();
  if (Array.isArray(trades)) {
    trades.forEach((trade) => {
      if (!tradesByAutotrader.has(trade.autotrader_id)) {
        tradesByAutotrader.set(trade.autotrader_id, trade);
      }
    });
  }

  const now = Date.now();

  return autotraders
    .map((autotrader) => {
      const trade = tradesByAutotrader.get(autotrader.autotrader_id);
      const assetLabel = trade?.asset_id || "asset";
      const runtimeMs = Math.max(now - new Date(autotrader.created_at).getTime(), 0);
      const runtimeDays = Math.floor(runtimeMs / (1000 * 60 * 60 * 24));
      const runtimeHours = Math.floor((runtimeMs / (1000 * 60 * 60)) % 24);
      const runtimeLabel = `${autotrader.is_running ? "Running" : "Stopped"} ${runtimeDays}d ${runtimeHours}h`;
      const pnlValue = Number(autotrader.pnl_percent || 0);
      const pnlPrefix = pnlValue > 0 ? "+" : pnlValue < 0 ? "-" : "";

      return {
        name: autotrader.tradingPlanName || autotrader.name || "Autotrader",
        pair: `${assetLabel} / USDT`,
        runtime: runtimeLabel,
        pnl: `${pnlPrefix}${Math.abs(pnlValue).toFixed(1)}%`,
        sortKey: Math.abs(pnlValue),
      };
    })
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, 3)
    .map(({ sortKey, ...rest }) => rest);
}
