import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
let total = 0;
for (const file of [
  "dist/index.html",
  "dist/assets/battlefield.js",
  "dist/assets/battlefield.css",
]) {
  const data = readFileSync(file),
    gzip = gzipSync(data).length;
  total += gzip;
  console.log(`${file}: ${data.length} bytes / ${gzip} gzip`);
}
console.log(`Total: ${total} gzip bytes`);
// 30 KB -> 36 KB in 0.7.0 (command mode); 40 KB in 0.8.0 (terrain themes, two-step setup,
// strategy drawer, after-action sticker).
if (total > 40000) throw Error("40KB compressed app budget exceeded");
