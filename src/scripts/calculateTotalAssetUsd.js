import {
  getAccounts,
  getAccountAssets,
} from "./dataAccess.js";


export const calculateTotalAssetUsd = async () => {
  const accounts = await getAccounts();

  let totalUsd = 0;

  for (const account of accounts) {
    const assets = await getAccountAssets(account.account_id);
    for (const asset of assets || []) {
      totalUsd += Number(asset.usd_value || 0);
    }
  }

  return totalUsd;
};
