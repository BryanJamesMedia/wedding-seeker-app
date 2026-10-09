/** Concatenates all migrations into one re-runnable file for the Neon SQL Editor. */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), "db", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const out = [
  "-- Wedding Seeker: full schema. Paste into the Neon SQL Editor and click Run. Safe to re-run.",
  ...files.map((f) => `\n-- ===== ${f} =====\n${readFileSync(join(dir, f), "utf8")}`),
].join("\n");
writeFileSync(join(process.cwd(), "db", "neon-setup.sql"), out);
console.log(`wrote db/neon-setup.sql from ${files.length} migrations`);
