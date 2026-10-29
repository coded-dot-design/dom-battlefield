// The battle on the Fizlet kernel: a seed replays the same battle frame for frame (the engine's
// seeded random is the only randomness in play), and another seed gives another battle.
import test from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../vendor/fizlet/kernel/engine.ts";
import { generate, createBattle, command, step, snapshot } from "../src/model.ts";

const roles = ["medium", "scout", "medium", "heavy"];

/** Twelve a side on a seeded field, stepped by the kernel at 60 Hz with scripted input (steer,
 *  fire, a squad order); returns a digest every 10 seconds and the Math.random calls made. */
function play(seed, frames, mission = 1) {
  const e = createEngine();
  const s = createBattle(generate(40, 24, mission, seed), mission, 0, roles, "wedge", 12, e);
  const input = { x: 0, y: 0, fire: false, aim: null };
  e.add({ step: (_, dt) => step(s, dt, input) });
  let calls = 0;
  const real = Math.random;
  Math.random = () => (calls++, real());
  const digest = [];
  try {
    for (let f = 1; f <= frames; f++) {
      input.x = Math.sin(f / 90);
      input.y = Math.cos(f / 70) * 0.7;
      input.fire = f % 200 < 150;
      if (f === 900) command(s, { type: "focus", ids: [1, 2, 3], target: null });
      if (f === 2400) command(s, { type: "release", ids: [1, 2, 3] });
      e.advance(1 / 60);
      if (f % 600 === 0) {
        const k = snapshot(s);
        digest.push(
          k.units.map((u) => [u.hp > 0, u.x.toFixed(6), u.y.toFixed(6), u.hp.toFixed(3), u.order].join()).join("|"),
          `shots ${s.shotCount} fx ${s.effectCount} kits ${k.kits.x.join()} random ${k.random} next ${s.nextId} winner ${s.winner}`,
        );
      }
    }
  } finally {
    Math.random = real;
    e.destroy();
  }
  return { digest: digest.join("\n"), calls, steps: e.steps, s };
}

test("same seed, same battle on the kernel; another seed, another battle; no Math.random in play", () => {
  for (const mission of [0, 1, 2, 3]) {
    const a = play(41, 3600, mission), b = play(41, 3600, mission), c = play(42, 3600, mission);
    assert.equal(a.calls, 0, "no Math.random while playing");
    assert.equal(a.digest, b.digest, `mission ${mission}: seed 41 twice, identical over 3600 frames`);
    assert.notEqual(a.digest, c.digest, `mission ${mission}: seed 42 plays another battle`);
    assert.ok(a.s.nextId > 1100, "shells flew");
  }
});
