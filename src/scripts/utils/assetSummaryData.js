export const deriveDailyTotalUSD = (accountAssetDaily = []) =>
  accountAssetDaily.map((day) => {
    let total = 0;
    for (const account of day.accounts || []) {
      for (const asset of account.assets || []) {
        if (typeof asset.value_usd === "number") {
          total += asset.value_usd;
        }
      }
    }
    return {
      date: day.date,
      total_usd: total,
    };
  });

export const applyTimeframe = (data, days) => {
  if (days === "ALL") {
    return data;
  }
  return data.slice(-days);
};
