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
if (total > 24000) throw Error("24KB compressed app budget exceeded");
