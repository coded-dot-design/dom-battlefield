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
// 30 KB -> 36 KB in 0.7.0 for command mode (plan step, route editing, tip details).
if (total > 36000) throw Error("36KB compressed app budget exceeded");
