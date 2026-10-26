import test from "node:test";
import assert from "node:assert/strict";
import {
  variant,
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
  plot,
  moveBase,
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
      for (let seed = 1; seed <= 12; seed++)
      for (const density of [0.6, 1, 1.45]) {
        const b = generate(w, h, mission, seed, density);
        assert.ok(route(b, b.bases[0], b.bases[1]).length, `${mission}/${density}: HQ to HQ`);
        assert.ok(route(b, b.bases[0], b.center).length);
        assert.deepEqual(b, generate(w, h, mission, seed, density));
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
test("orders target only own wingmen; a move becomes a hold at that square", () => {
  const s = createBattle(generate(26, 20, 1, 3), 1, 0, roles);
  command(s, { type: "order", ids: [0, 1, 4], order: "retreat" });
  assert.equal(s.units[0].order, "advance");
  assert.equal(s.units[1].order, "retreat");
  assert.equal(s.units[4].order, "advance");
  const dest = cell(s.board, s.units[1]);
  assert.equal(command(s, { type: "move", id: 4, cell: dest }), false);
  assert.equal(command(s, { type: "move", id: 1, cell: dest }), true);
  assert.equal(s.units[1].order, "hold");
  assert.equal(s.units[1].hold, dest);
  // A new squad order replaces the route and the hold.
  command(s, { type: "order", ids: [1], order: "advance" });
  assert.equal(s.units[1].hold, null);
  assert.deepEqual(s.units[1].route, []);
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
test("a route drives through every stop in order, then holds the destination", () => {
  const b = generate(26, 20, 0, 3);
  b.tiles.fill("ground");
  const s = createBattle(b, 0, 0, roles);
  for (const u of s.units) if (u.id !== 1 && u.id !== 0) u.hp = 0;
  s.units[4].hp = 100;
  s.units[4].x = 24;
  s.units[4].y = 18;
  const u = s.units[1];
  u.hp = u.maxHp = 1e6; // never low enough to detour for a repair kit
  const start = cell(b, u),
    via = cell(b, { x: u.x, y: u.y + 4 }),
    dest = cell(b, { x: u.x + 4, y: u.y + 4 });
  // The plotted path bends through the stop instead of cutting the corner.
  const full = plot(b, start, [via, dest]);
  assert.ok(full.includes(via));
  assert.equal(full.at(-1), dest);
  assert.equal(plot(b, start, [-1]), null);
  assert.ok(command(s, { type: "route", id: 1, cells: [via, dest] }));
  let sawVia = false;
  for (let i = 0; i < 900 && !(u.waypoint === null && cell(b, u) === dest); i++) {
    const before = { x: u.x, y: u.y };
    step(s, 0.02, idle);
    assert.ok(Math.hypot(u.x - before.x, u.y - before.y) < 0.1, "no teleporting");
    if (cell(b, u) === via) sawVia = true;
  }
  assert.ok(sawVia, "drove through the stop");
  assert.equal(cell(b, u), dest);
  // Holding: it stays put instead of drifting back to an old order.
  for (let i = 0; i < 200; i++) step(s, 0.02, idle);
  assert.equal(cell(b, u), dest);
  assert.equal(u.order, "hold");
  // Blocked stops are refused.
  b.tiles[dest] = "rock";
  assert.equal(command(s, { type: "route", id: 1, cells: [dest] }), false);
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
test("an HQ can move within its own half, never onto water or into a dead end", () => {
  const b = generate(30, 20, 3, 4);
  const mid = Math.floor(b.rows / 2);
  assert.equal(moveBase(b, 0, mid * b.cols + 25), false, "not on the enemy half");
  assert.equal(moveBase(b, 0, mid * b.cols + 15), false, "not on the canal");
  assert.ok(moveBase(b, 0, 4 * b.cols + 5));
  assert.equal(b.bases[0], 4 * b.cols + 5);
  assert.equal(b.tiles[4 * b.cols + 5], "ground");
  assert.ok(route(b, b.bases[0], b.bases[1]).length);
  const s = createBattle(b, 3, 0, roles);
  assert.ok(Math.hypot(s.units[0].x - 5.5, s.units[0].y - 4.5) < 4, "squad deploys at the new HQ");
});
test("wedge, line and column are different shapes", () => {
  const b = generate(30, 20, 1, 2);
  b.tiles.fill("ground");
  const shape = (f) => createBattle(b, 1, 0, roles, f).units.slice(0, 4).map((u) => [u.x.toFixed(1), u.y.toFixed(1)].join());
  const wedge = shape("wedge"), line = shape("line"), column = shape("column");
  assert.notDeepEqual(wedge, line);
  assert.notDeepEqual(line, column);
  const lx = createBattle(b, 1, 0, roles, "line").units.slice(0, 4).map((u) => u.x);
  assert.ok(Math.max(...lx) - Math.min(...lx) < 0.6, "line is abreast");
  const w = createBattle(b, 1, 0, roles, "wedge").units.slice(0, 4);
  assert.ok(w[0].x > w[1].x && w[0].x > w[3].x, "you lead the wedge");
});
test("terrain density makes maps lighter or heavier", () => {
  const solidCount = (b) => b.tiles.filter((t) => t !== "ground" && t !== "road").length;
  for (let mission = 0; mission < 4; mission++) {
    const light = solidCount(generate(30, 20, mission, 5, 0.6)),
      heavy = solidCount(generate(30, 20, mission, 5, 1.45));
    assert.ok(heavy > light, `mission ${mission}: ${light} < ${heavy}`);
  }
});
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

test("each terrain lays different roads, and every field stays connected", () => {
  const roads = (m, s) => generate(36, 20, m, s).tiles.map((t) => (t === "road" ? 1 : 0)).join("");
  assert.notEqual(roads(0, 7), roads(1, 7));
  assert.notEqual(roads(1, 7), roads(2, 7));
  assert.notEqual(roads(0, 7), roads(0, 8), "the seed moves the lanes");
  for (let m = 0; m < 4; m++)
    for (let s = 1; s < 60; s++)
      for (const [c, r] of [[18, 14], [48, 30]]) {
        const b = generate(c, r, m, s * 7919, 1.45);
        assert.ok(route(b, b.bases[0], b.bases[1]).length, `bases connect (${m}/${s})`);
        assert.ok(route(b, b.bases[0], b.center).length, `objective reachable (${m}/${s})`);
      }
});

test("dashed cover falls faster than solid cover", () => {
  const b = generate(36, 20, 3, 11);
  const houses = b.tiles.map((t, i) => [t, i]).filter(([t]) => t === "house");
  const dashed = houses.filter(([, i]) => variant(i) >= 3), solidOnes = houses.filter(([, i]) => variant(i) < 3);
  assert.ok(dashed.length && solidOnes.length);
  for (const [, i] of dashed) assert.equal(b.health[i], 40);
  for (const [, i] of solidOnes) assert.equal(b.health[i], 90);
  const w = generate(36, 20, 2, 11);
  w.tiles.forEach((t, i) => t === "rock" && assert.equal(w.health[i], variant(i) >= 3 ? 35 : 0));
});
