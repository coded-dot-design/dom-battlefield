// Landing-page screenshots, taken from the built game (dist). Run after `npm run build`:
//   node scripts/shots.mjs     → site/public/shots/*.webp (+ og.png)
// Real frames of the real game, so the landing page never shows a mock.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";

const root = resolve("dist"), out = resolve("site/public/shots");
mkdirSync(out, { recursive: true });
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  let f = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" });
  res.end(readFileSync(f));
}).listen(0, "127.0.0.1");
await new Promise((ok) => server.on("listening", ok));
const url = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const webp = (png, name, q = 82) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", png, "-c:v", "libwebp", "-quality", String(q), join(out, `${name}.webp`)]);

async function page(viewport, theme = "dark", touch = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: touch, isMobile: touch });
  await ctx.addInitScript((t) => {
    localStorage.setItem("dom-battlefield:intro", "seen");
    localStorage.setItem("dom-battlefield:tips", "off");
    localStorage.setItem("dom-virus:theme", t);
  }, theme);
  const p = await ctx.newPage();
  await p.goto(url + "?debug");
  await p.waitForFunction(() => window.battlefield);
  await p.waitForTimeout(500);
  return p;
}
const tmp = (n) => join(out, `${n}.png`);
const shoot = async (p, name, clip) => {
  await p.screenshot({ path: tmp(name), clip });
  webp(tmp(name), name);
  execFileSync("rm", [tmp(name)]);
};
const map = (p) => p.locator("#bf-stage, .bf-stage, #bf-map").first().boundingBox();

// 1. Pick the ground: the location card over the board.
let p = await page({ width: 1440, height: 900 });
await shoot(p, "setup", await map(p));
// 2. Plan: time frozen, the three planning keys.
await p.locator(".bf-mission").nth(1).click();
await p.locator("#bf-deploy").click();
await p.waitForFunction(() => window.battlefield.command.planning);
await p.waitForTimeout(600);
await shoot(p, "plan", await map(p));
// 3. Fight: twelve a side, a few seconds into the shooting.
await p.locator('.bf-home-card[data-open="platoon"]').click();
await p.locator('#bf-size [data-size="12"]').click();
await p.locator("#bf-start").click();
await p.locator("#bf-advance, [data-order='advance']").first().click().catch(() => {});
await p.waitForTimeout(7000);
await shoot(p, "battle", await map(p));
await p.screenshot({ path: join(out, "og-full.png") });
await p.context().close();
// 4. Phone cockpit, landscape.
p = await page({ width: 844, height: 390 }, "dark", true);
await p.locator(".bf-mission").first().click();
await p.locator("#bf-quick").click();
await p.waitForTimeout(150);
if (await p.evaluate(() => window.battlefield.gate === "fullscreen")) await p.locator("#bf-gate-go").click();
await p.waitForFunction(() => window.battlefield.gate === null).catch(() => {});
await p.waitForTimeout(3200);
await shoot(p, "phone", { x: 0, y: 0, width: 844, height: 390 });
await p.context().close();
// Social card: 1200x630 from the battle frame.
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", join(out, "og-full.png"), "-vf", "scale=1200:-1,crop=1200:630:0:(ih-630)/2", join(out, "og.png")]);
execFileSync("rm", [join(out, "og-full.png")]);
await browser.close();
server.close();
console.log("shots →", out);
