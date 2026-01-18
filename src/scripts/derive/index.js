import { deriveTradeHistory } from "./deriveTradeHistory.js";
import { deriveAccountsSummary } from "./deriveAccountsSummary.js";
import { deriveTopAutotraders } from "./deriveTopAutotraders.js";

export function deriveDashboardData(trades, accounts, autotraders) {
  return {
    tradeHistory: deriveTradeHistory(trades),
    accountsSummary: deriveAccountsSummary(trades, accounts),
    topAutotraders: deriveTopAutotraders(trades, autotraders),
  };
}
