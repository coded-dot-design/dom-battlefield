// Battlefield site (GitHub Pages): landing page, style guide and the game under /play/.
// Run after `npm run build && npm run site:build`. Serves artifacts/pages at /dom-battlefield/.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve("artifacts/pages");
if (!existsSync(join(root, "index.html"))) throw Error("Build the site first: npm run site:build");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!path.startsWith("/dom-battlefield/")) return res.writeHead(404).end();
  let file = join(root, path.slice("/dom-battlefield".length));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" });
  res.end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const base = `http://127.0.0.1:${server.address().port}/dom-battlefield/`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let where = "start";
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  where = "landing";
  await page.goto(base);
  for (const path of ["", "style-guide/"]) {
    await page.goto(base + path);
    assert.equal(await page.locator("h1").count(), 1, `${path || "home"} has one h1`);
    assert.match(await page.locator('meta[property="og:image"]').getAttribute("content"), /^https:\/\/.+\/dom-battlefield\/shots\/og\.png$/);
    assert.match(await page.locator('link[rel="canonical"]').getAttribute("href"), /^https:\/\/.+\/dom-battlefield\//);
    assert.equal(await page.locator('a[href$="dom-virus/"]').count() > 0, true, `${path || "home"} links back to DOM VIRUS`);
  }
  await page.goto(base);
  // The hero is a live battle: the canvas paints, the HUD counts, a tap calls an airstrike.
  await page.waitForTimeout(1200);
  const painted = await page.locator("canvas.arena").evaluate((c) => {
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4 * 97) if (d[i]) n++;
    return n;
  });
  assert.ok(painted > 50, "the arena draws");
  const hero = await page.locator(".hero").boundingBox();
  await page.mouse.click(hero.x + hero.width * 0.8, hero.y + hero.height * 0.5);
  await page.waitForFunction(() => document.querySelector("[data-strikes]").textContent === "01");
  await page.locator("[data-airstrike]").click();
  await page.waitForFunction(() => document.querySelector("[data-strikes]").textContent === "02");
  // Clicking a key in the hero never calls a strike.
  await page.locator(".hero a.bui-sys").hover();
  assert.equal(await page.locator("[data-strikes]").textContent(), "02");
  // Headline letters are targets but the h1 still reads as one name.
  assert.equal(await page.locator("h1").getAttribute("aria-label"), "Twelve tanks. One radio.");
  assert.ok((await page.locator("h1 .hx").count()) >= 18);

  where = "radio";
  const advance = page.locator('[data-order="advance"]');
  await advance.scrollIntoViewIfNeeded();
  await advance.click();
  assert.equal(await advance.getAttribute("aria-pressed"), "true", "orders lock");
  assert.match(await page.locator("[data-radio-toast]").textContent(), /ADVANCE/);
  await page.locator('[data-order="attack"]').click();
  assert.equal(await advance.getAttribute("aria-pressed"), "false", "one order at a time");
  await page.locator('[data-order="attack"]').click();
  assert.match(await page.locator("[data-radio-toast]").textContent(), /released/);
  assert.equal(await page.locator("img[src$='.webp']").count(), 5, "five real screenshots");

  where = "theme";
  await page.locator("[data-theme-toggle]").click();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "light");
  assert.equal(await page.evaluate(() => localStorage.getItem("dom-virus:theme")), "light", "theme is shared with the game and DOM VIRUS");
  await page.locator("[data-theme-toggle]").click();

  where = "phone";
  for (const width of [390, 360])
    for (const path of ["", "style-guide/"]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(base + path);
      await page.waitForTimeout(300);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(wide <= width + 1, `${path || "home"} never scrolls sideways at ${width}px (${wide}px)`);
    }
  await page.setViewportSize({ width: 1440, height: 900 });

  where = "style-guide";
  await page.goto(base + "style-guide/");
  const cmd = () => page.locator("[data-bui]").first().evaluate((n) => getComputedStyle(n).getPropertyValue("--k-cmd").trim());
  assert.equal(await cmd(), "#9a63ff");
  await page.locator('[data-palette="swarm"]').click();
  assert.equal(await cmd(), "#8573ee", "a passed-in palette repaints every board");
  await page.locator('[data-palette="battlefield"]').click();
  assert.equal(await cmd(), "#9a63ff", "and restores");
  const toggle = page.locator("#key [data-toggle]");
  await toggle.click();
  assert.equal(await toggle.getAttribute("aria-pressed"), "true", "keys lock");
  await page.locator("[data-open-overlay]").click();
  assert.equal(await page.locator("[data-overlay]").isVisible(), true, "the overlay opens");
  await page.locator("[data-close-overlay]").click();
  assert.equal(await page.locator("[data-overlay]").isVisible(), false);
  assert.equal(await page.locator("[data-shadow-demo]").evaluate((h) => getComputedStyle(h.shadowRoot.querySelector("button")).borderStyle), "solid", "shadow DOM isolates the board");
  // Link keys are keys: a hard base straight below, never to the side.
  const shadow = await page.locator(".bu-links a").first().evaluate((a) => getComputedStyle(a).boxShadow);
  assert.match(shadow, /\) 0px \d+(\.\d+)?px 0px/, `link keys sit on a vertical base (${shadow})`);

  where = "play";
  await page.goto(base);
  await page.locator(".hero-start").click();
  await page.waitForURL(/\/dom-battlefield\/play\/$/);
  await page.waitForFunction(() => window.battlefield || document.querySelector("#battlefield"));
  assert.deepEqual(errors, []);

  where = "blitz-board";
  const bp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const berr = [];
  bp.on("pageerror", (e) => berr.push(e.message));
  await bp.goto(base + "blitz/play/?seconds=6");
  assert.equal(await bp.evaluate(() => window.blitz.state), "intro");
  await bp.evaluate(() => window.blitz.start());
  await bp.waitForFunction(() => window.blitz.state === "play", null, { timeout: 5000 });
  await bp.waitForFunction(() => window.blitz.world.tanks.filter((t) => t.alive && t.drop >= 1).length >= 6, null, { timeout: 6000 });
  await bp.mouse.move(700, 400);
  await bp.mouse.down();
  await bp.keyboard.press("KeyQ");
  await bp.waitForTimeout(400);
  assert.ok(await bp.evaluate(() => window.blitz.world.shells.some((s) => s.on) || window.blitz.world.tanks[0].strikes === 0), "you can fire and call a strike");
  await bp.mouse.up();
  // A short match ends with the result sticker and the standings.
  await bp.waitForFunction(() => window.blitz.state === "end", null, { timeout: 12000 });
  const over = await bp.evaluate(() => document.querySelector("#blitz").shadowRoot.querySelector("[data-ov]").textContent);
  assert.match(over, /(STAGE CLEAR|INSERT COIN).*REMATCH/s);
  assert.match(over, /REMATCH/);
  assert.deepEqual(berr, []);
  await bp.close();

  where = "blitz-phone";
  // Phones: the game page loads like the Battlefield app (no header/footer, no scroll, no zoom).
  const phone = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const pp = await phone.newPage();
  await pp.goto(base + "blitz/play/");
  const app = await pp.evaluate(() => {
    const r = document.querySelector(".blitz-stage").getBoundingClientRect();
    return {
      head: getComputedStyle(document.querySelector(".site-head")).display,
      foot: getComputedStyle(document.querySelector(".site-foot")).display,
      stage: [r.top, r.left, Math.round(r.width), Math.round(r.height)],
      scroll: document.documentElement.scrollHeight <= innerHeight + 1,
      zoom: /user-scalable=no/.test(document.querySelector("meta[name=viewport]").content),
    };
  });
  assert.deepEqual(app, { head: "none", foot: "none", stage: [0, 0, 844, 390], scroll: true, zoom: true });
  await phone.close();

  where = "blitz-landing";
  const lp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const lerr = [];
  lp.on("pageerror", (e) => lerr.push(e.message));
  await lp.goto(base + "blitz/");
  assert.match(await lp.locator("h1").textContent(), /Battlefield Blitz/);
  assert.match(await lp.locator(".bz-hero .eyebrow").textContent(), /BLITZ VERSION/);
  await lp.waitForFunction(() => window.blitzDemo?.world.tanks.filter((t) => t.alive).length >= 5, null, { timeout: 8000 });
  assert.equal(await lp.evaluate(() => window.blitzDemo.world.tanks.some((t) => t.you)), false, "the hero battle is all bots");
  assert.equal(new URL(await lp.locator(".start-key").getAttribute("href"), base).pathname, "/dom-battlefield/blitz/play/");
  assert.ok(await lp.locator('a[href="/dom-battlefield/"]').count() > 0, "links back to the original");
  assert.match(await lp.locator("#drop pre").first().textContent(), /blitz\/blitz\.js/);
  await lp.setViewportSize({ width: 390, height: 844 });
  await lp.waitForTimeout(300);
  assert.ok(await lp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Blitz landing never scrolls sideways on a phone");
  assert.deepEqual(lerr, []);
  await lp.close();

  where = "blitz-drop-in";
  const dp = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const derr = [];
  dp.on("pageerror", (e) => derr.push(e.message));
  await dp.goto(base + "style-guide/");
  const snap = () => dp.evaluate(() => [...document.body.querySelectorAll("*")].filter((n) => !n.closest("[data-fizlet-host],[data-blitz-ignore]")).map((n) => n.tagName + [...n.attributes].map((a) => a.name + "=" + a.value).sort().join("|")).join("\n"));
  await dp.addScriptTag({ url: base + "blitz/blitz.js" });
  const before = await snap();
  const playKey = dp.locator("[data-blitz-ignore]").locator("button");
  assert.match(await playKey.textContent(), /PLAY BLITZ/i, "a PLAY BLITZ key waits on the page");
  await playKey.click();
  await dp.waitForSelector("[data-fizlet-host=blitz]", { state: "attached" });
  await dp.waitForTimeout(3500);
  assert.ok(await dp.evaluate(() => !!document.querySelector("[data-fizlet-host=blitz]").shadowRoot.querySelector("canvas")), "the page becomes the arena");
  await dp.keyboard.press("Escape");
  await dp.waitForTimeout(200);
  assert.equal(await dp.locator("[data-fizlet-host=blitz]").count(), 0, "Escape closes");
  assert.equal(await snap(), before, "the page is exactly as it was");
  assert.deepEqual(derr, []);
  await dp.close();

  where = "reduced-motion";
  const still = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const sp = await still.newPage();
  await sp.goto(base);
  await sp.waitForTimeout(500);
  assert.equal(await sp.locator("[data-airstrike]").isVisible(), false, "no strike key without motion");
  const frames = await sp.locator("canvas.arena").evaluate(async (c) => {
    const grab = () => c.toDataURL().length;
    const a = grab();
    await new Promise((r) => setTimeout(r, 400));
    return a === grab();
  });
  assert.equal(frames, true, "reduced motion: the arena is a still frame");
  await still.close();
  console.log("Site: landing arena, airstrikes, radio, theme, phones, style guide, play link, Blitz board + phone app mode + drop-in, reduced motion passed.");
} catch (e) {
  console.error(`::error title=Battlefield site test (${where})::${e.message}`);
  throw e;
} finally {
  await browser.close();
  server.close();
}
