/** Card and key icons drawn with the game's own Sherman sprite, in your team colour. Each icon has
 *  a fixed design box (in sprite pixels) and is drawn at 3x for crisp pixel edges. */
import { tankSprites } from "../shared/sherman-sprites";

const draw = tankSprites(document);
const UP = -Math.PI / 2;
/** Design box per icon (width x height in sprite pixels). */
const BOX: Record<string, [number, number]> = {
  platoon: [96, 72],
  loadout: [96, 72],
  plan: [96, 72],
  tank: [44, 32],
  side0: [44, 32],
  side1: [44, 32],
  "f-wedge": [60, 44],
  "f-line": [60, 44],
  "f-column": [60, 44],
  scout: [40, 32],
  medium: [40, 32],
  heavy: [40, 32],
};
const SCALE: Record<string, number> = { scout: 0.78, medium: 0.92, heavy: 1.08 };

type Colors = { team: string; a: string; b: string; yellow: string; cyan: string; ink: string };
function colors(root: HTMLElement): Colors {
  const css = getComputedStyle(root),
    v = (n: string) => css.getPropertyValue(n).trim();
  return { team: v("--team"), a: v("--team-a"), b: v("--team-b"), yellow: v("--yellow"), cyan: v("--cyan"), ink: v("--rim") || "#07060f" };
}
/** A dashed pixel line from point to point (horizontal or vertical runs only). */
function dashes(c: CanvasRenderingContext2D, pts: [number, number][], color: string) {
  c.fillStyle = color;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!,
      [x1, y1] = pts[i]!,
      len = Math.hypot(x1 - x0, y1 - y0),
      dx = (x1 - x0) / len,
      dy = (y1 - y0) / len;
    for (let t = 0; t < len; t += 7) {
      const run = Math.min(4, len - t);
      c.fillRect(Math.round(x0 + dx * t - (dy ? 1.5 : 0)), Math.round(y0 + dy * t - (dx ? 1.5 : 0)), dx ? run : 3, dy ? run : 3);
    }
  }
}
function paint(c: CanvasRenderingContext2D, kind: string, k: Colors) {
  const tank = (x: number, y: number, angle: number, color: string, scale = 1) =>
    draw(c, x, y, angle, angle, color, 0, 0, false, scale);
  if (kind === "platoon") {
    // Three tanks in a wedge, heading for the enemy: you at the tip.
    tank(48, 26, UP, k.team, 0.9);
    tank(22, 52, UP, k.team, 0.82);
    tank(74, 52, UP, k.team, 0.82);
  } else if (kind === "loadout") {
    // One heavy tank and its three weight classes as bars (scout, medium, heavy).
    tank(30, 38, UP, k.team, 1.18);
    for (const [i, w] of [14, 24, 34].entries()) {
      c.fillStyle = k.cyan;
      c.fillRect(56, 20 + i * 14, w, 6);
      c.fillStyle = k.yellow;
      c.fillRect(56 + w - 6, 18 + i * 14, 6, 10);
    }
  } else if (kind === "plan") {
    // A tank, its dashed route and the flag it drives to.
    dashes(c, [[30, 56], [52, 56], [52, 22], [78, 22]], k.yellow);
    tank(16, 56, 0, k.team, 0.7);
    c.fillStyle = k.ink;
    c.fillRect(77, 6, 5, 28);
    c.fillStyle = k.yellow;
    c.fillRect(78, 7, 3, 26);
    c.fillRect(81, 7, 13, 10);
    c.fillStyle = k.ink;
    c.fillRect(81, 17, 13, 1);
  } else if (kind.startsWith("f-")) {
    // Formations: four small tanks heading right, as they deploy (you are the brighter one).
    const at: Record<string, [number, number][]> = {
      "f-wedge": [[46, 22], [30, 9], [30, 35], [13, 22]],
      "f-line": [[28, 6], [28, 17], [28, 28], [28, 39]],
      "f-column": [[50, 22], [36, 22], [22, 22], [8, 22]],
    };
    for (const [i, [x, y]] of at[kind]!.entries()) tank(x, y, 0, i === 0 ? k.yellow : k.team, 0.5);
  } else if (kind in SCALE) tank(16, 16, 0, k.team, SCALE[kind]);
  else tank(16, 16, 0, kind === "side0" ? k.a : kind === "side1" ? k.b : k.team, 0.9);
}
/** (Re)draw every icon on the page: on load, and when your side or the theme changes. */
export function drawIcons(root: HTMLElement) {
  const k = colors(root),
    key = Object.values(k).join();
  for (const n of root.querySelectorAll<HTMLCanvasElement>("canvas[data-icon]")) {
    const kind = n.dataset.icon!,
      box = BOX[kind] ?? [44, 32];
    if (n.dataset.drawn === key) continue;
    n.dataset.drawn = key;
    n.width = box[0] * 3;
    n.height = box[1] * 3;
    n.style.aspectRatio = `${box[0]} / ${box[1]}`;
    const c = n.getContext("2d")!;
    c.setTransform(3, 0, 0, 3, 0, 0);
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, box[0], box[1]);
    paint(c, kind, k);
  }
}
/** Dice face pips (1-6) on a 20x20 die. */
const PIPS: Record<number, [number, number][]> = {
  1: [[10, 10]],
  2: [[6.5, 6.5], [13.5, 13.5]],
  3: [[6, 6], [10, 10], [14, 14]],
  4: [[6.5, 6.5], [13.5, 6.5], [6.5, 13.5], [13.5, 13.5]],
  5: [[6, 6], [14, 6], [10, 10], [6, 14], [14, 14]],
  6: [[6.5, 5.5], [13.5, 5.5], [6.5, 10], [13.5, 10], [6.5, 14.5], [13.5, 14.5]],
};
export function dieFace(svg: SVGSVGElement, face: number) {
  svg.innerHTML =
    `<rect x="2" y="2" width="16" height="16" rx="3.5" />` +
    PIPS[face]!.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.5" fill="currentColor" stroke="none" />`).join("");
}
/** Roll: the die tumbles through a few faces and lands on a new one. */
export function rollDie(button: HTMLElement) {
  const svg = button.querySelector<SVGSVGElement>(".bf-die");
  if (!svg) return;
  button.classList.remove("roll");
  void button.offsetWidth;
  button.classList.add("roll");
  let n = 0;
  const tick = () => {
    dieFace(svg, 1 + Math.floor(Math.random() * 6));
    if (++n < 5) setTimeout(tick, 70);
  };
  tick();
}
