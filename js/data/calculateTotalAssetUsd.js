import { getLatestAccountAssetDaily, getLatestAssetPriceDaily } from "./data.js";

export const calculateTotalAssetUsd = async () => {
  const dailyAssets = await getLatestAccountAssetDaily();
  const dailyPrices = await getLatestAssetPriceDaily();

  let totalUsd = 0;

  const priceMap = new Map(
    Object.entries(dailyPrices).map(([assetId, p]) => [
      assetId,
      Number(p.price_usd || 0),
    ])
  );

  for (const account of dailyAssets.accounts || []) {
    for (const asset of account.assets || []) {
      const price = priceMap.get(asset.asset_id) || 0;
      totalUsd += Number(asset.value || 0) * price;
    }
  }

  return totalUsd;
};
