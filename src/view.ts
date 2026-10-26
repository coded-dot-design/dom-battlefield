import { tankSprites } from "../shared/sherman-sprites";
import { point, MISSIONS } from "./model";
import type { Battle } from "./model";
const colors = ["#39ffb0", "#ff5c8f"];
const MINI: Record<string, string> = {
  water: "#1d4fb8",
  rock: "#a77bff",
  rubble: "#3a2a66",
  hedge: "#19f0ff",
  fence: "#ffe14d",
  car: "#ffe14d",
};
/** Minimap colours follow each operation's climate (see the terrain themes in style.css). */
const MINI_BY: Record<string, Record<string, string>> = {
  hedge: { hedge: "#39ffb0", house: "#7be0a8", rock: "#2b9a63", fence: "#7aa356", car: "#3d6b4f" },
  sand: { rock: "#ff8a3c", fence: "#ffb547", car: "#e07a2c", house: "#ffb547", rubble: "#5a2d12" },
  snow: { rock: "#bfe9ff", house: "#7c8cff", fence: "#b9a8ff", car: "#9fd8ff", water: "#3a6fd8", rubble: "#2b3170" },
  river: { house: "#ff2e88", water: "#19c6d8", car: "#ffe14d", fence: "#ff2e88", rubble: "#2a2a3c" },
};
/** A route as drawn: square ids from the tank's square to its destination, plus its stops. */
export interface RouteLine {
  id: number;
  cells: number[];
  stops: number[];
  n: number;
  selected: boolean;
  draft: boolean;
  bad: boolean;
  hq: boolean;
}
const SVG = "http://www.w3.org/2000/svg";
export class View {
  world: HTMLElement;
  cells: HTMLElement[] = [];
  units = new Map<
    number,
    {
      node: HTMLButtonElement;
      canvas: HTMLCanvasElement;
      ctx: CanvasRenderingContext2D;
      key?: string;
      move?: string;
      hp?: number;
      alive?: boolean;
      flags?: string;
      mx?: number;
      my?: number;
    }
  >();
  shots = new Map<number, HTMLElement>();
  effects = new Map<number, HTMLElement>();
  shotPool: HTMLElement[] = [];
  effectPool: HTMLElement[] = [];
  kits = new Map<number, HTMLElement>();
  reticle: HTMLElement;
  reticleKey = "";
  tile = 36;
  revision = -1;
  routeLayer: SVGSVGElement;
  hintEl: HTMLElement;
  hintKey = "";
  routeKey = "";
  target = -1;
  paused?: boolean;
  // Layout reads are cached here and refreshed only on resize/scroll events, never per frame.
  vw = 0;
  vh = 0;
  sl = 0;
  st = 0;
  vx = 0;
  vy = 0;
  ox = 0;
  oy = 0;
  camKey = "";
  abort = new AbortController();
  mini: SVGSVGElement;
  miniUnits = new Map<number, SVGCircleElement>();
  camera: SVGRectElement;
  drawTank = tankSprites(document);
  constructor(
    public viewport: HTMLElement,
    public s: Battle,
    public onUnit: (id: number) => void,
  ) {
    this.world = document.createElement("div");
    this.world.className = "bf-world";
    this.world.dataset.terrain = MISSIONS[s.mission]!.terrain;
    viewport.dataset.terrain = this.world.dataset.terrain;
    viewport.replaceChildren(this.world);
    this.mini = document.querySelector<SVGSVGElement>("#bf-minimap")!;
    this.mini.replaceChildren();
    this.mini.setAttribute("viewBox", `0 0 ${s.board.cols} ${s.board.rows}`);
    for (let i = 0; i < s.board.tiles.length; i++) {
      const el = document.createElement("div");
      el.className = "bf-tile";
      el.dataset.cell = String(i);
      this.world.append(el);
      this.cells.push(el);
    }
    for (const side of [0, 1]) {
      const base = document.createElement("div");
      base.className = "bf-base";
      base.dataset.side = String(side);
      if (side === s.side) base.classList.add("own");
      const p = point(s.board, s.board.bases[side]!);
      base.style.left = `${(p.x / s.board.cols) * 100}%`;
      base.style.top = `${(p.y / s.board.rows) * 100}%`;
      base.innerHTML = `<span>HQ ${side === 0 ? "A" : "B"}</span><i></i>`;
      this.world.append(base);
    }
    if (MISSIONS[s.mission]!.objective === "hold") {
      const n = document.createElement("div");
      n.className = "bf-objective";
      const p = point(s.board, s.board.center);
      n.style.left = `${(p.x / s.board.cols) * 100}%`;
      n.style.top = `${(p.y / s.board.rows) * 100}%`;
      n.textContent = "HOLD";
      this.world.append(n);
    }
    for (const u of s.units) {
      const node = document.createElement("button");
      node.className = "bf-tank";
      node.dataset.unit = String(u.id);
      node.style.setProperty("--team", colors[u.side]!);
      if (u.side !== s.side) node.classList.add("enemy");
      else if (u.id !== s.side * s.per) {
        const n = document.createElement("b");
        n.className = "bf-n";
        n.textContent = String(u.id % s.per);
        node.append(n);
      }
      node.setAttribute(
        "aria-label",
        `${u.side === s.side ? "Friendly" : "Enemy"} ${u.role} tank ${(u.id % s.per) + 1}`,
      );
      const canvas = document.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      node.append(canvas);
      const health = document.createElement("i");
      health.className = "bf-health";
      node.append(health);
      node.addEventListener("click", (e) => {
        e.stopPropagation();
        onUnit(u.id);
      });
      this.world.append(node);
      this.units.set(u.id, { node, canvas, ctx: canvas.getContext("2d")! });
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      circle.setAttribute("r", u.id === s.side * s.per ? ".55" : ".34");
      circle.setAttribute("fill", colors[u.side]!);
      this.mini.append(circle);
      this.miniUnits.set(u.id, circle);
    }
    // Routes: one SVG in map units (viewBox = cols x rows), so lines never need a layout read.
    this.routeLayer = document.createElementNS(SVG, "svg");
    this.routeLayer.classList.add("bf-routes");
    this.routeLayer.setAttribute("viewBox", `0 0 ${s.board.cols} ${s.board.rows}`);
    this.routeLayer.setAttribute("preserveAspectRatio", "none");
    this.routeLayer.setAttribute("aria-hidden", "true");
    this.world.append(this.routeLayer);
    this.hintEl = document.createElement("b");
    this.hintEl.className = "bf-hint";
    this.hintEl.hidden = true;
    this.world.append(this.hintEl);
    this.reticle = document.createElement("i");
    this.reticle.className = "bf-reticle";
    this.reticle.hidden = true;
    this.world.append(this.reticle);
    this.camera = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    this.camera.setAttribute("fill", "none");
    this.camera.setAttribute("stroke", "#fff5ce");
    this.camera.setAttribute("stroke-width", ".18");
    this.mini.append(this.camera);
    const opts = { passive: true, signal: this.abort.signal };
    viewport.addEventListener("scroll", () => this.scrolled(), opts);
    addEventListener("scroll", () => this.measure(), opts);
    // Rails, drawers and fullscreen change the viewport box without a window resize.
    const ro = new ResizeObserver(() => this.measure());
    ro.observe(viewport);
    this.abort.signal.addEventListener("abort", () => ro.disconnect());
    this.resize();
    this.render(-1, false, true);
  }
  resize() {
    const { cols, rows } = this.s.board;
    this.tile =
      matchMedia("(pointer: coarse)").matches || innerWidth < 760
        ? 32
        : Math.min(
            this.viewport.clientWidth / cols,
            this.viewport.clientHeight / rows,
          );
    this.world.style.width = `${cols * this.tile}px`;
    this.world.style.height = `${rows * this.tile}px`;
    this.world.style.setProperty("--tile", `${this.tile}px`);
    this.world.style.gridTemplateColumns = `repeat(${cols},1fr)`;
    this.world.style.gridTemplateRows = `repeat(${rows},1fr)`;
    for (const k of this.s.pickups)
      this.kits.get(k.id)?.style.setProperty("transform", `translate(${k.x * this.tile}px,${k.y * this.tile}px)`);
    this.reticleKey = "";
    this.measure();
  }
  /** One deliberate layout read after size changes; pointer math uses the cache. */
  measure() {
    const v = this.viewport.getBoundingClientRect(),
      w = this.world.getBoundingClientRect();
    this.vw = this.viewport.clientWidth;
    this.vh = this.viewport.clientHeight;
    this.scrolled();
    this.vx = v.left;
    this.vy = v.top;
    this.ox = w.left - v.left + this.sl;
    this.oy = w.top - v.top + this.st;
  }
  scrolled() {
    this.sl = this.viewport.scrollLeft;
    this.st = this.viewport.scrollTop;
  }
  location(e: { clientX: number; clientY: number }) {
    return {
      x: (e.clientX - this.vx - this.ox + this.sl) / this.tile,
      y: (e.clientY - this.vy - this.oy + this.st) / this.tile,
    };
  }
  render(selected: number, paused: boolean, reduced = false) {
    const s = this.s,
      b = s.board;
    if (this.revision !== b.revision) {
      this.revision = b.revision;
      this.mini.querySelector("[data-terrain-map]")?.remove();
      const map = document.createElementNS("http://www.w3.org/2000/svg", "g");
      map.setAttribute("data-terrain-map", "");
      b.tiles.forEach((t, i) => {
        if (t === "ground" || t === "road") return;
        const r = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        r.setAttribute("x", String(i % b.cols));
        r.setAttribute("y", String(Math.floor(i / b.cols)));
        r.setAttribute("width", "1");
        r.setAttribute("height", "1");
        r.setAttribute("fill", MINI_BY[MISSIONS[s.mission]!.terrain]?.[t] ?? MINI[t] ?? "#ff2e88");
        map.append(r);
      });
      b.bases.forEach((id, side) => {
        const p = point(b, id),
          r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        r.setAttribute("x", String(p.x - 0.8));
        r.setAttribute("y", String(p.y - 0.8));
        r.setAttribute("width", "1.6");
        r.setAttribute("height", "1.6");
        r.setAttribute("fill", "none");
        r.setAttribute("stroke", colors[side]!);
        r.setAttribute("stroke-width", ".25");
        map.append(r);
      });
      this.mini.prepend(map);
      this.cells.forEach((n, i) => {
        n.dataset.kind = b.tiles[i];
        n.setAttribute("aria-label", b.tiles[i]!);
      });
    }
    for (const u of s.units) {
      const v = this.units.get(u.id)!;
      const alive = u.hp > 0;
      if (v.alive !== alive) {
        v.alive = alive;
        v.node.hidden = !alive;
        this.miniUnits.get(u.id)!.style.display = alive ? "" : "none";
      }
      if (!alive) continue;
      const move = `translate(${(u.x * this.tile - 24).toFixed(1)}px,${(u.y * this.tile - 24).toFixed(1)}px)`;
      if (v.move !== move) v.node.style.transform = v.move = move;
      const flags = `${u.id === selected}${u.id === s.side * s.per}`;
      if (v.flags !== flags) {
        v.flags = flags;
        v.node.classList.toggle("selected", u.id === selected);
        v.node.classList.toggle("commander", u.id === s.side * s.per);
      }
      const hp = Math.round((u.hp / u.maxHp) * 100);
      if (v.hp !== hp) v.node.style.setProperty("--hp", `${(v.hp = hp)}%`);
      const spriteKey = `${u.angle.toFixed(3)},${u.turret.toFixed(3)},${reduced ? 0 : Math.floor(u.tread) % 2},${u.recoil.toFixed(1)}`;
      if (spriteKey !== v.key) {
        v.key = spriteKey;
        v.ctx.clearRect(0, 0, 64, 64);
        this.drawTank(
          v.ctx,
          32,
          32,
          u.angle,
          u.turret,
          colors[u.side]!,
          reduced ? 0 : u.tread,
          u.recoil,
          false,
          u.role === "heavy" ? 1.2 : u.role === "scout" ? 0.85 : 1,
        );
      }
      // Minimap dots move in tenth-cell steps; sub-pixel updates are invisible there.
      const mx = Math.round(u.x * 10),
        my = Math.round(u.y * 10);
      if (v.mx !== mx || v.my !== my) {
        const m = this.miniUnits.get(u.id)!;
        m.setAttribute("cx", String((v.mx = mx) / 10));
        m.setAttribute("cy", String((v.my = my) / 10));
      }
    }
    const live = new Set<number>();
    for (const p of s.shots) live.add(p.id);
    for (const [id, n] of this.shots)
      if (!live.has(id)) {
        n.remove();
        this.shots.delete(id);
        this.shotPool.push(n);
      }
    for (const p of s.shots) {
      let n = this.shots.get(p.id);
      if (!n) {
        n = this.shotPool.pop() ?? document.createElement("i");
        n.className = "bf-shell";
        this.world.append(n);
        this.shots.set(p.id, n);
      }
      n.style.transform = `translate(${p.x * this.tile}px,${p.y * this.tile}px) rotate(${Math.atan2(p.vy, p.vx)}rad)`;
    }
    live.clear();
    for (const p of s.effects) live.add(p.id);
    for (const [id, n] of this.effects)
      if (!live.has(id)) {
        n.remove();
        this.effects.delete(id);
        this.effectPool.push(n);
      }
    for (const p of s.effects) {
      let n = this.effects.get(p.id);
      if (!n) {
        n = this.effectPool.pop() ?? document.createElement("i");
        n.className = "bf-burst";
        n.style.color = p.color;
        if (!n.firstChild) n.innerHTML = "<b></b><b></b><b></b><b></b>";
        this.world.append(n);
        this.effects.set(p.id, n);
      }
      const t = reduced ? 0 : (0.55 - p.life) / 0.55;
      n.style.transform = `translate(${p.x * this.tile}px,${p.y * this.tile}px) scale(${0.5 + t * 1.8})`;
      n.style.opacity = String(p.life / 0.55);
    }
    live.clear();
    for (const k of s.pickups) live.add(k.id);
    for (const [id, n] of this.kits)
      if (!live.has(id)) {
        n.remove();
        this.kits.delete(id);
      }
    for (const k of s.pickups)
      if (!this.kits.has(k.id)) {
        const n = document.createElement("i");
        n.className = "bf-kit";
        n.title = "Repair kit";
        n.style.transform = `translate(${k.x * this.tile}px,${k.y * this.tile}px)`;
        this.world.append(n);
        this.kits.set(k.id, n);
      }
    const t = this.tile,
      cam = `${(this.sl / t).toFixed(2)} ${(this.st / t).toFixed(2)} ${Math.min(b.cols, this.vw / t).toFixed(2)} ${Math.min(b.rows, this.vh / t).toFixed(2)}`;
    if (cam !== this.camKey) {
      this.camKey = cam;
      const [x, y, w, h] = cam.split(" ");
      this.camera.setAttribute("x", x!);
      this.camera.setAttribute("y", y!);
      this.camera.setAttribute("width", w!);
      this.camera.setAttribute("height", h!);
    }
    if (this.paused !== paused)
      this.world.dataset.paused = String((this.paused = paused));
  }
  /** Draw routes; rebuilt only when something about them changes (stops, squares, selection). */
  routes(list: RouteLine[]) {
    const key = JSON.stringify(list);
    if (key === this.routeKey) return;
    this.routeKey = key;
    const cols = this.s.board.cols,
      at = (c: number) => `${(c % cols) + 0.5},${Math.floor(c / cols) + 0.5}`,
      el = (tag: string, attrs: Record<string, string>, parent: Element = this.routeLayer) => {
        const n = document.createElementNS(SVG, tag);
        for (const k in attrs) n.setAttribute(k, attrs[k]!);
        parent.append(n);
        return n;
      };
    this.routeLayer.replaceChildren();
    // Selected last, so it draws on top.
    for (const r of [...list].sort((a, b) => Number(a.selected) - Number(b.selected))) {
      if (r.cells.length < 2) continue;
      const points = r.cells.map(at).join(" "),
        cls = `bf-route${r.selected ? " sel" : ""}${r.draft ? " draft" : ""}${r.bad ? " bad" : ""}`;
      if (r.selected) el("polyline", { class: "bf-route-hit", points });
      el("polyline", { class: cls, points, "vector-effect": "non-scaling-stroke" });
      const end = r.cells.at(-1)!,
        [x, y] = at(end).split(","),
        flag = el("g", { class: `bf-flag${r.selected ? " sel" : ""}${r.hq ? " hq" : ""}`, transform: `translate(${x} ${y})` });
      if (r.selected) flag.setAttribute("data-stop", String(r.stops.length - 1));
      el("circle", { class: "bf-grab", r: "0.9" }, flag);
      el("path", { d: "M-.05 .35V-.6h.6l-.15.2.15.2h-.6" }, flag);
      const label = el("text", { x: ".02", y: "-.29" }, flag);
      label.textContent = r.hq ? "HQ" : String(r.n);
      if (r.selected)
        r.stops.slice(0, -1).forEach((c, i) => {
          const [sx, sy] = at(c).split(",");
          el("circle", { class: "bf-grab", cx: sx!, cy: sy!, r: "0.8", "data-stop": String(i) });
          el("circle", { class: "bf-stop", cx: sx!, cy: sy!, r: ".3", "data-stop": String(i) });
        });
    }
  }
  /** A short instruction that rides above the selected tank (command mode). */
  hint(text: string, p: { x: number; y: number } | null) {
    const key = p && text ? `${text}|${(p.x * this.tile).toFixed(0)},${(p.y * this.tile).toFixed(0)}` : "";
    if (key === this.hintKey) return;
    this.hintKey = key;
    this.hintEl.hidden = !key;
    if (!key) return;
    if (this.hintEl.textContent !== text) this.hintEl.textContent = text;
    this.hintEl.style.transform = `translate(${(p!.x * this.tile).toFixed(0)}px,${(p!.y * this.tile - 30).toFixed(0)}px) translateX(-50%)`;
  }
  /** Aim reticle: auto (dashed, follows the auto target), unit lock, or square lock. */
  aim(mode: string, p: { x: number; y: number } | null) {
    const key = p ? `${mode}:${(p.x * this.tile).toFixed(1)},${(p.y * this.tile).toFixed(1)}` : "";
    if (key === this.reticleKey) return;
    this.reticleKey = key;
    this.reticle.hidden = !p;
    if (!p) return;
    this.reticle.dataset.mode = mode;
    this.reticle.style.transform = `translate(${p.x * this.tile}px,${p.y * this.tile}px)`;
  }
  /** Keep the command tank inside the middle of the view; eases toward it, writes only on change. */
  follow(p: { x: number; y: number }) {
    const t = this.tile,
      zx = this.vw * 0.18,
      zy = this.vh * 0.18,
      px = p.x * t - this.sl,
      py = p.y * t - this.st;
    let dx = 0,
      dy = 0;
    if (px < this.vw / 2 - zx) dx = px - (this.vw / 2 - zx);
    else if (px > this.vw / 2 + zx) dx = px - (this.vw / 2 + zx);
    if (py < this.vh / 2 - zy) dy = py - (this.vh / 2 - zy);
    else if (py > this.vh / 2 + zy) dy = py - (this.vh / 2 + zy);
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const maxX = Math.max(0, this.s.board.cols * t - this.vw),
      maxY = Math.max(0, this.s.board.rows * t - this.vh),
      left = Math.max(0, Math.min(maxX, this.sl + dx * 0.2)),
      top = Math.max(0, Math.min(maxY, this.st + dy * 0.2));
    if (Math.abs(left - this.sl) < 0.5 && Math.abs(top - this.st) < 0.5) return;
    this.viewport.scrollLeft = this.sl = left;
    this.viewport.scrollTop = this.st = top;
  }
  center() {
    const p = this.s.units[this.s.side * this.s.per]!;
    this.viewport.scrollTo({
      left: p.x * this.tile - this.vw / 2,
      top: p.y * this.tile - this.vh / 2,
      behavior: "instant",
    });
    this.scrolled();
  }
  highlight(id: number) {
    if (id === this.target) return;
    this.cells[this.target]?.classList.remove("target");
    this.cells[id]?.classList.add("target");
    this.target = id;
  }
  destroy() {
    this.abort.abort();
    this.world.remove();
    this.mini.replaceChildren();
    this.units.clear();
    this.kits.clear();
    this.shots.clear();
    this.effects.clear();
    this.shotPool.length = this.effectPool.length = 0;
  }
}
