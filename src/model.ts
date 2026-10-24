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
export type Order = "advance" | "follow" | "retreat";
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
}
export interface Shot extends Point {
  id: number;
  vx: number;
  vy: number;
  side: number;
  life: number;
  damage: number;
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
  scout: { cost: 2, hp: 65, speed: 3.6, reload: 0.8, damage: 18 },
  medium: { cost: 3, hp: 100, speed: 2.8, reload: 1, damage: 28 },
  heavy: { cost: 4, hp: 150, speed: 2.1, reload: 1.35, damage: 42 },
};
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
  | { type: "move"; id: number; cell: number };
export interface Battle {
  board: Board;
  mission: number;
  side: number;
  units: Unit[];
  shots: Shot[];
  effects: Effect[];
  time: number;
  capture: number[];
  winner: number | null;
  nextId: number;
  events: string[];
}
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
  occupied: number[] = [],
) {
  if (start === end) return [];
  if (solid(b.tiles[end]!)) return [];
  const prev = new Int16Array(b.tiles.length).fill(-1),
    queue = [start];
  prev[start] = start;
  for (let n = 0; n < queue.length; n++) {
    const id = queue[n]!;
    for (const next of neighbors(b, id)) {
      if (prev[next] !== -1 || (next !== end && occupied.includes(next)))
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
  cols = Math.max(18, Math.min(40, Math.floor(cols)));
  rows = Math.max(14, Math.min(26, Math.floor(rows)));
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
): Battle {
  if (roles.length !== 4 || loadoutCost(roles) > 12)
    throw Error("Choose four tanks within 12 points.");
  const units: Unit[] = [];
  for (const team of [0, 1])
    for (let i = 0; i < 4; i++) {
      const role =
        team === side
          ? roles[i]!
          : (["medium", "scout", "medium", "heavy"][i] as Role);
      const base = point(board, board.bases[team]!);
      const y = Math.max(
        1.5,
        Math.min(
          board.rows - 1.5,
          base.y +
            (formation === "line"
              ? i * 1.3 - 2
              : formation === "column"
                ? 0
                : (i - 1.5) * 1.4),
        ),
      );
      const x =
        formation === "column"
          ? base.x + (team === 0 ? 1 : -1) * (i * 0.8)
          : base.x + (i % 2) * (team === 0 ? 0.8 : -0.8);
      units.push({
        id: team * 4 + i,
        side: team,
        role,
        x,
        y,
        hp: ROLES[role].hp,
        maxHp: ROLES[role].hp,
        angle: team ? Math.PI : 0,
        turret: team ? Math.PI : 0,
        tread: 0,
        recoil: 0,
        cooldown: 0.4 + i * 0.15,
        order: "advance",
        waypoint: null,
        path: [],
        plan: 0,
      });
    }
  return {
    board,
    mission,
    side,
    units,
    shots: [],
    effects: [],
    time: 0,
    capture: [0, 0],
    winner: null,
    nextId: 20,
    events: [],
  };
}
export function command(s: Battle, c: Command) {
  if (s.winner !== null) return false;
  if (c.type === "order") {
    for (const u of s.units)
      if (c.ids.includes(u.id) && u.side === s.side && u.id !== s.side * 4) {
        u.order = c.order;
        u.waypoint = null;
        u.path = [];
        u.plan = 0;
      }
    s.events.push(
      c.order === "follow"
        ? "Squad falling in."
        : c.order === "retreat"
          ? "Squad returning to headquarters."
          : "Squad advancing.",
    );
    return true;
  }
  const u = s.units.find((u) => u.id === c.id && u.side === s.side && u.hp > 0);
  if (
    !u ||
    u.id === s.side * 4 ||
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
  if (s.effects.length < 64)
    s.effects.push({ ...p, id: s.nextId++, life: 0.55, color });
}
export function fire(s: Battle, u: Unit, angle: number) {
  if (u.cooldown > 0 || s.shots.length >= 80) return;
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
  });
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
    player = s.units.find((u) => u.id === s.side * 4)!;
  for (const u of s.units) {
    if (u.hp <= 0) continue;
    u.cooldown -= dt;
    u.recoil = Math.max(0, u.recoil - dt * 16);
    u.plan -= dt;
    const home = point(b, b.bases[u.side]!);
    if (Math.hypot(u.x - home.x, u.y - home.y) < 1.6)
      u.hp = Math.min(u.maxHp, u.hp + dt * 3);
    const enemies = s.units
      .filter((v) => v.side !== u.side && v.hp > 0)
      .sort(
        (a, z) =>
          Math.hypot(a.x - u.x, a.y - u.y) - Math.hypot(z.x - u.x, z.y - u.y),
      );
    const target = enemies.find(
      (v) => Math.hypot(v.x - u.x, v.y - u.y) < 10 && clearShot(b, u, v),
    );
    if (u === player) {
      const length = Math.hypot(input.x, input.y);
      if (length)
        moveUnit(
          s,
          u,
          (input.x / length) * ROLES[u.role].speed * dt,
          (input.y / length) * ROLES[u.role].speed * dt,
        );
      const aim = input.aim ?? target;
      if (aim) u.turret = Math.atan2(aim.y - u.y, aim.x - u.x);
      if (input.fire) fire(s, u, u.turret);
    } else {
      let goal =
        u.waypoint ??
        (u.order === "retreat"
          ? b.bases[u.side]!
          : u.order === "follow" && player.hp > 0 && u.side === s.side
            ? cell(b, player)
            : MISSIONS[s.mission]!.objective === "hold"
              ? b.center
              : b.bases[1 - u.side]!);
      const objectivePoint = point(b, goal);
      const stop =
        (u.waypoint === null &&
          Math.hypot(u.x - objectivePoint.x, u.y - objectivePoint.y) < 1.2) ||
        (u.order === "follow" &&
          u.waypoint === null &&
          Math.hypot(u.x - player.x, u.y - player.y) < 2) ||
        (target &&
          u.waypoint === null &&
          u.order === "advance" &&
          Math.hypot(u.x - target.x, u.y - target.y) < 5);
      if (!stop) {
        if (u.plan <= 0) {
          u.path = route(
            b,
            cell(b, u),
            goal,
            s.units.filter((v) => v !== u && v.hp > 0).map((v) => cell(b, v)),
          );
          u.plan = 0.65 + u.id * 0.025;
        }
        const next = u.path[0];
        if (next !== undefined) {
          const p = point(b, next),
            d = Math.hypot(p.x - u.x, p.y - u.y);
          const travel = Math.min(d, ROLES[u.role].speed * dt * 0.8);
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
      if (target) {
        u.turret = Math.atan2(target.y - u.y, target.x - u.x);
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
