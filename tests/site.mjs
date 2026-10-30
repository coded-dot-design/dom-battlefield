// Battlefield site (GitHub Pages): landing page, style guide and the game under /play/.
// Run after `npm run build && npm run site:build`. Serves artifacts/pages at /dom-battlefield/.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";
import { checkKeys, checkTaps } from "./keys.mjs";
import { checkHeroScrim } from "./hero-scrim.mjs";

const root = resolve("artifacts/pages");
if (!existsSync(join(root, "index.html"))) throw Error("Build the site first: npm run site:build");
// The served /play/ (dist's bytes plus the site's head): canonical, share tags and JSON-LD.
{
  const play = readFileSync(join(root, "play/index.html"), "utf8");
  for (const tag of ['rel="canonical"', 'property="og:title"', 'property="og:image"']) assert.ok(play.includes(tag), `/play/ has ${tag}`);
  const ld = JSON.parse(play.match(/<script type="application\/ld\+json">(.*?)<\/script>/)[1]);
  assert.deepEqual(ld["@graph"].map((g) => g["@type"]), ["WebPage", "BreadcrumbList"]);
}
// Discovery files (scripts/discovery.mjs): robots.txt names the sitemap; the sitemap and llms.txt list the
// indexable pages (home, /play/, /style-guide/) and nothing that is noindex or canonical elsewhere.
{
  const home = readFileSync(join(root, "index.html"), "utf8").match(/<link rel="canonical" href="([^"]+)"/)[1];
  assert.match(readFileSync(join(root, "robots.txt"), "utf8"), new RegExp(`^Sitemap: ${home}sitemap\\.xml$`, "m"));
  const locs = [...readFileSync(join(root, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, [home, `${home}play/`, `${home}style-guide/`]);
  const llms = readFileSync(join(root, "llms.txt"), "utf8");
  assert.match(llms, /^# DOM Battlefield\n/);
  assert.match(llms, /By Chris Cooley\./);
  for (const url of locs) assert.ok(llms.includes(`](${url})`), `llms.txt links ${url}`);
}
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
    const ld = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    assert.deepEqual(ld["@graph"].map((g) => g["@type"]), path ? ["WebPage", "BreadcrumbList"] : ["WebSite", "VideoGame"], `${path || "home"} structured data`);
    assert.equal(await page.locator('a[href="https://domvirus.com/"]').count() > 0, true, `${path || "home"} links back to DOM VIRUS`);
    assert.ok(await page.locator('a[href="https://battlefieldblitz.domvirus.com/"]').count() > 0, `${path || "home"} links to Blitz on its own host`);
  }
  where = "hero";
  {
    // The hero is a live battle on Fizlet (site/src/scripts/arena): fizlet/slot mounts it, the canvas
    // paints, the HUD counts, a tap calls an airstrike, the letters react, it rests and settles to no
    // frames, it pauses offscreen, and Recall gives the hero back byte for byte.
    const hp = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const herr = [];
    hp.on("pageerror", (e) => herr.push(e.message));
    hp.on("console", (m) => m.type() === "error" && herr.push(m.text()));
    await hp.addInitScript(() => document.addEventListener("DOMContentLoaded", () => (window.served = document.querySelector(".hero").outerHTML)));
    await hp.goto(base + "?debug");
    await hp.waitForFunction(() => window.arena && document.querySelector("[data-fizlet-slot] canvas.arena"), null, { timeout: 8000 });
    assert.equal(await hp.locator(".arena-poster").isVisible(), false, "the poster is only for reduced motion");
    await hp.waitForTimeout(1200);
    const painted = await hp.locator("canvas.arena").evaluate((c) => {
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4 * 97) if (d[i]) n++;
      return n;
    });
    assert.ok(painted > 50, "the arena draws");
    const moved = await hp.evaluate(async () => {
      const x = [...window.arena.arena.tx.slice(0, 10)];
      await new Promise((r) => setTimeout(r, 300));
      return window.arena.arena.tx.slice(0, 10).some((v, i) => v !== x[i]);
    });
    assert.ok(moved, "the tanks drive");
    const hero = await hp.locator(".hero").boundingBox();
    await hp.mouse.click(hero.x + hero.width * 0.8, hero.y + hero.height * 0.5);
    await hp.waitForFunction(() => document.querySelector("[data-strikes]").textContent === "01");
    await hp.locator("[data-airstrike]").click();
    await hp.waitForFunction(() => document.querySelector("[data-strikes]").textContent === "02");
    // Clicking a key in the hero never calls a strike.
    await hp.locator(".hero a.bui-sys").hover();
    assert.equal(await hp.locator("[data-strikes]").textContent(), "02");
    // A strike on the headline knocks its letters (through the engine's ledger).
    const letter = await hp.locator(".hx").nth(3).boundingBox();
    await hp.mouse.click(letter.x + letter.width / 2, letter.y + letter.height / 2);
    await hp.waitForFunction(() => [...document.querySelectorAll(".hx")].some((l) => l.style.transform.includes("rotate")), null, { timeout: 3000 });
    await hp.locator("[data-sound]").click();
    await hp.waitForFunction(() => document.querySelector("[data-sound]").getAttribute("aria-pressed") === "true");
    await hp.waitForFunction(() => document.querySelector("[data-wrecks]").textContent !== "000", null, { timeout: 8000 });
    const stats = await hp.evaluate(() => window.arena.engine.stats());
    console.log(`hero: ${stats.frames} frames, ${stats.frameMs.avg.toFixed(2)} ms avg / ${stats.frameMs.max.toFixed(2)} ms max per frame, ${stats.dropped} steps dropped`);
    // Left alone it rests: the last shots land, then no frames at all; a visitor wakes it.
    await hp.evaluate(() => window.arena.rest());
    await hp.waitForFunction(() => window.arena.engine.paused.includes("settled"), null, { timeout: 8000 });
    const quiet = await hp.evaluate(async () => {
      const f = window.arena.engine.stats().frames;
      await new Promise((r) => setTimeout(r, 600));
      return window.arena.engine.stats().frames - f;
    });
    assert.equal(quiet, 0, "settled: no frames");
    await hp.mouse.move(hero.x + 300, hero.y + 300);
    await hp.mouse.move(hero.x + 320, hero.y + 310);
    await hp.waitForFunction(() => window.arena.engine.running);
    // Offscreen: paused.
    await hp.evaluate(() => scrollTo(0, document.querySelector(".hero").offsetHeight + 400));
    await hp.waitForFunction(() => window.arena.engine.paused.includes("offscreen"));
    await hp.evaluate(() => scrollTo(0, 0));
    await hp.waitForFunction(() => window.arena.engine.running);
    // Recall: the hero as it was served, byte for byte (letters, HUD, sound key, copy, poster).
    const back = await hp.evaluate(() => (window.arenaSlot.destroy(), document.querySelector(".hero").outerHTML === window.served));
    assert.equal(back, true, "Recall gives the hero back exactly");
    assert.deepEqual(herr, []);
    await hp.close();
  }
  where = "hero frame cap (phone)";
  {
    // A phone left alone on the landing page: the battle is an ambient hero, so it asks for at most
    // ~30 frames a second (fps: 30, the Fizlet hero default; uncapped it asked for one every vsync and
    // kept the main thread ~90 % busy at 4× CPU), and none once it has settled. Counts every
    // requestAnimationFrame call on the page, so a second loop can't hide.
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const pp = await ctx.newPage();
    await pp.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.rafCalls = 0;
      window.requestAnimationFrame = (cb) => (window.rafCalls++, raf(cb));
    });
    await pp.goto(base + "?debug");
    await pp.waitForFunction(() => window.arena?.engine.running, null, { timeout: 8000 });
    const rate = (ms) => pp.evaluate(async (ms) => {
      const n = window.rafCalls, t = performance.now();
      await new Promise((r) => setTimeout(r, ms));
      return ((window.rafCalls - n) * 1000) / (performance.now() - t);
    }, ms);
    const battling = await rate(2000);
    assert.ok(battling > 5 && battling <= 33, `the battle asks for at most ~30 frames a second (got ${battling.toFixed(1)})`);
    await pp.evaluate(() => window.arena.rest());
    await pp.waitForFunction(() => window.arena.engine.paused.includes("settled"), null, { timeout: 8000 });
    assert.equal(await rate(1000), 0, "settled: no frames requested at all");
    console.log(`hero on a phone: ${battling.toFixed(1)} rAF/s battling, 0 once settled`);
    await ctx.close();
  }
  await page.goto(base);
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

  where = "perf overlay";
  // Off by default: nothing loaded, nothing on the page. The header key loads it and measures the
  // page's frames; F9 hides it and the key follows; the choice is shared (dom-virus:perf).
  assert.deepEqual(await page.evaluate(() => [!!document.querySelector(".fizlet-perf"), document.querySelector("[data-perf-toggle]").getAttribute("aria-pressed")]), [false, "false"]);
  await page.locator("[data-perf-toggle]").click();
  await page.waitForSelector(".fizlet-perf:not([hidden])");
  await page.waitForTimeout(700);
  const meter = await page.evaluate(() => ({ fps: +document.querySelector(".fizlet-perf b").textContent, stored: localStorage.getItem("dom-virus:perf"), pressed: document.querySelector("[data-perf-toggle]").getAttribute("aria-pressed") }));
  assert.ok(meter.fps > 10 && meter.stored === "1" && meter.pressed === "true", `page meter on (${JSON.stringify(meter)})`);
  await page.keyboard.press("F9");
  assert.deepEqual(await page.evaluate(() => [document.querySelector(".fizlet-perf").hidden, localStorage.getItem("dom-virus:perf"), document.querySelector("[data-perf-toggle]").getAttribute("aria-pressed")]), [true, "0", "false"], "F9 hides it");

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

  where = "past-builds";
  // Every pinned past build is served from its own path; the picker's key follows the choice.
  const archive = JSON.parse(readFileSync("site/archive.json", "utf8"));
  await page.goto(base);
  const pick = page.locator("[data-past-builds] select");
  assert.equal(await pick.locator("option").count(), archive.length);
  const old = archive.at(-1).version;
  await pick.selectOption({ label: old });
  assert.equal(new URL(await page.locator("[data-past-builds] a").getAttribute("href"), base).pathname, `/dom-battlefield/v/${old}/`);
  for (const { version } of archive) {
    const build = JSON.parse(readFileSync(join(root, "v", version, "build.json"), "utf8"));
    assert.equal(`v${build.version}`, version, `${version} is its own build`);
  }
  assert.deepEqual(errors, []);
  // Old builds predate the icon links, so the browser's own /favicon.ico probe may 404 here.
  const failed = [];
  const watch = (r) => r.status() >= 400 && !r.url().endsWith("/favicon.ico") && failed.push(r.url());
  page.on("response", watch);
  await page.locator("[data-past-builds] a").click();
  await page.waitForURL(new RegExp(`/v/${old.replaceAll(".", "\\.")}/$`));
  await page.waitForFunction(() => document.querySelector("#battlefield")?.children.length > 0);
  assert.match(await page.locator('link[rel="canonical"]').getAttribute("href"), /\/play\/$/, "past builds point search engines at /play/");
  assert.match(await page.locator('meta[property="og:url"]').getAttribute("content"), /\/play\/$/, "and shares too");
  assert.equal(JSON.parse(await page.locator('script[type="application/ld+json"]').textContent())["@graph"][0].version, old);
  page.off("response", watch);
  assert.deepEqual(failed, []);
  assert.deepEqual(errors.filter((e) => !/status of 404/.test(e)), [], "the old build runs without errors");
  errors.length = 0;

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
  // Blitz's home is its own site: this copy stays for old links and points search engines there.
  assert.equal(await lp.locator('link[rel="canonical"]').getAttribute("href"), "https://battlefieldblitz.domvirus.com/");
  assert.match(await lp.locator("#drop pre").first().textContent(), /blitz\/blitz\.js/);
  await lp.setViewportSize({ width: 390, height: 844 });
  await lp.waitForTimeout(300);
  assert.ok(await lp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), "Blitz landing never scrolls sideways on a phone");
  assert.deepEqual(lerr, []);
  await lp.close();

  // The Blitz hero scrim and its copy follow the theme (light: --surface, dark: --bg), AA in both.
  where = "blitz hero scrim";
  await checkHeroScrim(browser, base + "blitz/", "blitz landing");

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

  // Page keys (BOARD-UI.md "Page keys"): every in-page key presses (face drops by its base) and
  // clicks on its face, top edge and base; Enter shows the press; phones: a tap on the base clicks.
  let keys = 0;
  for (const path of ["", "style-guide/", "blitz/"]) {
    where = `page keys ${path || "home"}`;
    for (const [opts, check] of [[{ viewport: { width: 1440, height: 900 } }, checkKeys], [{ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }, checkTaps]]) {
      const kc = await browser.newContext(opts);
      const kp = await kc.newPage();
      await kp.goto(base + path);
      keys += await check(kp, where, { skip: '[tabindex="-1"]' }); // style guide: frozen state specimens
      await kc.close();
    }
  }

  where = "touch";
  {
    // Phones (390 x 844, touch): a double-tap, a pinch or a sideways swipe on the hero battle never
    // zooms or pans the page; the page is touch-action: manipulation (no double-tap zoom) and stays
    // 390 wide. Raw touch points: Chromium's synthesized touch pinch never zooms headless.
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 });
    const tp = await phone.newPage();
    await tp.goto(base);
    await tp.waitForTimeout(500);
    const cdp = await phone.newCDPSession(tp);
    const pts = (type, list) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: list.map(([x, y], id) => ({ x, y, id })) });
    const state = () => tp.evaluate(() => ({ scale: visualViewport.scale, x: scrollX, w: document.documentElement.scrollWidth }));
    const hero = await tp.locator("[data-touch-lock]").first().boundingBox();
    const x = 195, y = Math.round(hero.y + hero.height * 0.55);
    await pts("touchStart", [[x - 15, y], [x + 15, y]]);
    for (let i = 1; i <= 10; i++) await pts("touchMove", [[x - 15 - i * 12, y], [x + 15 + i * 12, y]]);
    await pts("touchEnd", []);
    await tp.waitForTimeout(300);
    assert.deepEqual(await state(), { scale: 1, x: 0, w: 390 }, "a pinch on the hero does not zoom the page");
    await pts("touchStart", [[300, y]]);
    for (let i = 1; i <= 10; i++) await pts("touchMove", [[300 - i * 25, y]]);
    await pts("touchEnd", []);
    await tp.waitForTimeout(300);
    assert.deepEqual(await state(), { scale: 1, x: 0, w: 390 }, "a sideways swipe on the hero does not pan the page");
    await cdp.send("Input.synthesizeTapGesture", { x, y, tapCount: 2, gestureSourceType: "touch" });
    await tp.waitForTimeout(300);
    assert.equal((await state()).scale, 1, "a double-tap on the hero does not zoom");
    const ta = await tp.evaluate(() => [getComputedStyle(document.documentElement).touchAction, getComputedStyle(document.querySelector("[data-touch-lock]")).touchAction]);
    assert.deepEqual(ta, ["manipulation", "pan-y"], "page touch-action manipulation, hero pan-y");
    await phone.close();
  }

  where = "reduced-motion";
  const still = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
  const sp = await still.newPage();
  await sp.goto(base);
  await sp.waitForTimeout(500);
  assert.equal(await sp.locator("[data-airstrike]").isVisible(), false, "no strike key without motion");
  // Reduced motion: the hero keeps its still poster and the scene never loads.
  await sp.waitForTimeout(1500);
  assert.equal(await sp.locator(".arena-poster").isVisible(), true, "reduced motion: the still poster");
  assert.equal(await sp.locator("[data-fizlet-slot]").count(), 0, "reduced motion: no scene");
  await still.close();
  console.log(`Site: landing arena (mount, strikes, letters, rest, offscreen, Recall), airstrikes, radio, theme, phones, style guide, play link, Blitz board + phone app mode + hero scrim in both themes + drop-in, reduced motion, past builds, ${keys} page keys passed.`);
} catch (e) {
  console.error(`::error title=Battlefield site test (${where})::${e.message}`);
  throw e;
} finally {
  await browser.close();
  server.close();
}
