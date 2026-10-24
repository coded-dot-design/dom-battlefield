import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const files = [
  ["sherman-bytes", "src/sprites.ts", "shared/sherman-sprites.ts"],
  ["dom-virus", "src/selection-lock.ts", "shared/selection-lock.ts"],
  ["dom-virus", "src/audio.ts", "shared/audio.ts"],
];
const sources = files.map(([repo, file, dest]) => {
  const path = `../${repo}/${file}`;
  copyFileSync(path, dest);
  return {
    repository: `https://github.com/coded-dot-design/${repo}`,
    version: JSON.parse(readFileSync(`../${repo}/package.json`)).version,
    path: file,
    destination: dest,
    sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
  };
});
writeFileSync(
  "shared/ORIGIN.json",
  JSON.stringify(
    {
      note: "Generated owning-source snapshots. Edit the owning game/core, then run node scripts/sync-shared.mjs. Never edit shared independently.",
      sources,
    },
    null,
    2,
  ) + "\n",
);
