import { tankSprites } from "../shared/sherman-sprites";
import { point, MISSIONS } from "./model";
import type { Battle } from "./model";
const colors = ["#75dca3", "#ee8586"];
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
    }
  >();
  shots = new Map<number, HTMLElement>();
  effects = new Map<number, HTMLElement>();
  shotPool: HTMLElement[] = [];
  effectPool: HTMLElement[] = [];
  tile = 36;
  revision = -1;
  pathStamp = "";
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
    viewport.replaceChildren(this.world);
    this.mini = document.querySelector<SVGSVGElement>("#bf-minimap")!;
    this.mini.replaceChildren();
    this.mini.setAttribute("viewBox", `0 0 ${s.board.cols} ${s.board.rows}`);
    for (let i = 0; i < s.board.tiles.length; i++) {
      const el = document.createElement("div");
      el.className = "bf-tile";
      el.dataset.cell = String(i);
      el.style.gridColumn = String((i % s.board.cols) + 1);
      el.style.gridRow = String(Math.floor(i / s.board.cols) + 1);
      this.world.append(el);
      this.cells.push(el);
    }
    for (const side of [0, 1]) {
      const base = document.createElement("div");
      base.className = "bf-base";
      base.dataset.side = String(side);
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
      node.setAttribute(
        "aria-label",
        `${u.side === s.side ? "Friendly" : "Enemy"} ${u.role} tank ${(u.id % 4) + 1}`,
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
      circle.setAttribute("r", u.id === s.side * 4 ? ".55" : ".34");
      circle.setAttribute("fill", colors[u.side]!);
      this.mini.append(circle);
      this.miniUnits.set(u.id, circle);
    }
    this.camera = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect",
    );
    this.camera.setAttribute("fill", "none");
    this.camera.setAttribute("stroke", "#fff5ce");
    this.camera.setAttribute("stroke-width", ".18");
    this.mini.append(this.camera);
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
  }
  location(e: { clientX: number; clientY: number }) {
    const r = this.world.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / this.tile,
      y: (e.clientY - r.top) / this.tile,
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
        r.setAttribute(
          "fill",
          t === "water"
            ? "#427dac"
            : t === "rock"
              ? "#8984bd"
              : t === "rubble"
                ? "#665778"
                : "#ab6597",
        );
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
    const path = s.units.find((u) => u.id === selected)?.path ?? [],
      stamp = selected + ":" + path.join(",");
    if (stamp !== this.pathStamp) {
      this.pathStamp = stamp;
      this.cells.forEach((n, id) =>
        n.classList.toggle("planned", path.includes(id)),
      );
    }
    for (const u of s.units) {
      const v = this.units.get(u.id)!;
      v.node.hidden = u.hp <= 0;
      v.node.style.transform = `translate(${u.x * this.tile - 24}px,${u.y * this.tile - 24}px)`;
      v.node.classList.toggle("selected", u.id === selected);
      v.node.classList.toggle("commander", u.id === s.side * 4);
      v.node.style.setProperty("--hp", `${(u.hp / u.maxHp) * 100}%`);
      const spriteKey = [
        u.angle.toFixed(3),
        u.turret.toFixed(3),
        reduced ? 0 : Math.floor(u.tread) % 2,
        u.recoil.toFixed(1),
      ].join(",");
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
      const m = this.miniUnits.get(u.id)!;
      m.setAttribute("cx", String(u.x));
      m.setAttribute("cy", String(u.y));
      m.style.display = u.hp > 0 ? "" : "none";
    }
    for (const [id, n] of this.shots)
      if (!s.shots.some((p) => p.id === id)) {
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
    for (const [id, n] of this.effects)
      if (!s.effects.some((p) => p.id === id)) {
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
    this.camera.setAttribute("x", String(this.viewport.scrollLeft / this.tile));
    this.camera.setAttribute("y", String(this.viewport.scrollTop / this.tile));
    this.camera.setAttribute(
      "width",
      String(Math.min(b.cols, this.viewport.clientWidth / this.tile)),
    );
    this.camera.setAttribute(
      "height",
      String(Math.min(b.rows, this.viewport.clientHeight / this.tile)),
    );
    this.world.dataset.paused = String(paused);
  }
  center() {
    const p = this.s.units.find((u) => u.id === this.s.side * 4)!;
    this.viewport.scrollTo({
      left: p.x * this.tile - this.viewport.clientWidth / 2,
      top: p.y * this.tile - this.viewport.clientHeight / 2,
      behavior: "instant",
    });
  }
  highlight(id: number) {
    for (const c of this.cells)
      c.classList.toggle("target", Number(c.dataset.cell) === id);
  }
  destroy() {
    this.world.remove();
    this.mini.replaceChildren();
    this.units.clear();
    this.shots.clear();
    this.effects.clear();
    this.shotPool.length = this.effectPool.length = 0;
  }
}
