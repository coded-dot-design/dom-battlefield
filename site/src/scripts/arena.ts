/**
 * Hero arena: the landing page's live mini battle. Two platoons drawn with the game's own tank
 * sprites roam the whole hero, shell each other, flatten the board's shapes, and knock the
 * headline's letters around (shots and treads both). Tap the field (or the AIRSTRIKE key) to
 * call a strike. One canvas, one rAF loop, bounded pools; paused offscreen and in hidden tabs,
 * a still frame under reduced motion.
 */
import { tankSprites } from "../../../shared/sherman-sprites";
import { createGameAudio } from "../../../shared/audio";

type Team = 0 | 1;
type Tank = {
  team: Team; x: number; y: number; a: number; ta: number; v: number; hp: number; cool: number; tread: number;
  recoil: number; flash: number; gx: number; gy: number; target: Target | null; think: number; dead: number; drop: number;
};
type Target = { x: number; y: number; kind: "tank" | "prop" | "letter"; ref: unknown };
type Prop = { x: number; y: number; s: number; kind: number; crushed: number; pop: number; tint: string };
type Letter = { el: HTMLElement; x: number; y: number; w: number; h: number; busy: number };
type Shell = { team: Team; x: number; y: number; vx: number; vy: number; life: number; big: number };
type Bit = { x: number; y: number; vx: number; vy: number; r: number; vr: number; s: number; life: number; max: number; c: string; kind: 0 | 1 | 2 | 3 | 4; text?: string };
type Scorch = { x: number; y: number; r: number; life: number };

const TAU = Math.PI * 2;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)]!;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const BOOM_WORDS = ["BOOM", "KABOOM", "WRECKED", "DIRECT HIT", "BLAM"];

export function startArena(hero: HTMLElement) {
  const canvas = hero.querySelector<HTMLCanvasElement>("canvas.arena")!;
  const ctx = canvas.getContext("2d")!;
  const inner = hero.querySelector<HTMLElement>(".hero-inner");
  const hud = {
    wrecks: hero.querySelector<HTMLElement>("[data-wrecks]"),
    flat: hero.querySelector<HTMLElement>("[data-flat]"),
    strikes: hero.querySelector<HTMLElement>("[data-strikes]"),
  };
  const draw = tankSprites(document);
  const audio = createGameAudio(document, "battlefield-site", false);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let W = 0, H = 0, dpr = 1, scale = 1.5, running = false, visible = true, last = 0, raf = 0, shake = 0;
  let wrecks = 0, flattened = 0, strikes = 0;
  const tanks: Tank[] = [], props: Prop[] = [], shells: Shell[] = [], bits: Bit[] = [], scorches: Scorch[] = [];
  let letters: Letter[] = [];
  const col = { a: "#39ffb0", b: "#ff5c8f", sys: "#19f0ff", attack: "#ff2e88", advance: "#ff8a1f", hurt: "#ffc21a", cmd: "#9a63ff", line: "#3b3170", bg: "#07060f", ink: "#f6f3ff", white: "#fff4ff", light: false };
  const hq = [{ x: 0, y: 0 }, { x: 0, y: 0 }];

  function colours() {
    const s = getComputedStyle(document.documentElement);
    const v = (n: string, f: string) => s.getPropertyValue(n).trim() || f;
    col.a = v("--team-a", col.a); col.b = v("--team-b", col.b); col.sys = v("--k-sys", col.sys); col.attack = v("--k-attack", col.attack);
    col.advance = v("--k-advance", col.advance); col.hurt = v("--hurt", col.hurt); col.cmd = v("--k-cmd", col.cmd); col.line = v("--line", col.line);
    col.bg = v("--bg", col.bg); col.ink = v("--ink", col.ink);
    col.light = document.documentElement.dataset.theme === "light";
    for (const p of props) p.tint = propTint(p.kind);
  }
  const team = (t: Team) => (t ? col.b : col.a);
  const propTint = (k: number) => [col.a, col.sys, col.hurt, col.cmd][k % 4]!;

  // ---------- Layout ----------
  function resize() {
    const r = hero.getBoundingClientRect();
    W = Math.max(320, r.width);
    H = Math.max(320, r.height);
    dpr = Math.min(devicePixelRatio || 1, W < 700 ? 1.5 : 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    scale = W < 560 ? 1.05 : W < 900 ? 1.3 : 1.6;
    hq[0] = W < 700 ? { x: W * 0.84, y: H * 0.6 } : { x: W * 0.42, y: H * 0.86 };
    hq[1] = { x: W * 0.88, y: H * 0.17 };
    measure();
    const want = W < 560 ? 3 : W < 900 ? 4 : 5;
    while (tanks.length < want * 2) tanks.push(spawnTank((tanks.length % 2) as Team, true));
    tanks.length = want * 2;
    const nProps = Math.round((W * H) / 60000);
    while (props.length < nProps) props.push(newProp());
    props.length = Math.min(props.length, nProps);
    for (const t of tanks) (t.x = Math.min(W - 20, t.x)), (t.y = Math.min(H - 20, t.y));
    if (!running) frame(performance.now(), true);
  }
  function measure() {
    const r = hero.getBoundingClientRect();
    keepOut = [...hero.querySelectorAll<HTMLElement>(".hero-title, .lead, .hero-ctas, .hero-top, .arena-hud")].map((el) => {
      const b = el.getBoundingClientRect();
      return new DOMRect(b.left - r.left, b.top - r.top, b.width, b.height);
    });
    letters = [...hero.querySelectorAll<HTMLElement>(".hx")].map((el) => {
      const b = el.getBoundingClientRect();
      const old = letters.find((l) => l.el === el);
      return { el, x: b.left - r.left, y: b.top - r.top, w: b.width, h: b.height, busy: old?.busy ?? 0 };
    }).filter((l) => l.w > 4);
  }
  // Shapes stay off the copy and the keys (tanks still drive over everything).
  let keepOut: DOMRect[] = [];
  function newProp(): Prop {
    const kind = Math.floor(Math.random() * 4);
    let x = 0, y = 0;
    for (let i = 0; i < 12; i++) {
      (x = rand(30, W - 30)), (y = rand(40, H - 30));
      if (!keepOut.some((r) => x > r.left - 30 && x < r.right + 30 && y > r.top - 30 && y < r.bottom + 30)) break;
    }
    return { x, y, s: rand(22, 40) * (scale / 1.4), kind, crushed: 0, pop: 0, tint: propTint(kind) };
  }
  function spawnTank(t: Team, intro = false): Tank {
    // Enter from the team's own edge; the intro drives everyone in from off screen.
    const home = hq[t]!;
    const x = intro ? (t ? W + rand(40, 160) : -rand(40, 160)) : home.x + rand(-30, 30);
    const y = intro ? rand(H * 0.15, H * 0.9) : home.y + rand(-30, 30);
    return {
      team: t, x, y, a: t ? Math.PI : 0, ta: t ? Math.PI : 0, v: rand(62, 92), hp: 3, cool: rand(0.8, 2.4), tread: 0, recoil: 0, flash: 0,
      gx: rand(W * 0.1, W * 0.9), gy: rand(H * 0.15, H * 0.9), target: null, think: 0, dead: 0, drop: intro ? 0 : 1,
    };
  }

  // ---------- Effects ----------
  function push(b: Bit) {
    if (bits.length > 420) bits.shift();
    bits.push(b);
  }
  function text(x: number, y: number, word: string, c: string, size = 1) {
    push({ x, y, vx: rand(-14, 14), vy: -70, r: rand(-0.18, 0.18), vr: 0, s: 16 * size, life: 0.9, max: 0.9, c, kind: 4, text: word });
  }
  function blast(x: number, y: number, size: number, tint: string) {
    const k = size * (scale / 1.4);
    push({ x, y, vx: 0, vy: 0, r: 0, vr: 0, s: 26 * k, life: 0.28, max: 0.28, c: col.white, kind: 1 }); // flash
    push({ x, y, vx: 0, vy: 0, r: 0, vr: 0, s: 20 * k, life: 0.5, max: 0.5, c: col.hurt, kind: 1 }); // fireball
    push({ x: x + rand(-6, 6), y: y + rand(-6, 6), vx: 0, vy: 0, r: 0, vr: 0, s: 14 * k, life: 0.42, max: 0.42, c: col.advance, kind: 1 });
    push({ x, y, vx: 0, vy: 0, r: 0, vr: 0, s: 18 * k, life: 0.5, max: 0.5, c: tint, kind: 2 }); // ring
    push({ x, y, vx: 0, vy: 0, r: 0.3, vr: 1.6, s: 24 * k, life: 0.6, max: 0.6, c: col.attack, kind: 3 }); // spinning square ring
    const n = Math.round(10 + size * 5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.2, 0.2), sp = rand(120, 300) * k;
      push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(0, TAU), vr: rand(-9, 9), s: rand(4, 9) * k, life: rand(0.5, 0.9), max: 0.9, c: pick([tint, col.hurt, col.white, col.attack, col.sys]), kind: 0 });
    }
    for (let i = 0; i < 4; i++)
      push({ x: x + rand(-10, 10), y: y + rand(-10, 10), vx: rand(-20, 20), vy: rand(-30, -8), r: 0, vr: 0, s: rand(12, 20) * k, life: rand(0.8, 1.3), max: 1.3, c: "smoke", kind: 1 });
    if (scorches.length > 36) scorches.shift();
    scorches.push({ x, y, r: 16 * k, life: 9 });
    shake = Math.min(18, shake + size * 3.5);
    // Shots and blasts knock any letter in reach, away from the centre.
    const reach = 46 * k;
    for (const l of letters) {
      const cx = l.x + l.w / 2, cy = l.y + l.h / 2, d = Math.hypot(cx - x, cy - y);
      if (d < reach + l.w / 2) knock(l, (cx - x) / (d || 1), (cy - y) / (d || 1), size);
    }
  }
  function knock(l: Letter, nx: number, ny: number, power: number) {
    const now = performance.now();
    if (now < l.busy) return;
    l.busy = now + 900;
    const p = Math.min(2.4, power), dx = nx * 26 * p, dy = ny * 22 * p - 18 * p, spin = (nx >= 0 ? 1 : -1) * rand(25, 70) * p;
    l.el.animate(
      [
        { transform: "none", color: "inherit" },
        { transform: `translate(${dx}px,${dy}px) rotate(${spin}deg) scale(1.15)`, color: col.attack, offset: 0.3 },
        { transform: `translate(${dx * 0.3}px,${Math.max(0, dy * -0.1)}px) rotate(${-spin * 0.15}deg)`, offset: 0.7 },
        { transform: "none", color: "inherit" },
      ],
      { duration: 820, easing: "cubic-bezier(.2,.9,.3,1.2)" },
    );
  }
  let squashed = 0;
  function squash(l: Letter, angle: number) {
    const now = performance.now();
    // One flattened letter at a time keeps the headline readable.
    if (now < l.busy || now < squashed) return;
    l.busy = now + 1100;
    squashed = now + 700;
    flattened++;
    text(l.x + l.w / 2, l.y, "FLATTENED", col.hurt, 0.8);
    const sx = Math.abs(Math.cos(angle)) > 0.5;
    l.el.animate(
      [
        { transform: "none" },
        { transform: sx ? "scale(1.25,.28) translateY(40%)" : "scale(.3,1.15)", offset: 0.18 },
        { transform: sx ? "scale(1.25,.28) translateY(40%)" : "scale(.3,1.15)", offset: 0.6 },
        { transform: "scale(.92,1.12)", offset: 0.82 },
        { transform: "none" },
      ],
      { duration: 1000, easing: "ease-out" },
    );
  }
  function kill(t: Tank, by: "shell" | "strike") {
    t.dead = rand(1.4, 2.4);
    wrecks++;
    blast(t.x, t.y, 2.2, team(t.team));
    setTimeout(() => running && blast(t.x + rand(-18, 18), t.y + rand(-18, 18), 1.2, col.hurt), 140);
    // The hull breaks up: team-coloured chunks and the turret spin away.
    for (let i = 0; i < 9; i++) {
      const a = rand(0, TAU), sp = rand(90, 220);
      push({ x: t.x, y: t.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(0, TAU), vr: rand(-12, 12), s: rand(7, 14) * (scale / 1.4), life: 1.1, max: 1.1, c: i % 3 ? team(t.team) : "#151020", kind: 0 });
    }
    text(t.x, t.y - 20, by === "strike" ? "AIRSTRIKE!" : pick(BOOM_WORDS), team(t.team ? 0 : 1), 1.2);
    audio.play("tank-destroyed");
    tick();
  }
  function tick() {
    if (hud.wrecks) hud.wrecks.textContent = String(wrecks).padStart(3, "0");
    if (hud.flat) hud.flat.textContent = String(flattened).padStart(3, "0");
    if (hud.strikes) hud.strikes.textContent = String(strikes).padStart(2, "0");
  }

  // ---------- Airstrike ----------
  const pending: { x: number; y: number; t: number }[] = [];
  function strike(x: number, y: number) {
    if (pending.length > 5) return;
    strikes++;
    pending.push({ x, y, t: 0.42 });
    audio.play("fire");
    tick();
    if (!running) start();
  }
  function detonate(x: number, y: number) {
    blast(x, y, 3.2, col.attack);
    setTimeout(() => running && blast(x + rand(-30, 30), y + rand(-24, 24), 1.6, col.advance), 90);
    setTimeout(() => running && blast(x + rand(-30, 30), y + rand(-24, 24), 1.3, col.sys), 190);
    const r = 95 * (scale / 1.4);
    for (const t of tanks) if (!t.dead && Math.hypot(t.x - x, t.y - y) < r) kill(t, "strike");
    for (const p of props) if (!p.crushed && Math.hypot(p.x - x, p.y - y) < r) wreckProp(p);
    for (const l of letters) {
      const cx = l.x + l.w / 2, cy = l.y + l.h / 2, d = Math.hypot(cx - x, cy - y);
      if (d < r * 1.6) knock(l, (cx - x) / (d || 1), (cy - y) / (d || 1), 2.6 - d / r);
    }
    audio.play("hurt");
  }
  function wreckProp(p: Prop) {
    p.crushed = rand(5, 9);
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU), sp = rand(60, 180);
      push({ x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: rand(0, TAU), vr: rand(-10, 10), s: p.s * rand(0.18, 0.32), life: 0.8, max: 0.8, c: p.tint, kind: 0 });
    }
  }

  // ---------- Simulation ----------
  function think(t: Tank) {
    t.think = rand(1.2, 2.6);
    const foes = tanks.filter((o) => !o.dead && o.team !== t.team && o.drop >= 1);
    const near = foes.sort((p, q) => Math.hypot(p.x - t.x, p.y - t.y) - Math.hypot(q.x - t.x, q.y - t.y))[0];
    const roll = Math.random();
    if (near && Math.hypot(near.x - t.x, near.y - t.y) < W * 0.55 && roll < 0.62) t.target = { x: near.x, y: near.y, kind: "tank", ref: near };
    else if (letters.length && roll < 0.86) {
      const l = pick(letters);
      t.target = { x: l.x + l.w / 2, y: l.y + l.h / 2, kind: "letter", ref: l };
    } else {
      const live = props.filter((p) => !p.crushed);
      const p = live.length ? pick(live) : null;
      t.target = p ? { x: p.x, y: p.y, kind: "prop", ref: p } : null;
    }
    // Drive somewhere: often straight over a letter or a shape, otherwise anywhere.
    const r = Math.random();
    if (r < 0.2 && letters.length) {
      const l = pick(letters);
      (t.gx = l.x + l.w / 2), (t.gy = l.y + l.h / 2);
    } else if (r < 0.55 && props.length) {
      const p = pick(props);
      (t.gx = p.x), (t.gy = p.y);
    } else (t.gx = rand(W * 0.05, W * 0.95)), (t.gy = rand(H * 0.1, H * 0.92));
  }
  function fire(t: Tank) {
    const tg = t.target!;
    const len = 24 * scale, mx = t.x + Math.cos(t.ta) * len, my = t.y + Math.sin(t.ta) * len;
    const d = Math.hypot(tg.x - mx, tg.y - my), sp = 560, spread = rand(-0.07, 0.07);
    const a = t.ta + spread;
    if (shells.length > 40) shells.shift();
    shells.push({ team: t.team, x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: Math.min(1.4, d / sp + rand(-0.03, 0.05)), big: tg.kind === "tank" ? 1.25 : 1 });
    t.recoil = 6;
    t.flash = 0.09;
    t.cool = rand(1.1, 2.3);
    push({ x: mx, y: my, vx: 0, vy: 0, r: 0, vr: 0, s: 9 * (scale / 1.4), life: 0.12, max: 0.12, c: col.white, kind: 1 });
    audio.play("fire");
  }
  function step(dt: number) {
    for (const p of pending) p.t -= dt;
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i]!.t <= 0) detonate(pending[i]!.x, pending[i]!.y), pending.splice(i, 1);
    for (const t of tanks) {
      if (t.dead) {
        t.dead -= dt;
        if (t.dead <= 0) Object.assign(t, spawnTank(t.team), { dead: 0, drop: 0 });
        continue;
      }
      if (t.drop < 1) t.drop = Math.min(1, t.drop + dt * 1.6);
      t.think -= dt;
      t.cool -= dt;
      if (t.think <= 0 || (t.target?.kind === "tank" && (t.target.ref as Tank).dead)) think(t);
      if (t.target?.kind === "tank") {
        const o = t.target.ref as Tank;
        (t.target.x = o.x), (t.target.y = o.y);
      }
      // Drive: turn toward the goal, roll forward, slow on tight turns.
      const want = Math.atan2(t.gy - t.y, t.gx - t.x), turn = wrap(want - t.a);
      t.a += Math.sign(turn) * Math.min(Math.abs(turn), 2.4 * dt);
      const speed = t.v * (Math.abs(turn) > 1.2 ? 0.35 : 1) * (scale / 1.4);
      t.x += Math.cos(t.a) * speed * dt;
      t.y += Math.sin(t.a) * speed * dt;
      t.tread += speed * dt * 0.15;
      if (Math.hypot(t.gx - t.x, t.gy - t.y) < 24) t.think = Math.min(t.think, 0.1);
      // Keep inside the field once on it.
      if (t.drop >= 1 || (t.x > 0 && t.x < W)) (t.x = Math.max(16, Math.min(W - 16, t.x))), (t.y = Math.max(20, Math.min(H - 16, t.y)));
      // Turret: track, fire when lined up.
      if (t.target) {
        const aim = Math.atan2(t.target.y - t.y, t.target.x - t.x), dta = wrap(aim - t.ta);
        t.ta += Math.sign(dta) * Math.min(Math.abs(dta), 4.2 * dt);
        if (t.cool <= 0 && Math.abs(dta) < 0.1 && t.x > 0 && t.x < W) fire(t);
      } else t.ta += wrap(t.a - t.ta) * Math.min(1, dt * 3);
      t.recoil = Math.max(0, t.recoil - dt * 30);
      t.flash = Math.max(0, t.flash - dt);
      // Treads: flatten shapes and letters underneath.
      const foot = 13 * scale;
      for (const p of props)
        if (!p.crushed && Math.abs(p.x - t.x) < foot && Math.abs(p.y - t.y) < foot) {
          p.crushed = rand(5, 8);
          flattened++;
          text(p.x, p.y - 10, "FLATTENED", col.hurt, 0.8);
          for (let i = 0; i < 6; i++) push({ x: p.x, y: p.y, vx: rand(-90, 90), vy: rand(-90, 90), r: 0, vr: rand(-6, 6), s: p.s * 0.2, life: 0.6, max: 0.6, c: p.tint, kind: 0 });
          tick();
        }
      for (const l of letters) if (t.x > l.x && t.x < l.x + l.w && t.y > l.y + l.h * 0.15 && t.y < l.y + l.h * 0.9) (squash(l, t.a), tick());
    }
    // Tanks push apart.
    for (let i = 0; i < tanks.length; i++)
      for (let j = i + 1; j < tanks.length; j++) {
        const p = tanks[i]!, q = tanks[j]!;
        if (p.dead || q.dead) continue;
        const dx = q.x - p.x, dy = q.y - p.y, d = Math.hypot(dx, dy), min = 26 * scale;
        if (d > 0 && d < min) {
          const k = (min - d) / 2 / d;
          (p.x -= dx * k), (p.y -= dy * k), (q.x += dx * k), (q.y += dy * k);
        }
      }
    // Shells: fly, hit a tank on the way, or burst where they were aimed.
    for (let i = shells.length - 1; i >= 0; i--) {
      const s = shells[i]!;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      let hit: Tank | null = null;
      for (const t of tanks) if (!t.dead && t.team !== s.team && t.drop >= 1 && Math.hypot(t.x - s.x, t.y - s.y) < 15 * scale) hit = t;
      if (hit || s.life <= 0) {
        shells.splice(i, 1);
        blast(s.x, s.y, s.big, team(s.team));
        if (hit && --hit.hp <= 0) kill(hit, "shell");
        else if (hit) text(hit.x, hit.y - 16, "HIT", col.hurt, 0.8), audio.play("kill");
        for (const p of props) if (!p.crushed && Math.hypot(p.x - s.x, p.y - s.y) < p.s) wreckProp(p);
      }
    }
    for (const p of props) {
      if (p.crushed > 0) {
        p.crushed -= dt;
        if (p.crushed <= 0) Object.assign(p, newProp(), { pop: 0 });
      } else p.pop = Math.min(1, p.pop + dt * 2.5);
    }
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i]!;
      b.life -= dt;
      if (b.life <= 0) {
        bits.splice(i, 1);
        continue;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const drag = b.kind === 0 ? 2.6 : 1.4;
      b.vx -= b.vx * drag * dt;
      b.vy -= b.vy * drag * dt;
      b.r += b.vr * dt;
    }
    for (let i = scorches.length - 1; i >= 0; i--) if ((scorches[i]!.life -= dt) <= 0) scorches.splice(i, 1);
    shake = Math.max(0, shake - dt * 40);
  }

  // ---------- Render ----------
  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sx = shake ? rand(-shake, shake) * 0.5 : 0, sy = shake ? rand(-shake, shake) * 0.5 : 0;
    ctx.translate(sx, sy);
    if (inner) inner.style.transform = shake > 4 ? `translate(${(sx * 0.4).toFixed(1)}px,${(sy * 0.4).toFixed(1)}px)` : "";
    // Scorch marks on the ground.
    for (const s of scorches) {
      ctx.globalAlpha = Math.min(1, s.life / 3) * (col.light ? 0.16 : 0.5);
      ctx.fillStyle = col.light ? "#1b1636" : "#000";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // HQs: the game's dashed squares, exaggerated.
    hq.forEach((h, i) => {
      const s = 46 * (scale / 1.4);
      ctx.strokeStyle = i ? col.b : col.a;
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.globalAlpha = 0.75;
      ctx.strokeRect(h.x - s, h.y - s, s * 2, s * 2);
      ctx.setLineDash([]);
      ctx.fillStyle = i ? col.b : col.a;
      ctx.globalAlpha = 0.18;
      ctx.fillRect(h.x - s * 0.45, h.y - s * 0.2, s * 0.9, s * 0.65);
      ctx.globalAlpha = 0.9;
      ctx.font = `700 ${Math.round(11 * (scale / 1.4))}px ui-monospace, monospace`;
      ctx.textAlign = "center";
      ctx.fillText(i ? "HQ B" : "HQ A", h.x, h.y - s * 0.45);
    });
    ctx.globalAlpha = 1;
    // Shapes from the board.
    for (const p of props) {
      if (p.crushed > 0) {
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = p.tint;
        ctx.fillRect(p.x - p.s * 0.6, p.y - 2, p.s * 1.2, 4);
        ctx.globalAlpha = 1;
        continue;
      }
      const k = p.pop < 1 ? 0.4 + 0.6 * easeBack(p.pop) : 1, s = p.s * k;
      ctx.lineWidth = 3;
      ctx.strokeStyle = p.tint;
      ctx.fillStyle = col.light ? "rgba(255,255,255,.7)" : "rgba(7,6,15,.55)";
      ctx.beginPath();
      if (p.kind === 0) round(p.x - s / 2, p.y - s / 2, s, s, s * 0.3);
      else if (p.kind === 1) ctx.rect(p.x - s / 2, p.y - s / 2, s, s);
      else if (p.kind === 2) ctx.arc(p.x, p.y, s / 2, 0, TAU);
      else round(p.x - s * 0.7, p.y - s * 0.28, s * 1.4, s * 0.56, s * 0.28);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = p.tint;
      if (p.kind === 1) ctx.fillRect(p.x - s * 0.18, p.y - s * 0.18, s * 0.36, s * 0.36);
      if (p.kind === 2) ctx.fillRect(p.x + s * 0.22, p.y - s * 0.42, s * 0.2, s * 0.2);
    }
    // Strike reticles.
    for (const p of pending) {
      const k = p.t / 0.42, r = 30 + 60 * k;
      ctx.strokeStyle = col.attack;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 1 - k * 0.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, TAU);
      ctx.moveTo(p.x - r - 12, p.y);
      ctx.lineTo(p.x - r + 14, p.y);
      ctx.moveTo(p.x + r - 14, p.y);
      ctx.lineTo(p.x + r + 12, p.y);
      ctx.moveTo(p.x, p.y - r - 12);
      ctx.lineTo(p.x, p.y - r + 14);
      ctx.moveTo(p.x, p.y + r - 14);
      ctx.lineTo(p.x, p.y + r + 12);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // Tanks.
    for (const t of tanks) {
      if (t.dead) continue;
      const k = scale * (t.drop < 1 ? 0.6 + 0.4 * easeBack(t.drop) : 1);
      draw(ctx, t.x, t.y, t.a, t.ta, team(t.team), t.tread, t.recoil, t.flash > 0, k);
      if (t.hp < 3) {
        ctx.fillStyle = t.hp === 1 ? col.attack : col.hurt;
        for (let i = 0; i < 3; i++) ctx.globalAlpha = i < t.hp ? 1 : 0.25, ctx.fillRect(t.x - 10 + i * 8, t.y - 22 * scale, 6, 4);
        ctx.globalAlpha = 1;
      }
    }
    // Shells.
    ctx.lineCap = "round";
    for (const s of shells) {
      const c = team(s.team);
      ctx.strokeStyle = c;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.04, s.y - s.vy * 0.04);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 3;
      ctx.strokeStyle = col.white;
      ctx.stroke();
    }
    ctx.lineCap = "butt";
    // Particles.
    for (const b of bits) {
      const k = b.life / b.max;
      if (b.kind === 0) {
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.fillStyle = b.c;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.fillRect(-b.s / 2, -b.s / 2, b.s, b.s);
        ctx.restore();
      } else if (b.kind === 1) {
        const smoke = b.c === "smoke";
        ctx.globalAlpha = smoke ? k * (col.light ? 0.12 : 0.2) : k;
        ctx.fillStyle = smoke ? (col.light ? "#5d5684" : "#2a2150") : b.c;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.s * (smoke ? 1.4 - k * 0.6 : 0.6 + (1 - k) * 1.6), 0, TAU);
        ctx.fill();
      } else if (b.kind === 2 || b.kind === 3) {
        ctx.globalAlpha = k;
        ctx.strokeStyle = b.c;
        ctx.lineWidth = 4 * k + 1;
        const r = b.s * (0.5 + (1 - k) * (b.kind === 2 ? 4.2 : 3));
        if (b.kind === 2) {
          ctx.beginPath();
          ctx.arc(b.x, b.y, r, 0, TAU);
          ctx.stroke();
        } else {
          ctx.save();
          ctx.translate(b.x, b.y);
          ctx.rotate(b.r);
          ctx.strokeRect(-r / 2, -r / 2, r, r);
          ctx.restore();
        }
      } else {
        ctx.globalAlpha = Math.min(1, k * 2);
        const size = Math.round(b.s * (1 + (1 - k) * 0.3));
        ctx.font = `900 ${size}px ui-monospace, SFMono-Regular, monospace`;
        ctx.textAlign = "center";
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.r);
        ctx.lineWidth = 5;
        ctx.strokeStyle = col.light ? "#fff" : "#07060f";
        ctx.strokeText(b.text!, 0, 0);
        ctx.fillStyle = b.c;
        ctx.fillText(b.text!, 0, 0);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
  function round(x: number, y: number, w: number, h: number, r: number) {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  const easeBack = (t: number) => 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;

  // ---------- Loop ----------
  let remeasure = 0;
  function frame(now: number, still = false) {
    // rAF stamps the frame start, which can be just before `last`: never step backwards.
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0));
    last = now;
    if (!still) {
      step(dt);
      if ((remeasure -= dt) <= 0) (remeasure = 1), measure();
    }
    render();
    if (running) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running || reduced.matches || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
    if (inner) inner.style.transform = "";
  }

  // ---------- Wiring ----------
  colours();
  resize();
  new ResizeObserver(() => resize()).observe(hero);
  new MutationObserver(() => (colours(), running || frame(performance.now(), true))).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  new IntersectionObserver(([e]) => ((visible = !!e?.isIntersecting), visible ? start() : stop()), { threshold: 0.05 }).observe(hero);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  reduced.addEventListener("change", () => (reduced.matches ? stop() : start()));
  hero.addEventListener("pointerdown", (e) => {
    if ((e.target as Element).closest("a, button, input, label, [data-no-strike]") || reduced.matches) return;
    audio.unlock(e);
    const r = hero.getBoundingClientRect();
    strike(e.clientX - r.left, e.clientY - r.top);
  });
  hero.querySelector("[data-airstrike]")?.addEventListener("click", (e) => {
    audio.unlock(e);
    const live = tanks.filter((t) => !t.dead && t.x > 0 && t.x < W);
    const t = live.length ? pick(live) : null;
    strike(t ? t.x : W / 2, t ? t.y : H / 2);
  });
  const sound = hero.querySelector<HTMLButtonElement>("[data-sound]");
  sound?.addEventListener("click", (e) => {
    audio.toggle();
    audio.unlock(e);
    sound.setAttribute("aria-pressed", String(audio.enabled));
  });
  // A still poster under reduced motion: tanks parked mid-fight.
  if (reduced.matches) {
    for (const t of tanks) (t.x = rand(W * 0.1, W * 0.9)), (t.y = rand(H * 0.2, H * 0.9)), (t.drop = 1);
    frame(performance.now(), true);
  }
  start();
  return { strike, stop, start };
}
