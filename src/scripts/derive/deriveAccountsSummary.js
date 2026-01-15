export function deriveAccountsSummary(trades, accounts) {
  if (!Array.isArray(accounts) || accounts.length === 0) {
    return [];
  }

  return accounts.map((acc) => {
    const accTrades = Array.isArray(trades)
      ? trades.filter((t) => t.account_id === acc.account_id)
      : [];
    return {
      account_id: acc.account_id,
      value: accTrades.length > 0 ? 1 : 0,
    };
  });
}
