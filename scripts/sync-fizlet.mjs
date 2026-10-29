// Snapshot the Fizlet engine (sibling checkout ../fizlet, or FIZLET_DIR) into vendor/fizlet, with
// provenance in vendor/fizlet/ORIGIN.json. The game runs on its kernel and fizlet/rules; the site's
// Board UI comes from vendor/fizlet/ui (fizlet/ui).
//   node scripts/sync-fizlet.mjs
// Never edit vendor/fizlet by hand: change coded-dot-design/fizlet, then run this.
import { cpSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

const from = process.env.FIZLET_DIR ?? "../fizlet";
const sha = (f) => createHash("sha256").update(readFileSync(f)).digest("hex");
rmSync("vendor/fizlet", { recursive: true, force: true });
cpSync(`${from}/src`, "vendor/fizlet", { recursive: true, filter: (p) => !p.endsWith(".md") });
const files = [];
const walk = (d) => readdirSync(d).forEach((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : files.push(join(d, n))));
walk("vendor/fizlet");
const version = JSON.parse(readFileSync(`${from}/package.json`, "utf8")).version;
const commit = execFileSync("git", ["-C", from, "rev-parse", "HEAD"]).toString().trim();
writeFileSync("vendor/fizlet/ORIGIN.json", JSON.stringify({
  note: "Generated snapshot. Edit coded-dot-design/fizlet, then run node scripts/sync-fizlet.mjs.",
  repository: "https://github.com/coded-dot-design/fizlet",
  version,
  commit,
  files: files.sort().map((f) => ({ path: relative("vendor/fizlet", f), sha256: sha(f) })),
}, null, 2) + "\n");
console.log(`vendor/fizlet ← Fizlet ${version} (${commit.slice(0, 7)})`);
