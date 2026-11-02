// Play in page (site/src/scripts/hero-play.ts) on both board landings, desktop (1440) and phone (390):
// - attract mode: a wheel (desktop) or a finger swipe (phone) over the hero scrolls the page, and a tap
//   on the field is not game input;
// - Play in page: the hero is a modal dialog over the whole viewport (named, focused, announced), the
//   page does not scroll under a wheel or a swipe, focus stays inside, and the game takes input;
// - Exit, Escape and the back gesture: the scroll position, the focus (the Play in page key) and the
//   page's HTML come back exactly as they were;
// - reduced motion: no expand animation, the game starts for the visit and goes again on exit, and the
//   page is byte for byte what it was.
// Every wait is on state; a "nothing moved" check waits two frames. Run after `npm run site:build`.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";

const root = resolve("artifacts/pages");
if (!existsSync(join(root, "index.html"))) throw Error("Build the site first: npm run site:build");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };
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
const SAY = "Playing in page, press Escape to exit.";
const LANDINGS = [
  { name: "battlefield", path: "?debug", hero: ".hero", label: "DOM Battlefield, playing in page", up: "() => !!window.arena && !!document.querySelector(\"canvas.arena\")" },
  { name: "blitz", path: "blitz/", hero: ".bz-hero", label: "Battlefield Blitz, playing in page", up: "() => window.blitzDemo?.world.tanks.filter((t) => t.alive).length >= 5" },
];
const DESKTOP = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };

/** The page's HTML. `live`: the attract battle keeps drawing, so its own moving parts (the
 *  headline letters it knocks, the HUD counts, the canvas size, the copy's shake) are blanked. The
 *  module loader's preload hints (<link rel="modulepreload">, added to <head> the first time a lazy
 *  chunk loads: the battle's scene under reduced motion) are the browser's cache, not the page. */
const snapshot = (page, live) => page.evaluate((live) => {
  const html = document.documentElement.cloneNode(true);
  for (const el of html.querySelectorAll('head link[rel="modulepreload"]')) el.remove();
  if (live) {
    for (const el of html.querySelectorAll(".hx, .hero-inner")) el.removeAttribute("style");
    for (const el of html.querySelectorAll("[data-wrecks], [data-flat], [data-strikes]")) el.textContent = "";
    for (const el of html.querySelectorAll("canvas")) (el.removeAttribute("width"), el.removeAttribute("height"));
  }
  return html.outerHTML;
}, live);
/** Byte for byte, or where the two first differ. */
function same(got, want, msg) {
  if (got === want) return;
  let i = 0;
  while (got[i] === want[i]) i++;
  assert.fail(`${msg}: differs at ${i}:\n  got  …${got.slice(i - 120, i + 160)}\n  want …${want.slice(i - 120, i + 160)}`);
}
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
/** Scrolling has stopped (a wheel, a fling or a key's smooth scroll has run out): the same scrollY on
 *  three frames in a row. */
const still = (page) => page.waitForFunction(() => {
  const s = (window.__still ??= { y: NaN, n: 0 });
  s.n = scrollY === s.y ? s.n + 1 : 0;
  s.y = scrollY;
  return s.n >= 3 && !(window.__still = null);
}, null, { polling: "raf", timeout: 5000 });
const scrolledTo = async (page, y) => (await still(page), await page.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), y), await still(page));

/** One finger swiping up over (x, y) by `dy` px (raw touch points: what a phone sends). */
async function swipe(cdp, x, y, dy) {
  const at = (type, list) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: list.map(([px, py]) => ({ x: px, y: py, id: 1 })) });
  await at("touchStart", [[x, y]]);
  for (let i = 1; i <= 10; i++) await at("touchMove", [[x, y - (dy * i) / 10]]);
  await at("touchEnd", []);
}
/** A spot on the hero's field: inside the hero, on no key, link, label or HUD. */
const field = (page, sel) => page.evaluate((sel) => {
  const hero = document.querySelector(sel), r = hero.getBoundingClientRect();
  for (const [fx, fy] of [[0.85, 0.3], [0.75, 0.45], [0.9, 0.6], [0.6, 0.25], [0.5, 0.15]]) {
    const x = Math.round(r.left + r.width * fx), y = Math.round(Math.max(r.top, 0) + (Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) * fy);
    const at = document.elementFromPoint(x, y);
    if (hero.contains(at) && !at.closest("a, button, [data-no-strike], .hero-play-bar, h1, p")) return { x, y };
  }
  throw Error(`${sel}: no free spot on the field`);
}, sel);

let where = "start";
try {
  for (const L of LANDINGS)
    for (const [kind, opts] of [["1440", DESKTOP], ["390", PHONE]]) {
      where = `${L.name} ${kind}`;
      const phone = kind === "390";
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + L.path);
      await page.waitForFunction(L.up, null, { timeout: 10000 });
      const cdp = phone ? await ctx.newCDPSession(page) : null;
      const box = await page.locator(L.hero).boundingBox();
      const over = { x: Math.round(box.x + box.width * 0.75), y: Math.round(box.y + box.height * 0.55) };

      // ---------- Attract: the page scrolls through the hero; the game takes no input ----------
      where = `${L.name} ${kind}: attract`;
      if (phone) await swipe(cdp, over.x, over.y, 300);
      else (await page.mouse.move(over.x, over.y), await page.mouse.wheel(0, 300));
      await page.waitForFunction(() => scrollY > 0, null, { timeout: 5000 });
      if (!phone) {
        // And with a trackpad's small steps, and the keyboard.
        await scrolledTo(page, 0);
        for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 20);
        await page.waitForFunction(() => scrollY > 0, null, { timeout: 5000 });
        await scrolledTo(page, 0);
        await page.mouse.click(over.x, over.y); // focus the page, over the hero (no input to the game)
        await page.keyboard.press("PageDown");
        await page.waitForFunction(() => scrollY > 0, null, { timeout: 5000 });
      }
      await scrolledTo(page, 0);
      const stage = await page.evaluate((sel) => {
        const s = document.querySelector(sel).querySelector("[data-fizlet-slot], [data-play-stage]");
        return { pe: getComputedStyle(s).pointerEvents, ta: getComputedStyle(document.querySelector(sel)).touchAction };
      }, L.hero);
      assert.deepEqual(stage, { pe: "none", ta: "auto" }, "attract: the game's layer takes no pointer, the hero no touch-action");
      if (L.name === "battlefield") {
        const spot = await field(page, L.hero);
        phone ? await page.touchscreen.tap(spot.x, spot.y) : await page.mouse.click(spot.x, spot.y);
        await frames(page);
        assert.equal(await page.locator("[data-strikes]").textContent(), "00", "attract: a tap on the field calls no strike");
        assert.equal(await page.locator("[data-airstrike]").isVisible(), false, "attract: no strike key");
      }

      // ---------- Engage, play, exit (the Exit key, then Escape, then the back gesture) ----------
      for (const how of ["key", "escape", ...(phone ? ["back"] : [])]) {
        where = `${L.name} ${kind}: engaged (${how})`;
        const key = page.locator("[data-hero-play-open]");
        await key.evaluate((k) => k.scrollIntoView({ block: "center", behavior: "instant" }));
        await still(page);
        const y0 = await page.evaluate(() => scrollY);
        assert.ok(y0 > 0, "the key sits down the page (so a restore is a real one)");
        const before = await snapshot(page, true);
        // Where the page under the hero sits on screen (it must not move when the hero lifts off).
        const under = () => page.evaluate((sel) => [document.querySelector("main").getBoundingClientRect().top, document.querySelector(sel).nextElementSibling.getBoundingClientRect().top, document.querySelector(".site-head .wrap").getBoundingClientRect().left]
          .map((v) => Math.round(v * 10) / 10), L.hero);
        const placed = await under();
        // Pressed where it is (a locator's tap or click would scroll it into view first).
        const kb = await key.boundingBox(), kx = kb.x + kb.width / 2, ky = kb.y + kb.height / 2;
        phone ? await page.touchscreen.tap(kx, ky) : await page.mouse.click(kx, ky);
        await page.waitForFunction((sel) => {
          const h = document.querySelector(sel);
          return h.dataset.play === "on" && !h.getAnimations().length;
        }, L.hero, { timeout: 5000 });
        const state = await page.evaluate(([sel, id]) => {
          const h = document.querySelector(sel), r = h.getBoundingClientRect(), a = document.activeElement;
          return {
            rect: [r.left, r.top, r.width, r.height].map(Math.round),
            dialog: [h.getAttribute("role"), h.getAttribute("aria-modal"), document.getElementById(h.getAttribute("aria-labelledby"))?.textContent],
            focus: h.contains(a),
            said: h.querySelector("[data-hero-play-live]").textContent,
            exit: (() => { const e = h.querySelector("[data-hero-play-exit]").getBoundingClientRect(); return e.height >= 44 && e.width >= 44 && e.top < 80 && (e.right > innerWidth - 80 || e.left < 80); })(),
            inert: [...document.body.children].filter((c) => !c.contains(h) && !/^(SCRIPT|STYLE)$/.test(c.tagName)).every((c) => c.inert),
            overflow: getComputedStyle(document.documentElement).overflow,
          };
        }, [L.hero]);
        const vp = page.viewportSize();
        assert.deepEqual(state, {
          rect: [0, 0, vp.width, vp.height], dialog: ["dialog", "true", L.label], focus: true, said: SAY, exit: true, inert: true, overflow: "hidden",
        }, "engaged: a labelled modal dialog over the whole viewport, focused, announced, the page inert");
        if (L.name === "blitz") {
          // Exit leads the game's own top-left key row: the (i) / full screen key's top (±2 px), just
          // to its left, never over it; the match has the whole viewport.
          await page.waitForFunction(() => window.blitzMatch?.state === "intro", null, { timeout: 5000 });
          const row = await page.evaluate(() => {
            const k = [...document.querySelector("#bz-demo").shadowRoot.querySelectorAll("[data-dir], [data-fs]")].map((e) => e.getBoundingClientRect()).find((r) => r.width);
            const e = document.querySelector("[data-hero-play-exit]").getBoundingClientRect(), h = document.querySelector("#bz-demo").getBoundingClientRect();
            return { dTop: Math.abs(e.top - k.top), gap: k.left - e.right, host: [h.top, h.left, h.width, h.height].map(Math.round) };
          });
          assert.ok(row.dTop <= 2, `Exit shares the (i) key's row (tops ${row.dTop} px apart)`);
          assert.ok(row.gap >= 0 && row.gap <= 12, `Exit sits just left of the game's first key (gap ${row.gap} px)`);
          assert.deepEqual(row.host, [0, 0, vp.width, vp.height], "the match has the whole viewport");
        }
        // The page does not scroll under it.
        assert.deepEqual(await under(), placed, "engaged: the page under the dialog has not moved (no jump, no scrollbar shift)");
        const pinned = () => page.evaluate(() => [scrollY, document.body.style.top]);
        const held = await pinned();
        assert.deepEqual(held, [0, `${-y0}px`], "engaged: the body is pinned where the page was");
        if (phone) await swipe(cdp, Math.round(vp.width / 2), Math.round(vp.height * 0.6), 300);
        else (await page.mouse.move(vp.width / 2, vp.height / 2), await page.mouse.wheel(0, 400));
        await frames(page);
        assert.deepEqual(await pinned(), held, "engaged: a wheel or a swipe does not scroll the page");
        // Focus stays in the dialog.
        for (let i = 0; i < 6; i++) {
          await page.keyboard.press("Tab");
          const inside = await page.evaluate((sel) => document.querySelector(sel).contains(document.activeElement) || document.activeElement === document.body, L.hero);
          assert.ok(inside, `engaged: Tab ${i + 1} stays in the dialog`);
        }
        // The game takes input.
        if (L.name === "battlefield") {
          const n = Number(await page.locator("[data-strikes]").textContent());
          const spot = await field(page, L.hero);
          phone ? await page.touchscreen.tap(spot.x, spot.y) : await page.mouse.click(spot.x, spot.y);
          await page.waitForFunction((n) => Number(document.querySelector("[data-strikes]").textContent) === n + 1, n, { timeout: 5000 });
        } else {
          await page.waitForFunction(() => window.blitzMatch?.state === "intro", null, { timeout: 5000 });
          const start = page.locator("#bz-demo").locator("button", { hasText: "PRESS START" });
          phone ? await start.tap() : await start.click();
          await page.waitForFunction(() => window.blitzMatch.state === "count" || window.blitzMatch.state === "play", null, { timeout: 5000 });
        }
        // Exit.
        if (how === "key") phone ? await page.locator("[data-hero-play-exit]").tap() : await page.locator("[data-hero-play-exit]").click();
        else if (how === "escape") await page.keyboard.press("Escape");
        else await page.goBack();
        await page.waitForFunction((sel) => !document.querySelector(sel).dataset.play, L.hero, { timeout: 5000 });
        await page.waitForFunction(() => history.state === null, null, { timeout: 5000 });
        await page.waitForFunction(L.up, null, { timeout: 10000 });
        const after = await page.evaluate(() => [scrollY, document.activeElement?.hasAttribute("data-hero-play-open")]);
        assert.deepEqual(after, [y0, true], `exit (${how}): the scroll position and the focus come back`);
        // PRESS START's launch burst (the kit's launch(), on <body>) clears itself when it lands.
        await page.waitForFunction(() => !document.querySelector(".bui-burst"), null, { timeout: 5000 });
        same(await snapshot(page, true), before, `exit (${how}): the page's HTML is what it was`);
      }

      // ---------- Back in attract: the page scrolls through the hero again ----------
      where = `${L.name} ${kind}: attract again`;
      await scrolledTo(page, 0);
      if (phone) await swipe(cdp, over.x, over.y, 300);
      else (await page.mouse.move(over.x, over.y), await page.mouse.wheel(0, 300));
      await page.waitForFunction(() => scrollY > 0, null, { timeout: 5000 });
      assert.deepEqual(errors, []);
      console.log(`${L.name} ${kind}: attract scrolls (wheel/swipe), engaged locks and plays, Exit / Escape${phone ? " / back" : ""} restore scroll ${"and"} focus and the HTML`);
      await ctx.close();
    }

  // ---------- Reduced motion: still frame, no expand, the game for the visit only ----------
  for (const L of LANDINGS)
    for (const [kind, opts] of [["1440", DESKTOP], ["390", PHONE]]) {
      where = `${L.name} ${kind}: reduced motion`;
      const phone = kind === "390";
      const ctx = await browser.newContext({ ...opts, reducedMotion: "reduce" });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(base + L.path);
      await page.waitForLoadState("load");
      if (L.name === "battlefield") {
        assert.equal(await page.locator(".arena-poster").isVisible(), true, "reduced motion: the still poster");
        assert.equal(await page.locator("[data-fizlet-slot]").count(), 0, "reduced motion: no battle in the background");
      } else {
        await page.waitForFunction(() => window.blitzDemo && !window.blitzDemo.engine.running, null, { timeout: 5000 });
        const f = await page.evaluate(() => window.blitzDemo.engine.stats().frames);
        await frames(page);
        assert.equal(await page.evaluate(() => window.blitzDemo.engine.stats().frames), f, "reduced motion: one still frame, no more");
      }
      const key = page.locator("[data-hero-play-open]");
      await key.evaluate((k) => k.scrollIntoView({ block: "center", behavior: "instant" }));
      await still(page);
      const y0 = await page.evaluate(() => scrollY);
      const before = await snapshot(page, false);
      phone ? await key.tap() : await key.click();
      await page.waitForFunction((sel) => document.querySelector(sel).dataset.play === "on", L.hero);
      assert.equal(await page.evaluate((sel) => document.querySelector(sel).getAnimations().length, L.hero), 0, "reduced motion: no expand animation");
      if (L.name === "battlefield") {
        await page.waitForFunction(() => window.arena?.engine.running && document.querySelector("canvas.arena"), null, { timeout: 8000 });
        assert.equal(await page.locator(".arena-poster").isVisible(), false, "the poster steps aside for play");
        const spot = await field(page, L.hero);
        phone ? await page.touchscreen.tap(spot.x, spot.y) : await page.mouse.click(spot.x, spot.y);
        await page.waitForFunction(() => document.querySelector("[data-strikes]").textContent === "01", null, { timeout: 5000 });
      } else await page.waitForFunction(() => window.blitzMatch?.state === "intro", null, { timeout: 5000 });
      await page.keyboard.press("Escape");
      await page.waitForFunction((sel) => !document.querySelector(sel).dataset.play && history.state === null, L.hero);
      assert.equal(await page.evaluate(() => scrollY), y0, "reduced motion: the scroll position comes back");
      same(await snapshot(page, false), before, "reduced motion: the page is byte for byte what it was");
      if (L.name === "battlefield") assert.equal(await page.locator(".arena-poster").isVisible(), true, "the poster is back");
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  console.log("Play in page: both landings, 1440 and 390, attract scroll, engaged lock + input + focus, Exit / Escape / back restore exactly, reduced motion.");
} catch (e) {
  console.error(`::error title=Play in page (${where})::${e.message}`);
  throw e;
} finally {
  await browser.close();
  server.close();
}
