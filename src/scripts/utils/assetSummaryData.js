export const deriveDailyTotalUSD = (accountAssetDaily) =>
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
      total_usd: Number(total.toFixed(2)),
    };
  });

export const applyTimeframe = (data, timeframe) => {
  if (timeframe === "ALL") return data;

  const map = {
    "7D": 7,
    "30D": 30,
    "90D": 90,
  };

  return data.slice(-map[timeframe]);
};
