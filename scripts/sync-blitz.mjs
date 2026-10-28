// Pin Battlefield Blitz (sibling checkout ../dom-battlefield-blitz, its committed dist/) into
// vendor/blitz. The site's Blitz pages (/blitz/, /blitz/play/) and the drop-in script use it.
//   node scripts/sync-blitz.mjs
// Never edit vendor/blitz by hand: release Blitz, then run this.
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const from = "../dom-battlefield-blitz";
const build = JSON.parse(readFileSync(`${from}/dist/build.json`, "utf8"));
rmSync("vendor/blitz", { recursive: true, force: true });
cpSync(`${from}/dist`, "vendor/blitz", { recursive: true });
const commit = execFileSync("git", ["-C", from, "rev-parse", "HEAD"]).toString().trim();
writeFileSync("vendor/blitz/ORIGIN.json", JSON.stringify({
  note: "Pinned build of Battlefield Blitz (its dist/). Release coded-dot-design/dom-battlefield-blitz, then run node scripts/sync-blitz.mjs.",
  repository: "https://github.com/coded-dot-design/dom-battlefield-blitz",
  version: build.version,
  commit,
  files: build.files,
}, null, 2) + "\n");
console.log(`vendor/blitz ← Blitz ${build.version} (${commit.slice(0, 7)})`);
