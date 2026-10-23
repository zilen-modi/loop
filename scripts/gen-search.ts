import { writeFileSync } from "fs";
import { join } from "path";
import { buildSearchIndex } from "./search-index";

const entries = buildSearchIndex();
writeFileSync(join(__dirname, "../content/search-index.json"), JSON.stringify(entries, null, 1) + "\n");
console.log(`Wrote ${entries.length} search entries.`);
