// The landing hero's battle (site/src/scripts/arena/sim.ts) on the Fizlet kernel: it fights, it
// rests, and a busy steady state steps without allocating (Fizlet contract: a step never allocates).
// Its own file, so it runs in its own process; npm test runs files one at a time with --expose-gc.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";
import { createEngine } from "../vendor/fizlet/kernel/engine.ts";
import { effects } from "../vendor/fizlet/fx.ts";
import { createArena, WORDS, REST } from "../site/src/scripts/arena/sim.ts";

/** A 1440 × 860 hero with the headline's 21 letters in two rows and the copy kept clear. */
function hero() {
  const e = createEngine();
  const fx = effects({ words: WORDS, colors: ["#fff4ff", "#ffc21a", "#ff8a1f", "#ff2e88", "#19f0ff", "#39ffb0", "#ff5c8f", "#9a63ff", "#151020"] });
  const a = createArena(e, fx);
  for (let i = 0; i < 21; i++) (a.lx[i] = 150 + (i % 11) * 80), (a.ly[i] = i < 11 ? 140 : 280), (a.lw[i] = 70), (a.lh[i] = 130);
  a.N[a.NL] = 21;
  a.kl[0] = 150, a.kt[0] = 140, a.kr[0] = 1100, a.kb[0] = 420;
  a.N[a.NK] = 1;
  a.resize(1440, 860);
  return { e, fx, a };
}

test("the hero battle fights: shells, wrecks, flattened shapes and letters, knocked letters", () => {
  const { e, fx, a } = hero();
  let knocked = 0;
  for (let i = 0; i < 60 * 40; i++) {
    if (i % 300 === 0) a.strike(300 + (i % 900), 400);
    a.F[a.QUIET] = 0;
    a.step(1 / 60);
    for (let l = 0; l < 21; l++) if (a.anim[l]) knocked++;
    e.events.clear();
  }
  assert.ok(a.N[a.WRECKS] > 3, `wrecks ${a.N[a.WRECKS]}`);
  assert.ok(a.N[a.FLAT] > 3, `flattened ${a.N[a.FLAT]}`);
  assert.equal(a.N[a.STRUCK], 8);
  assert.ok(knocked > 0, "letters react");
  assert.ok(fx.live > 0 && fx.dropped === 0, `effects in budget (${fx.live} live, ${fx.dropped} dropped)`);
  for (let i = 0; i < a.N[a.NT]; i++) assert.ok(Number.isFinite(a.tx[i]) && Number.isFinite(a.ty[i]));
});

test("left alone, the battle rests: it stops firing, everything lands, the engine may settle", () => {
  const { e, fx, a } = hero();
  let busy = 0;
  e.busy = () => void busy++;
  for (let i = 0; i < 60 * (REST + 6); i++) a.step(1 / 60);
  busy = 0;
  for (let i = 0; i < 60; i++) a.step(1 / 60);
  assert.equal(busy, 0, "no frame asked for once at rest");
  assert.equal(fx.live, 0);
  assert.equal(a.N[a.NS], 0);
  // A visitor (input resets the quiet clock) wakes it.
  a.F[a.QUIET] = 0;
  a.step(1 / 60);
  assert.equal(busy, 1);
});

test("a busy hero battle steps without allocating (zero minor GCs over 20,000 steps)", async () => {
  const { e, a } = hero();
  const busy = (n) => {
    for (let i = 0; i < n; i++) {
      if (i % 240 === 0) a.strike(200 + (i % 1000), 300 + (i % 400));
      a.F[a.QUIET] = 0;
      a.step(1 / 60);
      e.events.clear();
    }
  };
  busy(20000); // warm up: every path optimized
  const wrecks = a.N[a.WRECKS];
  const gcs = await minorGCs(() => busy(20000), 5);
  assert.ok(a.N[a.WRECKS] - wrecks > 20, `busy: ${a.N[a.WRECKS] - wrecks} wrecks`);
  assert.equal(gcs, 0, `${gcs} minor GCs while stepping`);
});
