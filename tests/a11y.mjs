// Accessible play (E14): a whole match from the keyboard alone, visible focus, overlays that take
// and give back focus, and the screen-reader announcements (one polite region, turn / units /
// result). Run with `npm run test:browser` (after tests/browser.mjs).
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createServer } from "vite";

const server = await createServer({ logLevel: "error", server: { host: "127.0.0.1", port: 5232 } });
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync("/tmp/chromium") ? "/tmp/chromium" : undefined),
  args: ["--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5232/?debug");

const bf = (expr) => page.evaluate(expr);
const focused = () => page.evaluate(() => {
  const e = document.activeElement;
  return e ? e.id || e.className || e.tagName : "";
});
/** Every announcement the region makes (its text at each write). */
await page.evaluate(() => {
  window.__said = [];
  new MutationObserver(() => {
    const r = document.querySelector("[data-fz-announce]");
    if (r && r.textContent.trim() && window.__said.at(-1) !== r.textContent) window.__said.push(r.textContent);
  }).observe(document.body, { subtree: true, childList: true, characterData: true });
});
const said = () => page.evaluate(() => window.__said.join(" | "));
/** Tab (forwards) until `sel` has focus; every stop on the way must show a focus ring. */
async function tabTo(sel, max = 120) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const at = await page.evaluate((sel) => {
      const e = document.activeElement;
      if (!e || e === document.body) return { hit: false, ring: true };
      const s = getComputedStyle(e);
      const ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
      return { hit: e.matches(sel), ring, name: e.id || e.className };
    }, sel);
    assert.ok(at.ring, `focus is visible on ${at.name}`);
    if (at.hit) return;
  }
  throw Error(`Tab never reached ${sel}`);
}

// Boot: any key presses start.
await page.waitForFunction(() => document.querySelector("#bf-boot")?.classList.contains("ready") || document.querySelector("#bf-boot")?.hidden);
await page.keyboard.press("Enter");
await page.waitForTimeout(400);

// Setup: a location, then Plan battle, by Tab and Enter.
await tabTo(".bf-mission");
await page.keyboard.press("Enter");
await tabTo("#bf-deploy");
await page.keyboard.press("Enter");
await page.waitForFunction(() => window.battlefield.playing && window.battlefield.command.planning);
await page.waitForTimeout(1200);
assert.match(await said(), /Planning, time frozen/, "the phase is announced");
assert.match(await said(), /Friendly 4 of 4, hostile 4 of 4/, "both platoons are announced");

// Plan: select tank 1 (key 1), then the map: arrow keys and Space plant its route; Enter locks.
await page.keyboard.press("Digit1");
assert.equal((await bf(() => window.battlefield.command)).selected >= 0, true, "1 selects a wingman");
await page.locator("#bf-viewport").focus();
assert.equal(await page.locator(".bf-tile.cursor").count(), 1, "the map shows a square cursor");
const start = await page.evaluate(() => Number(document.querySelector(".bf-tile.cursor").dataset.cell));
for (const k of ["ArrowRight", "ArrowRight", "ArrowRight", "ArrowRight", "ArrowDown"]) await page.keyboard.press(k);
const moved = await page.evaluate(() => Number(document.querySelector(".bf-tile.cursor").dataset.cell));
assert.notEqual(moved, start, "arrow keys move the cursor");
for (let tries = 0; tries < 8 && !(await bf(() => window.battlefield.command.draft?.stops.length)); tries++) {
  await page.keyboard.press("Space");
  if (!(await bf(() => window.battlefield.command.draft?.stops.length))) await page.keyboard.press("ArrowRight");
}
assert.ok(await bf(() => window.battlefield.command.draft?.stops.length), "Space plants a flag on the cursor's square");
await page.keyboard.press("Enter");
await page.keyboard.press("Escape");
await page.waitForTimeout(1100);
assert.match(await said(), /column \d+, row \d+/, "the cursor's square is announced");

// Start battle (Tab + Enter), then fight: auto-aim, advance, hold fire.
await tabTo("#bf-start");
await page.keyboard.press("Enter");
await page.waitForFunction(() => !window.battlefield.command.planning);
await page.keyboard.press("KeyE");
await page.keyboard.down("Space");
await page.waitForTimeout(1500);
await page.keyboard.up("Space");
assert.match(await said(), /Battle on/, "the battle is announced");

// Pause overlay: focus moves in, Tab stays in, Esc resumes and focus comes back out.
await page.keyboard.press("KeyP");
await page.waitForTimeout(200);
assert.equal(await focused(), "bf-giveup-no", "pause focuses Keep fighting");
await page.keyboard.press("Tab");
assert.equal(await focused(), "bf-giveup-yes", "Tab reaches Surrender");
await page.keyboard.press("Tab");
assert.equal(await focused(), "bf-giveup-no", "Tab cycles inside the overlay");
await page.keyboard.press("Escape");
assert.equal(await bf(() => window.battlefield.paused), false, "Esc keeps fighting");

// Keys panel and button tips: open with Enter, close with Esc, focus back on their key.
await page.locator("#bf-keys").focus();
await page.keyboard.press("Enter");
assert.equal(await page.locator("#bf-keys-panel").isVisible(), true, "Enter opens the keys panel");
await page.keyboard.press("Escape");
assert.equal(await page.locator("#bf-keys-panel").isVisible(), false, "Esc closes it");
assert.equal(await focused(), "bf-keys", "focus returns to the keys key");
await page.locator("#bf-tips").focus();
await page.keyboard.press("Enter");
assert.equal(await page.locator("#bf-coach").isVisible(), true, "Enter opens the tips");
assert.equal(await focused(), "bf-coach-off", "the tips take focus");
await page.keyboard.press("Escape");
assert.equal(await page.locator("#bf-coach").isVisible(), false, "Esc closes the tips");
assert.equal(await bf(() => window.battlefield.paused), false, "closing the tips resumes");

// The result: the match ends (debug hook), the overlay takes focus, the result is announced at once.
await bf(() => window.battlefield.end(true));
await page.waitForFunction(() => !document.querySelector("#bf-result").hidden);
assert.equal(await focused(), "bf-rematch", "the result focuses Rematch");
await page.waitForTimeout(100);
assert.match(await said(), /Mission complete: you win/, "the win is announced");
assert.match(await said(), /hostile 0 of 4/, "the last enemy loss is announced");
// Rematch from the keyboard, then surrender from the keyboard: a whole match, start to end.
await page.keyboard.press("Enter");
await page.waitForFunction(() => window.battlefield.playing && window.battlefield.command.planning);
await tabTo("#bf-start");
await page.keyboard.press("Enter");
await page.waitForFunction(() => !window.battlefield.command.planning);
await page.keyboard.press("KeyP");
await page.keyboard.press("Tab");
assert.equal(await focused(), "bf-giveup-yes");
await page.keyboard.press("Enter");
await page.waitForFunction(() => !window.battlefield.playing);
await page.waitForTimeout(1100);
assert.match(await said(), /Setup: choose an operation/, "back to setup is announced");

// Exactly one live region on the page, and it is the announcer's.
const live = await page.evaluate(() =>
  [...document.querySelectorAll("[aria-live], [role=status], [role=alert], [role=log]")].map((e) => e.outerHTML.slice(0, 80)));
assert.equal(live.length, 1, `one live region: ${live.join(", ")}`);
const region = await page.evaluate(() => {
  const r = document.querySelector("[data-fz-announce]"), s = getComputedStyle(r);
  return { role: r.getAttribute("role"), live: r.getAttribute("aria-live"), atomic: r.getAttribute("aria-atomic"), w: r.getBoundingClientRect().width, display: s.display, parent: r.parentElement === document.body };
});
assert.deepEqual(region, { role: "status", live: "polite", atomic: "true", w: 1, display: "block", parent: true });
assert.deepEqual(errors, [], "no page errors");
console.log({ keyboardMatch: true, announced: (await said()).split(" | ").length });
await browser.close();
await server.close();
