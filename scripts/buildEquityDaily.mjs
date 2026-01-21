import fs from "fs";

const out = [];
for (let i = 0; i < 7; i++) {
  out.push({
    date: new Date(Date.now() - i*86400000).toISOString().slice(0,10),
    value: Math.round(Math.random()*10000)
  });
}
fs.writeFileSync("data/derive/asset_equity_daily.json", JSON.stringify(out.reverse(), null, 2));
