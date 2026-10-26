import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync, existsSync } from "node:fs";
import { createServer } from "vite";
const server = await createServer({
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
// Some Chromium builds refuse to resize a fullscreen window; leave fullscreen first.
async function resize(page, size) {
  await page.evaluate(async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
  });
  await page.setViewportSize(size);
  await page.waitForTimeout(100);
  if (await page.evaluate(() => window.battlefield?.gate === "fullscreen")) {
    await page.locator("#bf-gate-go").click();
    await page.waitForFunction(() => window.battlefield.gate === null);
  }
}
// Touch deploys stop at the ready gate until landscape + full screen.
async function passGate(page) {
  await page.waitForTimeout(120);
  if (await page.evaluate(() => window.battlefield.gate === "fullscreen"))
    await page.locator("#bf-gate-go").click();
  await page.waitForFunction(() => window.battlefield.gate === null);
  if (await page.locator("#bf-coach").isVisible())
    await page.locator("#bf-coach").click({ position: { x: 5, y: 5 } });
}
let where = "start";
try {
  for (const mobile of [false, true])
    for (const light of [false, true]) {
      const page = await browser.newPage({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1440, height: 1000 },
        hasTouch: mobile,
        isMobile: mobile,
      });
      where = `${mobile ? "mobile" : "desktop"}-${light ? "light" : "dark"}`;
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("http://127.0.0.1:5231");
      await page.waitForFunction(() => window.battlefield);
      if (light) await page.locator("#bf-theme").click();
      assert.equal(await page.locator(".bf-mission").count(), 4);
      assert.equal(await page.locator(".bf-tank").count(), 8);
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
      // Setup is two steps: location, then terrain density (Random rerolls layout and density).
      assert.equal(await page.locator("#bf-strategy").isVisible(), false, "strategy waits for the plan step");
      const solids = () => page.evaluate(() => window.battlefield.snapshot().board.tiles.filter((t) => t !== "ground" && t !== "road").length);
      await page.locator('#bf-density [data-density="0.6"]').click();
      const lightCount = await solids();
      await page.locator('#bf-density [data-density="1.45"]').click();
      assert.ok((await solids()) > lightCount, "heavy terrain has more obstacles");
      const seedBefore = await page.evaluate(() => window.battlefield.snapshot().board.seed);
      await page.locator("#bf-reroll").click();
      assert.notEqual(await page.evaluate(() => window.battlefield.snapshot().board.seed), seedBefore);
      await page.locator('#bf-density [data-density="1"]').click();
      for (let i = 0; i < 4; i++) {
        await page.locator(".bf-mission").nth(i).click();
        const s = await page.evaluate(() => window.battlefield.snapshot());
        assert.equal(s.mission, i);
        assert.equal(s.units.length, 8);
      }
      await page.locator(".bf-mission").first().click();
      await page.screenshot({
        path: `artifacts/setup-${mobile ? "mobile" : "desktop"}-${light ? "light" : "dark"}.png`,
      });
      await page.locator("#bf-deploy").click();
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.battlefield.playing), true);
      if (mobile) {
        // Ready gate: portrait holds the battle until the phone is landscape (and full screen).
        await page.waitForFunction(() => window.battlefield.gate === "rotate");
        assert.equal(await page.evaluate(() => window.battlefield.paused), true);
        const frozen = await page.evaluate(() => window.battlefield.snapshot().time);
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => window.battlefield.snapshot().time), frozen);
        assert.equal(await page.locator("#bf-gate-go").isVisible(), false);
        await resize(page, { width: 844, height: 390 });
        await page.waitForFunction(() => window.battlefield.gate !== "rotate");
        if (await page.evaluate(() => window.battlefield.gate === "fullscreen"))
          await page.locator("#bf-gate-go").click();
        await page.waitForFunction(() => window.battlefield.gate === null);
        // Leaving full screen mid-battle re-locks the gate; one tap restores it.
        if (await page.evaluate(() => !!document.fullscreenElement)) {
          await page.evaluate(() => document.exitFullscreen());
          await page.waitForFunction(() => window.battlefield.gate === "fullscreen");
          await page.locator("#bf-gate-go").click();
          await page.waitForFunction(() => window.battlefield.gate === null);
        }
      }
      if (mobile) {
        // First-run tips label controls (once the layout settles), hold the battle, open details on
        // tap, and can be switched off.
        assert.ok(await page.locator("#bf-coach").isVisible());
        await page.waitForFunction(() => document.querySelectorAll(".bf-coach-tip").length >= 4);
        await page.locator(".bf-tip-label").first().click();
        assert.equal(await page.locator(".bf-tip-label").first().getAttribute("aria-expanded"), "true");
        assert.ok(await page.locator("#bf-coach").isVisible(), "tapping a label keeps the tips open");
        assert.equal(await page.evaluate(() => window.battlefield.paused), true);
        if (light) await page.locator("#bf-coach-off").click();
        else await page.locator("#bf-coach").click({ position: { x: 5, y: 5 } });
        assert.equal(await page.locator("#bf-coach").isVisible(), false);
        assert.equal(await page.evaluate(() => window.battlefield.paused), false);
      }
      if (mobile)
        assert.equal(
          await page.evaluate(() => getComputedStyle(document.body).userSelect),
          "none",
        );
      // Strategy slides out during the plan step: changes rebuild the battle and stick.
      await page.locator("#bf-strat-toggle").click();
      assert.equal(await page.locator("#bf-strategy").isVisible(), true);
      await page.locator('[data-slot="1"] [data-role="heavy"]').click();
      assert.equal(await page.locator("#bf-start").isDisabled(), true, "over budget blocks Start");
      await page.locator('[data-slot="1"] [data-role="scout"]').click();
      assert.equal(await page.locator('[data-slot="1"] [data-role="scout"]').getAttribute("aria-pressed"), "true");
      assert.equal(await page.locator("#bf-start").isDisabled(), false);
      await page.locator('#bf-formation [data-formation="line"]').click();
      await page.locator('#bf-formation [data-formation="wedge"]').click();
      await page.locator('#bf-side [data-side="1"]').click();
      assert.equal(await page.evaluate(() => window.battlefield.snapshot().side), 1);
      assert.equal(await page.evaluate(() => window.battlefield.command.planning), true, "still planning after a change");
      await page.locator('#bf-side [data-side="0"]').click();
      assert.match(await page.locator("#bf-strat-chip").textContent(), /^A · WEDGE · 4$/);
      await page.locator("#bf-strat-close").click();
      assert.equal(await page.locator("#bf-strategy").isVisible(), false);
      // Plan step: every battle opens frozen, in command mode, with the first wingman selected.
      const cmd = () => page.evaluate(() => window.battlefield.command);
      assert.deepEqual(
        await page.evaluate(() => ({ ...window.battlefield.command, draft: undefined })),
        { on: true, planning: true, selected: 1, draft: undefined },
      );
      assert.equal(await page.locator("#bf-status").textContent(), "PLAN");
      const t0 = await page.evaluate(() => window.battlefield.snapshot().time);
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => window.battlefield.snapshot().time), t0, "time frozen while planning");
      // Tap a reachable square that is on screen and not under a panel: a dashed draft appears.
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
          if (d < 4 || d > 7 || !plot(s.board, from, [id]) || s.units.some((v) => Math.hypot(v.x - q.x, v.y - q.y) < 1.2)) continue;
          const at = ok(id);
          if (at) return at;
        }
        return null;
      });
      assert.ok(spot, "found an open square on screen");
      await page.mouse.click(spot.x, spot.y);
      assert.deepEqual((await cmd()).draft.stops, [spot.id]);
      await page.waitForFunction(() => document.querySelectorAll(".bf-route.draft").length === 1);
      assert.equal(await page.locator("#bf-cmd-state").textContent(), "DRAFT");
      assert.equal(await page.locator("#bf-lock").isDisabled(), false);
      // Drag the middle of the line to an open square nearby: that adds a turn.
      const bend = await page.evaluate(async () => {
        const { plot, cell } = await import("/src/model.ts");
        const s = window.battlefield.snapshot(),
          c = window.battlefield.command,
          line = document.querySelector(".bf-route-hit"),
          pts = line.getAttribute("points").split(" ").map((p) => p.split(",").map(Number)),
          [mx, my] = pts[Math.floor(pts.length / 2)],
          world = document.querySelector(".bf-world").getBoundingClientRect(),
          tile = world.width / s.board.cols;
        for (const dy of [2, -2, 3, -3])
          for (const dx of [0, 1, -1]) {
            const x = Math.floor(mx) + dx,
              y = Math.floor(my) + dy,
              id = y * s.board.cols + x;
            if (x < 0 || y < 0 || x >= s.board.cols || y >= s.board.rows) continue;
            if (!plot(s.board, cell(s.board, s.units[c.selected]), [id, ...c.draft.stops])) continue;
            const to = { x: world.left + (x + 0.5) * tile, y: world.top + (y + 0.5) * tile },
              hit = document.elementFromPoint(to.x, to.y);
            if (!hit?.closest("#bf-viewport")) continue;
            return { from: { x: world.left + mx * tile, y: world.top + my * tile }, to, id };
          }
        return null;
      });
      if (bend) {
        await page.mouse.move(bend.from.x, bend.from.y);
        await page.mouse.down();
        await page.mouse.move(bend.to.x, bend.to.y, { steps: 6 });
        await page.mouse.up();
        const stops = (await cmd()).draft.stops;
        assert.equal(stops.length, 2, `bend adds a stop: ${JSON.stringify(stops)}`);
        assert.equal(stops.at(-1), spot.id, "destination unchanged");
      }
      const drafted = (await cmd()).draft.stops;
      await page.locator("#bf-lock").click();
      const locked = await page.evaluate(() => window.battlefield.snapshot().units[1]);
      assert.deepEqual(locked.route, drafted, "Lock sends the route to the tank");
      assert.equal(locked.order, "hold");
      assert.match(await page.locator("#bf-cmd-state").textContent(), /^EN ROUTE/);
      await page.waitForFunction(() => !document.querySelector(".bf-route.draft"), null, { timeout: 2000 });
      // Next tank, then start: time runs, command mode ends, aim returns.
      await page.locator('[data-plan="next"]').click();
      assert.equal((await cmd()).selected, 2);
      await page.locator("#bf-start").click();
      assert.deepEqual(
        { on: (await cmd()).on, planning: (await cmd()).planning, aim: await page.evaluate(() => window.battlefield.aim.mode) },
        { on: false, planning: false, aim: mobile ? "auto" : "pointer" },
      );
      await page.waitForTimeout(200);
      assert.ok((await page.evaluate(() => window.battlefield.snapshot().time)) > t0, "battle runs after Start");
      // Mid-battle: Command is one of the aim modes; Auto switches it off again.
      await page.locator("#bf-command").click();
      assert.equal((await cmd()).on, true);
      assert.equal(await page.locator("#bf-auto").getAttribute("aria-pressed"), "false");
      assert.equal(await page.locator("#bf-cmd").isVisible(), true);
      await page.locator("#bf-auto").click();
      assert.equal((await cmd()).on, false);
      assert.equal(await page.locator("#bf-cmd").isVisible(), false);
      const before = await page.evaluate(
        () => window.battlefield.snapshot().units[0],
      );
      await page.keyboard.down("KeyD");
      await page.waitForTimeout(180);
      await page.keyboard.up("KeyD");
      const after = await page.evaluate(
        () => window.battlefield.snapshot().units[0],
      );
      assert.ok(after.x > before.x);
      if (mobile) {
        // Thumbstick: a drag to the right drives right; a light push creeps slower than a full one.
        const st = await page.locator("#bf-stick").boundingBox(),
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
          light = await drive(0.4);
        assert.ok(full > 0.2, `stick drives: ${full}`);
        assert.ok(light < full, `analog throttle: ${light} < ${full}`);
        assert.equal(await page.locator(".bf-knob").evaluate((el) => el.style.transform), "");
      }
      await page.locator("[data-order=follow]").click();
      assert.ok(
        await page.evaluate(() =>
          window.battlefield
            .snapshot()
            .units.filter((u) => u.side === 0 && u.id !== 0)
            .every((u) => u.order === "follow"),
        ),
      );
      await page.locator("[data-order=retreat]").click();
      assert.ok(
        await page.evaluate(() =>
          window.battlefield
            .snapshot()
            .units.filter((u) => u.side === 0 && u.id !== 0)
            .every((u) => u.order === "retreat"),
        ),
      );
      // Aim: lock an enemy tank, order the squad to attack it, then release to auto.
      const foe = await page.evaluate(() => window.battlefield.snapshot().units.find((u) => u.side === 1 && u.hp > 0).id);
      await page.evaluate((id) => document.querySelector(`[data-unit="${id}"]`).click(), foe);
      assert.deepEqual(await page.evaluate(() => window.battlefield.aim), { mode: "unit", id: foe, picking: false });
      await page.locator("[data-order=attack]").click();
      assert.ok(await page.evaluate((foe) => window.battlefield.snapshot().units.filter((u) => u.side === 0 && u.id !== 0).every((u) => u.order === "attack" && u.focus === foe), foe));
      await page.locator("#bf-target").click();
      assert.equal(await page.evaluate(() => window.battlefield.aim.picking), true);
      const box = await page.locator("#bf-viewport").boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      assert.equal(await page.evaluate(() => window.battlefield.aim.mode), "cell");
      await page.locator("#bf-auto").click();
      assert.equal(await page.evaluate(() => window.battlefield.aim.mode), mobile ? "auto" : "auto");
      await page.locator("[data-order=retreat]").click();
      if (mobile) {
        await page.locator("#bf-squad").click();
        await page.waitForTimeout(300);
        await page.locator(".bf-roster-unit").nth(1).click();
      }
      else await page.keyboard.press("Digit1");
      const target = await page.evaluate(async () => {
        const { route, cell, point } = await import("/src/model.ts");
        const s = window.battlefield.snapshot(),
          p = s.units[1];
        return s.board.tiles.findIndex((t, id) => {
          const q = point(s.board, id),
            d = Math.hypot(p.x - q.x, p.y - q.y),
            path = route(s.board, cell(s.board, p), id);
          return (
            d >= 2 &&
            d < 4 &&
            path.length > 1 &&
            path.length < 5 &&
            s.units.every((u) => Math.hypot(u.x - q.x, u.y - q.y) > 0.9)
          );
        });
      });
      assert.ok(target >= 0);
      const tile = page.locator(`[data-cell="${target}"]`);
      await tile.scrollIntoViewIfNeeded();
      // Tapping your own tank mid-battle opens Command on it.
      assert.deepEqual(
        await page.evaluate(() => ({ on: window.battlefield.command.on, selected: window.battlefield.command.selected })),
        { on: true, selected: 1 },
      );
      // Tap the square's centre on the map (a tank driving over it must not intercept), then Lock.
      await tile.evaluate((el) => {
        const r = el.getBoundingClientRect(),
          at = { bubbles: true, pointerId: 7, isPrimary: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
        const vp = document.querySelector("#bf-viewport");
        vp.dispatchEvent(new PointerEvent("pointerdown", at));
        vp.dispatchEvent(new PointerEvent("pointerup", at));
      });
      await page.locator("#bf-lock").click();
      // The locked tank heads there and holds.
      assert.equal(
        await page.evaluate(() => window.battlefield.snapshot().units[1].order),
        "hold",
      );
      const moved = await page.evaluate(() => {
        const s = window.battlefield.snapshot();
        return { waypoint: s.units[1].hold, assigned: s.events.some((e) => e.startsWith("Route locked")) };
      });
      assert.ok(
        moved.waypoint === target || moved.assigned,
        `UI waypoint reaches model: ${JSON.stringify(moved)}`,
      );
      // Back to fighting: Auto leaves Command (and the gun works again).
      await page.locator("#bf-auto").click();
      assert.equal(await page.evaluate(() => window.battlefield.command.on), false);
      const rosterIdentity = await page
        .locator(".bf-roster-unit")
        .first()
        .elementHandle();
      await page.waitForTimeout(180);
      assert.ok(
        await rosterIdentity.evaluate((el) => el.isConnected),
        "roster nodes stay stable",
      );
      // Pause freezes all simulation state and restores native selection.
      await page.locator("#bf-pause").click();
      const frozen = await page.evaluate(() => window.battlefield.snapshot());
      await resize(page, 
        mobile ? { width: 900, height: 420 } : { width: 1280, height: 900 },
      );
      await page.waitForTimeout(120);
      assert.deepEqual(
        await page.evaluate(() => window.battlefield.snapshot()),
        frozen,
      );
      await resize(page, 
        mobile ? { width: 844, height: 390 } : { width: 1440, height: 1000 },
      );
      if (mobile)
        assert.notEqual(
          await page.evaluate(() => getComputedStyle(document.body).userSelect),
          "none",
        );
      await page.locator("#bf-pause").click();
      if (mobile) {
        await page.locator("#bf-pan").click();
        const r = await page.locator("#bf-viewport").boundingBox();
        await page.mouse.move(r.x + r.width - 25, r.y + r.height * 0.6);
        await page.mouse.down();
        await page.mouse.move(r.x + 25, r.y + r.height * 0.6, { steps: 5 });
        await page.mouse.up();
        assert.ok(
          await page
            .locator("#bf-viewport")
            .evaluate((el) => el.scrollLeft > 0),
        );
        await page.locator("#bf-pan").click();
        await page.locator("#bf-center").click();
      }
      if (mobile) {
        await resize(page, { width: 844, height: 390 });
        await page.waitForTimeout(100);
        const stage = await page.locator("#bf-viewport").boundingBox();
        const pad = await page.locator(".bf-dpad").boundingBox();
        const fireBox = await page.locator('[data-key="Space"]').boundingBox();
        assert.ok(stage.x <= 844 * 0.2 && stage.x + stage.width >= 844 * 0.8, "map owns the middle 60%+");
        assert.ok(stage.height >= 386, "map is full height");
        assert.ok(pad.x + pad.width <= stage.x, "D-pad sits in the left rail");
        assert.ok(fireBox.x >= stage.x + stage.width, "Fire sits in the right rail");
        assert.ok(pad.y + pad.height <= 390);
        for (const sel of [".bf-mini", ".bf-aim", ".bf-orders"]) {
          const r = await page.locator(sel).boundingBox();
          assert.ok(r.x >= stage.x + stage.width && r.x + r.width <= 844, `${sel} in right rail`);
          assert.ok(await page.locator(sel).evaluate((el) => {
            const b = el.getBoundingClientRect();
            return el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
          }), `${sel} is not covered`);
        }
        const tools = await page.locator(".bf-map-tools").boundingBox();
        assert.ok(tools.x + tools.width <= stage.x, "camera tools in left rail");
        const score = await page.locator(".bf-metrics").boundingBox();
        assert.ok(score.y + score.height <= tools.y, "scoreboard clears camera tools");
        assert.ok(tools.y + tools.height <= pad.y, "camera tools clear the D-pad");
        // Short screens (iPhone Safari with its bars shows ~300-330px): no rail control may overlap.
        for (const [w, h] of [[844, 330], [667, 300]]) {
          await resize(page, { width: w, height: h });
          const bad = await page.evaluate(() => {
            const box = [".bf-quick", ".bf-metrics", ".bf-map-tools", ".bf-dpad", ".bf-mini", ".bf-aim", ".bf-orders", ".bf-fire"].map((s) => [s, document.querySelector(s).getBoundingClientRect()]);
            const out = [];
            for (let i = 0; i < box.length; i++) {
              const [a, A] = box[i];
              if (A.top < 0 || A.bottom > innerHeight + 0.5) out.push(`${a} offscreen`);
              for (const [b, B] of box.slice(i + 1))
                if (A.left < B.right - 0.5 && B.left < A.right - 0.5 && A.top < B.bottom - 0.5 && B.top < A.bottom - 0.5) out.push(`${a} x ${b}`);
            }
            return out;
          });
          assert.deepEqual(bad, [], `${w}x${h} rails`);
        }
        await resize(page, { width: 844, height: 390 });
        // Notch / camera cutout: simulated 44px insets push both rails inward.
        await page.locator("#battlefield").evaluate((el) => {
          el.style.setProperty("--sl", "44px");
          el.style.setProperty("--sr", "44px");
        });
        await page.waitForTimeout(80);
        const padSafe = await page.locator(".bf-dpad").boundingBox(),
          fireSafe = await page.locator('[data-key="Space"]').boundingBox(),
          miniSafe = await page.locator(".bf-mini").boundingBox(),
          mapSafe = await page.locator("#bf-viewport").boundingBox();
        assert.ok(padSafe.x >= 44 && fireSafe.x + fireSafe.width <= 844 - 44, "controls clear the safe area");
        assert.ok(miniSafe.x + miniSafe.width <= 844 - 44, "minimap clears the safe area");
        assert.ok(padSafe.x + padSafe.width <= mapSafe.x && fireSafe.x >= mapSafe.x + mapSafe.width, "map stays between rails");
        await page.locator("#battlefield").evaluate((el) => {
          el.style.removeProperty("--sl");
          el.style.removeProperty("--sr");
        });
        const orders = await page.locator(".bf-orders").boundingBox();
        assert.ok(orders.y + orders.height <= fireBox.y, "orders clear the Fire button");
        assert.equal(await page.locator("#bf-tactics").isVisible(), false);
        const fire = await page.locator('[data-key="Space"]').boundingBox();
        assert.ok(fire.y + fire.height <= 390, "Fire stays in viewport");
        await page.mouse.move(
          fire.x + fire.width / 2,
          fire.y + fire.height / 2,
        );
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.up();
        assert.ok(
          await page.evaluate(
            () => window.battlefield.snapshot().units[0].cooldown > 0,
          ),
          "touch fire works",
        );
      }
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.screenshot({
        path: `artifacts/battle-${mobile ? "mobile" : "desktop"}-${light ? "light" : "dark"}.png`,
      });
      if (mobile) {
        await page.locator("#bf-squad").click();
        await page.waitForTimeout(300);
      }
      await page.locator("#bf-restart").click();
      assert.equal(
        await page.evaluate(() => window.battlefield.playing),
        false,
      );
      assert.equal(await page.locator(".bf-tank").count(), 8);
      for (let n = 0; n < 3; n++) {
        await page.locator("#bf-deploy").click();
        if (mobile) await passGate(page);
        if (mobile) {
          await page.locator("#bf-squad").click();
          await page.waitForTimeout(300);
        }
        await page.locator("#bf-restart").click();
      }
      assert.equal(await page.locator(".bf-tank").count(), 8);
      assert.equal(
        await page.locator("style[data-dom-virus-selection]").count(),
        0,
      );
      // Big battle: 12 per side, picked in Strategy during the plan step, runs without errors.
      await page.locator("#bf-deploy").click();
      if (mobile) await passGate(page);
      await page.locator("#bf-strat-toggle").click();
      await page.locator('#bf-size [data-size="12"]').click();
      assert.equal(await page.locator(".bf-tank").count(), 24);
      await page.locator("#bf-strat-close").click();
      await page.locator("#bf-start").click();
      await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => window.battlefield.snapshot().units.length), 24);
      if (mobile) {
        await page.locator("#bf-squad").click();
        await page.waitForTimeout(300);
      }
      await page.locator("#bf-restart").click();
      // The strategy stuck: still 12 a side on the next setup.
      assert.equal(await page.locator(".bf-tank").count(), 24);
      // Quick battle skips the plan step entirely.
      await page.locator("#bf-quick").click();
      if (mobile) await passGate(page);
      assert.equal(await page.evaluate(() => window.battlefield.command.planning), false);
      if (mobile) {
        await page.locator("#bf-squad").click();
        await page.waitForTimeout(300);
      }
      await page.locator("#bf-restart").click();
      assert.deepEqual(errors, []);
      console.log({
        mobile,
        light,
        commands: true,
        paused: true,
        cleanup: true,
      });
      await page.close();
    }
  // Install card: iPhone Safari gets Add to Home Screen steps; desktop never sees it.
  {
    const page = await browser.newPage({
      viewport: { width: 844, height: 390 },
      hasTouch: true,
      isMobile: true,
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    });
    await page.goto("http://127.0.0.1:5231");
    await page.waitForFunction(() => window.battlefield);
    assert.equal(await page.evaluate(() => window.battlefield.install), "ios");
    await page.locator("#bf-install-later").click();
    assert.equal(await page.evaluate(() => window.battlefield.install), null);
    await page.close();
    const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await desk.goto("http://127.0.0.1:5231");
    await desk.waitForFunction(() => window.battlefield);
    assert.equal(await desk.evaluate(() => window.battlefield.install), null);
    await desk.close();
    console.log({ install: true });
  }
} catch (e) {
  // CI annotation: readable from the checks API even when log downloads are not.
  console.log(`::error title=Battlefield browser test (${where})::${String(e.stack || e).split("\n").slice(0, 4).join(" | ")}`);
  throw e;
} finally {
  await browser.close();
  await server.close();
}
