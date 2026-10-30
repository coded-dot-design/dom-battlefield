import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, existsSync } from "node:fs";
import { createServer } from "vite";
const server = await createServer({
  logLevel: "error",
  server: { host: "127.0.0.1", port: 5231 },
});
await server.listen();
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    (existsSync("/tmp/chromium") ? "/tmp/chromium" : undefined),
  args: ["--no-sandbox"],
});
mkdirSync("artifacts", { recursive: true });
const URL = "http://127.0.0.1:5231";
// Some Chromium builds refuse to resize a fullscreen window; leave fullscreen first.
async function resize(page, size) {
  await page.evaluate(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  });
  await page.setViewportSize(size);
  await page.waitForTimeout(120);
  if (await page.evaluate(() => window.battlefield?.gate === "fullscreen")) {
    await page.locator("#bf-gate-go").click();
    await page.waitForFunction(() => window.battlefield.gate === null);
  }
}
// Touch battles stop at the ready gate until landscape + full screen.
async function passGate(page) {
  await page.waitForTimeout(120);
  if (await page.evaluate(() => window.battlefield.gate === "fullscreen"))
    await page.locator("#bf-gate-go").click();
  await page.waitForFunction(() => window.battlefield.gate === null);
  if (await page.locator("#bf-coach").isVisible())
    await page.locator("#bf-coach").click({ position: { x: 5, y: 5 } });
}
// The white flag pauses the battle and asks: keep fighting or surrender.
async function restart(page) {
  if (!(await page.locator("#bf-giveup").isVisible())) await page.locator("#bf-pause").click();
  assert.equal(await page.evaluate(() => window.battlefield.paused), true, "the battle holds while asking");
  await page.locator("#bf-giveup-yes").click();
  await page.waitForFunction(() => !window.battlefield.playing);
}
/** Step 1: pick a location (the card opens Terrain), then Plan battle or Quick start. */
async function plan(page, mobile, mission = 0) {
  await page.locator(".bf-mission").nth(mission).click();
  await page.locator("#bf-deploy").click();
  await page.waitForFunction(() => window.battlefield.playing && window.battlefield.command.planning);
  if (mobile) await passGate(page);
}
const cmd = (page) => page.evaluate(() => window.battlefield.command);
const visibleTanks = (page) => page.locator(".bf-tank:visible").count();
/** A box in viewport pixels, or null. */
const box = (page, sel) => page.locator(sel).first().boundingBox();
/** Pause and results share the same physical sticker landing and map-bottom action layout. */
async function checkOverlay(page, id) {
  const sticker = page.locator(`${id} .bf-sticker`);
  await sticker.evaluate(async (n) => {
    await Promise.all(n.getAnimations().filter((a) => a.animationName === "bf-slam").map((a) => a.finished));
  });
  const layout = await page.evaluate((id) => {
    const overlay = document.querySelector(id),
      vp = document.querySelector("#bf-viewport").getBoundingClientRect(),
      // The camera may pan a larger world off center; the controls stay anchored to the
      // visible map viewport, rather than following that moving world underneath them.
      map = { left: Math.max(0, vp.left), top: Math.max(0, vp.top), right: Math.min(innerWidth, vp.right), bottom: Math.min(innerHeight, vp.bottom) },
      sticker = overlay.querySelector(".bf-sticker"),
      label = sticker.getBoundingClientRect(),
      keys = overlay.querySelector(".bf-overlay-keys").getBoundingClientRect(),
      shadow = getComputedStyle(sticker).boxShadow.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/),
      hit = document.elementFromPoint(vp.left + 8, vp.top + 8);
    return {
      map, label: { center: label.top + label.height / 2, bottom: label.bottom },
      keys: { x: keys.left + keys.width / 2, top: keys.top, bottom: keys.bottom },
      shadowY: shadow ? Number(shadow[2]) : 0,
      blocksMap: Boolean(hit?.closest(id)),
    };
  }, id);
  const height = layout.map.bottom - layout.map.top;
  assert.ok(Math.abs(layout.keys.x - (layout.map.left + layout.map.right) / 2) < 3, "overlay actions center on the map");
  assert.ok(layout.keys.bottom <= layout.map.bottom + 2, "overlay actions stay inside the map");
  assert.ok(layout.keys.bottom > layout.map.top + height * 0.75, "overlay actions sit toward the bottom on every layout");
  assert.ok(layout.label.center < layout.map.top + height * 0.52, "hero sticker balances just above the map center");
  assert.ok(layout.label.bottom < layout.keys.top, "hero sticker and actions do not overlap");
  assert.ok(Math.abs(layout.shadowY) < 1, "hero sticker finishes pressed into its base");
  assert.equal(layout.blocksMap, true, "the grey overlay intercepts background map input");
}
let where = "start";
try {
  where = "hero tank art";
  {
    // The landing hero draws the game's Sherman as fizlet/sprite data (site/src/scripts/arena/tank.ts):
    // pixel for pixel the shared drawing, every tread frame, recoil frame and the muzzle flash.
    const page = await browser.newPage();
    await page.goto(URL);
    const diff = await page.evaluate(async () => {
      const { tankSprites } = await import("/shared/sherman-sprites.ts");
      const { sprites } = await import("/vendor/fizlet/sprite.ts");
      const { TANK, RECOIL } = await import("/site/src/scripts/arena/tank.ts");
      const shared = tankSprites(document), art = sprites(TANK, { palettes: [{ team: "#39ffb0" }, { team: "#fff8d4" }] });
      const pixels = (draw) => {
        const c = document.createElement("canvas");
        c.width = c.height = 80;
        const g = c.getContext("2d");
        draw(g);
        return g.getImageData(0, 0, 80, 80).data;
      };
      let off = 0;
      for (let tread = 0; tread < 2; tread++)
        for (let recoil = 0; recoil < RECOIL; recoil++)
          for (const flash of [false, true]) {
            const a = pixels((g) => shared(g, 32, 40, 0, 0, "#39ffb0", tread, recoil, flash));
            const b = pixels((g) => (art.draw(g, 0, tread, 32, 40, 0, 1, 0), art.draw(g, 1, recoil, 32, 40, 0, 1, flash ? 1 : 0)));
            for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) off++;
          }
      return off;
    });
    assert.equal(diff, 0, "the hero's tank is the game's tank");
    await page.close();
  }
  for (const mobile of [false, true])
    for (const light of [false, true]) {
      where = `${mobile ? "mobile" : "desktop"}-${light ? "light" : "dark"}`;
      const ctx = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
        hasTouch: mobile,
        isMobile: mobile,
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(URL);
      await page.waitForFunction(() => window.battlefield);
      if (mobile) {
        // Phones: one intro card about installing (shown once), and portrait waits for a turn.
        assert.equal(await page.evaluate(() => window.battlefield.install), "menu", "the intro card offers the browser's install");
        assert.equal(await page.evaluate(() => window.battlefield.gate), "rotate", "setup is landscape-only on a phone");
        assert.equal(await page.locator("#bf-gate-exit").isVisible(), false, "no Back to setup before a battle");
        // Upright, the rotate gate carries the install tip; the card waits for landscape.
        assert.equal(await page.locator("#bf-install").isVisible(), false, "the install card never covers the rotate gate");
        await page.setViewportSize({ width: 844, height: 390 });
        await page.locator("#bf-install-later").click();
        assert.equal(await page.evaluate(() => window.battlefield.install), null);
        await page.waitForFunction(() => window.battlefield.gate === null);
        assert.equal(await page.locator("#battlefield").getAttribute("data-ui"), "touch");
      } else assert.equal(await page.locator("#battlefield").getAttribute("data-ui"), "desk");
      if (light) {
        await page.locator("#bf-theme").click();
        assert.equal(await page.locator("#bf-theme .bf-sun").isVisible(), true, "the theme key shows the sun in light");
      } else assert.equal(await page.locator("#bf-theme .bf-moon").isVisible(), true);
      assert.equal(await page.locator("#bf-settings").count(), 0, "no settings gear");
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      // Step 1 starts blank: the two HQs, no tanks, no terrain, no start keys yet.
      assert.equal(await page.locator("#battlefield").getAttribute("data-stage"), "setup");
      assert.equal(await page.locator("#battlefield").getAttribute("data-blank"), "");
      assert.equal(await page.locator(".bf-mission").count(), 4);
      assert.equal(await page.locator(".bf-thumb").count(), 4, "each location has a terrain thumbnail");
      assert.equal(await page.locator(".bf-tile[data-kind]:not([data-kind=ground]):visible").count() - (await page.locator(".bf-thumb .bf-tile:not([data-kind=ground])").count()), 0, "no obstacles before a location is picked");
      assert.equal(await visibleTanks(page), 0, "no tanks in step 1");
      assert.equal(await page.locator("#bf-terrain").isVisible(), false);
      assert.equal(await page.locator("#bf-go").isVisible(), false);
      // Picking a location shows its ground and opens Terrain right under it (Light by default).
      for (let i = 3; i >= 0; i--) {
        await page.locator(".bf-mission").nth(i).click();
        const s = await page.evaluate(() => window.battlefield.snapshot());
        assert.equal(s.mission, i);
        assert.equal(s.units.length, 8);
        assert.equal(await page.locator(".bf-mission").nth(i).evaluate((n) => n.nextElementSibling?.id), "bf-terrain");
      }
      assert.equal(await page.locator("#battlefield").getAttribute("data-blank"), null);
      assert.equal(await page.locator("#bf-go").isVisible(), true, "Quick start + Plan battle appear");
      assert.equal(await page.locator('#bf-density [data-density="0.6"]').getAttribute("aria-pressed"), "true", "Light is the default");
      const solids = () => page.evaluate(() => window.battlefield.snapshot().board.tiles.filter((t) => t !== "ground" && t !== "road").length);
      const lightCount = await solids();
      await page.locator('#bf-density [data-density="1.45"]').click();
      assert.ok((await solids()) > lightCount, "heavy terrain has more obstacles");
      // The dice rolls a new layout at the same density.
      const seedBefore = await page.evaluate(() => window.battlefield.snapshot().board.seed);
      await page.locator("#bf-reroll").click();
      assert.notEqual(await page.evaluate(() => window.battlefield.snapshot().board.seed), seedBefore);
      assert.equal(await page.locator('#bf-density [data-density="1.45"]').getAttribute("aria-pressed"), "true", "the dice keeps the density");
      await page.locator('#bf-density [data-density="0.6"]').click();
      await page.screenshot({ path: `artifacts/setup-${mobile ? "mobile" : "desktop"}-${light ? "light" : "dark"}.png` });
      if (!mobile) {
        // More space (full screen) means a bigger field: more squares, not just bigger ones.
        const cols = () => page.evaluate(() => window.battlefield.snapshot().board.cols);
        await page.setViewportSize({ width: 1100, height: 760 });
        await page.waitForTimeout(150);
        const small = await cols();
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.waitForTimeout(250);
        assert.ok((await cols()) > small, "a bigger screen grows the field");
      } else {
        // The phone field fills the screen while setting up: as wide as it is tall allows.
        const w = await box(page, ".bf-world"), v = await box(page, "#bf-viewport");
        assert.ok(w.width >= v.width - 30 || w.height >= v.height - 30, "the field fills the screen");
      }
      await page.locator(".bf-mission").first().click();
      await page.locator("#bf-deploy").click();
      await page.waitForFunction(() => window.battlefield.playing);
      assert.equal(await page.evaluate(() => window.battlefield.playing), true);
      if (mobile) {
        // Leaving full screen mid-battle locks the gate; one tap restores it.
        await page.waitForFunction(() => window.battlefield.gate !== undefined);
        if (await page.evaluate(() => window.battlefield.gate === "fullscreen")) await page.locator("#bf-gate-go").click();
        await page.waitForFunction(() => window.battlefield.gate === null);
        if (await page.evaluate(() => !!document.fullscreenElement)) {
          await page.evaluate(() => document.exitFullscreen());
          await page.waitForFunction(() => window.battlefield.gate === "fullscreen");
          await page.locator("#bf-gate-go").click();
          await page.waitForFunction(() => window.battlefield.gate === null);
        }
        assert.equal(await page.locator("#bf-coach").isVisible(), false, "no tips while planning");
        assert.equal(await page.evaluate(() => getComputedStyle(document.body).userSelect), "none");
      }
      // Plan home: three cards. Time is frozen and nothing is selected yet.
      assert.equal(await page.locator("#battlefield").getAttribute("data-stage"), "plan");
      assert.equal(await page.locator("#bf-plan-home").isVisible(), true);
      assert.equal(await page.locator(".bf-home-card").count(), 3);
      assert.equal(await page.locator('.bf-home-card [data-badge="per"]').textContent(), "4");
      assert.equal(await page.locator("#bf-start").isVisible(), true, "Start battle is there from the first plan card");
      assert.equal(await page.locator("#bf-status").textContent(), "PLAN");
      assert.equal(await visibleTanks(page), 8, "the platoons arrive for planning");
      const t0 = await page.evaluate(() => window.battlefield.snapshot().time);
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => window.battlefield.snapshot().time), t0, "time frozen while planning");
      // Platoon: opens on the side away from your team; changes rebuild the battle and stick.
      await page.locator('.bf-home-card[data-open="platoon"]').click();
      assert.equal(await page.locator("#bf-card-platoon").isVisible(), true);
      assert.equal(await page.locator("#bf-card-platoon").getAttribute("data-away"), "right", "side A: the card sits right");
      const startBeforeSide = await box(page, "#bf-start");
      await page.locator('#bf-side [data-side="1"]').click();
      assert.equal(await page.evaluate(() => window.battlefield.snapshot().side), 1);
      assert.equal(await page.locator("#bf-card-platoon").getAttribute("data-away"), "left", "side B: the card hops left");
      if (!mobile) {
        const startAfterSide = await box(page, "#bf-start");
        assert.ok(Math.abs(startAfterSide.x - startBeforeSide.x) < 1, "desktop Start stays anchored when the planning card switches sides");
      }
      assert.equal((await cmd(page)).planning, true, "still planning after a change");
      await page.locator('#bf-side [data-side="0"]').click();
      await page.locator('#bf-formation [data-formation="line"]').click();
      await page.locator('#bf-formation [data-formation="wedge"]').click();
      // Drag a card by its grip: it stays where it lands.
      {
        const g = await box(page, "#bf-card-platoon .bf-card-grip");
        await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
        await page.mouse.down();
        await page.mouse.move(g.x + g.width / 2 - 80, g.y + g.height / 2 + 30, { steps: 5 });
        await page.mouse.up();
        assert.equal(await page.locator("#bf-card-platoon").getAttribute("data-moved"), "", "the card moved");
        const after = await box(page, "#bf-card-platoon .bf-card-grip");
        assert.ok(Math.abs(after.x - (g.x - 80)) < 6, "it landed under the finger");
      }
      // A single click shrinks the card; the same native button also opens it from the keyboard.
      {
        const fold = page.locator("#bf-card-platoon .bf-fold-key");
        assert.equal(await fold.evaluate((n) => n.tagName), "BUTTON");
        assert.equal(await fold.getAttribute("aria-expanded"), "true");
        assert.equal(await fold.getAttribute("data-fold-tip"), "Click to shrink");
        await fold.click();
        assert.equal(await page.locator("#bf-card-platoon").evaluate((n) => n.classList.contains("folded")), true, "one click shrinks the card");
        assert.equal(await page.locator("#bf-side").isVisible(), false);
        assert.equal(await fold.getAttribute("aria-expanded"), "false");
        assert.equal(await fold.getAttribute("data-fold-tip"), "Click to expand");
        await fold.press("Enter");
        assert.equal(await page.locator("#bf-side").isVisible(), true, "Enter opens the card exactly once");
        assert.equal(await fold.getAttribute("aria-expanded"), "true");
      }
      // Desktop gives the cards an explicit Next / Previous footer. Touch keeps the circular
      // shortcuts with small captions, so the controls do not cost another row of map space.
      if (!mobile) {
        await page.locator('#bf-card-platoon .bf-card-next[data-open="loadout"]').click();
        assert.equal(await page.locator("#bf-card-loadout").isVisible(), true, "Next opens Loadout");
        await page.locator('#bf-card-loadout .bf-card-prev[data-open="platoon"]').click();
        assert.equal(await page.locator("#bf-card-platoon").isVisible(), true, "Previous returns to Platoon");
      } else {
        assert.equal(await page.locator("#bf-card-platoon .bf-card-nav").isVisible(), false, "touch cards have no extra footer");
        assert.equal(await page.locator('#bf-card-platoon .bf-orb[data-open="loadout"] .bf-orb-caption').isVisible(), true, "touch Next is labelled on the existing circle");
      }
      // Orbit: hop straight to Loadout. Over budget blocks the start keys.
      await page.locator('#bf-card-platoon .bf-orb[data-open="loadout"]').click();
      assert.equal(await page.locator("#bf-card-loadout").isVisible(), true);
      assert.equal(await page.locator("#bf-card-platoon").isVisible(), false);
      await page.locator("#bf-card-loadout .bf-fold-key").click();
      assert.equal(await page.locator("#bf-loadout").isVisible(), false, "Loadout also shrinks with one click");
      await page.locator("#bf-card-loadout .bf-fold-key").press("Space");
      assert.equal(await page.locator("#bf-loadout").isVisible(), true, "Space opens Loadout exactly once");
      await page.locator('[data-slot="1"] [data-role="heavy"]').click();
      assert.equal(await page.locator("#bf-start").isDisabled(), true, "over budget blocks Start");
      await page.locator(mobile ? '#bf-card-loadout .bf-orb[data-open="plan"]' : '#bf-card-loadout .bf-card-next[data-open="plan"]').click();
      assert.equal(await page.locator("#bf-card-loadout").isVisible(), true, "Next respects the loadout budget guard");
      await page.locator('[data-slot="1"] [data-role="scout"]').click();
      assert.equal(await page.locator('[data-slot="1"] [data-role="scout"]').getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator("#bf-start").isDisabled(), false);
      assert.equal(await page.locator("#bf-card-loadout .bf-x").count(), 0, "no close key: the orbit moves on");
      // Planning: drag your HQ to another open spot on your half; the squad redeploys around it.
      await page.locator('#bf-card-loadout .bf-orb[data-open="plan"]').click();
      assert.equal(await page.locator("#bf-plan-home").isVisible(), false);
      const hqDrag = await page.evaluate(async () => {
        const { moveBase, point } = await import("/src/model.ts");
        const s = window.battlefield.snapshot(),
          b = s.board,
          world = document.querySelector(".bf-world").getBoundingClientRect(),
          tile = world.width / b.cols,
          from = point(b, b.bases[0]);
        for (const [dx, dy] of [[2, -3], [2, 3], [1, -4], [1, 4], [3, 0]]) {
          const id = Math.floor(from.y + dy) * b.cols + Math.floor(from.x + dx),
            test = structuredClone(b);
          if (!moveBase(test, 0, id)) continue;
          const to = { x: world.left + ((id % b.cols) + 0.5) * tile, y: world.top + (Math.floor(id / b.cols) + 0.5) * tile },
            hit = document.elementFromPoint(to.x, to.y);
          const start = document.elementFromPoint(world.left + from.x * tile, world.top + from.y * tile);
          if (!hit?.closest("#bf-viewport") || hit.closest(".bf-tank") || !start?.closest("#bf-viewport") || start.closest(".bf-tank")) continue;
          return { id, from: { x: world.left + from.x * tile, y: world.top + from.y * tile }, to };
        }
        return null;
      });
      if (hqDrag) {
        await page.mouse.move(hqDrag.from.x, hqDrag.from.y);
        await page.mouse.down();
        await page.mouse.move(hqDrag.to.x, hqDrag.to.y, { steps: 6 });
        await page.mouse.up();
        const after = await page.evaluate(() => window.battlefield.snapshot());
        assert.equal(after.board.bases[0], hqDrag.id, "HQ moved");
        const hq = { x: (hqDrag.id % after.board.cols) + 0.5, y: Math.floor(hqDrag.id / after.board.cols) + 0.5 };
        assert.ok(Math.hypot(after.units[0].x - hq.x, after.units[0].y - hq.y) < 4, "squad redeployed at the new HQ");
        assert.equal((await cmd(page)).planning, true);
      }
      // Plan: the first wingman is selected and its three orders ride beside it.
      assert.deepEqual({ ...(await cmd(page)), draft: undefined }, { on: true, planning: true, selected: 1, draft: undefined });
      assert.equal(await page.locator("#bf-cmd").isVisible(), true);
      assert.equal(await page.locator("#bf-cmd").getAttribute("data-away"), "right");
      assert.equal(await page.locator("#bf-cmd-close").count(), 0, "the plan card has no close key");
      assert.equal(await page.locator("#bf-acts").isVisible(), true);
      assert.equal(await page.locator("#bf-next").evaluate((n) => n.classList.contains("bf-call")), false, "Next calls only once there is an order");
      assert.equal(await page.locator("#bf-cmd-badge b").textContent(), "1");
      // Move HQ / Move Tanks: a switch, one side always on.
      assert.equal(await page.locator("#bf-mode-tanks").getAttribute("aria-checked"), "true");
      await page.locator("#bf-mode-hq").click();
      assert.equal(await page.locator("#bf-mode-hq").getAttribute("aria-checked"), "true");
      assert.equal(await page.locator("#bf-mode-tanks").getAttribute("aria-checked"), "false");
      assert.equal(await page.locator("#bf-acts").isVisible(), false, "Move HQ: no tank orders");
      await page.locator("#bf-mode-hq").click();
      assert.equal(await page.locator("#bf-mode-hq").getAttribute("aria-checked"), "true", "tapping the lit side does nothing");
      await page.locator("#bf-mode-tanks").click();
      assert.equal(await page.locator("#bf-mode-tanks").getAttribute("aria-checked"), "true", "the other side switches back");
      assert.equal((await cmd(page)).selected, 1);
      // Attack HQ: on, and tapping it again clears the order (the tank fights on its own).
      await page.locator('#bf-acts [data-act="hq"]').click();
      assert.equal(await page.locator('#bf-acts [data-act="hq"]').getAttribute("aria-pressed"), "true");
      let u1 = await page.evaluate(() => window.battlefield.snapshot().units[1]);
      assert.equal(u1.route.at(-1), await page.evaluate(() => window.battlefield.snapshot().board.bases[1]), "routed at the enemy HQ");
      assert.equal(await page.locator("#bf-next").evaluate((n) => n.classList.contains("bf-call")), true, "an order makes Next call");
      await page.locator('#bf-acts [data-act="hq"]').click();
      assert.equal(await page.locator('#bf-acts [data-act="hq"]').getAttribute("aria-pressed"), "false");
      u1 = await page.evaluate(() => window.battlefield.snapshot().units[1]);
      assert.deepEqual(u1.route, [], "cleared");
      // Follow me: one order at a time.
      await page.locator('#bf-acts [data-act="follow"]').click();
      assert.equal(await page.evaluate(() => window.battlefield.snapshot().units[1].order), "follow");
      assert.equal(await page.locator('#bf-acts [data-act="follow"]').getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator('#bf-acts [data-act="hq"]').getAttribute("aria-pressed"), "false");
      // Command: plant a flag with a tap; a dashed draft and the check appear.
      await page.locator('#bf-acts [data-act="route"]').click();
      assert.equal(await page.locator('#bf-acts [data-act="route"]').getAttribute("aria-pressed"), "true");
      const spot = await page.evaluate(async () => {
        const { plot, cell, point } = await import("/src/model.ts");
        const s = window.battlefield.snapshot(),
          u = s.units[1],
          from = cell(s.board, u);
        const ok = (id) => {
          const r = document.querySelector(`[data-cell="${id}"]`).getBoundingClientRect(),
            x = r.left + r.width / 2,
            y = r.top + r.height / 2,
            hit = document.elementFromPoint(x, y);
          return hit && hit.closest("#bf-viewport") && !hit.closest(".bf-tank") ? { id, x, y } : null;
        };
        for (const [id] of s.board.tiles.entries()) {
          const q = point(s.board, id),
            d = Math.hypot(u.x - q.x, u.y - q.y);
          if (q.x < 2 || q.y < 2 || q.x > s.board.cols - 2 || q.y > s.board.rows - 2) continue;
          if (d < 5 || d > 9 || !plot(s.board, from, [id]) || s.units.some((v) => Math.hypot(v.x - q.x, v.y - q.y) < 1.2)) continue;
          const at = ok(id);
          if (at) return at;
        }
        return null;
      });
      assert.ok(spot, "found an open square on screen");
      await page.mouse.click(spot.x, spot.y);
      assert.deepEqual((await cmd(page)).draft.stops, [spot.id]);
      await page.waitForFunction(() => document.querySelectorAll(".bf-route.draft").length === 1);
      assert.equal(await page.locator("#bf-cmd-state").textContent(), "PLOTTING");
      assert.equal(await page.locator("#bf-check").isVisible(), true);
      assert.equal(await page.locator("#bf-check").getAttribute("data-state"), "draft");
      // Drag the middle of the line to an open square nearby: that adds a turn.
      const bend = await page.evaluate(async () => {
        const { plot, cell } = await import("/src/model.ts");
        const s = window.battlefield.snapshot(),
          c = window.battlefield.command,
          line = document.querySelector(".bf-route-hit"),
          pts = line.getAttribute("points").split(" ").map((p) => p.split(",").map(Number)),
          world = document.querySelector(".bf-world").getBoundingClientRect(),
          tile = world.width / s.board.cols,
          hq = document.querySelector(".bf-base.own").getBoundingClientRect(),
          offHq = (x, y) => x < hq.left - 4 || x > hq.right + 4 || y < hq.top - 4 || y > hq.bottom + 4,
          seen = ([x, y]) => document.elementFromPoint(world.left + x * tile, world.top + y * tile) === line && offHq(world.left + x * tile, world.top + y * tile),
          inner = pts.slice(1, -1).filter(seen),
          [mx, my] = inner[Math.floor(inner.length / 2)] ?? pts[Math.floor(pts.length / 2)];
        for (const dy of [2, -2, 3, -3])
          for (const dx of [0, 1, -1]) {
            const x = Math.floor(mx) + dx,
              y = Math.floor(my) + dy,
              id = y * s.board.cols + x;
            if (x < 0 || y < 0 || x >= s.board.cols || y >= s.board.rows) continue;
            if (!plot(s.board, cell(s.board, s.units[c.selected]), [id, ...c.draft.stops])) continue;
            const to = { x: world.left + (x + 0.5) * tile, y: world.top + (y + 0.5) * tile },
              hit = document.elementFromPoint(to.x, to.y);
            if (!hit?.closest("#bf-viewport") || !offHq(to.x, to.y)) continue;
            return { from: { x: world.left + mx * tile, y: world.top + my * tile }, to, id };
          }
        return null;
      });
      if (bend) {
        await page.mouse.move(bend.from.x, bend.from.y);
        await page.mouse.down();
        await page.mouse.move(bend.to.x, bend.to.y, { steps: 6 });
        await page.mouse.up();
        const stops = (await cmd(page)).draft.stops;
        assert.equal(stops.length, 2, `bend adds a stop: ${JSON.stringify(stops)}`);
        assert.equal(stops.at(-1), spot.id, "destination unchanged");
      }
      const drafted = (await cmd(page)).draft.stops;
      await page.locator("#bf-check").click();
      const locked = await page.evaluate(() => window.battlefield.snapshot().units[1]);
      assert.deepEqual(locked.route, drafted, "the check sends the route to the tank");
      assert.equal(locked.order, "hold");
      assert.match(await page.locator("#bf-cmd-state").textContent(), /^ROGER · GRID \d{4}$/);
      assert.equal(await page.locator("#bf-cmd-state").getAttribute("data-kind"), "command", "the order pill takes the order's colour");
      assert.equal(await page.locator("#bf-check").getAttribute("data-state"), "locked", "the check stays lit by the flag");
      await page.waitForFunction(() => !document.querySelector(".bf-route.draft"), null, { timeout: 2000 });
      // A resize while planning (address bar, full screen) keeps the plan and the ground.
      {
        const before = await page.evaluate(() => { const s = window.battlefield.snapshot(); return { route: s.units[1].route.join(), cols: s.board.cols, seed: s.board.seed }; });
        const vs = page.viewportSize();
        await resize(page, { width: vs.width, height: vs.height - 30 });
        await page.waitForTimeout(250);
        const after = await page.evaluate(() => { const s = window.battlefield.snapshot(); return { route: s.units[1].route.join(), cols: s.board.cols, seed: s.board.seed }; });
        await resize(page, vs);
        await page.waitForTimeout(250);
        assert.deepEqual(after, before, "planning survives a resize");
      }
      // Next: on to the next tank.
      await page.locator("#bf-next").click();
      assert.equal((await cmd(page)).selected, 2);
      // Desktop: objective + messages live in the comms panel above the map; touch has a toast.
      assert.equal(await page.locator(".bf-comms #bf-announcement").count(), mobile ? 0 : 1);
      if (mobile) assert.ok(await page.locator(".bf-footer").evaluate((n) => n.classList.contains("show")), "comms toast shows");
      // Your own tank takes a route too: its platoon key (desktop) selects it.
      if (!mobile) {
        await page.locator("#bf-roster .bf-unit").first().click();
        assert.equal((await cmd(page)).selected, 0);
        assert.match(await page.locator("#bf-cmd-tank").textContent(), /^YOUR TANK/);
        assert.equal(await page.locator('#bf-acts [data-act="follow"]').isDisabled(), true, "your tank doesn't follow itself");
      }
      // The numbered Plan badge has the same single-click and keyboard fold contract.
      {
        const badge = page.locator("#bf-cmd-badge");
        const selectedBefore = (await cmd(page)).selected;
        await badge.click();
        assert.equal(await page.locator("#bf-cmd").evaluate((n) => n.classList.contains("folded")), true);
        assert.equal(await badge.getAttribute("aria-expanded"), "false");
        await badge.press("Enter");
        assert.equal(await badge.getAttribute("aria-expanded"), "true");
        assert.equal((await cmd(page)).selected, selectedBefore, "folding does not change the selected tank");
      }
      // Start presses and bursts using a bounded effect; command mode ends and aim returns.
      await page.locator("#bf-start").click();
      assert.equal(await page.locator("#bf-start").evaluate((n) => n.classList.contains("go")), true);
      assert.equal(await page.locator(".bf-launch-burst").count(), 1, "one launch burst is active");
      assert.ok((await page.locator(".bf-launch-bit").count()) <= 16, "launch fragments have a hard cap");
      await page.waitForFunction(() => document.querySelector("#bf-start").hidden);
      await page.waitForFunction(() => !document.querySelector(".bf-launch-burst"), null, { timeout: 1500 });
      assert.equal(await page.locator("#battlefield").getAttribute("data-stage"), "battle");
      assert.equal(await page.locator(".bf-mode").isVisible(), false, "Move HQ is planning only");
      assert.deepEqual(
        { on: (await cmd(page)).on, planning: (await cmd(page)).planning, aim: await page.evaluate(() => window.battlefield.aim.mode) },
        { on: false, planning: false, aim: mobile ? "auto" : "pointer" },
      );
      if (mobile) {
        await page.waitForFunction(() => !document.querySelector("#bf-coach").hidden);
        await page.waitForFunction(() => document.querySelectorAll(".bf-coach-tip").length >= 12);
        const off = await page.evaluate(() =>
          [...document.querySelectorAll(".bf-tip-label")].filter((n) => {
            const r = n.getBoundingClientRect();
            return r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight;
          }).length,
        );
        assert.equal(off, 0, "every tip label is fully on screen");
        await page.locator(".bf-tip-label").first().click();
        assert.equal(await page.locator(".bf-tip-label").first().getAttribute("aria-expanded"), "true");
        assert.ok(await page.locator("#bf-coach").isVisible(), "tapping a label keeps the tips open");
        assert.equal(await page.evaluate(() => window.battlefield.paused), true, "tips hold the battle");
        if (light) await page.locator("#bf-coach-off").click();
        else await page.locator("#bf-coach").click({ position: { x: 300, y: 200 } });
        assert.equal(await page.locator("#bf-coach").isVisible(), false);
      }
      await page.waitForTimeout(200);
      assert.ok((await page.evaluate(() => window.battlefield.snapshot().time)) > t0, "battle runs after Start");
      if (mobile) {
        // Touch battle: no header; Command slides the right rail away and Auto stays on.
        assert.equal(await page.locator(".bf-header").isVisible(), false, "no header in battle");
        const fireAt = await box(page, ".bf-fire"), autoAt = (await box(page, "#bf-auto")).x;
        await page.locator("#bf-command").click();
        assert.equal((await cmd(page)).on, true);
        assert.equal(await page.locator("#bf-auto").getAttribute("aria-pressed"), "true", "auto-aim stays on in command mode");
        await page.waitForTimeout(320);
        assert.ok((await box(page, "#bf-auto")).x > autoAt + 100, "the right rail slides off");
        const fireCmd = await box(page, ".bf-fire");
        assert.ok(fireCmd.width < fireAt.width * 0.75 && fireCmd.width > fireAt.width * 0.5, "Fire shrinks by a third");
        assert.ok(fireCmd.x + fireCmd.width <= (await page.evaluate(() => innerWidth)) && fireCmd.x > fireAt.x, "Fire slides right, on screen");
        assert.equal(await page.locator("#bf-cmd").isVisible(), false, "touch battle: no info card");
        await page.locator("#bf-command").click();
        assert.equal((await cmd(page)).on, false);
        await page.waitForTimeout(320);
        // The shrunk Fire (an x) also closes command mode.
        await page.locator("#bf-command").click();
        await page.waitForTimeout(320);
        await page.locator(".bf-fire").click();
        assert.equal((await cmd(page)).on, false, "Fire leaves command mode");
        await page.waitForTimeout(320);
        // Auto is a switch: off, the gun points where you drive; on again, back to auto.
        await page.locator("#bf-auto").click();
        assert.equal(await page.evaluate(() => window.battlefield.aim.mode), "free");
        assert.equal(await page.locator("#bf-auto").getAttribute("aria-pressed"), "false");
        await page.locator("#bf-auto").click();
        assert.equal(await page.evaluate(() => window.battlefield.aim.mode), "auto");
      } else {
        // Desktop: Command is one of the aim modes; Auto switches it off again.
        await page.locator("#bf-command").click();
        assert.equal((await cmd(page)).on, true);
        assert.equal(await page.locator("#bf-auto").getAttribute("aria-pressed"), "false");
        assert.equal(await page.locator("#bf-cmd").isVisible(), true);
        await page.locator("#bf-auto").click();
        assert.equal((await cmd(page)).on, false);
        assert.equal(await page.locator("#bf-cmd").isVisible(), false);
        // Space (fire) and the GUN OFF · FIGHT key both hand the gun back.
        await page.locator("#bf-command").click();
        assert.equal(await page.locator("#bf-fight").isVisible(), true, "command mode shows FIGHT");
        await page.keyboard.press("Space");
        assert.equal((await cmd(page)).on, false, "Space leaves command mode");
        await page.locator("#bf-command").click();
        await page.locator("#bf-fight").click();
        assert.equal((await cmd(page)).on, false, "FIGHT leaves command mode");
        assert.equal(await page.locator("#bf-fight").isVisible(), false);
      }
      const before = await page.evaluate(() => window.battlefield.snapshot().units[0]);
      await page.keyboard.down("KeyD");
      await page.waitForTimeout(180);
      await page.keyboard.up("KeyD");
      assert.ok((await page.evaluate(() => window.battlefield.snapshot().units[0])).x > before.x);
      if (mobile) {
        // Thumbstick: a drag to the right drives right; a light push creeps slower than a full one.
        const st = await box(page, "#bf-stick"),
          cx = st.x + st.width / 2,
          cy = st.y + st.height / 2;
        const drive = async (frac) => {
          const a = await page.evaluate(() => window.battlefield.snapshot().units[0].x);
          await page.mouse.move(cx, cy);
          await page.mouse.down();
          await page.mouse.move(cx + st.width * 0.36 * frac, cy, { steps: 3 });
          await page.waitForTimeout(400);
          await page.mouse.up();
          return (await page.evaluate(() => window.battlefield.snapshot().units[0].x)) - a;
        };
        const full = await drive(1),
          slow = await drive(0.4);
        assert.ok(full > 0.2, `stick drives: ${full}`);
        assert.ok(slow < full, `analog throttle: ${slow} < ${full}`);
        assert.equal(await page.locator(".bf-knob").evaluate((el) => el.style.transform), "");
      }
      const squad = (order) =>
        page.evaluate((order) => window.battlefield.snapshot().units.filter((u) => u.side === 0 && u.id !== 0).every((u) => u.order === order), order);
      await page.locator("[data-order=follow]").click();
      assert.ok(await squad("follow"));
      await page.locator("[data-order=retreat]").click();
      assert.ok(await squad("retreat"));
      // Aim: lock an enemy tank, order the squad to attack it, then release to auto.
      const foe = await page.evaluate(() => window.battlefield.snapshot().units.find((u) => u.side === 1 && u.hp > 0).id);
      await page.evaluate((id) => document.querySelector(`[data-unit="${id}"]`).click(), foe);
      assert.deepEqual(await page.evaluate(() => window.battlefield.aim), { mode: "unit", id: foe, picking: false });
      await page.locator("[data-order=attack]").click();
      assert.ok(await page.evaluate((foe) => window.battlefield.snapshot().units.filter((u) => u.side === 0 && u.id !== 0).every((u) => u.order === "attack" && u.focus === foe), foe));
      await page.locator("#bf-target").click();
      assert.equal(await page.evaluate(() => window.battlefield.aim.mode), "auto", "Lock while locked releases it");
      await page.locator("#bf-target").click();
      assert.equal(await page.evaluate(() => window.battlefield.aim.picking), true);
      const vp = await box(page, "#bf-viewport");
      // An open square away from the tanks (the camera keeps your tank in the middle).
      const open = await page.evaluate(() => {
        const v = document.querySelector("#bf-viewport").getBoundingClientRect();
        for (let fy = 0.85; fy > 0.1; fy -= 0.05)
          for (const fx of [0.4, 0.6, 0.5, 0.3, 0.7]) {
            const x = v.left + v.width * fx,
              y = v.top + v.height * fy,
              hit = document.elementFromPoint(x, y);
            if (hit?.closest("#bf-viewport") && !hit.closest(".bf-tank, .bf-hint")) return { x, y };
          }
        return null;
      });
      await page.mouse.click(open.x, open.y);
      assert.equal(await page.evaluate(() => window.battlefield.aim.mode), "cell");
      if (mobile) await page.locator("#bf-target").click();
      else await page.locator("#bf-auto").click();
      assert.equal(await page.evaluate(() => window.battlefield.aim.mode), "auto");
      await page.locator("[data-order=retreat]").click();
      // Tapping a wingman mid-battle opens Command on it.
      if (mobile) await page.evaluate(() => document.querySelector('[data-unit="1"]').click());
      else await page.keyboard.press("Digit1");
      assert.deepEqual(
        await page.evaluate(() => ({ on: window.battlefield.command.on, selected: window.battlefield.command.selected })),
        { on: true, selected: 1 },
      );
      const target = await page.evaluate(async () => {
        const { route, cell, point } = await import("/src/model.ts");
        const s = window.battlefield.snapshot(),
          p = s.units[1];
        return s.board.tiles.findIndex((t, id) => {
          const q = point(s.board, id),
            d = Math.hypot(p.x - q.x, p.y - q.y),
            path = route(s.board, cell(s.board, p), id);
          return d >= 2 && d < 4 && path.length > 1 && path.length < 5 && s.units.every((u) => Math.hypot(u.x - q.x, u.y - q.y) > 0.9);
        });
      });
      assert.ok(target >= 0);
      // Tap the square's centre on the map (a tank driving over it must not intercept), then lock.
      await page.locator(`[data-cell="${target}"]`).evaluate((el) => {
        const r = el.getBoundingClientRect(),
          at = { bubbles: true, pointerId: 7, isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
        const vp = document.querySelector("#bf-viewport");
        vp.dispatchEvent(new PointerEvent("pointerdown", at));
        vp.dispatchEvent(new PointerEvent("pointerup", at));
      });
      await page.locator("#bf-check").evaluate((b) => b.click());
      assert.equal(await page.evaluate(() => window.battlefield.snapshot().units[1].order), "hold");
      // Back to fighting.
      await page.locator(mobile ? "#bf-command" : "#bf-auto").click();
      assert.equal(await page.evaluate(() => window.battlefield.command.on), false);
      // Pause freezes all simulation state, dims the field and restores native selection.
      await page.locator("#bf-pause").click();
      const frozen = await page.evaluate(() => window.battlefield.snapshot());
      await resize(page, mobile ? { width: 900, height: 420 } : { width: 1280, height: 900 });
      await page.waitForTimeout(120);
      assert.deepEqual(await page.evaluate(() => window.battlefield.snapshot()), frozen);
      assert.equal(await page.locator("#bf-giveup").isVisible(), true, "pausing asks: keep fighting or give up");
      assert.equal(await page.locator("#bf-giveup").evaluate((n) => getComputedStyle(n).backgroundColor !== "rgba(0, 0, 0, 0)"), true, "the field dims behind the sticker");
      await checkOverlay(page, "#bf-giveup");
      if (!mobile) {
        // Platoon keys: colour is health, pips are size, the number matches the field.
        assert.ok((await page.locator("#bf-roster .bf-unit").evaluateAll((n) => n.map((b) => b.dataset.hp !== undefined && b.querySelectorAll(".bf-pips s").length >= 1))).every(Boolean));
      } else {
        assert.equal(await page.locator("#bf-keys").isVisible(), false, "no keyboard panel on touch");
        assert.equal(await page.locator(".bf-header").isVisible(), false, "the flag pauses without the header");
        assert.notEqual(await page.evaluate(() => getComputedStyle(document.body).userSelect), "none");
      }
      await resize(page, mobile ? { width: 844, height: 390 } : { width: 1440, height: 1000 });
      await page.locator("#bf-giveup-no").click();
      assert.equal(await page.evaluate(() => window.battlefield.paused), false);
      assert.equal(await page.locator("#bf-giveup").isVisible(), false);
      if (!mobile) {
        // Background help is usable again after the blocking modal closes.
        await page.locator("#bf-keys").hover();
        assert.equal(await page.locator("#bf-keys-panel").isVisible(), true, "the key icon shows the controls");
        assert.ok((await page.locator("#bf-keys-panel kbd").count()) > 15);
        await page.mouse.move(5, 500);
        assert.equal(await page.locator("#bf-keys-panel").isVisible(), false);
      }
      if (mobile) {
        // Menu: pauses and brings the header in over the dim; Tips closes it and shows the tips.
        await page.locator("#bf-squad").click();
        assert.equal(await page.evaluate(() => window.battlefield.paused), true);
        assert.equal(await page.locator(".bf-header").isVisible(), true);
        assert.equal(await page.locator("#bf-giveup").isVisible(), true);
        await page.locator("#bf-tips").click();
        assert.equal(await page.locator(".bf-header").isVisible(), false, "Tips closes the menu");
        assert.equal(await page.locator("#bf-coach").isVisible(), true);
        await page.locator("#bf-coach").click({ position: { x: 5, y: 5 } });
        assert.equal(await page.evaluate(() => window.battlefield.paused), false);
        // Pan drags the camera; Center brings it back to your tank.
        await page.locator("#bf-pan").click();
        const r = await box(page, "#bf-viewport");
        const left0 = await page.locator("#bf-viewport").evaluate((el) => el.scrollLeft);
        await page.mouse.move(r.x + r.width * 0.7, r.y + r.height * 0.6);
        await page.mouse.down();
        await page.mouse.move(r.x + r.width * 0.3, r.y + r.height * 0.6, { steps: 5 });
        await page.mouse.up();
        assert.ok((await page.locator("#bf-viewport").evaluate((el) => el.scrollLeft)) !== left0, "pan moves the camera");
        await page.locator("#bf-pan").click();
        await page.locator("#bf-center").click();
        // The rails: every control on screen, none overlapping, the field free between them.
        const RAIL = ["#bf-squad", "#bf-pause", ".bf-metrics", "#bf-command", "#bf-center", "#bf-pan", "#bf-stick", ".bf-mini", "[data-order=attack]", "[data-order=retreat]", "[data-order=advance]", "[data-order=follow]", "#bf-auto", "#bf-target", ".bf-fire"];
        const check = (insets = 0) =>
          page.evaluate(([RAIL, insets]) => {
            const out = [],
              boxes = RAIL.map((s) => [s, document.querySelector(s).getBoundingClientRect()]);
            for (let i = 0; i < boxes.length; i++) {
              const [a, A] = boxes[i];
              if (A.top < -0.5 || A.bottom > innerHeight + 0.5 || A.left < insets - 0.5 || A.right > innerWidth - insets + 0.5) out.push(`${a} offscreen`);
              const hit = document.elementFromPoint(A.left + A.width / 2, A.top + A.height / 2);
              if (!document.querySelector(a).contains(hit)) out.push(`${a} covered`);
              for (const [b, B] of boxes.slice(i + 1)) {
                // Round keys: compare the circles, not their square boxes.
                const round = [a, b].every((s) => getComputedStyle(document.querySelector(s)).borderRadius === "50%");
                const hit = round
                  ? Math.hypot(A.x + A.width / 2 - B.x - B.width / 2, A.y + A.height / 2 - B.y - B.height / 2) < (A.width + B.width) / 2 - 0.5
                  : A.left < B.right - 0.5 && B.left < A.right - 0.5 && A.top < B.bottom - 0.5 && B.top < A.bottom - 0.5;
                if (hit) out.push(`${a} x ${b}`);
              }
            }
            const left = Math.max(...boxes.filter(([, B]) => B.right < innerWidth / 2).map(([, B]) => B.right)),
              right = Math.min(...boxes.filter(([, B]) => B.left > innerWidth / 2).map(([, B]) => B.left));
            if (right - left < innerWidth * 0.45) out.push(`field between rails is only ${right - left}px`);
            return out;
          }, [RAIL, insets]);
        for (const [w, h] of [[844, 390], [844, 330], [667, 300], [932, 430]]) {
          await resize(page, { width: w, height: h });
          assert.deepEqual(await check(), [], `${w}x${h} rails`);
        }
        await resize(page, { width: 844, height: 390 });
        // Notch / camera cutout: simulated 44px insets push both rails inward.
        await page.locator("#battlefield").evaluate((el) => {
          el.style.setProperty("--sl", "44px");
          el.style.setProperty("--sr", "44px");
        });
        await page.waitForTimeout(80);
        assert.deepEqual(await check(44), [], "rails clear the safe areas");
        await page.locator("#battlefield").evaluate((el) => {
          el.style.removeProperty("--sl");
          el.style.removeProperty("--sr");
        });
        assert.equal(await page.locator("#bf-tactics").isVisible(), false, "no numbered platoon list on touch");
        const fire = await box(page, ".bf-fire");
        await page.mouse.move(fire.x + fire.width / 2, fire.y + fire.height / 2);
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.up();
        assert.ok(await page.evaluate(() => window.battlefield.snapshot().units[0].cooldown > 0), "touch fire works");
        // Two fingers: hold the stick, and the right-rail keys still answer (phones send no
        // click for a second touch).
        {
          const cdp = await page.context().newCDPSession(page);
          const st = await box(page, "#bf-stick"),
            stick = { x: st.x + st.width / 2, y: st.y + st.height / 2, id: 1 };
          const tap2 = async (sel) => {
            const b = await box(page, sel),
              t = { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 2 };
            await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [stick, t] });
            // CDP touchEnd lists the fingers that lift: only the key finger.
            await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [t] });
            await page.waitForTimeout(120);
          };
          await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [stick] });
          await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...stick, x: stick.x + 30 }] });
          stick.x += 30;
          const auto0 = await page.locator("#bf-auto").getAttribute("aria-pressed");
          await tap2("#bf-auto");
          assert.notEqual(await page.locator("#bf-auto").getAttribute("aria-pressed"), auto0, "Auto answers while driving");
          await tap2("#bf-auto");
          await tap2("[data-order=retreat]");
          assert.ok(await squad("retreat"), "orders answer while driving");
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await cdp.detach();
        }
      }
      if (mobile) {
        // Real touch taps (not mouse clicks): Menu opens the menu and never follows the link
        // that drops in under the finger; a long hold on Auto toggles it exactly once.
        const url0 = page.url();
        const m = await box(page, "#bf-squad");
        await page.touchscreen.tap(m.x + m.width / 2, m.y + m.height / 2);
        await page.waitForTimeout(300);
        assert.equal(page.url(), url0, "tapping Menu stays in the game");
        assert.equal(await page.evaluate(() => document.querySelector("#battlefield").classList.contains("menu-open")), true);
        await page.locator("#bf-giveup-no").click();
        const cdp = await page.context().newCDPSession(page);
        const a = await box(page, "#bf-auto"),
          pt = { x: a.x + a.width / 2, y: a.y + a.height / 2, id: 9 };
        const before = await page.locator("#bf-auto").getAttribute("aria-pressed");
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt] });
        await page.waitForTimeout(900);
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(200);
        assert.notEqual(await page.locator("#bf-auto").getAttribute("aria-pressed"), before, "a long hold toggles Auto once");
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [pt] });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await page.waitForTimeout(200);
        assert.equal(await page.locator("#bf-auto").getAttribute("aria-pressed"), before, "and a tap toggles it back");
        await cdp.detach();
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.screenshot({ path: `artifacts/battle-${mobile ? "mobile" : "desktop"}-${light ? "light" : "dark"}.png` });
      await restart(page);
      assert.equal(await page.evaluate(() => window.battlefield.playing), false);
      assert.equal(await page.locator("#battlefield").getAttribute("data-stage"), "setup");
      assert.equal(await page.locator(".bf-tank").count(), 8);
      for (let n = 0; n < 3; n++) {
        await plan(page, mobile);
        await restart(page);
      }
      assert.equal(await page.locator(".bf-tank").count(), 8);
      assert.equal(await page.locator("style[data-dom-virus-selection]").count(), 0);
      // Big battle: 12 per side, picked in Platoon during planning, runs without errors.
      await plan(page, mobile);
      await page.locator('.bf-home-card[data-open="platoon"]').click();
      await page.locator('#bf-size [data-size="12"]').click();
      assert.equal(await page.locator(".bf-tank").count(), 24);
      await page.locator("#bf-start").click();
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => window.battlefield.snapshot().units.length), 24);
      if (!mobile) {
        // A big platoon never wraps the desktop bar: icon keys, or its own card on the map.
        const rows = await page.evaluate(() => document.querySelector("#battlefield").classList.contains("platoon-floating")
          ? 1 : new Set([...document.querySelectorAll("#bf-roster .bf-unit")].map((n) => Math.round(n.getBoundingClientRect().top))).size);
        assert.equal(rows, 1, "the platoon row stays on one line in the bar");
      }
      await restart(page);
      // The platoon stuck: still 12 a side on the next setup.
      assert.equal(await page.locator(".bf-tank").count(), 24);
      // Quick start skips planning (and rolls the platoon and loadout).
      await page.locator("#bf-quick").click();
      if (mobile) await passGate(page);
      assert.equal((await cmd(page)).planning, false);
      assert.equal(await page.locator("#battlefield").getAttribute("data-stage"), "battle");
      await restart(page);
      assert.deepEqual(errors, []);
      console.log({ mobile, light, commands: true, paused: true, cleanup: true });
      await ctx.close();
    }
  // After-action stickers use the same pressed landing as pause, including GAME OVER.
  // A compact desktop also keeps the platoon usable instead of squeezing the numbered keys.
  for (const mobile of [false, true]) {
    where = mobile ? "overlay-mobile" : "compact-desktop-feedback";
    const ctx = await browser.newContext({
      viewport: mobile ? { width: 844, height: 390 } : { width: 1100, height: 800 },
      hasTouch: mobile,
      isMobile: mobile,
    });
    await ctx.addInitScript(() => {
      localStorage.setItem("dom-battlefield:intro", "seen");
      localStorage.setItem("dom-battlefield:tips", "off");
    });
    const page = await ctx.newPage();
    await page.goto(`${URL}/?debug`);
    await page.waitForFunction(() => window.battlefield);
    await plan(page, mobile);
    if (!mobile) {
      // Your own tank on the plan card: you drive it, it is never "on its own".
      await page.locator('.bf-home-card[data-open="plan"]').click();
      await page.keyboard.press("y");
      await page.waitForFunction(() => document.querySelector("#bf-cmd-state")?.textContent === "YOU'RE DRIVING");
      assert.equal(await page.locator("#bf-cmd-state").getAttribute("data-kind"), "you");
      // ...but its orders show like any tank's: Attack HQ, then tap again to clear.
      await page.locator('#bf-acts [data-act="hq"]').click();
      await page.waitForFunction(() => document.querySelector("#bf-cmd-state")?.textContent === "ATTACKING HQ");
      await page.locator('#bf-acts [data-act="hq"]').click();
      await page.waitForFunction(() => document.querySelector("#bf-cmd-state")?.textContent === "YOU'RE DRIVING");
      await page.goto(`${URL}/?debug`);
      await page.waitForFunction(() => window.battlefield);
      await plan(page, mobile);
      await page.locator('.bf-home-card[data-open="platoon"]').click();
      await page.locator('#bf-size [data-size="12"]').click();
      // Planning on a compact desktop: the footer drops the platoon instead of wrapping.
      await page.waitForFunction(() => document.querySelector("#battlefield").classList.contains("platoon-tucked"));
      assert.equal(await page.locator("#bf-tactics").isVisible(), false, "the planning footer hides a big platoon");
      const tops = await page.locator("#bf-controls button:visible").evaluateAll((nodes) => new Set(nodes.map((n) => Math.round(n.getBoundingClientRect().top))).size);
      assert.equal(tops, 1, "the planning footer stays on one row");
      // ...and no key runs under the next one, at this width or narrower.
      for (const width of [1100, 900, 1100]) {
        await page.setViewportSize({ width, height: 800 });
        await page.waitForTimeout(150);
        const overlaps = await page.locator("#bf-controls button:visible").evaluateAll((nodes) => {
          const r = nodes.map((n) => n.getBoundingClientRect());
          return r.filter((b, i) => i && b.left < r[i - 1].right - 1 && Math.abs(b.top - r[i - 1].top) < 5).length;
        });
        assert.equal(overlaps, 0, `planning footer keys don't overlap at ${width}px`);
      }
    }
    await page.locator("#bf-start").click();
    await page.waitForFunction(() => document.querySelector("#battlefield").dataset.stage === "battle");
    if (!mobile) {
      await page.waitForFunction(() => document.querySelector("#battlefield").classList.contains("platoon-floating"));
      assert.equal(await page.locator("#bf-roster-layout").isVisible(), true, "compact desktop keeps the detached platoon layout control");
      const keys = await page.locator("#bf-roster .bf-unit").evaluateAll((nodes) => nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { width: r.width, height: r.height };
      }));
      assert.equal(keys.length, 12);
      assert.ok(keys.every((r) => r.width >= 43 && r.height >= 43), "all twelve platoon keys retain a usable size");
      const controls = await page.locator("#bf-controls").evaluate((n) => ({ width: n.clientWidth, content: n.scrollWidth }));
      assert.ok(controls.content <= controls.width + 2, "the desktop footer fits without horizontal squeezing or overflow");
      for (const [pressed, release] of [
        ["#bf-command", "#bf-command"],
        ["#bf-roster .bf-unit:nth-child(2)", "#bf-roster .bf-unit:nth-child(3)"],
      ]) {
        await page.locator(pressed).hover();
        const bases = await page.locator(pressed).evaluate(async (n, release) => {
          const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
          const base = () => {
            const shadow = getComputedStyle(n).boxShadow.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/);
            return n.getBoundingClientRect().bottom + (shadow ? Number(shadow[2]) : 0);
          };
          n.click();
          await sleep(160);
          const values = [base()];
          document.querySelector(release).click();
          for (let i = 0; i < 12; i++) {
            await new Promise(requestAnimationFrame);
            values.push(base());
          }
          return values;
        }, release);
        assert.ok(Math.max(...bases) - Math.min(...bases) < 1.5, `${pressed}: the physical base stays planted throughout unlock`);
      }
      await page.screenshot({ path: "artifacts/compact-desktop-platoon.png" });
    }
    for (const won of [false, true]) {
      await page.evaluate((won) => window.battlefield.end(won), won);
      await page.waitForFunction(() => !document.querySelector("#bf-result").hidden);
      assert.equal(await page.locator("#bf-result-title").textContent(), won ? "MISSION COMPLETE" : "GAME OVER");
      await checkOverlay(page, "#bf-result");
      await page.screenshot({ path: `artifacts/result-${mobile ? "mobile" : "desktop"}-${won ? "won" : "lost"}.png` });
      if (!won) {
        await page.locator("#bf-rematch").click();
        if (mobile) await passGate(page);
        await page.locator("#bf-start").click();
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#bf-new-operation").click();
    await page.locator("#bf-quick").click();
    if (mobile) await passGate(page);
    assert.equal(await page.locator(".bf-launch-bit").count(), 0, "reduced motion launches without moving fragments");
    await page.waitForFunction(() => !document.querySelector(".bf-launch-burst"), null, { timeout: 1500 });
    await ctx.close();
    console.log({ overlays: true, compactDesktop: !mobile, reducedLaunch: true });
  }
  // Install intro: iPhone Safari gets Add to Home Screen steps, once; desktop never sees it.
  {
    where = "install";
    const ctx = await browser.newContext({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });
    await ctx.addInitScript(() => {
      Object.defineProperty(document, "fullscreenEnabled", { configurable: true, get: () => false });
      localStorage.setItem("dom-battlefield:tips", "off");
    });
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.waitForFunction(() => window.battlefield);
    assert.equal(await page.evaluate(() => window.battlefield.install), "ios");
    assert.equal(await page.locator("#bf-install-ios").isVisible(), true);
    await page.locator("#bf-install-later").click();
    assert.equal(await page.evaluate(() => window.battlefield.install), null);
    await page.reload();
    await page.waitForFunction(() => window.battlefield);
    assert.equal(await page.evaluate(() => window.battlefield.install), null, "shown once");
    await plan(page, true);
    // A native button keeps Space / Enter semantics while planning, even on an iOS-shaped
    // browser without the Fullscreen API. The compact orbit still advances the steps.
    await page.locator('.bf-home-card[data-open="platoon"]').click();
    await page.locator("#bf-card-platoon .bf-fold-key").press("Space");
    assert.equal(await page.locator("#bf-card-platoon .bf-fold-key").getAttribute("aria-expanded"), "false");
    await page.locator("#bf-card-platoon .bf-fold-key").press("Enter");
    await page.locator('#bf-card-platoon .bf-orb[data-open="loadout"]').click();
    assert.equal(await page.locator("#bf-card-loadout").isVisible(), true);
    await page.locator("#bf-card-loadout .bf-fold-key").press("Enter");
    assert.equal(await page.locator("#bf-card-loadout .bf-fold-key").getAttribute("aria-expanded"), "false");
    await page.locator("#bf-card-loadout .bf-fold-key").press("Space");
    // Fullscreen opens installation help; it must be clickable rather than trapped under the
    // pause modal's inert background. Dismissing help restores the original planning state.
    await page.locator("#bf-fullscreen").click();
    assert.equal(await page.locator("#bf-install").isVisible(), true);
    assert.equal(await page.locator("#bf-install").evaluate((n) => n.inert), false);
    assert.equal(await page.locator("#bf-giveup").isVisible(), false);
    await page.locator("#bf-install-later").click();
    assert.equal(await page.evaluate(() => window.battlefield.paused), false);
    assert.equal((await cmd(page)).planning, true);
    await page.locator("#bf-start").click();
    await page.waitForFunction(() => !window.battlefield.command.planning);
    // The same installation help can be opened from an already-paused mobile Menu. Closing
    // it returns to the pause choices, so the game does not resume behind the player.
    await page.locator("#bf-squad").click();
    await page.locator("#bf-fullscreen").click();
    assert.equal(await page.locator("#bf-install").isVisible(), true);
    assert.equal(await page.locator("#bf-install").evaluate((n) => n.inert), false);
    await page.locator("#bf-install-later").click();
    assert.equal(await page.evaluate(() => window.battlefield.paused), true);
    assert.equal(await page.locator("#bf-giveup").isVisible(), true);
    await page.locator("#bf-giveup-no").click();
    assert.equal(await page.evaluate(() => window.battlefield.paused), false);
    await ctx.close();
    const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desk.goto(URL);
    await desk.waitForFunction(() => window.battlefield);
    assert.equal(await desk.evaluate(() => window.battlefield.install), null);
    await desk.close();
    console.log({ install: true });
  }
  {
    // Boot screen (?intro forces it in a test browser): PRESS START builds the page in; a page
    // restored from the back/forward cache asks for a restart instead of running half torn down.
    where = "boot";
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(`${URL}?intro`);
    await page.waitForFunction(() => window.battlefield);
    assert.equal(await page.locator("#bf-boot").isVisible(), true, "the boot screen covers the page");
    const top = () => page.locator(".bf-boot-sticker").evaluate((n) => n.offsetTop);
    const sticker = await top();
    await page.locator("#bf-boot-go").waitFor({ state: "visible", timeout: 8000 });
    await page.waitForTimeout(450);
    const after = await box(page, ".bf-boot-sticker"), key = await box(page, "#bf-boot-go");
    assert.equal(await top(), sticker, "PRESS START never shifts the sticker");
    assert.ok(key.y > after.y + after.height, "PRESS START sits below the sticker");
    await page.locator("#bf-boot-go").click();
    await page.waitForFunction(() => document.querySelector("#bf-boot").hidden && !document.querySelector("#battlefield").dataset.boot, null, { timeout: 4000 });
    await page.locator(".bf-mission").first().click();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    assert.equal(await page.locator(".bf-stale").isVisible(), true, "a restored page offers a restart");
    await page.close();
    // From the hub's cartridge: the doors arrive shut and open once the game has loaded.
    const hub = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await hub.addInitScript(() => sessionStorage.setItem("dom-virus:doors", "shut"));
    await hub.goto(`${URL}?intro`);
    await hub.waitForFunction(() => document.querySelector("#battlefield").dataset.bootDoors === "open", null, { timeout: 4000 });
    assert.equal(await hub.evaluate(() => sessionStorage.getItem("dom-virus:doors")), null, "the hand-off flag is used once");
    await hub.close();
    console.log({ boot: true });
    // Desktop battle: command mode starts with the Plan card shrunk and the orders unpinned; a
    // change sticks (also after a reload).
    where = "battle cards";
    const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desk.addInitScript(() => localStorage.setItem("dom-battlefield:tips", "off"));
    await desk.goto(URL);
    await desk.locator(".bf-mission").first().click();
    await desk.locator("#bf-quick").click();
    await desk.waitForFunction(() => window.battlefield.playing && !window.battlefield.command.planning);
    await desk.locator("#bf-command").click();
    assert.equal(await desk.locator("#bf-cmd").evaluate((n) => n.classList.contains("folded")), true, "Plan card shrunk");
    assert.equal(await desk.locator("#bf-acts").getAttribute("data-pin"), "false", "orders unpinned");
    const corner = await box(desk, "#bf-cmd"), stage = await box(desk, ".bf-stage");
    assert.ok(corner.x - stage.x < 40 && corner.y - stage.y < 40, "Plan card in the top-left corner");
    await desk.locator("#bf-acts-pin").click();
    await desk.reload();
    await desk.locator(".bf-mission").first().click();
    await desk.locator("#bf-quick").click();
    await desk.waitForFunction(() => window.battlefield.playing && !window.battlefield.command.planning);
    await desk.locator("#bf-command").click();
    assert.equal(await desk.locator("#bf-acts").getAttribute("data-pin"), "true", "the pin choice is remembered");
    // Full screen survives surrender (and any new game): only its own key turns it off.
    await desk.locator("#bf-fullscreen").click();
    await desk.waitForFunction(() => !!document.fullscreenElement);
    await desk.locator("#bf-pause").click();
    await desk.locator("#bf-giveup-yes").click();
    await desk.waitForFunction(() => !window.battlefield.playing, null, { timeout: 3000 });
    assert.equal(await desk.evaluate(() => !!document.fullscreenElement), true, "surrender keeps full screen");
    await desk.evaluate(() => document.exitFullscreen());
    await desk.close();
    console.log({ battleCards: true });
  }
  {
    // Fast clicks right after load count (no key may swallow an early click).
    where = "fast";
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(URL);
    await page.waitForFunction(() => window.battlefield);
    await page.locator(".bf-mission").first().click();
    await page.locator("#bf-deploy").click();
    await page.locator("#bf-start").click();
    await page.locator("[data-order=follow]").click();
    assert.ok(await page.evaluate(() => window.battlefield.snapshot().units.filter((u) => u.side === 0 && u.id !== 0).every((u) => u.order === "follow")), "an early click is not dropped");
    await page.close();
    console.log({ fast: true });
  }
  {
    // Phone stick: drives your tank; a second finger's order lands (and stays lit); a new finger
    // on the stick takes it over even if the first finger's release never arrived.
    where = "phone-stick";
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    await ctx.addInitScript(() => { localStorage.setItem("dom-battlefield:intro", "seen"); localStorage.setItem("dom-battlefield:tips", "off"); });
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.waitForFunction(() => window.battlefield);
    await page.locator(".bf-mission").first().tap();
    await page.locator("#bf-quick").tap();
    await page.waitForTimeout(300);
    if (await page.evaluate(() => window.battlefield.gate === "fullscreen")) await page.locator("#bf-gate-go").tap();
    await page.waitForTimeout(300);
    const cdp = await ctx.newCDPSession(page);
    const me = () => page.evaluate(() => { const s = window.battlefield.snapshot(); const u = s.units.find((u) => u.id === s.side * s.per); return { x: u.x, side: s.side }; });
    const sb = await box(page, "#bf-stick"),
      c = { x: sb.x + sb.width / 2, y: sb.y + sb.height / 2 },
      a = await me(),
      dir = a.side === 0 ? 1 : -1,
      held = { x: c.x + (dir * sb.width) / 2, y: c.y, id: 1 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...c, id: 1 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [held] });
    await page.waitForTimeout(500);
    assert.ok(Math.abs((await me()).x - a.x) > 0.5, "the stick drives your tank");
    const ob = await box(page, "[data-order=retreat]"),
      t = { x: ob.x + ob.width / 2, y: ob.y + ob.height / 2, id: 2 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [held, t] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [t] });
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(() => { const s = window.battlefield.snapshot(); return s.units.filter((u) => u.side === s.side && u.id % s.per).every((u) => u.order === "retreat"); }), "an order lands while driving");
    assert.equal(await page.locator("[data-order=retreat]").getAttribute("aria-pressed"), "true", "the squad's order stays lit");
    // Finger 1 is never released; finger 3 lands on the stick and drives the other way.
    const back = { x: c.x - (dir * sb.width) / 2, y: c.y, id: 3 },
      b = await me();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [held, { ...c, id: 3 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [held, back] });
    await page.waitForTimeout(500);
    assert.ok(dir * ((await me()).x - b.x) < -0.3, "a new finger takes the stick");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => document.querySelector("#bf-stick").classList.contains("down")), false, "all fingers up: the stick lets go");
    await ctx.close();
    console.log({ phoneStick: true });
  }
  {
    // Desktop layout on a touch screen (tablet, touch laptop): with one finger down, a second
    // finger's taps on the bottom bar (orders, aim, platoon keys) still count.
    where = "desk-touch";
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, hasTouch: true });
    // Some Chromium builds report a coarse pointer here, which brings the install card: not this test's subject.
    await ctx.addInitScript(() => { localStorage.setItem("dom-battlefield:tips", "off"); localStorage.setItem("dom-battlefield:intro", "seen"); });
    const page = await ctx.newPage();
    await page.goto(URL);
    await page.waitForFunction(() => window.battlefield);
    await page.locator(".bf-mission").first().click();
    await page.locator("#bf-quick").click();
    await page.waitForTimeout(300);
    const ui = await page.locator("#battlefield").getAttribute("data-ui");
    const cdp = await ctx.newCDPSession(page);
    const v = await box(page, "#bf-viewport"),
      // Open ground at the top middle: a finger held on a tank would select it (orders go to it).
      hold = { x: v.x + v.width / 2, y: v.y + 12, id: 1 };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [hold] });
    assert.equal(await page.locator("#bf-order-label").textContent(), "RADIO · WHOLE SQUAD", "the held finger selected nothing");
    for (const o of ["follow", "retreat"]) {
      const b = await box(page, `[data-order=${o}]`),
        t = { x: b.x + b.width / 2, y: b.y + b.height / 2, id: 2 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [hold, t] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [t] });
      await page.waitForTimeout(120);
      assert.ok(
        await page.evaluate((o) => { const s = window.battlefield.snapshot(); return s.units.filter((u) => u.side === s.side && u.id % s.per !== 0).every((u) => u.order === o); }, o),
        `${ui}: ${o} answers a second finger`,
      );
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await ctx.close();
    console.log({ deskTouch: ui });
  }
  {
    // A narrow desktop window (no touch) gets the phone layout; the rails still fit side by side.
    where = "narrow";
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(URL);
    await page.waitForFunction(() => window.battlefield);
    await page.locator(".bf-mission").first().click();
    await page.locator("#bf-deploy").click();
    await page.locator("#bf-start").click();
    const [l, r] = await page.evaluate(() => [document.querySelector("#bf-stick").getBoundingClientRect().right, document.querySelector(".bf-fire").getBoundingClientRect().left]);
    assert.ok(l < r, `rails don't overlap at 390px: ${l} < ${r}`);
    await page.locator("#bf-pause").click();
    assert.equal(await page.evaluate(() => window.battlefield.paused), true);
    await page.close();
    console.log({ narrow: true });
  }
  {
    // Theme and sound are remembered across reloads (theme shared with the DOM VIRUS site).
    where = "prefs";
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(URL);
    await page.waitForFunction(() => window.battlefield);
    assert.equal(await page.locator("#battlefield").getAttribute("data-theme"), "dark");
    await page.locator("#bf-theme").click();
    await page.locator("#bf-sound").click();
    assert.equal(await page.locator("#bf-sound").getAttribute("aria-pressed"), "false");
    await page.reload();
    await page.waitForFunction(() => window.battlefield);
    assert.equal(await page.locator("#battlefield").getAttribute("data-theme"), "light", "theme survives a reload");
    assert.equal(await page.locator("#bf-sound").getAttribute("aria-pressed"), "false", "mute survives a reload");
    assert.equal(await page.evaluate(() => localStorage.getItem("dom-virus:theme")), "light");
    await page.close();
    console.log({ prefs: true });
  }
  {
    // The performance overlay: off by default; the header key (or F9) shows it over the map,
    // it is remembered, it draws battle frames, and it rests while the battle is stopped.
    where = "perf overlay";
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript(() => localStorage.setItem("dom-battlefield:tips", "off"));
    await page.goto(URL);
    await page.waitForFunction(() => window.battlefield);
    const off = await page.evaluate(() => [!!document.querySelector(".fizlet-perf"), performance.getEntriesByType("resource").some((r) => /perf/.test(r.name)), document.querySelector("#bf-perf").getAttribute("aria-pressed"), localStorage.getItem("dom-virus:perf")]);
    assert.deepEqual(off, [false, false, "false", null], "off by default: not loaded, not on the page");
    await page.locator(".bf-mission").first().click();
    await page.locator("#bf-quick").click();
    await page.waitForFunction(() => window.battlefield.playing && !window.battlefield.command.planning);
    await page.locator("#bf-perf").click();
    await page.waitForSelector(".fizlet-perf:not([hidden])");
    await page.waitForTimeout(800);
    const on = await page.evaluate(() => {
      const el = document.querySelector(".fizlet-perf"), r = el.getBoundingClientRect(), s = document.querySelector(".bf-stage").getBoundingClientRect();
      return { shown: !el.hidden, pressed: document.querySelector("#bf-perf").getAttribute("aria-pressed"), stored: localStorage.getItem("dom-virus:perf"), inMap: r.left >= s.left && r.bottom <= s.bottom && r.width > 0, fps: +el.querySelector("b").textContent };
    });
    assert.deepEqual({ ...on, fps: on.fps > 10 }, { shown: true, pressed: "true", stored: "1", inMap: true, fps: true }, `overlay on, in the map's corner (${on.fps} fps)`);
    await page.keyboard.press("F9");
    assert.equal(await page.locator("#bf-perf").getAttribute("aria-pressed"), "false", "F9 hides it and the key follows");
    await page.keyboard.press("F9");
    await page.reload();
    await page.waitForFunction(() => window.battlefield);
    assert.equal(await page.locator("#bf-perf").getAttribute("aria-pressed"), "true", "remembered across a reload");
    await page.waitForSelector(".fizlet-perf:not([hidden])");
    await page.close();
    console.log({ perf: true });
  }
} catch (e) {
  // CI annotation: readable from the checks API even when log downloads are not.
  console.log(`::error title=Battlefield browser test (${where})::${String(e.stack || e).split("\n").slice(0, 4).join(" | ")}`);
  throw e;
} finally {
  await browser.close();
  await server.close();
}
