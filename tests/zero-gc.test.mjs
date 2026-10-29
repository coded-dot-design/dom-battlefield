// Zero steady-state allocation (Fizlet contract rule 3): a busy battle steps without a minor GC.
// Its own file, so it runs in its own process; npm test runs files one at a time with --expose-gc.
import test from "node:test";
import assert from "node:assert/strict";
import { minorGCs } from "./gc.mjs";
import { createEngine } from "../vendor/fizlet/kernel/engine.ts";
import { generate, createBattle, step } from "../src/model.ts";

const roles = ["medium", "scout", "medium", "heavy"];

test("a busy steady state steps without allocating (zero minor GCs over 20,000 steps)", async () => {
  // Twelve a side kept alive and fighting: everyone is healed every half second, so the
  // battle never ends and every system stays busy (pathing, line of sight, shells, cover, kits).
  for (const mission of [1, 2, 3]) {
    const s = createBattle(generate(40, 24, mission, 7), mission, 0, roles, "wedge", 12, createEngine());
    const input = { x: 0, y: 0, fire: true, aim: null };
    const busy = (n) => {
      for (let i = 0; i < n; i++) {
        if (i % 30 === 0) {
          for (let j = 0; j < s.units.length; j++) s.units[j].hp = s.units[j].maxHp;
          s.capture[0] = s.capture[1] = 0;
        }
        step(s, 1 / 60, input);
      }
    };
    busy(20000); // warm up: every path optimized
    const shells = s.nextId;
    const gcs = await minorGCs(() => busy(20000), 5);
    assert.equal(s.winner, null, "still fighting");
    assert.ok(s.nextId - shells > 5000, `busy: ${s.nextId - shells} shells and bursts`);
    assert.equal(gcs, 0, `mission ${mission}: ${gcs} minor GCs over 20,000 busy steps`);
  }
});
