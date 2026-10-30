// Rewrites site/archive.json from the repo's tags: every release up to and including the current
// package version, newest first, each pinned to its tag's commit (scripts/archive.mjs serves each at
// /v/<version>/). tests/archive.mjs fails when a released tag is missing.
// Run after a release is tagged: npm run sync:archive
import { readFileSync, writeFileSync } from "node:fs";
import { releasedBuilds, remoteTags } from "./archive.mjs";

const current = `v${JSON.parse(readFileSync("package.json", "utf8")).version}`;
const archive = releasedBuilds(remoteTags(), current);
writeFileSync("site/archive.json", JSON.stringify(archive, null, 2) + "\n");
console.log(`${archive.length} released builds up to ${current}.`);
