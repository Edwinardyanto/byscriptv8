export async function loadAccountAssetsDaily() {
  const indexRes = await fetch("data/account_assets_daily/index.json");
  const files = await indexRes.json();

  const days = [];

  for (const file of files) {
    const res = await fetch(`data/account_assets_daily/${file}`);
    const accounts = await res.json();

    days.push({
      date: file.replace(".json", ""),
      accounts,
    });
  }

  return days;
}
