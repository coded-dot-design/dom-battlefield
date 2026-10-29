/** Battlefield owns maps and rules. Positions are grid units; commands contain no DOM.
 *  The simulation runs on the Fizlet kernel: `step` is the game's fixed step (no allocation once
 *  warm: pooled shots and effects, typed path buffers, scratch arrays), its random numbers come
 *  from the engine's seeded `random` (same seed, same battle), and repair kits live in
 *  `fizlet/rules` drops. */
import { createEngine, type Engine } from "../vendor/fizlet/kernel/engine";
import { seeded, type Random } from "../vendor/fizlet/kernel/random";
import { drops } from "../vendor/fizlet/rules";
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
export type Order = "advance" | "follow" | "retreat" | "attack" | "hold";
export type Point = { x: number; y: number };
export interface Unit extends Point {
  id: number;
  side: number;
  role: Role;
  hp: number;
  maxHp: number;
  /** Seconds a driving tank has been blocked; past a moment it may pass through its own squad. */
  jam: number;
  angle: number;
  turret: number;
  tread: number;
  recoil: number;
  cooldown: number;
  order: Order;
  /** The stop the tank is driving to now (route[0]), or null. */
  waypoint: number | null;
  /** The squares to drive through to the current stop: path[pathAt] up to path[pathEnd - 1]
   *  (a buffer the size of the board, refilled in place on every replan). */
  path: Int16Array;
  pathAt: number;
  pathEnd: number;
  /** Planned stops, in order; the last one is the destination. Each leg is pathed on the way. */
  route: number[];
  /** The square a "hold" order keeps; it is the route's destination once arrived. */
  hold: number | null;
  plan: number;
  /** Enemy this tank was ordered to attack (attack order), if still alive. */
  focus: number | null;
  /** Cached nearest visible enemy; rescanned every `scan` seconds. */
  target: number | null;
  scan: number;
  /** The plan a squad order set aside (order, remaining route, held square). While it is set the
   *  squad order is "locked"; releasing it, or an attack running out of enemies, restores it. */
  resume: Resume | null;
}
export interface Resume {
  order: Order;
  route: number[];
  hold: number | null;
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
    region: "RIVER CITY / TRAINING DRILL",
    terrain: "river",
    objective: "capture",
    brief:
      "A canal splits the city. Cross either bridge, work through the streets and capture the opposing headquarters.",
    tip: "Towers block shells until they fall; streets are lanes. Send a wingman over the second bridge.",
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
  /** A squad order overrides the plan (kept to resume); `plan: true` makes it the plan itself. */
  | { type: "order"; order: Order; ids: number[]; plan?: boolean }
  | { type: "release"; ids: number[] }
  | { type: "move"; id: number; cell: number }
  | { type: "route"; id: number; cells: number[] }
  | { type: "focus"; ids: number[]; target: number | null; plan?: boolean }
  | { type: "clear"; id: number };
export const SQUAD_SIZES = [4, 8, 12] as const;
export const REPAIR = { kit: 45, kill: 15, hq: 8, hqRadius: 2.2, every: 7 };
/** Repair kits: fizlet/rules drops that land where they spawn and last until collected. */
export type Kits = ReturnType<typeof drops<"kit">>;
export const SHOTS = 200, EFFECTS = 96, KITS = 6;
export interface Battle {
  board: Board;
  mission: number;
  side: number;
  /** Tanks per side. Ids are side * per + index; index 0 is the command tank (units[id]). */
  per: number;
  units: Unit[];
  kits: Kits;
  /** Seconds to the next timed repair kit. */
  pickupAt: number;
  /** The engine's seeded random: every roll in the battle comes from it. */
  random: Random;
  /** Pools: the live shells are shots[0 .. shotCount - 1], the live bursts effects[0 .. effectCount - 1]. */
  shots: Shot[];
  shotCount: number;
  effects: Effect[];
  effectCount: number;
  /** Squares with a living tank on them, rebuilt each step (pathfinding steers round them). */
  occ: Uint8Array;
  time: number;
  capture: number[];
  winner: number | null;
  nextId: number;
  events: string[];
}
export const commander = (s: Battle, side = s.side) => s.units[side * s.per]!;
/** The unit with this id if it is alive (ids are indexes into units). */
const live = (s: Battle, id: number | null) => {
  const v = id === null ? undefined : s.units[id];
  return v && v.hp > 0 ? v : undefined;
};
/** Math.hypot allocates in V8 even in optimized code (Fizlet lesson K5); this does not. */
const dist = (x: number, y: number) => Math.sqrt(x * x + y * y);
export const point = (b: Board, id: number): Point => ({
  x: (id % b.cols) + 0.5,
  y: Math.floor(id / b.cols) + 0.5,
});
const cellXY = (b: Board, x: number, y: number) =>
  Math.max(0, Math.min(b.rows - 1, Math.floor(y))) * b.cols +
  Math.max(0, Math.min(b.cols - 1, Math.floor(x)));
export const cell = (b: Board, p: Point) => cellXY(b, p.x, p.y);
export const solid = (t: Tile) => t !== "ground" && t !== "road" && t !== "rubble";
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
/** A stable per-cell look (0-4). 3 and 4 are the dashed shapes, drawn by the view. */
export const variant = (id: number) => ((id * 2654435761) >>> 0) % 5;
/** Dashed or dotted cover is flimsier than solid cover: it falls to fewer shells. Winter's dashed
 *  peaks and rings can even be shot away (solid rock stays permanent). */
export function toughness(t: Tile, id: number, mission: number) {
  const dashed = variant(id) >= 3;
  if (t === "house" && dashed && (mission === 2 || mission === 3)) return 40;
  if (t === "rock" && dashed && mission === 2) return 35;
  if (t === "hedge" && mission === 1) return 20; // dotted desert scrub
  return hitPoints(t);
}
/** The map generator's random stream: Fizlet's seeded LCG (the DOM VIRUS core sequence). */
export const rng = (seed: number) => seeded(seed);
// Pathfinding scratch, shared and grown only for a bigger board: a step never allocates.
let prev = new Int16Array(48 * 30),
  queue = new Int16Array(48 * 30),
  scratch = new Int16Array(48 * 30);
const grow = (size: number) => {
  if (prev.length < size) (prev = new Int16Array(size)), (queue = new Int16Array(size)), (scratch = new Int16Array(size));
};
/** Breadth-first search from start to end (neighbours left, right, up, down; occupied squares are
 *  skipped unless they are the end). Writes the squares after start, up to end, into out and
 *  returns how many; 0 if there is no way. */
function trace(b: Board, start: number, end: number, occ: Uint8Array | null, out: Int16Array) {
  const size = b.tiles.length,
    cols = b.cols;
  if (start === end || solid(b.tiles[end]!)) return 0;
  grow(size);
  prev.fill(-1, 0, size);
  prev[start] = start;
  queue[0] = start;
  for (let n = 0, len = 1; n < len; n++) {
    const id = queue[n]!,
      x = id % cols;
    for (let k = 0; k < 4; k++) {
      const next = k === 0 ? (x > 0 ? id - 1 : -1) : k === 1 ? (x < cols - 1 ? id + 1 : -1) : k === 2 ? id - cols : id + cols;
      if (next < 0 || next >= size || solid(b.tiles[next]!)) continue;
      if (prev[next] !== -1 || (next !== end && occ !== null && occ[next])) continue;
      prev[next] = id;
      queue[len++] = next;
      if (next === end) {
        let steps = 1;
        for (let c = end; prev[c] !== start; c = prev[c]!) steps++;
        for (let c = end, i = steps - 1; i >= 0; c = prev[c]!, i--) out[i] = c;
        return steps;
      }
    }
  }
  return 0;
}
/** Breadth-first routes are short on a capped grid, and replan only on orders/terrain changes. */
export function route(b: Board, start: number, end: number) {
  grow(b.tiles.length);
  return Array.from(scratch.subarray(0, trace(b, start, end, null, scratch)));
}
/** A unit's remaining path, as a list (for drawing). */
export const pathOf = (u: Unit) => Array.from(u.path.subarray(u.pathAt, u.pathEnd));
/** Path a unit from its square to goal now (commands; the step replans through drive). */
function repath(b: Board, u: Unit, goal: number) {
  u.pathAt = 0;
  u.pathEnd = trace(b, cell(b, u), goal, null, u.path);
}
export function generate(
  cols: number,
  rows: number,
  mission: number,
  seed: number,
  /** Obstacle density: 0.6 light, 1 normal, 1.45 heavy. Roads and deployment zones are kept clear. */
  density = 1,
  /** Columns between each HQ and its edge of the field (phones keep the HQs clear of the notch). */
  inset = 2,
): Board {
  const d = Math.max(0.4, Math.min(1.6, density));
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
      Math.floor(rows / 2) * cols + inset,
      Math.floor(rows / 2) * cols + cols - 1 - inset,
    ],
    center: Math.floor(rows / 2) * cols + Math.floor(cols / 2),
    seed,
    revision: 0,
  };
  for (let y = 1; y < rows - 1; y++)
    for (let x = inset + 2; x < cols - inset - 2; x++) {
      const r = random();
      let t: Tile = "ground";
      if (mission === 0) {
        if ((x % 6 === 0 || y % 6 === 0) && r < Math.min(0.95, 0.78 * d)) t = "hedge";
        else if (r < 0.07 * d) t = "house";
        else if (r < 0.12 * d) t = "hedge"; // lone bushes in the fields
      }
      if (mission === 1) {
        if (r < 0.11 * d) t = "rock";
        else if (r < 0.15 * d) t = "fence";
        else if (r < 0.19 * d) t = "hedge"; // desert scrub: soft cover
      }
      if (mission === 2) {
        if (r < 0.12 * d) t = "house";
        else if (r < 0.19 * d) t = "rock";
      }
      if (mission === 3) {
        // River city: a canal down the middle and city blocks between a grid of streets.
        if (Math.abs(x - Math.floor(cols / 2)) <= 1) t = "water";
        else if (x % 4 !== 1 && y % 4 !== 1 && r < 0.3 * d) t = "house";
        else if (r < 0.025 * d) t = "car";
        else if (r < 0.06 * d) t = "hedge"; // street trees
      }
      tiles[y * cols + x] = t;
    }
  // Guaranteed routes, deployment zones and a reachable objective. Each terrain lays its
  // roads differently and the seed shifts them, so no two fields share the same lanes.
  const mid = Math.floor(rows / 2),
    cx = Math.floor(cols / 2),
    pave = (x: number, y: number) => {
      if (x > 0 && x < cols - 1 && y > 0 && y < rows - 1) tiles[y * cols + x] = "road";
    },
    /** A full-width lane that drifts up or down by a row now and then, always 4-connected. */
    lane = (start: number, lo: number, hi: number, drift: number) => {
      let y = start;
      const path: number[] = [];
      for (let x = 1; x < cols - 1; x++) {
        pave(x, y);
        path.push(y * cols + x);
        if (x > 4 && x < cols - 5 && random() < drift) {
          const ny = Math.max(lo, Math.min(hi, y + (random() < 0.5 ? -1 : 1)));
          pave(x, ny);
          y = ny;
        }
      }
      return path;
    };
  for (let y = 1; y < rows - 1; y++)
    for (const x of [inset, inset + 1, cols - 2 - inset, cols - 1 - inset]) tiles[y * cols + x] = "road";
  let carLane: number[];
  if (mission === 0) {
    // Hedgerow: two winding country lanes and a farm track between them.
    carLane = lane(Math.floor(rows * 0.25), 2, mid - 2, 0.22);
    lane(Math.floor(rows * 0.75), mid + 2, rows - 3, 0.22);
    const fx = cx + Math.floor(random() * 7) - 3;
    for (let y = 1; y < rows - 1; y++) pave(fx, y);
    b.center = mid * cols + fx;
  } else if (mission === 1) {
    // Desert: a two-lane highway on a random row and a diagonal track across the dunes.
    const hy = 3 + Math.floor(random() * (rows - 7));
    carLane = lane(hy, hy, hy, 0);
    lane(hy + 1, hy + 1, hy + 1, 0);
    const down = random() < 0.5,
      slope = (rows - 4) / (cols - 10);
    let py = down ? 2 : rows - 3;
    for (let x = 5; x < cols - 5; x++) {
      const ty = Math.round(down ? 2 + (x - 5) * slope : rows - 3 - (x - 5) * slope);
      while (py !== ty) (pave(x, py), (py += ty > py ? 1 : -1));
      pave(x, py);
    }
    b.center = hy * cols + cx;
  } else if (mission === 2) {
    // Winter: a true crossroads at the centre, plus one outer lane above or below it.
    carLane = lane(mid, mid, mid, 0);
    for (let y = 1; y < rows - 1; y++) pave(cx, y);
    const outer = random() < 0.5 ? Math.floor(rows * 0.22) : Math.floor(rows * 0.78);
    lane(outer, outer - 1, outer + 1, 0.15);
  } else {
    // River city: two straight avenues; the canal is crossed only at the bridges.
    carLane = lane(Math.floor(rows * 0.3), 0, rows, 0);
    lane(Math.floor(rows * 0.7), 0, rows, 0);
    b.center = Math.floor(rows * 0.3) * cols + cx;
  }
  for (let i = 3; i < carLane.length - 3; i += 5) {
    const c = carLane[i]! - cols;
    if (tiles[c] === "ground") tiles[c] = "car";
  }
  for (const base of b.bases) {
    const p = point(b, base);
    for (let y = Math.floor(p.y) - 3; y <= Math.floor(p.y) + 3; y++)
      for (let x = Math.floor(p.x) - 3; x <= Math.floor(p.x) + 3; x++)
        if (x > 0 && x < cols - 1 && y > 0 && y < rows - 1)
          tiles[y * cols + x] = "ground";
  }
  b.health = tiles.map((t, i) => toughness(t, i, mission));
  return b;
}
/** Move a side's HQ during planning: behind its boundary line (hqLimit), never water, a cleared 3x3 pad, and both
 *  HQs plus the objective must stay connected. Returns false (and changes nothing) otherwise. */
/** How far behind the middle of the field an HQ must stay (in squares). */
export const HQ_BACK = 7;
/** The HQ boundary line (map x): side 0's HQ centre must be left of it, side 1's right of it.
 *  Small fields keep at least 4 columns of room behind it. */
export function hqLimit(b: Board, side: number) {
  const half = b.cols / 2,
    room = Math.min(HQ_BACK, half - 4);
  return side === 0 ? half - room : half + room;
}
export function moveBase(b: Board, side: number, id: number) {
  const x = id % b.cols,
    y = Math.floor(id / b.cols);
  if (id < 0 || id >= b.tiles.length || x < 1 || y < 1 || x > b.cols - 2 || y > b.rows - 2) return false;
  const limit = hqLimit(b, side);
  if (side === 0 ? x + 0.5 > limit : x + 0.5 < limit) return false;
  const pad: number[] = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) pad.push((y + dy) * b.cols + x + dx);
  if (pad.some((c) => b.tiles[c] === "water")) return false;
  const before = { tiles: pad.map((c) => b.tiles[c]!), health: pad.map((c) => b.health[c]!), base: b.bases[side]! };
  for (const c of pad) (b.tiles[c] = "ground"), (b.health[c] = 0);
  b.bases[side] = id;
  if (!route(b, b.bases[0]!, b.bases[1]!).length || !route(b, id, b.center).length) {
    pad.forEach((c, i) => ((b.tiles[c] = before.tiles[i]!), (b.health[c] = before.health[i]!)));
    b.bases[side] = before.base;
    return false;
  }
  b.revision++;
  return true;
}
/** Put a side's HQ somewhere new in its own zone (seeded, so the same map keeps the same spot):
 *  any row clear of the top and bottom, from its edge (plus inset) up to its boundary line. */
export function scatterHq(b: Board, side: number, seed: number, inset = 2) {
  const random = rng(seed ^ (0x5bd1e995 + side)),
    edge = side === 0 ? inset : b.cols - 1 - inset,
    span = Math.max(1, Math.floor(Math.abs(hqLimit(b, side) - edge)) - 1);
  for (let i = 0; i < 40; i++) {
    const x = edge + (side === 0 ? 1 : -1) * Math.floor(random() * span),
      y = 3 + Math.floor(random() * Math.max(1, b.rows - 6));
    if (moveBase(b, side, y * b.cols + x)) return true;
  }
  return false;
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
  /** The engine the battle runs on (its seeded random and event ring); headless if left out. */
  engine: Engine = createEngine(),
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
      // Wedge: an arrowhead (you at the tip, two flanks, one trailing). Line: abreast, all side
      // by side facing the enemy. Column: single file. Bigger squads repeat the shape behind.
      const want = {
        x:
          formation === "column"
            ? base.x + dir * (i * 0.8)
            : formation === "line"
              ? base.x + dir * (rank * 1.2)
              : base.x + dir * ([1.6, 0.8, 0.8, 0][slot]! + rank * 1.4),
        y: Math.max(
          1.5,
          Math.min(
            board.rows - 1.5,
            base.y +
              (formation === "line"
                ? slot * 1.3 - 1.95
                : formation === "column"
                  ? 0
                  : [0, -1.3, 1.3, 0][slot]! * (1 + rank * 0.35)),
          ),
        ),
      };
      // Clear the ground where the formation wants the tank first, then find a free spot.
      clearAround(board, want);
      const p = place(board, want, taken, units);
      clearAround(board, p);
      // One shape for every tank, its number fields doubles from the start (0.5 placeholders),
      // so the step's property loads stay monomorphic and never box (no map changes mid-battle).
      const u: Unit = {
        id: team * per + i,
        side: team,
        role,
        x: 0.5,
        y: 0.5,
        hp: 0.5,
        maxHp: ROLES[role].hp,
        jam: 0.5,
        angle: 0.5,
        turret: 0.5,
        tread: 0.5,
        recoil: 0.5,
        cooldown: 0.5,
        order: "advance",
        waypoint: null,
        path: new Int16Array(board.tiles.length),
        pathAt: 0,
        pathEnd: 0,
        route: [],
        hold: null,
        plan: 0.5,
        focus: null,
        target: null,
        scan: 0.5,
        resume: null,
      };
      u.x = p.x;
      u.y = p.y;
      u.hp = ROLES[role].hp;
      u.jam = u.tread = u.recoil = u.plan = 0;
      u.angle = u.turret = team ? Math.PI : 0;
      u.cooldown = 0.4 + (i % 4) * 0.15 + rank * 0.1;
      u.scan = (i % 5) * 0.04;
      units.push(u);
    }
  // Same board, same battle: the engine's random restarts from the board's seed.
  engine.random.state = (board.seed ^ 0x9e3779b9) >>> 0;
  // Kits land where they spawn (no fall) and stay until collected; the battle times them itself
  // (first after 4.2s, then every 7s), so the brick's own clock is not needed.
  const kits = drops(engine, { kinds: ["kit"], cap: KITS, fall: 0, life: Infinity });
  engine.remove(kits.system);
  const s: Battle = {
    board,
    mission,
    side,
    per,
    units,
    shots: Array.from({ length: SHOTS }, () => ({ id: 0, x: 0.5, y: 0.5, vx: 0.5, vy: 0.5, side: 0, life: 0.5, damage: 0, owner: 0 })),
    shotCount: 0,
    effects: Array.from({ length: EFFECTS }, () => ({ id: 0, x: 0.5, y: 0.5, life: 0.5, color: "" })),
    effectCount: 0,
    kits,
    pickupAt: REPAIR.every * 0.6,
    random: engine.random,
    occ: new Uint8Array(board.tiles.length),
    time: 0.5,
    capture: [0.5, 0.5],
    winner: null,
    nextId: 1000,
    events: [],
  };
  s.time = s.capture[0] = s.capture[1] = 0; // doubles from the start (see the units above)
  return s;
}
/** Use the formation point when it is open; otherwise the nearest free open cell. */
/** Nearest free spot to `want`: open ground, not a cell another tank took, and at least
 *  SPACING from every tank already placed (so no two start overlapping). */
const SPACING = 0.85;
function place(b: Board, want: Point, taken: Set<number>, placed: Point[]) {
  const clear = (p: Point) => canMove(b, p) && placed.every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= SPACING);
  const start = cell(b, want);
  if (clear(want) && !taken.has(start)) {
    taken.add(start);
    return want;
  }
  const seen = new Set([start]),
    queue = [start];
  for (let n = 0; n < queue.length; n++) {
    const id = queue[n]!;
    if (!solid(b.tiles[id]!) && !taken.has(id) && clear(point(b, id))) {
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
/** Deployment buffer: clear the cover (never water) in a ring around a starting tank, so the
 *  formation, squad size and HQ position decide the ground, not the other way round. */
function clearAround(b: Board, p: Point) {
  const cx = Math.floor(p.x),
    cy = Math.floor(p.y);
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (x < 0 || y < 0 || x >= b.cols || y >= b.rows) continue;
      const id = y * b.cols + x;
      if (solid(b.tiles[id]!) && b.tiles[id] !== "water") (b.tiles[id] = "ground"), (b.health[id] = 0);
    }
}
/** A plain, cloneable copy of the battle (tests, replays): the random stream as its state, the
 *  kits as lists, live shots and effects only. */
export function snapshot(s: Battle) {
  const { random, kits, occ: _, ...rest } = s,
    n = kits.count;
  return structuredClone({
    ...rest,
    shots: s.shots.slice(0, s.shotCount),
    effects: s.effects.slice(0, s.effectCount),
    random: random.state,
    kits: { count: n, x: Array.from(kits.x.subarray(0, n)), y: Array.from(kits.y.subarray(0, n)) },
  });
}
/** A line on the comms log: the last 8 are kept, shifted in place (no allocation). */
function say(s: Battle, line: string) {
  const e = s.events;
  if (e.length < 8) return void e.push(line);
  for (let i = 0; i < 7; i++) e[i] = e[i + 1]!;
  e[7] = line;
}
export function command(s: Battle, c: Command) {
  if (s.winner !== null) return false;
  const lead = s.side * s.per;
  if (c.type === "release") {
    let routes = 0;
    for (const u of s.units)
      if (c.ids.includes(u.id) && u.side === s.side && u.id !== lead && u.resume) {
        routes += u.resume.route.length ? 1 : 0;
        release(u);
      }
    say(s, routes ? "Back on the plan: routes resumed." : "Back on their own: advancing.");
    return true;
  }
  if (c.type === "focus") {
    const t = s.units.find((u) => u.id === c.target && u.side !== s.side && u.hp > 0);
    for (const u of s.units)
      if (c.ids.includes(u.id) && u.side === s.side && u.id !== lead && u.hp > 0) {
        override(u, "attack", c.plan);
        // A hunt still names its prey (the nearest enemy), so the attack ends when it falls.
        u.focus = t ? t.id : c.plan ? null : (nearestEnemy(s, u)?.id ?? null);
      }
    say(s, t ? "Squad attacking your target." : "Squad hunting the nearest enemy.");
    return true;
  }
  if (c.type === "order") {
    for (const u of s.units)
      if (c.ids.includes(u.id) && u.side === s.side && u.id !== lead) override(u, c.order, c.plan);
    say(
      s,
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
  if (c.type === "clear") {
    // Drop the route. Your own tank just stops being driven; a wingman goes back to advancing.
    if (!u) return false;
    u.route = [];
    u.resume = null;
    u.waypoint = u.hold = null;
    u.pathAt = u.pathEnd = 0;
    if (u.id !== lead) (u.order = "advance"), (u.focus = null);
    say(s, u.id === lead ? "Route cleared. Your tank is all yours." : "Route cleared, back to squad orders.");
    return true;
  }
  const cells = c.type === "move" ? [c.cell] : c.cells;
  if (!u || !cells.length || !plot(s.board, cell(s.board, u), cells)) return false;
  // A route: drive through each stop in order, then hold the last square (on the enemy HQ that
  // is a capture). Orders and attack commands replace it.
  u.route = cells.slice();
  u.resume = null;
  u.waypoint = u.route[0]!;
  u.hold = u.route.at(-1)!;
  // Your own tank drives the route only while you're not steering; it keeps its order.
  if (u.id !== lead) u.order = "hold";
  u.focus = null;
  repath(s.board, u, u.waypoint);
  u.plan = 0.7;
  say(
    s,
    u.id === lead
      ? "Your tank has a route. Steer any time to take over; let go and it drives on to the flag."
      : u.hold === s.board.bases[1 - u.side]
      ? "Route locked. Tank heading for the enemy HQ."
      : `Route locked: ${cells.length > 1 ? `${cells.length - 1} turn${cells.length > 2 ? "s" : ""}, then ` : ""}hold position.`,
  );
  return true;
}
/** Apply an order. A squad order sets the plan aside to resume later (only the first one does: a
 *  second order keeps the original plan); a planning order replaces the plan. */
function override(u: Unit, order: Order, plan = false) {
  if (plan) u.resume = null;
  else u.resume ??= { order: u.order, route: u.route.slice(), hold: u.hold };
  u.order = order;
  u.focus = null;
  u.waypoint = u.hold = null;
  u.route = [];
  u.pathAt = u.pathEnd = 0;
  u.plan = 0;
}
/** Back to the plan the squad order set aside. */
function release(u: Unit) {
  const r = u.resume;
  if (!r) return;
  u.resume = null;
  u.order = r.order;
  u.route = r.route.slice();
  u.hold = r.hold;
  u.waypoint = u.route[0] ?? null;
  u.focus = null;
  u.pathAt = u.pathEnd = 0;
  u.plan = 0;
}
/** The full square-by-square path from start through every stop, or null if a leg is blocked. */
export function plot(b: Board, start: number, stops: number[]) {
  const out: number[] = [];
  let from = start;
  for (const stop of stops) {
    if (stop < 0 || stop >= b.tiles.length || solid(b.tiles[stop]!)) return null;
    const leg = route(b, from, stop);
    if (!leg.length && from !== stop) return null;
    out.push(...leg);
    from = stop;
  }
  return out;
}
/** Reached the current stop: on to the next one, or hold the destination. */
function arrive(u: Unit) {
  u.route.shift();
  u.waypoint = u.route[0] ?? null;
  u.plan = 0;
}
export function clearShot(b: Board, a: Point, z: Point) {
  const dx = z.x - a.x,
    dy = z.y - a.y,
    d = dist(dx, dy);
  for (let n = 0.35; n < d - 0.3; n += 0.2)
    if (shellSolid(b.tiles[cellXY(b, a.x + (dx * n) / d, a.y + (dy * n) / d)]!)) return false;
  return true;
}
function canMoveXY(b: Board, x: number, y: number) {
  if (x < 0.32 || y < 0.32 || x >= b.cols - 0.32 || y >= b.rows - 0.32) return false;
  for (let i = 0; i < 4; i++)
    if (solid(b.tiles[cellXY(b, x + (i & 1 ? 0.27 : -0.27), y + (i & 2 ? 0.27 : -0.27))]!)) return false;
  return true;
}
export const canMove = (b: Board, p: Point) => canMoveXY(b, p.x, p.y);
// Numbers handed to helpers the step calls go through this array, not as arguments: a double
// passed to (or returned from) a call V8 doesn't inline is boxed, and the step is too big for
// everything to inline (Fizlet lesson K4). [0] dt, [1] dx, [2] dy of a move.
const F = new Float64Array(3);
/** A scratch point for effects at a square or a kit (written in place, never allocated). */
const at: Point = { x: 0.5, y: 0.5 };
export function moveUnit(s: Battle, u: Unit, dx: number, dy: number) {
  F[1] = dx;
  F[2] = dy;
  return move(s, u);
}
/** Move u by (F[1], F[2]) if the ground is open and it keeps clear of other tanks. */
function move(s: Battle, u: Unit) {
  const dx = F[1]!,
    dy = F[2]!,
    px = u.x + dx,
    py = u.y + dy;
  if (!canMoveXY(s.board, px, py)) return false;
  // Tanks keep 0.55 apart, but a tank that is already too close may always move away
  // (otherwise two overlapping tanks could never separate).
  // A tank jammed behind its own squad for a moment squeezes past (no stuck pile-ups).
  const squeeze = u.jam > 0.6;
  for (let i = 0; i < s.units.length; i++) {
    const v = s.units[i]!;
    if (v === u || v.hp <= 0 || (squeeze && v.side === u.side)) continue;
    const after = dist(v.x - px, v.y - py);
    if (after < 0.55 && after <= dist(v.x - u.x, v.y - u.y)) return false;
  }
  u.x = px;
  u.y = py;
  u.angle = Math.atan2(dy, dx);
  u.tread += dist(dx, dy) * 5;
  return true;
}
/** Remove item i of a pool's live run [0, n) keeping the order; the freed object goes to the end. */
function cut<T>(a: T[], i: number, n: number) {
  const t = a[i]!;
  for (let j = i; j < n - 1; j++) a[j] = a[j + 1]!;
  a[n - 1] = t;
}
function effect(s: Battle, p: Point, color: string) {
  if (s.effectCount < EFFECTS) {
    const e = s.effects[s.effectCount++]!;
    e.id = s.nextId++;
    e.x = p.x;
    e.y = p.y;
    e.life = 0.55;
    e.color = color;
  }
}
export function fire(s: Battle, u: Unit, angle: number) {
  u.turret = angle;
  shoot(s, u);
}
/** Fire along the turret if the gun is loaded and the shell pool has room. */
function shoot(s: Battle, u: Unit) {
  if (u.cooldown > 0 || s.shotCount >= SHOTS) return;
  const angle = u.turret;
  u.cooldown = ROLES[u.role].reload;
  u.recoil = 3;
  const p = s.shots[s.shotCount++]!;
  p.id = s.nextId++;
  p.x = u.x + Math.cos(angle) * 0.35;
  p.y = u.y + Math.sin(angle) * 0.35;
  p.vx = Math.cos(angle) * 15;
  p.vy = Math.sin(angle) * 15;
  p.life = 2;
  p.side = u.side;
  p.damage = ROLES[u.role].damage;
  p.owner = u.id;
}
// Nearest-visible scratch: candidates sorted by distance (stable insertion, like a stable sort).
const nearD = new Float64Array(64),
  nearI = new Int32Array(64);
/** Nearest living enemy within 10 cells with a clear line of fire. */
export function nearestVisible(s: Battle, u: Unit) {
  let n = 0;
  for (let i = 0; i < s.units.length && n < 64; i++) {
    const v = s.units[i]!;
    if (v.side === u.side || v.hp <= 0) continue;
    const d = (v.x - u.x) ** 2 + (v.y - u.y) ** 2;
    if (d >= 100) continue;
    let j = n++;
    for (; j > 0 && nearD[j - 1]! > d; j--) (nearD[j] = nearD[j - 1]!), (nearI[j] = nearI[j - 1]!);
    nearD[j] = d;
    nearI[j] = i;
  }
  for (let k = 0; k < n; k++) {
    const v = s.units[nearI[k]!]!;
    if (clearShot(s.board, u, v)) return v;
  }
  return undefined;
}
function nearestEnemy(s: Battle, u: Unit) {
  let best: Unit | undefined,
    d = Infinity;
  for (let i = 0; i < s.units.length; i++) {
    const v = s.units[i]!;
    if (v.side === u.side || v.hp <= 0) continue;
    const e = (v.x - u.x) ** 2 + (v.y - u.y) ** 2;
    if (e < d) (d = e), (best = v);
  }
  return best;
}
/** Index of the nearest repair kit within range, or -1. */
function nearestKit(s: Battle, u: Unit, range: number) {
  const k = s.kits;
  let best = -1,
    d = range * range;
  for (let i = 0; i < k.count; i++) {
    const e = (k.x[i]! - u.x) ** 2 + (k.y[i]! - u.y) ** 2;
    if (e < d) (d = e), (best = i);
  }
  return best;
}
/** A kit on the board (fizlet/rules drops; the id counter still advances, as it always did). */
function dropKit(s: Battle, p: Point) {
  s.nextId++;
  s.kits.spawn(p.x, p.y);
}
/** Salvage roll: a fallen house (30%) or a wreck (35%) leaves a kit if there is room. Small on
 *  purpose, so the random draw and the drop inline here instead of boxing numbers in the step. */
function salvage(s: Battle, p: Point, house: boolean) {
  if (s.kits.count < KITS && s.random() < (house ? 0.3 : 0.35)) dropKit(s, p);
}
/** Kit k is collected: removed from the board (drops), with its burst. */
function takeKit(s: Battle, k: number) {
  const kits = s.kits;
  at.x = kits.x[k]!;
  at.y = kits.y[k]!;
  kits.collect(at.x, at.y, 0.01);
  effect(s, at, "#39ffb0");
}
function spawnPickup(s: Battle) {
  const b = s.board,
    k = s.kits;
  if (k.count >= 3 + s.per / 4) return;
  next: for (let tries = 0; tries < 30; tries++) {
    const id = Math.floor(s.random() * b.tiles.length),
      x = (id % b.cols) + 0.5,
      y = Math.floor(id / b.cols) + 0.5;
    if (b.tiles[id] !== "ground") continue;
    for (let h = 0; h < b.bases.length; h++) {
      const base = b.bases[h]!;
      if (dist((base % b.cols) + 0.5 - x, Math.floor(base / b.cols) + 0.5 - y) < 4) continue next;
    }
    for (let i = 0; i < k.count; i++) if (dist(k.x[i]! - x, k.y[i]! - y) < 3) continue next;
    at.x = x;
    at.y = y;
    dropKit(s, at);
    return;
  }
}
export interface Input {
  x: number;
  y: number;
  fire: boolean;
  aim: Point | null;
}
/** Follow the planned path toward goal (replanning on a timer), arriving at route stops. */
function drive(s: Battle, u: Unit, goal: number) {
  const b = s.board,
    dt = F[0]!;
  if (u.plan <= 0) {
    const own = cell(b, u);
    s.occ[own] = 0;
    u.pathAt = 0;
    u.pathEnd = trace(b, own, goal, s.occ, u.path);
    s.occ[own] = 1;
    u.plan = 0.65 + (u.id % 12) * 0.025;
  }
  // A replan from inside the waypoint cell yields no path: that is arrival.
  if (u.pathAt >= u.pathEnd) {
    if (u.waypoint !== null && cell(b, u) === u.waypoint) arrive(u);
    return;
  }
  const next = u.path[u.pathAt]!,
    px = (next % b.cols) + 0.5,
    py = Math.floor(next / b.cols) + 0.5,
    d = dist(px - u.x, py - u.y);
  const travel = Math.min(d, speedOf(u) * dt * 0.8);
  if (d < 0.08) {
    u.pathAt++;
    if (u.pathAt >= u.pathEnd && u.waypoint !== null) arrive(u);
  } else if (((F[1] = ((px - u.x) / d) * travel), (F[2] = ((py - u.y) / d) * travel), !move(s, u))) {
    u.plan = Math.min(u.plan, 0.25);
    u.jam = Math.min(2, u.jam + dt);
  } else u.jam = Math.max(0, u.jam - dt / 2);
}
export function step(s: Battle, dt: number, input: Input) {
  if (s.winner !== null) return;
  dt = Math.min(0.04, Math.max(0, dt));
  F[0] = dt;
  s.time += dt;
  const b = s.board,
    units = s.units,
    kits = s.kits,
    player = commander(s);
  // Repair kits keep long battles going; a bounded number sit on open ground.
  s.pickupAt -= dt;
  if (s.pickupAt <= 0) {
    s.pickupAt = REPAIR.every;
    spawnPickup(s);
  }
  s.occ.fill(0);
  for (let i = 0; i < units.length; i++) if (units[i]!.hp > 0) s.occ[cell(b, units[i]!)] = 1;
  for (let i = 0; i < units.length; i++) {
    const u = units[i]!;
    if (u.hp <= 0) continue;
    u.cooldown -= dt;
    u.recoil = Math.max(0, u.recoil - dt * 16);
    u.plan -= dt;
    u.scan -= dt;
    const home = b.bases[u.side]!;
    if (dist(u.x - (home % b.cols) - 0.5, u.y - Math.floor(home / b.cols) - 0.5) < REPAIR.hqRadius)
      u.hp = Math.min(u.maxHp, u.hp + dt * REPAIR.hq);
    for (let k = kits.count - 1; k >= 0; k--) {
      if (dist(kits.x[k]! - u.x, kits.y[k]! - u.y) < 0.65 && u.hp < u.maxHp) {
        u.hp = Math.min(u.maxHp, u.hp + REPAIR.kit);
        takeKit(s, k);
        if (u.side === s.side) say(s, "Repair kit collected.");
      }
    }
    // Line-of-sight scans are the costliest check; refresh at 5Hz, not every tick.
    let target = live(s, u.target);
    if (u.scan <= 0 || !target) {
      u.scan = 0.2;
      target = nearestVisible(s, u);
      u.target = target ? target.id : null;
    }
    if (u === player) {
      // Analog input: direction from the vector, speed from its length (keyboard/D-pad = full).
      const length = dist(input.x, input.y),
        throttle = Math.min(1, length);
      if (length) {
        const speed = ROLES[u.role].speed * (0.55 + 0.45 * Math.max(0, u.hp / u.maxHp)); // speedOf, inline
        F[1] = (input.x / length) * speed * throttle * dt;
        F[2] = (input.y / length) * speed * throttle * dt;
        move(s, u);
        u.plan = 0; // steering overrides the route; let go and it replans to its flag
      } else if (u.waypoint !== null) drive(s, u, u.waypoint);
      const aim = input.aim ?? target;
      if (aim) u.turret = Math.atan2(aim.y - u.y, aim.x - u.x);
      if (input.fire) shoot(s, u);
    } else {
      let focus = live(s, u.focus);
      if (u.focus !== null && !focus) {
        u.focus = null;
        // A squad attack whose target fell takes on the next enemy in sight, or ends: back to plan.
        if (u.order === "attack" && u.resume) {
          const next = nearestVisible(s, u);
          if (next) (u.focus = next.id), (focus = next);
          else {
            release(u);
            if (u.side === s.side) say(s, `Tank ${u.id % s.per}: target down, back on the plan.`);
          }
        }
      }
      // Attack with no assigned target hunts the nearest living enemy anywhere.
      if (u.order === "attack" && !focus) focus = nearestEnemy(s, u);
      const kit = u.hp < u.maxHp * 0.35 && u.waypoint === null ? nearestKit(s, u, 9) : -1;
      const goal =
        u.waypoint ??
        (kit >= 0
          ? cellXY(b, kits.x[kit]!, kits.y[kit]!)
          : u.order === "hold" && u.hold !== null
            ? u.hold
            : u.order === "retreat"
            ? b.bases[u.side]!
            : u.order === "attack" && focus
              ? cell(b, focus)
              : u.order === "follow" && player.hp > 0 && u.side === s.side
                ? cell(b, player)
                : MISSIONS[s.mission]!.objective === "hold"
                  ? b.center
                  : b.bases[1 - u.side]!);
      const gx = (goal % b.cols) + 0.5,
        gy = Math.floor(goal / b.cols) + 0.5;
      const focusVisible = !!focus && dist(focus.x - u.x, focus.y - u.y) < 10 && clearShot(b, u, focus);
      const stop =
        kit < 0 &&
        ((u.waypoint === null && dist(u.x - gx, u.y - gy) < 1.2) ||
          (u.order === "follow" && u.waypoint === null && dist(u.x - player.x, u.y - player.y) < 2) ||
          (u.order === "attack" &&
            u.waypoint === null &&
            focusVisible &&
            dist(u.x - focus!.x, u.y - focus!.y) < 4.5) ||
          (!!target &&
            u.waypoint === null &&
            u.order === "advance" &&
            dist(u.x - target.x, u.y - target.y) < 5));
      if (!stop) drive(s, u, goal);
      const aim = focusVisible ? focus : target;
      if (aim) {
        u.turret = Math.atan2(aim.y - u.y, aim.x - u.x);
        shoot(s, u);
      }
    }
  }
  for (let i = s.shotCount - 1; i >= 0; i--) {
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
      const id = cellXY(b, p.x, p.y),
        tile = b.tiles[id]!;
      if (shellSolid(tile)) {
        hit = true;
        if (b.health[id]! > 0) {
          b.health[id] = b.health[id]! - p.damage;
          if (b.health[id]! <= 0) {
            at.x = (id % b.cols) + 0.5;
            at.y = Math.floor(id / b.cols) + 0.5;
            b.tiles[id] = "rubble";
            b.revision++;
            effect(s, at, tile === "car" ? "#ee6875" : "#cfb68c");
            say(s, tile === "car" ? "Vehicle destroyed." : "Cover breached.");
            for (let j = 0; j < units.length; j++) units[j]!.plan = 0;
            if (tile === "house") salvage(s, at, true);
          }
        } else effect(s, p, "#8895ae");
      }
      if (!hit)
        for (let j = 0; j < units.length; j++) {
          const u = units[j]!;
          if (u.side !== p.side && u.hp > 0 && dist(u.x - p.x, u.y - p.y) < 0.4) {
            u.hp = Math.max(0, u.hp - p.damage);
            effect(s, p, u.hp ? "#fff3bc" : "#ee6875");
            if (!u.hp) {
              const killer = live(s, p.owner);
              if (killer) killer.hp = Math.min(killer.maxHp, killer.hp + REPAIR.kill);
              if (u.side !== s.side) say(s, "Enemy tank destroyed.");
              // Wrecks sometimes leave salvage behind.
              salvage(s, u, false);
            }
            hit = true;
            break;
          }
        }
    }
    if (hit || p.life <= 0) cut(s.shots, i, s.shotCount--);
  }
  for (let i = s.effectCount - 1; i >= 0; i--) {
    const e = s.effects[i]!;
    e.life -= dt;
    if (e.life <= 0) cut(s.effects, i, s.effectCount--);
  }
  if (player.hp <= 0) s.winner = 1 - s.side;
  const mode = MISSIONS[s.mission]!.objective;
  for (let side = 0; side < 2; side++) {
    let living = 0,
      occupying = false,
      contested = false;
    const goal = mode === "hold" ? b.center : b.bases[1 - side]!,
      ox = (goal % b.cols) + 0.5,
      oy = Math.floor(goal / b.cols) + 0.5;
    for (let j = 0; j < units.length; j++) {
      const u = units[j]!;
      if (u.hp <= 0) continue;
      const d = dist(u.x - ox, u.y - oy);
      if (u.side === side) (living++, d < 1.8 && (occupying = true));
      else if (d < 2.4) contested = true;
    }
    if (!living) s.winner = 1 - side;
    if (mode !== "eliminate") {
      if (occupying && !contested) s.capture[side] = s.capture[side]! + dt;
      else if (mode === "capture") s.capture[side] = Math.max(0, s.capture[side]! - dt * 0.3);
      if (s.capture[side]! >= (mode === "hold" ? 45 : 12)) s.winner = side;
    }
  }
}
