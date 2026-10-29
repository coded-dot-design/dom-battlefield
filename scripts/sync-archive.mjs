// Rewrites site/archive.json from the repo's tags: every release before the current
// package version, newest first, each pinned to its tag's commit.
// Run after a release is tagged: npm run sync:archive
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const REPO = "https://github.com/coded-dot-design/dom-battlefield.git";
const current = `v${JSON.parse(readFileSync("package.json", "utf8")).version}`;
const parse = (v) => v.slice(1).split(".").map(Number);
const compare = (a, b) => {
  const [x, y] = [parse(a), parse(b)];
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};
const tags = new Map();
for (const line of execFileSync("git", ["ls-remote", "--tags", REPO], { encoding: "utf8" }).trim().split("\n")) {
  const [commit, ref] = line.split("\t");
  const match = /^refs\/tags\/(v\d+\.\d+\.\d+)(\^\{\})?$/.exec(ref);
  // Peeled (^{}) entries name the commit behind an annotated tag.
  if (match && (match[2] || !tags.has(match[1]))) tags.set(match[1], commit);
}
const archive = [...tags]
  .filter(([v]) => compare(v, current) < 0)
  .sort(([a], [b]) => compare(b, a))
  .map(([version, commit]) => ({ version, commit }));
writeFileSync("site/archive.json", JSON.stringify(archive, null, 2) + "\n");
console.log(`${archive.length} past builds before ${current}.`);
