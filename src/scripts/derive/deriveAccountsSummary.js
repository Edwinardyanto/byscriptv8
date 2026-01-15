export function deriveAccountsSummary(trades, accounts) {
  return accounts.map((acc) => {
    const accTrades = trades.filter((t) => t.account_id === acc.account_id);
    return {
      account_id: acc.account_id,
      value: accTrades.length > 0 ? 1 : 0,
    };
  });
}
