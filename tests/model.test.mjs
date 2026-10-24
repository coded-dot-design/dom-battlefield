import test from "node:test";
import assert from "node:assert/strict";
import {
  generate,
  route,
  point,
  cell,
  createBattle,
  command,
  step,
  fire,
  ROLES,
  loadoutCost,
  solid,
  canMove,
  clearShot,
  speedOf,
} from "../src/model.ts";
const roles = ["medium", "scout", "medium", "heavy"];
const idle = { x: 0, y: 0, fire: false, aim: null };
test("all operations and viewport sizes have reachable objectives and clear deployment zones", () => {
  for (let mission = 0; mission < 4; mission++)
    for (const [w, h] of [
      [18, 14],
      [26, 20],
      [40, 26],
    ])
      for (let seed = 1; seed <= 12; seed++) {
        const b = generate(w, h, mission, seed);
        assert.ok(route(b, b.bases[0], b.bases[1]).length);
        assert.ok(route(b, b.bases[0], b.center).length);
        assert.deepEqual(b, generate(w, h, mission, seed));
        for (const formation of ["wedge", "line", "column"])
          for (const side of [0, 1]) {
            const s = createBattle(b, mission, side, roles, formation);
            assert.equal(s.units.length, 8);
            for (const u of s.units)
              assert.ok(
                canMove(b, u),
                `${mission}/${formation}: ${JSON.stringify(u)}`,
              );
          }
      }
});
test("loadout budget is enforced at simulation boundary", () => {
  assert.equal(loadoutCost(roles), 12);
  assert.throws(() =>
    createBattle(generate(26, 20, 0, 2), 0, 0, [
      "heavy",
      "heavy",
      "heavy",
      "heavy",
    ]),
  );
});
test("orders target only own wingmen and move orders preserve standing orders", () => {
  const s = createBattle(generate(26, 20, 1, 3), 1, 0, roles);
  command(s, { type: "order", ids: [0, 1, 4], order: "retreat" });
  assert.equal(s.units[0].order, "advance");
  assert.equal(s.units[1].order, "retreat");
  assert.equal(s.units[4].order, "advance");
  const dest = cell(s.board, s.units[1]);
  assert.equal(command(s, { type: "move", id: 4, cell: dest }), false);
  assert.equal(command(s, { type: "move", id: 1, cell: dest }), true);
  assert.equal(s.units[1].waypoint, null);
  assert.equal(s.units[1].order, "retreat");
});
test("tank-blocking fence allows fire; permanent rock stops shells and destructible cover becomes rubble", () => {
  const b = generate(18, 14, 1, 5);
  b.tiles.fill("ground");
  b.health.fill(0);
  const id = 5 * b.cols + 8;
  b.tiles[id] = "fence";
  assert.equal(canMove(b, point(b, id)), false);
  assert.equal(clearShot(b, { x: 7.5, y: 5.5 }, { x: 9.5, y: 5.5 }), true);
  b.tiles[id] = "house";
  b.health[id] = 28;
  const s = createBattle(b, 1, 0, roles);
  const p = s.units[0];
  Object.assign(p, { x: 7.5, y: 5.5, cooldown: 0, turret: 0 });
  for (const u of s.units.slice(1)) u.hp = 0;
  s.units[4].hp = 100;
  s.units[4].x = 16;
  s.units[4].y = 12;
  fire(s, p, 0);
  for (let i = 0; i < 10; i++) step(s, 0.02, idle);
  assert.equal(b.tiles[id], "rubble");
  assert.equal(b.revision, 1);
  b.tiles[id] = "rock";
  b.revision++;
  p.cooldown = 0;
  fire(s, p, 0);
  for (let i = 0; i < 10; i++) step(s, 0.02, idle);
  assert.equal(b.tiles[id], "rock");
});
test("waypoint arrival resumes standing order without teleportation", () => {
  const b = generate(26, 20, 0, 3);
  b.tiles.fill("ground");
  const s = createBattle(b, 0, 0, roles);
  for (const u of s.units) if (u.id !== 1 && u.id !== 0) u.hp = 0;
  s.units[4].hp = 100;
  s.units[4].x = 24;
  s.units[4].y = 18;
  const u = s.units[1];
  u.order = "retreat";
  const target = cell(b, { x: u.x + 3, y: u.y });
  assert.ok(command(s, { type: "move", id: 1, cell: target }));
  let arrived = false;
  for (let i = 0; i < 300; i++) {
    const before = { x: u.x, y: u.y };
    step(s, 0.02, idle);
    assert.ok(Math.hypot(u.x - before.x, u.y - before.y) < 0.1);
    if (u.waypoint === null) {
      arrived = true;
      break;
    }
  }
  assert.ok(arrived);
  assert.equal(u.order, "retreat");
});
test("capture and player loss end the battle; end state stops simulation", () => {
  const s = createBattle(generate(26, 20, 0, 1), 0, 0, roles);
  for (const u of s.units)
    if (u.side === 1) {
      u.x = 22;
      u.y = 2;
      u.order = "retreat";
    }
  const p = s.units[0];
  Object.assign(p, point(s.board, s.board.bases[1]));
  s.capture[0] = 11.99;
  step(s, 0.02, idle);
  assert.equal(s.winner, 0);
  const time = s.time;
  step(s, 0.02, idle);
  assert.equal(s.time, time);
  const t = createBattle(generate(26, 20, 1, 1), 1, 0, roles);
  t.units[0].hp = 0;
  step(t, 0.02, idle);
  assert.equal(t.winner, 1);
});
test("simulation stays bounded with finite projectiles, debris and event history", () => {
  const s = createBattle(generate(26, 20, 1, 8), 1, 0, roles);
  for (let i = 0; i < 5000; i++) {
    step(s, 0.02, { ...idle, fire: true });
    assert.ok(s.shots.length <= 80);
    assert.ok(s.effects.length <= 64);
    assert.ok(s.events.length <= 8);
    for (const u of s.units)
      assert.ok(
        Number.isFinite(u.x) &&
          Number.isFinite(u.y) &&
          u.x >= 0 &&
          u.x < s.board.cols &&
          u.y >= 0 &&
          u.y < s.board.rows,
      );
  }
});
test("damaged tanks slow down but never stop", () => {
  const s = createBattle(generate(26, 20, 1, 3), 1, 0, roles);
  const u = s.units[1];
  const full = speedOf(u);
  assert.equal(full, ROLES[u.role].speed);
  u.hp = u.maxHp / 2;
  assert.ok(speedOf(u) < full && speedOf(u) > full * 0.7);
  u.hp = 1;
  assert.ok(speedOf(u) > full * 0.5);
  assert.ok(ROLES.heavy.speed < ROLES.medium.speed && ROLES.medium.speed < ROLES.scout.speed);
});
import { commander, REPAIR, SQUAD_SIZES } from "../src/model.ts";
test("larger squads deploy on open ground with unique ids and a command tank", () => {
  for (const per of SQUAD_SIZES)
    for (let mission = 0; mission < 4; mission++)
      for (const formation of ["wedge", "line", "column"]) {
        const b = generate(40, 26, mission, 7);
        const s = createBattle(b, mission, 1, roles, formation, per);
        assert.equal(s.units.length, per * 2);
        assert.equal(new Set(s.units.map((u) => u.id)).size, per * 2);
        assert.equal(commander(s).id, per);
        const cells = s.units.map((u) => cell(b, u));
        assert.equal(new Set(cells).size, cells.length, "no stacked tanks");
        for (const u of s.units) assert.ok(canMove(b, u), `${per}/${mission}/${formation}`);
      }
});
test("repair kits, HQ repair and kill salvage restore armor", () => {
  const b = generate(26, 20, 1, 4);
  const s = createBattle(b, 1, 0, roles);
  const p = commander(s);
  p.hp = 20;
  s.pickups.push({ id: 999, x: p.x, y: p.y });
  step(s, 0.02, idle);
  assert.ok(p.hp >= 20 + REPAIR.kit - 1, "kit heals");
  assert.equal(s.pickups.length, 0);
  p.hp = 10;
  const before = p.hp;
  for (let i = 0; i < 50; i++) step(s, 0.02, idle);
  assert.ok(p.hp > before + 5, "HQ repairs quickly");
  for (let i = 0; i < 2000; i++) step(s, 0.02, idle);
  assert.ok(s.pickups.length <= 3 + s.per / 4 + 6);
});
test("attack order focuses a chosen enemy, then hunts when it dies", () => {
  const b = generate(26, 20, 1, 3);
  b.tiles.fill("ground");
  const s = createBattle(b, 1, 0, roles);
  const enemy = s.units[6];
  command(s, { type: "focus", ids: [1, 2, 3], target: enemy.id });
  assert.ok(s.units.slice(1, 4).every((u) => u.order === "attack" && u.focus === enemy.id));
  const d0 = Math.hypot(s.units[1].x - enemy.x, s.units[1].y - enemy.y);
  for (let i = 0; i < 60; i++) step(s, 0.02, idle);
  assert.ok(Math.hypot(s.units[1].x - enemy.x, s.units[1].y - enemy.y) < d0, "closes on target");
  enemy.hp = 0;
  step(s, 0.02, idle);
  assert.ok(s.units.slice(1, 4).every((u) => u.focus === null && u.order === "attack"));
  assert.equal(command(s, { type: "focus", ids: [0], target: 5 }), true);
  assert.equal(s.units[0].order, "advance", "command tank is never re-ordered");
});
