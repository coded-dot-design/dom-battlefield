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
// strategy drawer, after-action sticker); 44 KB in 0.9.0 (header icons + settings menu, pause and
// start stickers, squad chips, per-terrain roads, city shapes, full-screen expand prompt); 46 KB in
// 0.11.0 (keyboard keycap panel, docked command card, platoon keys, surrender confirm); 48 KB in
// 0.13.0 (commanding your own tank, movable command card, comms panel, team colours); 52 KB in
// 0.14.0 (the redesigned flow: location card with terrain thumbnails, plan cards with orbits,
// per-tank order bubble, the touch cockpit rails, intro card, touch tips); 54 KB in 0.15.0
// (sprite-drawn icons, readable card type, dice, emblems, safe-area HQs); 57.5 KB in 0.16.1
// (desktop controls, overlays and planning cards); 61.5 KB in 0.17.0 (accessible card navigation,
// bounded launch effects, modal lifecycle and compact desktop platoon); 66 KB in 0.17.1 and 68 KB in 0.18.3. 72.5 KB in
// 1.0.0: the battle runs on the Fizlet engine (vendored kernel + fizlet/rules drops, JavaScript +4,295 B gzip
// over 0.18.13's 67,617; measured). No runtime dependencies (Fizlet is vendored source). 73 KB for
// the performance overlay switch: 71,911 -> 72,720 B (+809: the kit's setting(), the header key,
// F9 and the lazy loader; measured). The overlay itself (fizlet/perf, 1.87 KB gzip) is a separate
// chunk that loads only when a player turns it on, so it is not in this total.
// 74,350 for accessible play (E14): 72,750 -> 74,100 B (+1,350: the one polite announcer, the
// map's keyboard square cursor, Esc for the keys panel and tips, tank focus rings, the keys
// panel's map rows; HTML +108, JavaScript +1,197, CSS +45; measured). Raised by that delta.
if (total > 74350) throw Error("74,350 B compressed app budget exceeded");
