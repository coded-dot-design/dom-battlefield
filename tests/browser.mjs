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
      await page.locator("#bf-loadout select").nth(1).selectOption("heavy");
      assert.equal(await page.locator("#bf-deploy").isDisabled(), true);
      await page.locator("#bf-loadout select").nth(1).selectOption("scout");
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
      if (mobile) await page.evaluate(async () => { if (document.fullscreenElement) await document.exitFullscreen(); });
      assert.equal(await page.evaluate(() => window.battlefield.playing), true);
      if (mobile)
        assert.equal(
          await page.evaluate(() => getComputedStyle(document.body).userSelect),
          "none",
        );
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
      if (mobile) await page.locator("#bf-squad").click();
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
      if (mobile) await page.locator(".bf-roster-unit").nth(1).click();
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
      await tile.click({ force: true });
      assert.equal(
        await page.evaluate(() => window.battlefield.snapshot().units[1].order),
        "retreat",
      );
      assert.equal(
        await page.evaluate(
          () => window.battlefield.snapshot().units[1].waypoint,
        ),
        target,
        "UI waypoint reaches model",
      );
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
      await page.setViewportSize(
        mobile ? { width: 420, height: 844 } : { width: 1280, height: 900 },
      );
      await page.waitForTimeout(120);
      assert.deepEqual(
        await page.evaluate(() => window.battlefield.snapshot()),
        frozen,
      );
      await page.setViewportSize(
        mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
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
        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForTimeout(100);
        const stage = await page.locator(".bf-stage").boundingBox();
        assert.ok(stage.width >= 840 && stage.height >= 386, "landscape map fills screen");
        const pad = await page.locator(".bf-dpad").boundingBox();
        assert.ok(pad.width <= 844 * .2, "movement uses under 20% width");
        assert.ok(pad.y + pad.height <= 390);
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
      await page.locator("#bf-restart").click();
      assert.equal(
        await page.evaluate(() => window.battlefield.playing),
        false,
      );
      assert.equal(await page.locator(".bf-tank").count(), 8);
      for (let n = 0; n < 3; n++) {
        await page.locator("#bf-deploy").click();
        await page.locator("#bf-restart").click();
      }
      assert.equal(await page.locator(".bf-tank").count(), 8);
      assert.equal(
        await page.locator("style[data-dom-virus-selection]").count(),
        0,
      );
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
} finally {
  await browser.close();
  await server.close();
}
