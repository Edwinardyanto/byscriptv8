import fs from "fs";
import path from "path";

const dir = "data/account_assets_daily";
const files = fs.readdirSync(dir).filter(f => f.endsWith(".json")).sort();
const latest = files[files.length - 1].replace(".json", "");

fs.writeFileSync("data/meta/latest", JSON.stringify({ latestDate: latest }, null, 2));
