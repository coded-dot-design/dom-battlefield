/** Battlefield owns maps and rules. Positions are grid units; commands contain no DOM. */
export type Tile =
  | "ground"
  | "road"
  | "water"
  | "rock"
  | "hedge"
  | "house"
  | "fence"
  | "car"
  | "rubble";
export type Role = "scout" | "medium" | "heavy";
export type Order = "advance" | "follow" | "retreat" | "attack";
export type Point = { x: number; y: number };
export interface Unit extends Point {
  id: number;
  side: number;
  role: Role;
  hp: number;
  maxHp: number;
  angle: number;
  turret: number;
  tread: number;
  recoil: number;
  cooldown: number;
  order: Order;
  waypoint: number | null;
  path: number[];
  plan: number;
  /** Enemy this tank was ordered to attack (attack order), if still alive. */
  focus: number | null;
  /** Cached nearest visible enemy; rescanned every `scan` seconds. */
  target: number | null;
  scan: number;
}
export interface Shot extends Point {
  id: number;
  vx: number;
  vy: number;
  side: number;
  life: number;
  damage: number;
  owner: number;
}
export interface Pickup extends Point {
  id: number;
}
export interface Effect extends Point {
  id: number;
  life: number;
  color: string;
}
export const ROLES: Record<
  Role,
  { cost: number; hp: number; speed: number; reload: number; damage: number }
> = {
  scout: { cost: 2, hp: 65, speed: 2.9, reload: 0.8, damage: 18 },
  medium: { cost: 3, hp: 100, speed: 2.2, reload: 1, damage: 28 },
  heavy: { cost: 4, hp: 150, speed: 1.6, reload: 1.35, damage: 42 },
};
/** Cells per second. Damaged tanks lose up to 45% of their top speed. */
export const speedOf = (u: Unit) =>
  ROLES[u.role].speed * (0.55 + 0.45 * Math.max(0, u.hp / u.maxHp));
export const MISSIONS = [
  {
    id: "bocage",
    name: "Hedgerow breach",
    region: "NORMANDY / 1944 INSPIRED",
    terrain: "hedge",
    objective: "capture",
    brief:
      "Cut through the hedges. Hold the opposing headquarters for 12 seconds with no defender nearby.",
    tip: "Hedges and houses stop shells until destroyed. Open a lane, then bring your squad through.",
    source: "https://goordnance.army.mil/history/Rhino.html",
  },
  {
    id: "desert",
    name: "Desert spearhead",
    region: "EL ALAMEIN / 1942 INSPIRED",
    terrain: "sand",
    objective: "eliminate",
    brief:
      "Break the opposing platoon. Keep your command tank alive and eliminate all four defenders.",
    tip: "Rock ridges are permanent. Fences block tanks but shells pass through. Use the wide lanes.",
    source: "https://www.nam.ac.uk/explore/battle-alamein",
  },
  {
    id: "winter",
    name: "Winter crossroads",
    region: "ARDENNES / 1944 INSPIRED",
    terrain: "snow",
    objective: "hold",
    brief:
      "Control the central crossroads for 45 uncontested seconds. The first side to secure it wins.",
    tip: "Your headquarters repairs nearby tanks. Retreat to recover, then approach from another lane.",
    source:
      "https://history.army.mil/Publications/Publications-Catalog/The-Ardennes-Battle-Of-The-Bulge/",
  },
  {
    id: "river",
    name: "Twin bridges",
    region: "RIVER CROSSING / TRAINING DRILL",
    terrain: "river",
    objective: "capture",
    brief:
      "Cross either bridge and capture the opposing headquarters. Protect your own approach.",
    tip: "Water blocks movement and shells. Use the two bridges; send a wingman to cover the second.",
    source: "",
  },
] as const;
export interface Board {
  cols: number;
  rows: number;
  tiles: Tile[];
  health: number[];
  bases: number[];
  center: number;
  seed: number;
  revision: number;
}
export type Command =
  | { type: "order"; order: Order; ids: number[] }
  | { type: "move"; id: number; cell: number }
  | { type: "focus"; ids: number[]; target: number | null };
export const SQUAD_SIZES = [4, 8, 12] as const;
export const REPAIR = { kit: 45, kill: 15, hq: 8, hqRadius: 2.2, every: 7 };
export interface Battle {
  board: Board;
  mission: number;
  side: number;
  /** Tanks per side. Ids are side * per + index; index 0 is the command tank. */
  per: number;
  units: Unit[];
  pickups: Pickup[];
  pickupAt: number;
  rand: number;
  shots: Shot[];
  effects: Effect[];
  time: number;
  capture: number[];
  winner: number | null;
  nextId: number;
  events: string[];
}
export const commander = (s: Battle, side = s.side) => s.units[side * s.per]!;
export const point = (b: Board, id: number): Point => ({
  x: (id % b.cols) + 0.5,
  y: Math.floor(id / b.cols) + 0.5,
});
export const cell = (b: Board, p: Point) =>
  Math.max(0, Math.min(b.rows - 1, Math.floor(p.y))) * b.cols +
  Math.max(0, Math.min(b.cols - 1, Math.floor(p.x)));
export const solid = (t: Tile) => !["ground", "road", "rubble"].includes(t);
export const shellSolid = (t: Tile) => solid(t) && t !== "fence";
export const hitPoints = (t: Tile) =>
  ({
    ground: 0,
    road: 0,
    water: 0,
    rock: 0,
    hedge: 45,
    house: 90,
    car: 28,
    fence: 0,
    rubble: 0,
  })[t];
export function rng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
export function neighbors(b: Board, id: number) {
  const x = id % b.cols,
    y = Math.floor(id / b.cols);
  return [
    x > 0 ? id - 1 : -1,
    x < b.cols - 1 ? id + 1 : -1,
    y > 0 ? id - b.cols : -1,
    y < b.rows - 1 ? id + b.cols : -1,
  ].filter((i) => i >= 0 && !solid(b.tiles[i]!));
}
/** Breadth-first routes are short on a capped grid, and replan only on orders/terrain changes. */
export function route(
  b: Board,
  start: number,
  end: number,
  occupied: Set<number> = new Set(),
) {
  if (start === end) return [];
  if (solid(b.tiles[end]!)) return [];
  const prev = new Int16Array(b.tiles.length).fill(-1),
    queue = [start];
  prev[start] = start;
  for (let n = 0; n < queue.length; n++) {
    const id = queue[n]!;
    for (const next of neighbors(b, id)) {
      if (prev[next] !== -1 || (next !== end && occupied.has(next)))
        continue;
      prev[next] = id;
      queue.push(next);
      if (next === end) {
        const path = [end];
        while (prev[path[0]!] !== start) path.unshift(prev[path[0]!]!);
        return path;
      }
    }
  }
  return [];
}
export function generate(
  cols: number,
  rows: number,
  mission: number,
  seed: number,
): Board {
  cols = Math.max(18, Math.min(48, Math.floor(cols)));
  rows = Math.max(14, Math.min(30, Math.floor(rows)));
  const random = rng(seed),
    tiles: Tile[] = Array(cols * rows).fill("ground");
  const b: Board = {
    cols,
    rows,
    tiles,
    health: [],
    bases: [
      Math.floor(rows / 2) * cols + 2,
      Math.floor(rows / 2) * cols + cols - 3,
    ],
    center: Math.floor(rows / 2) * cols + Math.floor(cols / 2),
    seed,
    revision: 0,
  };
  for (let y = 1; y < rows - 1; y++)
    for (let x = 4; x < cols - 4; x++) {
      const r = random();
      let t: Tile = "ground";
      if (mission === 0) {
        if ((x % 6 === 0 || y % 6 === 0) && r < 0.78) t = "hedge";
        else if (r < 0.07) t = "house";
      }
      if (mission === 1) {
        if (r < 0.11) t = "rock";
        else if (r < 0.15) t = "fence";
      }
      if (mission === 2) {
        if (r < 0.12) t = "house";
        else if (r < 0.19) t = "rock";
      }
      if (mission === 3) {
        if (Math.abs(x - Math.floor(cols / 2)) <= 1) t = "water";
        else if (r < 0.08) t = "house";
      }
      tiles[y * cols + x] = t;
    }
  // Guaranteed alternate routes, deployment zones and a reachable objective.
  const lanes = [Math.floor(rows * 0.3), Math.floor(rows * 0.7)];
  for (const y of lanes)
    for (let x = 1; x < cols - 1; x++) tiles[y * cols + x] = "road";
  for (let y = 1; y < rows - 1; y++)
    for (const x of [2, 3, cols - 4, cols - 3]) tiles[y * cols + x] = "road";
  if (mission !== 3) {
    for (let x = 1; x < cols - 1; x++)
      tiles[Math.floor(rows / 2) * cols + x] = "road";
  } else b.center = lanes[0]! * cols + Math.floor(cols / 2);
  for (let x = 4; x < cols - 4; x += 5) {
    const y = lanes[0]! - 1;
    if (tiles[y * cols + x] === "ground") tiles[y * cols + x] = "car";
  }
  for (const base of b.bases) {
    const p = point(b, base);
    for (let y = Math.floor(p.y) - 3; y <= Math.floor(p.y) + 3; y++)
      for (let x = Math.floor(p.x) - 3; x <= Math.floor(p.x) + 3; x++)
        if (x > 0 && x < cols - 1 && y > 0 && y < rows - 1)
          tiles[y * cols + x] = "ground";
  }
  b.health = tiles.map(hitPoints);
  return b;
}
export function loadoutCost(roles: Role[]) {
  return roles.reduce((n, r) => n + ROLES[r].cost, 0);
}
export function createBattle(
  board: Board,
  mission: number,
  side: number,
  roles: Role[],
  formation = "wedge",
  per = 4,
): Battle {
  if (roles.length !== 4 || loadoutCost(roles) > 12)
    throw Error("Choose four tanks within 12 points.");
  per = SQUAD_SIZES.includes(per as 4) ? per : 4;
  const units: Unit[] = [],
    taken = new Set<number>();
  for (const team of [0, 1])
    for (let i = 0; i < per; i++) {
      // Larger squads repeat the wingman pattern; the command tank keeps slot 0.
      const role =
        team === side
          ? roles[i < 4 ? i : 1 + ((i - 1) % 3)]!
          : (["medium", "scout", "medium", "heavy"][i % 4] as Role);
      const base = point(board, board.bases[team]!),
        dir = team === 0 ? 1 : -1,
        slot = i % 4,
        rank = Math.floor(i / 4);
      const want = {
        x:
          formation === "column"
            ? base.x + dir * (i * 0.8)
            : base.x + dir * ((slot % 2) * 0.8 + rank * 1.1),
        y: Math.max(
          1.5,
          Math.min(
            board.rows - 1.5,
            base.y +
              (formation === "line"
                ? slot * 1.3 - 2
                : formation === "column"
                  ? 0
                  : (slot - 1.5) * 1.4),
          ),
        ),
      };
      const p = place(board, want, taken);
      units.push({
        id: team * per + i,
        side: team,
        role,
        ...p,
        hp: ROLES[role].hp,
        maxHp: ROLES[role].hp,
        angle: team ? Math.PI : 0,
        turret: team ? Math.PI : 0,
        tread: 0,
        recoil: 0,
        cooldown: 0.4 + (i % 4) * 0.15 + rank * 0.1,
        order: "advance",
        waypoint: null,
        path: [],
        plan: 0,
        focus: null,
        target: null,
        scan: (i % 5) * 0.04,
      });
    }
  return {
    board,
    mission,
    side,
    per,
    units,
    shots: [],
    effects: [],
    pickups: [],
    pickupAt: REPAIR.every * 0.6,
    rand: board.seed ^ 0x9e3779b9,
    time: 0,
    capture: [0, 0],
    winner: null,
    nextId: 1000,
    events: [],
  };
}
/** Use the formation point when it is open; otherwise the nearest free open cell. */
function place(b: Board, want: Point, taken: Set<number>) {
  const start = cell(b, want);
  if (canMove(b, want) && !taken.has(start)) {
    taken.add(start);
    return want;
  }
  const seen = new Set([start]),
    queue = [start];
  for (let n = 0; n < queue.length; n++) {
    const id = queue[n]!;
    if (!solid(b.tiles[id]!) && !taken.has(id) && canMove(b, point(b, id))) {
      taken.add(id);
      return point(b, id);
    }
    const x = id % b.cols;
    for (const next of [id - 1, id + 1, id - b.cols, id + b.cols])
      if (
        next >= 0 &&
        next < b.tiles.length &&
        !seen.has(next) &&
        Math.abs((next % b.cols) - x) <= 1
      ) {
        seen.add(next);
        queue.push(next);
      }
  }
  return want;
}
export function command(s: Battle, c: Command) {
  if (s.winner !== null) return false;
  const lead = s.side * s.per;
  if (c.type === "focus") {
    const t = s.units.find((u) => u.id === c.target && u.side !== s.side && u.hp > 0);
    for (const u of s.units)
      if (c.ids.includes(u.id) && u.side === s.side && u.id !== lead && u.hp > 0) {
        u.order = "attack";
        u.focus = t ? t.id : null;
        u.waypoint = null;
        u.path = [];
        u.plan = 0;
      }
    s.events.push(t ? "Squad attacking your target." : "Squad hunting the nearest enemy.");
    return true;
  }
  if (c.type === "order") {
    for (const u of s.units)
      if (c.ids.includes(u.id) && u.side === s.side && u.id !== lead) {
        u.order = c.order;
        u.focus = null;
        u.waypoint = null;
        u.path = [];
        u.plan = 0;
      }
    s.events.push(
      c.order === "follow"
        ? "Squad falling in."
        : c.order === "retreat"
          ? "Squad returning to headquarters for repairs."
          : c.order === "attack"
            ? "Squad hunting the nearest enemy."
            : "Squad advancing.",
    );
    return true;
  }
  const u = s.units.find((u) => u.id === c.id && u.side === s.side && u.hp > 0);
  if (
    !u ||
    u.id === lead ||
    c.cell < 0 ||
    c.cell >= s.board.tiles.length ||
    solid(s.board.tiles[c.cell]!)
  )
    return false;
  const path = route(s.board, cell(s.board, u), c.cell);
  if (!path.length && cell(s.board, u) !== c.cell) return false;
  u.waypoint = path.length ? c.cell : null;
  u.path = path;
  u.plan = 0.7;
  s.events.push("Waypoint assigned. Previous orders resume on arrival.");
  return true;
}
export function clearShot(b: Board, a: Point, z: Point) {
  const d = Math.hypot(z.x - a.x, z.y - a.y);
  for (let n = 0.35; n < d - 0.3; n += 0.2)
    if (
      shellSolid(
        b.tiles[
          cell(b, {
            x: a.x + ((z.x - a.x) * n) / d,
            y: a.y + ((z.y - a.y) * n) / d,
          })
        ]!,
      )
    )
      return false;
  return true;
}
export function canMove(b: Board, p: Point) {
  return (
    p.x >= 0.32 &&
    p.y >= 0.32 &&
    p.x < b.cols - 0.32 &&
    p.y < b.rows - 0.32 &&
    [-0.27, 0.27].every((dx) =>
      [-0.27, 0.27].every(
        (dy) => !solid(b.tiles[cell(b, { x: p.x + dx, y: p.y + dy })]!),
      ),
    )
  );
}
export function moveUnit(s: Battle, u: Unit, dx: number, dy: number) {
  const p = { x: u.x + dx, y: u.y + dy };
  if (
    canMove(s.board, p) &&
    !s.units.some(
      (v) => v !== u && v.hp > 0 && Math.hypot(v.x - p.x, v.y - p.y) < 0.55,
    )
  ) {
    u.x = p.x;
    u.y = p.y;
    u.angle = Math.atan2(dy, dx);
    u.tread += Math.hypot(dx, dy) * 5;
    return true;
  }
  return false;
}
function effect(s: Battle, p: Point, color = "#f0bd68") {
  if (s.effects.length < 96)
    s.effects.push({ ...p, id: s.nextId++, life: 0.55, color });
}
export function fire(s: Battle, u: Unit, angle: number) {
  if (u.cooldown > 0 || s.shots.length >= 200) return;
  u.cooldown = ROLES[u.role].reload;
  u.recoil = 3;
  u.turret = angle;
  s.shots.push({
    id: s.nextId++,
    x: u.x + Math.cos(angle) * 0.35,
    y: u.y + Math.sin(angle) * 0.35,
    vx: Math.cos(angle) * 15,
    vy: Math.sin(angle) * 15,
    life: 2,
    side: u.side,
    damage: ROLES[u.role].damage,
    owner: u.id,
  });
}
/** Nearest living enemy within 10 cells with a clear line of fire. */
export function nearestVisible(s: Battle, u: Unit) {
  const near: [number, Unit][] = [];
  for (const v of s.units) {
    if (v.side === u.side || v.hp <= 0) continue;
    const d = (v.x - u.x) ** 2 + (v.y - u.y) ** 2;
    if (d < 100) near.push([d, v]);
  }
  near.sort((a, z) => a[0] - z[0]);
  for (const [, v] of near) if (clearShot(s.board, u, v)) return v;
  return undefined;
}
function nearestEnemy(s: Battle, u: Unit) {
  let best: Unit | undefined,
    d = Infinity;
  for (const v of s.units) {
    if (v.side === u.side || v.hp <= 0) continue;
    const e = (v.x - u.x) ** 2 + (v.y - u.y) ** 2;
    if (e < d) (d = e), (best = v);
  }
  return best;
}
function nearestKit(s: Battle, u: Unit, range: number) {
  let best: Pickup | undefined,
    d = range * range;
  for (const k of s.pickups) {
    const e = (k.x - u.x) ** 2 + (k.y - u.y) ** 2;
    if (e < d) (d = e), (best = k);
  }
  return best;
}
/** Deterministic per-battle random stream (replays and tests stay reproducible). */
function roll(s: Battle) {
  s.rand = (Math.imul(s.rand, 1664525) + 1013904223) >>> 0;
  return s.rand / 4294967296;
}
function spawnPickup(s: Battle) {
  const b = s.board;
  if (s.pickups.length >= 3 + s.per / 4) return;
  for (let tries = 0; tries < 30; tries++) {
    const id = Math.floor(roll(s) * b.tiles.length),
      p = point(b, id);
    if (
      b.tiles[id] !== "ground" ||
      b.bases.some((h) => Math.hypot(point(b, h).x - p.x, point(b, h).y - p.y) < 4) ||
      s.pickups.some((k) => Math.hypot(k.x - p.x, k.y - p.y) < 3)
    )
      continue;
    s.pickups.push({ id: s.nextId++, ...p });
    return;
  }
}
export interface Input {
  x: number;
  y: number;
  fire: boolean;
  aim: Point | null;
}
export function step(s: Battle, dt: number, input: Input) {
  if (s.winner !== null) return;
  dt = Math.min(0.04, Math.max(0, dt));
  s.time += dt;
  const b = s.board,
    player = commander(s);
  // Repair kits keep long battles going; a bounded number sit on open ground.
  s.pickupAt -= dt;
  if (s.pickupAt <= 0) {
    s.pickupAt = REPAIR.every;
    spawnPickup(s);
  }
  const occupied = new Set<number>();
  for (const v of s.units) if (v.hp > 0) occupied.add(cell(b, v));
  for (const u of s.units) {
    if (u.hp <= 0) continue;
    u.cooldown -= dt;
    u.recoil = Math.max(0, u.recoil - dt * 16);
    u.plan -= dt;
    u.scan -= dt;
    const home = point(b, b.bases[u.side]!);
    if (Math.hypot(u.x - home.x, u.y - home.y) < REPAIR.hqRadius)
      u.hp = Math.min(u.maxHp, u.hp + dt * REPAIR.hq);
    for (let k = s.pickups.length - 1; k >= 0; k--) {
      const kit = s.pickups[k]!;
      if (Math.hypot(kit.x - u.x, kit.y - u.y) < 0.65 && u.hp < u.maxHp) {
        u.hp = Math.min(u.maxHp, u.hp + REPAIR.kit);
        s.pickups.splice(k, 1);
        effect(s, kit, "#39ffb0");
        if (u.side === s.side) s.events.push("Repair kit collected.");
      }
    }
    // Line-of-sight scans are the costliest check; refresh at 5Hz, not every tick.
    let target = s.units.find((v) => v.id === u.target && v.hp > 0);
    if (u.scan <= 0 || !target) {
      u.scan = 0.2;
      target = nearestVisible(s, u);
      u.target = target ? target.id : null;
    }
    if (u === player) {
      const length = Math.hypot(input.x, input.y);
      if (length)
        moveUnit(
          s,
          u,
          (input.x / length) * speedOf(u) * dt,
          (input.y / length) * speedOf(u) * dt,
        );
      const aim = input.aim ?? target;
      if (aim) u.turret = Math.atan2(aim.y - u.y, aim.x - u.x);
      if (input.fire) fire(s, u, u.turret);
    } else {
      let focus = u.focus === null ? undefined : s.units.find((v) => v.id === u.focus && v.hp > 0);
      if (u.focus !== null && !focus) u.focus = null;
      // Attack with no assigned target hunts the nearest living enemy anywhere.
      if (u.order === "attack" && !focus) focus = nearestEnemy(s, u);
      const kit = u.hp < u.maxHp * 0.35 && u.waypoint === null ? nearestKit(s, u, 9) : undefined;
      let goal =
        u.waypoint ??
        (kit
          ? cell(b, kit)
          : u.order === "retreat"
            ? b.bases[u.side]!
            : u.order === "attack" && focus
              ? cell(b, focus)
              : u.order === "follow" && player.hp > 0 && u.side === s.side
                ? cell(b, player)
                : MISSIONS[s.mission]!.objective === "hold"
                  ? b.center
                  : b.bases[1 - u.side]!);
      const objectivePoint = point(b, goal);
      const focusVisible =
        focus && Math.hypot(focus.x - u.x, focus.y - u.y) < 10 && clearShot(b, u, focus);
      const stop =
        !kit &&
        ((u.waypoint === null &&
          Math.hypot(u.x - objectivePoint.x, u.y - objectivePoint.y) < 1.2) ||
          (u.order === "follow" &&
            u.waypoint === null &&
            Math.hypot(u.x - player.x, u.y - player.y) < 2) ||
          (u.order === "attack" &&
            u.waypoint === null &&
            focus &&
            focusVisible &&
            Math.hypot(u.x - focus.x, u.y - focus.y) < 4.5) ||
          (target &&
            u.waypoint === null &&
            u.order === "advance" &&
            Math.hypot(u.x - target.x, u.y - target.y) < 5));
      if (!stop) {
        if (u.plan <= 0) {
          const own = cell(b, u);
          occupied.delete(own);
          u.path = route(b, own, goal, occupied);
          occupied.add(own);
          u.plan = 0.65 + (u.id % 12) * 0.025;
        }
        const next = u.path[0];
        // A replan from inside the waypoint cell yields no path: that is arrival.
        if (next === undefined && u.waypoint !== null && cell(b, u) === u.waypoint) {
          u.waypoint = null;
          u.plan = 0;
        } else if (next !== undefined) {
          const p = point(b, next),
            d = Math.hypot(p.x - u.x, p.y - u.y);
          const travel = Math.min(d, speedOf(u) * dt * 0.8);
          if (d < 0.08) {
            u.path.shift();
            if (!u.path.length && u.waypoint !== null) {
              u.waypoint = null;
              u.plan = 0;
            }
          } else if (
            !moveUnit(
              s,
              u,
              ((p.x - u.x) / d) * travel,
              ((p.y - u.y) / d) * travel,
            )
          )
            u.plan = Math.min(u.plan, 0.25);
        }
      }
      const shoot = focusVisible ? focus : target;
      if (shoot) {
        u.turret = Math.atan2(shoot.y - u.y, shoot.x - u.x);
        fire(s, u, u.turret);
      }
    }
  }
  for (let i = s.shots.length - 1; i >= 0; i--) {
    const p = s.shots[i]!;
    p.life -= dt;
    let hit = false;
    const steps = Math.ceil((15 * dt) / 0.15);
    for (let n = 0; n < steps && !hit; n++) {
      p.x += (p.vx * dt) / steps;
      p.y += (p.vy * dt) / steps;
      if (p.x < 0 || p.y < 0 || p.x >= b.cols || p.y >= b.rows) {
        hit = true;
        break;
      }
      const id = cell(b, p),
        tile = b.tiles[id]!;
      if (shellSolid(tile)) {
        hit = true;
        if (b.health[id]! > 0) {
          b.health[id] = b.health[id]! - p.damage;
          if (b.health[id]! <= 0) {
            b.tiles[id] = "rubble";
            b.revision++;
            effect(s, point(b, id), tile === "car" ? "#ee6875" : "#cfb68c");
            s.events.push(
              tile === "car" ? "Vehicle destroyed." : "Cover breached.",
            );
            for (const u of s.units) u.plan = 0;
            if (tile === "house" && s.pickups.length < 6 && roll(s) < 0.3)
              s.pickups.push({ id: s.nextId++, ...point(b, id) });
          }
        } else effect(s, p, "#8895ae");
      }
      if (!hit)
        for (const u of s.units)
          if (
            u.side !== p.side &&
            u.hp > 0 &&
            Math.hypot(u.x - p.x, u.y - p.y) < 0.4
          ) {
            u.hp = Math.max(0, u.hp - p.damage);
            effect(s, p, u.hp ? "#fff3bc" : "#ee6875");
            if (!u.hp) {
              const killer = s.units.find((v) => v.id === p.owner && v.hp > 0);
              if (killer) killer.hp = Math.min(killer.maxHp, killer.hp + REPAIR.kill);
              if (u.side !== s.side) s.events.push("Enemy tank destroyed.");
              // Wrecks sometimes leave salvage behind.
              if (s.pickups.length < 6 && roll(s) < 0.35) s.pickups.push({ id: s.nextId++, x: u.x, y: u.y });
            }
            hit = true;
            break;
          }
    }
    if (hit || p.life <= 0) s.shots.splice(i, 1);
  }
  for (let i = s.effects.length - 1; i >= 0; i--) {
    s.effects[i]!.life -= dt;
    if (s.effects[i]!.life <= 0) s.effects.splice(i, 1);
  }
  if (player.hp <= 0) s.winner = 1 - s.side;
  for (const side of [0, 1]) {
    const living = s.units.filter((u) => u.side === side && u.hp > 0);
    if (!living.length) s.winner = 1 - side;
    const mode = MISSIONS[s.mission]!.objective;
    if (mode !== "eliminate") {
      const objective = point(
        b,
        mode === "hold" ? b.center : b.bases[1 - side]!,
      );
      const occupying = living.some(
          (u) => Math.hypot(u.x - objective.x, u.y - objective.y) < 1.8,
        ),
        contested = s.units.some(
          (u) =>
            u.side !== side &&
            u.hp > 0 &&
            Math.hypot(u.x - objective.x, u.y - objective.y) < 2.4,
        );
      if (occupying && !contested) s.capture[side] = s.capture[side]! + dt;
      else if (mode === "capture")
        s.capture[side] = Math.max(0, s.capture[side]! - dt * 0.3);
      if (s.capture[side]! >= (mode === "hold" ? 45 : 12)) s.winner = side;
    }
  }
  if (s.events.length > 8) s.events.splice(0, s.events.length - 8);
}
