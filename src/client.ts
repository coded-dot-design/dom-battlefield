import {
  generate,
  createBattle,
  loadoutCost,
  command,
  step,
  MISSIONS,
  ROLES,
  cell,
  solid,
  point,
  commander,
  plot,
  moveBase,
  hqLimit,
  scatterHq,
} from "./model";
import { drawIcons, dieFace, rollDie } from "./icons";
import type { Battle, Role, Order, Input } from "./model";
import { View } from "./view";
import type { RouteLine } from "./view";
import { createGameAudio } from "../shared/audio";
import { createMobileSelectionLock } from "../shared/selection-lock";
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const viewport = $("#bf-viewport"),
  setup = $("#bf-setup"),
  status = $("#bf-status"),
  announcement = $("#bf-announcement");
let mission = 0,
  side = 0,
  seed = 1207,
  density = 0.6,
  formation = "wedge",
  per = 4,
  roles: Role[] = ["medium", "scout", "medium", "heavy"];
/* Setup sticks between visits: location, terrain and the whole strategy (side, formation, squad
   size, loadout). Restarting is just: pick a place, then Plan strategy or Quick battle. */
const SETUP = "dom-battlefield:setup";
try {
  const saved = JSON.parse(localStorage.getItem(SETUP) || "null");
  if (saved) {
    if (saved.mission >= 0 && saved.mission < 4) mission = saved.mission;
    if (saved.side === 0 || saved.side === 1) side = saved.side;
    if ([0.6, 1, 1.45].includes(saved.density)) density = saved.density;
    if (Number.isInteger(saved.seed)) seed = saved.seed;
    if (["wedge", "line", "column"].includes(saved.formation)) formation = saved.formation;
    if ([4, 8, 12].includes(saved.per)) per = saved.per;
    if (Array.isArray(saved.roles) && saved.roles.length === 4 && saved.roles.every((r: string) => r in ROLES)) roles = saved.roles;
  }
} catch {}
/** A moved HQ belongs to one map: same location, layout, density, squad size and side. */
let hqMove: { key: string; cell: number } | null = null,
  hqPick = false;
/** Step 1 starts on an empty grid: the ground appears once you pick a location. */
let picked = false;
/** Planning cards: home (Platoon / Loadout / Plan), one of the two settings cards, or Plan
 *  (directing tanks, with Move HQ / Move Tanks). */
type Panel = "home" | "platoon" | "loadout" | "plan";
let panel: Panel = "home";
/** Command: the selected tank's Command (flag) button is on, waiting for a tap on the map. */
let armed = false;
/** Touch: auto-aim stays on until you switch it off (a lock overrides it while it lasts). */
let autoOn = true;
/** A moved HQ belongs to one map, including its size (the cell index means nothing on another). */
const mapKey = (cols = state?.board.cols, rows = state?.board.rows) => `${mission}:${seed}:${density}:${per}:${side}:${cols}x${rows}`;
function remember() {
  if (quickSaved) return;
  try {
    localStorage.setItem(SETUP, JSON.stringify({ mission, side, density, seed, formation, per, roles }));
  } catch {}
}
let state: Battle,
  view: View,
  playing = false,
  paused = false,
  selected = -1,
  pan = false,
  frame = 0,
  last = 0,
  uiAt = 0,
  accumulator = 0,
  hiddenPause = false,
  // Command mode: direct the squad (your gun is off, time runs at half speed). Planning is the
  // same tool before the battle starts, with time frozen.
  commanding = false,
  planning = false,
  draft: { id: number; stops: number[] } | null = null;
/** Wingmen are numbered 1..per-1 (the command tank is 0, "you"). */
const tankNo = (id: number) => id % state.per;
/** "Your tank" for the command tank, "Tank n" for a wingman. */
const tankName = (id: number) => (id === commander(state).id ? "Your tank" : `Tank ${tankNo(id)}`);
const root = document.querySelector<HTMLElement>("#battlefield")!;
/** One place that says which screen and which layout we're in; CSS keys off both. */
function syncUi() {
  const ui = railLayout.matches ? "touch" : "desk",
    stage = !playing ? "setup" : planning ? "plan" : "battle";
  if (root.dataset.ui !== ui) root.dataset.ui = ui;
  if (root.dataset.stage !== stage) root.dataset.stage = stage;
  if (root.dataset.panel !== panel) root.dataset.panel = panel;
  if (view) view.fitAll = ui === "desk" || stage !== "battle";
}
/** A platoon key's inside: the tank number over 1-3 size pips. */
const PIPS: Record<string, number> = { scout: 1, medium: 2, heavy: 3 };
const unitKey = (role: string, no: string) => `<b>${no}</b><i class="bf-pips" data-n="${PIPS[role]}">${"<s></s>".repeat(PIPS[role] ?? 1)}</i>`;
const healthTone = (u: { hp: number; maxHp: number }) =>
  u.hp <= 0 ? "lost" : u.hp / u.maxHp > 0.6 ? "ok" : u.hp / u.maxHp > 0.3 ? "hurt" : "critical";
const audio = createGameAudio(document, "battlefield");
/** Player aim: auto (nearest visible enemy), pointer (mouse), a locked tank, or a locked square. */
type Aim =
  | { mode: "auto" | "pointer" | "free" }
  | { mode: "unit"; id: number }
  | { mode: "cell"; x: number; y: number };
let follow = true,
  stick = { id: -1, x: 0, y: 0, cx: 0, cy: 0, r: 1 };
/** Short haptic taps where supported (Android); iOS Safari has no vibration API. */
function buzz(pattern: number | number[]) {
  if (coarse.matches && "vibrate" in navigator) navigator.vibrate(pattern);
}
let aim: Aim = { mode: "auto" },
  picking = false,
  pointer: { x: number; y: number } | null = null;
const input: Input = { x: 0, y: 0, fire: false, aim: null },
  keys = new Set<string>(),
  held = new Set<string>(),
  touch = new Map<number, string>(),
  lease = createMobileSelectionLock(document),
  abort = new AbortController();
const coarse = matchMedia("(pointer: coarse)"),
  /** Phones and small tablets (and very narrow windows) get the touch layout. */
  railLayout = matchMedia("(pointer: coarse) and (max-width: 1400px), (max-width: 759px)"),
  TIPS = "dom-battlefield:tips";
const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
  options = { signal: abort.signal };
function listen(target: EventTarget, type: string, fn: EventListener) {
  target.addEventListener(type, fn, options);
}
/** After a touch press, the browser may still send a click when the finger lifts, and by then the
 *  layout may have changed under it (the menu drops the header in; pause shows the dim). That
 *  click is swallowed wherever it lands, so a press acts exactly once. */
let swallowId = -1,
  swallowUntil = 0;
document.addEventListener(
  "pointerup",
  (e) => {
    if (e.pointerId === swallowId) (swallowId = -1), (swallowUntil = performance.now() + 500);
  },
  { capture: true, signal: abort.signal },
);
document.addEventListener(
  "click",
  (e) => {
    if (performance.now() < swallowUntil) {
      swallowUntil = 0;
      e.preventDefault();
      e.stopPropagation();
    }
  },
  { capture: true, signal: abort.signal },
);
/** Touch screens send native touch events, which iOS delivers reliably to every finger even while
 *  another is driving; pointer events can be cancelled there when a second finger reads as a
 *  pinch. Controls listen to touches first (and cancel them, so no zoom, scroll or click follows). */
const touchEvents = "ontouchstart" in window,
  active = { signal: abort.signal, passive: false };
/** Brief pressed look for a key the finger only taps (iOS shows no :active for it). */
function flash(el: HTMLElement) {
  el.classList.add("down");
  setTimeout(() => el.classList.remove("down"), 140);
}
/** A key that works while another finger is down (driving with the stick or held keys): touch
 *  presses act the moment the finger lands, like Fire. Mouse and keyboard use click. */
function press(el: HTMLElement, fn: () => void) {
  el.addEventListener(
    "touchstart",
    (e) => {
      if (!e.cancelable) return; // the click that follows will act
      e.preventDefault();
      flash(el);
      fn();
    },
    active,
  );
  listen(el, "pointerdown", ((e: PointerEvent) => {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return;
    if (e.pointerType === "touch" && touchEvents) return;
    e.preventDefault();
    swallowId = e.pointerId;
    fn();
  }) as EventListener);
  listen(el, "click", () => fn());
}
let toastTimer = 0;
function say(text: string) {
  if (announcement.textContent === text) return;
  announcement.textContent = text;
  // Touch: comms is a radio toast. It shows briefly, then fades; tap or swipe it away sooner.
  if (text) {
    const f = $(".bf-footer");
    f.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => f.classList.remove("show"), Math.min(5200, 1800 + text.length * 40));
  }
  // The comms LED blinks once per new message: noticed, not distracting.
  const led = document.querySelector<HTMLElement>(".bf-comms-led");
  if (led) (led.classList.remove("rx"), void led.offsetWidth, led.classList.add("rx"));
}
/** HUD text writes are skipped when unchanged so the 6Hz HUD costs no style work. */
function text(sel: string, value: string) {
  const n = $(sel);
  if (n.textContent !== value) n.textContent = value;
}
function tipsOff() {
  try {
    return localStorage.getItem(TIPS) === "off";
  } catch {
    return false;
  }
}
/** Touch tips: one short label per rail control, and a line more on tap. */
const TOUCH_TIPS: [string, string, string][] = [
  ["#bf-squad", "Menu", "Pauses, and shows the header: tips, full screen, sound, theme, eject."],
  ["#bf-pause", "Surrender", "Pauses the battle and asks: keep fighting, or wave the white flag."],
  ["#bf-command", "Command", "Half speed. The right rail slides away: tap a tank, then give it an order. Tap again to fight."],
  ["#bf-center", "Center", "Snap the camera back to your tank and follow it."],
  ["#bf-pan", "Pan", "Drag the map to look around. Tap again to stop."],
  ["#bf-stick", "Drive", "Drag any way. A small push creeps, a full push is top speed."],
  [".bf-mini", "Sector map", "The whole field. Tap it to look there."],
  ["[data-order=attack]", "Attack", "The squad attacks your locked tank, or hunts the nearest enemy."],
  ["[data-order=retreat]", "Retreat", "Back to HQ to repair."],
  ["[data-order=advance]", "Advance", "Push to the objective."],
  ["[data-order=follow]", "Fall in", "The squad forms up on you."],
  ["#bf-auto", "Auto-aim", "On: fire at the nearest enemy you can see. Off: the gun points where you drive."],
  ["#bf-target", "Lock", "Tap it, then an enemy tank or a square: you keep firing there. Tap again to release."],
  [".bf-fire", "Fire", "Hold to keep firing."],
];
/** Touch: labels sit just inside the field, beside their rail, at their control's height, and
 *  stack downwards where two would collide. Their notes open under them. */
function lineUp(layer: HTMLElement) {
  const tips = [...layer.querySelectorAll<HTMLElement>(".bf-coach-tip")].map((tip) => {
      const r = tip.getBoundingClientRect();
      return { tip, r, left: r.left + r.width / 2 < innerWidth / 2 };
    }),
    edge = (left: boolean) =>
      left ? Math.max(...tips.filter((t) => t.left).map((t) => t.r.right)) : Math.min(...tips.filter((t) => !t.left).map((t) => t.r.left));
  for (const left of [true, false]) {
    const x = edge(left);
    let floor = -Infinity;
    for (const t of tips.filter((t) => t.left === left).sort((a, b) => a.r.top + a.r.height / 2 - b.r.top - b.r.height / 2)) {
      const label = t.tip.querySelector<HTMLElement>(".bf-tip-label")!,
        note = t.tip.querySelector<HTMLElement>("p")!,
        h = label.offsetHeight,
        y = Math.max(floor, t.r.top + t.r.height / 2 - h / 2);
      floor = y + h + 4;
      for (const n of [label, note]) {
        n.style.translate = "none";
        n.style.top = `${(n === note ? y + h + 4 : y) - t.r.top}px`;
        n.style.left = left ? `${x + 8 - t.r.left}px` : "auto";
        n.style.right = left ? "auto" : `${t.r.right - x + 8}px`;
      }
    }
  }
}
/** Tip labels and their notes never leave the screen: nudge each one back inside. */
function keepOnScreen(layer: HTMLElement) {
  const pad = 6;
  for (const n of layer.querySelectorAll<HTMLElement>(".bf-tip-label, .bf-coach-tip > p")) {
    n.style.marginLeft = n.style.marginTop = "";
    if (!n.getClientRects().length) continue;
    const r = n.getBoundingClientRect(),
      dx = r.left < pad ? pad - r.left : r.right > innerWidth - pad ? innerWidth - pad - r.right : 0,
      dy = r.top < pad ? pad - r.top : r.bottom > innerHeight - pad ? innerHeight - pad - r.bottom : 0;
    if (dx) n.style.marginLeft = `${dx}px`;
    if (dy) n.style.marginTop = `${dy}px`;
  }
}
let coachTimer = 0,
  coachPaused = false;
/** Button tips: dotted rings and labels on each visible control. They wait until the layout has
 *  stopped moving (full screen, rotation, rails), re-place on resize, stay until dismissed, and
 *  each label opens a longer explanation on tap. */
function coach(show: boolean) {
  const layer = $("#bf-coach");
  cancelAnimationFrame(coachTimer);
  layer.querySelectorAll(".bf-coach-tip").forEach((n) => n.remove());
  layer.hidden = !show;
  if (!show) {
    if (coachPaused) setPause(false);
    coachPaused = false;
    return;
  }
  if (playing && !paused) {
    setPause(true);
    coachPaused = true;
  }
  // Touch labels each rail control on its own (the groups are split across both rails);
  // desktop labels the groups in the bottom bar.
  const touchUi = root.dataset.ui === "touch";
  const tipOf = (n: HTMLElement) => (touchUi ? TOUCH_TIPS.find(([sel]) => n.matches(sel)) : undefined);
  const controls = () =>
    (touchUi
      ? TOUCH_TIPS.map(([sel]) => document.querySelector<HTMLElement>(sel)!).filter(Boolean)
      : [...document.querySelectorAll<HTMLElement>("#battlefield [data-tip]")]
    ).filter((n) => n.getClientRects().length > 0 && n.getBoundingClientRect().width > 0);
  const place = () => {
    layer.querySelectorAll(".bf-coach-tip").forEach((n) => n.remove());
    const mid = innerWidth / 2;
    for (const n of controls()) {
      const r = n.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const tip = document.createElement("div");
      tip.className = "bf-coach-tip";
      tip.style.cssText = `left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px`;
      const left = r.left + r.width / 2 < mid,
        t = tipOf(n);
      tip.dataset.at = touchUi ? (left ? "right" : "left") : (n.dataset.tipAt ?? (r.top < 60 ? (left ? "below" : "below-r") : left ? "right" : "left"));
      const label = document.createElement("button");
      label.className = "bf-tip-label";
      label.textContent = t ? t[1] : n.dataset.tip!;
      label.setAttribute("aria-expanded", "false");
      const more = document.createElement("p");
      more.textContent = t ? t[2] : (n.dataset.tipMore ?? "");
      tip.append(label, more);
      layer.append(tip);
    }
    if (touchUi) lineUp(layer);
    keepOnScreen(layer);
  };
  // Wait for a stable layout: the tip targets must not move for 8 frames in a row (max ~1.5 s).
  let last = "",
    still = 0,
    frames = 0;
  const settle = () => {
    if (layer.hidden) return;
    const key = controls().map((n) => { const r = n.getBoundingClientRect(); return `${r.left|0},${r.top|0},${r.width|0}`; }).join();
    still = key === last ? still + 1 : 0;
    last = key;
    if (still >= 8 || ++frames > 90) return place();
    coachTimer = requestAnimationFrame(settle);
  };
  void document.fonts.ready.then(() => (coachTimer = requestAnimationFrame(settle)));
}
function fit() {
  if (!view) return;
  view.resize();
  view.render(selected, paused, reduced.matches);
  mapTools();
}
/** Center and Pan only matter when the map is bigger than the screen. */
function mapTools() {
  const w = view.world, v = viewport;
  $("#battlefield").classList.toggle("map-fits", w.offsetWidth <= v.clientWidth + 1 && w.offsetHeight <= v.clientHeight + 1);
}
/** The field size the screen allows (clamped like generate()). */
function mapSize() {
  const touchMap = innerWidth < 760 || coarse.matches,
    grow = per === 12 ? 12 : per === 8 ? 6 : 0,
    unit = per === 12 ? 28 : per === 8 ? 32 : 36,
    // Touch: a fixed number of rows, and as many columns as the screen's shape asks for, so
    // the whole field fills the screen while you set up and plan (the battle then zooms in).
    rows = touchMap ? 16 + grow / 2 : Math.floor(viewport.clientHeight / unit),
    cols = touchMap
      ? Math.round((rows * viewport.clientWidth) / Math.max(1, viewport.clientHeight))
      : Math.floor(viewport.clientWidth / unit);
  return { cols: Math.max(18, Math.min(48, cols)), rows: Math.max(14, Math.min(30, rows)) };
}
/** The screen's safe-area insets (notch, camera, rounded corners), read once per layout. */
let safe = { l: 0, r: 0, t: 0, b: 0 };
function readSafe() {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0) env(safe-area-inset-right,0) env(safe-area-inset-bottom,0) env(safe-area-inset-left,0)";
  document.body.append(probe);
  const c = getComputedStyle(probe);
  safe = { l: parseFloat(c.paddingLeft) || 0, r: parseFloat(c.paddingRight) || 0, t: parseFloat(c.paddingTop) || 0, b: parseFloat(c.paddingBottom) || 0 };
  probe.remove();
}
readSafe();
/** HQ columns from the edge: 2 on desktop; on touch, past the safe area plus a finger's width. */
function hqInset(cols: number, rows: number) {
  if (!railLayout.matches) return 2;
  const tile = Math.min(viewport.clientWidth / cols, viewport.clientHeight / rows) || 20;
  return Math.max(4, Math.ceil((Math.max(safe.l, safe.r) + 18) / tile) + 1);
}
function preview(resized = false) {
  // Setup, or a strategy change during the plan step (same seed, so the same ground).
  if (playing && !planning) return;
  // The field fills the space it has (full screen adds squares); bigger squads get a bigger
  // field; the camera already scrolls on touch.
  syncUi();
  const { cols, rows } = mapSize();
  // Planning: a resize that doesn't change the map size (address bars, rails) just re-fits.
  // Planning: a resize (address bar, full screen, rotation) only re-fits. Routes and the ground
  // you planned on stay as they are.
  if (resized && planning && state) return fit();
  view?.destroy();
  $("#bf-roster").replaceChildren();
  // Phones: the HQs (and the platoons in front of them) sit far enough in from the edges to
  // clear the notch, so every tank can be tapped. The enemy HQ moves round its own zone.
  const inset = hqInset(cols, rows),
    b = generate(cols, rows, mission, seed, density, inset);
  scatterHq(b, 1 - side, seed, inset);
  if (hqMove && hqMove.key === mapKey(cols, rows)) moveBase(b, side, hqMove.cell);
  state = createBattle(
    b,
    mission,
    side,
    loadoutCost(roles) <= 12 ? roles : ["medium", "medium", "medium", "medium"],
    formation,
    per,
  );
  // Step 1 before a location is picked: an empty grid with the two HQs, nothing else.
  if (!picked && !playing) b.tiles.fill("ground"), b.health.fill(0), b.revision++;
  root.dataset.side = String(side);
  root.toggleAttribute("data-blank", !picked && !playing);
  view = new View(viewport, state, selectUnit);
  syncUi();
  view.resize();
  view.center();
  mapTools();
  $("#bf-operation").textContent = picked || playing ? MISSIONS[mission]!.name : "Pick a location";
  const cost = loadoutCost(roles),
    over = cost > 12;
  $("#bf-points").textContent = `${cost} / 12 points`;
  root.classList.toggle("bf-over", over);
  for (const n of document.querySelectorAll<HTMLElement>("[data-badge=per]")) n.textContent = String(per);
  for (const n of document.querySelectorAll<HTMLElement>("[data-badge=pts]")) n.textContent = String(cost);
  for (const slot of document.querySelectorAll<HTMLElement>("[data-slot]")) {
    const pips = slot.querySelector<HTMLElement>(".bf-pips")!,
      n = String(PIPS[roles[Number(slot.dataset.slot)]!] ?? 2);
    if (pips.dataset.n !== n) (pips.dataset.n = n), (pips.innerHTML = "<s></s>".repeat(Number(n)));
  }
  for (const n of document.querySelectorAll<HTMLElement>("[data-slot] [data-role]"))
    n.setAttribute(
      "aria-pressed",
      String(roles[Number(n.closest<HTMLElement>("[data-slot]")!.dataset.slot)] === n.dataset.role),
    );
  for (const id of ["#bf-deploy", "#bf-quick", "#bf-start"]) $<HTMLButtonElement>(id).disabled = over;
  $("#bf-cost-error").textContent = over ? "Over budget: downgrade a tank before you deploy." : "";
  $("#bf-objective-label").textContent =
    MISSIONS[mission]!.objective === "capture"
      ? "CAPTURE HQ / 12s"
      : MISSIONS[mission]!.objective === "hold"
        ? "HOLD CROSSROADS / 45s"
        : "ELIMINATE OPPOSING PLATOON";
  remember();
  drawIcons(root);
  updateHUD();
  if (planning) {
    selected = -1;
    draft = null;
    armed = false;
    if (panel === "plan") nextTank();
    // A side change moves the cards to the other side.
    showCards();
    cmdPanel();
  }
}
function selectUnit(id: number, fromList = false) {
  if (!playing || paused || pan) return;
  // Planning: tapping one of your tanks from any card jumps straight to Plan (Move Tanks).
  if (planning && hqPick) return say("Move HQ is on: tap behind the dashed line, or switch to Move Tanks.");
  const u = state.units.find((u) => u.id === id);
  if (!u || u.hp <= 0) return;
  if (planning && panel !== "plan" && u.side === side) showPanel("plan", false);
  armed = false;
  if (u.side !== side) {
    // Tapping an enemy: with a wingman selected, it attacks that tank. Outside command mode
    // your own aim locks on too.
    if (!commanding) lockUnit(u.id);
    if (selected >= 0 && selected !== commander(state).id) {
      command(state, { type: "focus", ids: [selected], target: u.id });
      draft = { id: selected, stops: [] };
      say(`Tank ${tankNo(selected)} attacking that tank.`);
      cmdPanel();
    }
    return;
  }
  if (draft && draft.id !== id) commitDraft();
  // Your own tank can take a route too: in Command (or from its key in the platoon list).
  // Outside Command, tapping it on the field just deselects.
  const own = u.id === commander(state).id,
    routeOwn = own && (commanding || planning || fromList);
  // Tapping a tank mid-battle opens Command on it: see its route, change it.
  if (!commanding && !planning && (!own || fromList)) setCommand(true, false);
  selected = own && !routeOwn ? -1 : id;
  draft = selected < 0 ? null : { id: selected, stops: [...u.route] };
  $("#bf-order-label").textContent =
    selected < 0 || own ? "ORDERS · WHOLE SQUAD" : `ORDERS · TANK ${tankNo(id)}`;
  say(
    selected < 0
      ? "Squad selected."
      : own
        ? "Your tank: tap a square to set its route. Steer any time to take over; let go and it drives on."
        : commanding
          ? `Tank ${tankNo(id)}: tap a square to send it, or Attack HQ.`
          : `Tank ${tankNo(id)}: tap a square to move, or an enemy to attack it.`,
  );
  setMenu(false);
  cmdPanel();
  view.render(selected, paused, reduced.matches);
}
function aimButtons() {
  const touch = railLayout.matches;
  // Touch: Auto is a switch that stays on (through command mode and locks) until you turn it off.
  $("#bf-auto").setAttribute("aria-pressed", String(touch ? autoOn : !commanding && aim.mode === "auto"));
  $("#bf-target").setAttribute("aria-pressed", String((touch || !commanding) && (picking || aim.mode === "unit" || aim.mode === "cell")));
  $("#bf-command").setAttribute("aria-pressed", String(commanding));
  $("#battlefield").classList.toggle("picking", picking);
  $("#battlefield").classList.toggle("commanding", commanding);
}
function setAim(next: Aim, message?: string) {
  // Desktop: aim and command are one switch, so picking an aim mode leaves command mode.
  if (commanding && !planning && !railLayout.matches) setCommand(false);
  // Touch: "back to auto" means back to whatever the Auto switch says.
  if (next.mode === "auto" && railLayout.matches && !autoOn) next = { mode: "free" };
  aim = next;
  picking = false;
  input.aim = null;
  aimButtons();
  if (message) say(message);
}
function lockUnit(id: number) {
  setAim({ mode: "unit", id }, "Aim locked on that tank. It returns to auto-aim when the tank is destroyed.");
}
function autoAim() {
  if (railLayout.matches) {
    // Touch: a switch. Off means the gun points where the tank drives; a lock still overrides.
    autoOn = !autoOn;
    if (aim.mode === "auto" || aim.mode === "free") setAim({ mode: autoOn ? "auto" : "free" });
    else aimButtons();
    return say(autoOn ? "Auto-aim on: nearest visible enemy." : "Auto-aim off: the gun points where you drive.");
  }
  // On desktop, Auto toggles back to mouse aiming.
  if (aim.mode === "auto") setAim({ mode: "pointer" }, "Mouse aim.");
  else setAim({ mode: "auto" }, "Auto-aim: nearest visible enemy.");
}
function startPick() {
  if (!playing || paused || planning) return;
  if (picking || aim.mode === "unit" || aim.mode === "cell") return setAim({ mode: "auto" }, autoOn || !railLayout.matches ? "Lock released. Auto-aim." : "Lock released.");
  picking = true;
  aimButtons();
  say("Lock aim: tap an enemy tank, or any square to keep shooting there.");
}
/** Resolve the aim point each frame; a destroyed lock falls back to auto-aim. */
function resolveAim() {
  if (aim.mode === "unit") {
    const id = aim.id,
      t = state.units.find((u) => u.id === id && u.hp > 0);
    if (!t) {
      setAim({ mode: "auto" }, "Target destroyed. Back to auto-aim.");
      return null;
    }
    return { x: t.x, y: t.y };
  }
  if (aim.mode === "cell") return { x: aim.x, y: aim.y };
  if (aim.mode === "pointer") return pointer;
  if (aim.mode === "free") {
    const u = commander(state);
    return { x: u.x + Math.cos(u.angle) * 4, y: u.y + Math.sin(u.angle) * 4 };
  }
  return null;
}
/** Touch battle menu: the header drops in over the paused field. */
function setMenu(open: boolean) {
  root.classList.toggle("menu-open", open);
  $("#bf-squad").setAttribute("aria-expanded", String(open));
  pauseButton();
}
/** Command mode on/off. Your gun stops and time halves, so directing the squad is a risk. */
function setCommand(on: boolean, pick = true) {
  if (planning && !on && panel === "plan") return;
  if (!on) commitDraft();
  commanding = on;
  picking = false;
  armed = false;
  if (!on) {
    // Back to fighting: squad orders go to the whole squad again.
    selected = -1;
    draft = null;
    $("#bf-order-label").textContent = "ORDERS · WHOLE SQUAD";
    $("#bf-cmd").hidden = true;
    if (!planning) follow = true;
  } else {
    if (selected < 0 && pick) nextTank();
    say(
      planning
        ? "Plan your attack: tap a tank, then the map. Check locks the route; the arrow moves on."
        : railLayout.matches
          ? "Command mode: half speed. Tap a tank to direct it. Tap Command again to fight."
          : "Command mode: half speed, your gun is off. Direct a tank, then switch back to Auto.",
    );
  }
  aimButtons();
  cmdPanel();
}
function wingmen() {
  return state.units.filter((u) => u.side === side && u.id !== commander(state).id && u.hp > 0);
}
function nextTank() {
  const list = wingmen();
  if (!list.length) return;
  const i = list.findIndex((u) => u.id === selected);
  selectUnit(list[(i + 1) % list.length]!.id);
}
/** The draft's square-by-square line (from the tank), or null if a stop is unreachable. */
function draftCells() {
  if (!draft) return null;
  const u = state.units[draft.id]!;
  return plot(state.board, cell(state.board, u), draft.stops);
}
const dirty = () =>
  !!draft && draft.stops.join() !== state.units[draft.id]!.route.join();
function setDest(id: number) {
  if (!draft) return say("Tap one of your numbered tanks first.");
  if (solid(state.board.tiles[id]!)) return say("Blocked square. Choose open ground.");
  const before = draft.stops;
  draft.stops = [...before.slice(0, -1), id];
  if (!draftCells()) {
    draft.stops = before;
    return say("Unreachable from here. Choose another square.");
  }
  armed = false;
  if (draft.stops.length === 1 && before.length === 0) say("Flag planted. Drag the line or the flag to adjust, then tap the check.");
  cmdPanel();
}
/** Moving on (another tank, Start, leaving Command) never throws a drawn route away. */
function commitDraft() {
  if (draft && dirty() && draft.stops.length && draftCells()) {
    lockRoute();
    say(`${tankName(draft.id)}: route locked.`);
  }
}
function lockRoute() {
  if (!draft || !draft.stops.length || !dirty()) return;
  if (command(state, { type: "route", id: draft.id, cells: draft.stops })) {
    say(draft.id === commander(state).id ? (state.events.at(-1) ?? "") : `${tankName(draft.id)}: ${state.events.at(-1)}`);
    buzz(12);
  } else say("That route is blocked now. Adjust it.");
  cmdPanel();
}
/** Which of the selected tank's three orders is on: Attack HQ, Follow me, or a Command route. */
function actState() {
  const u = draft ? state.units[draft.id] : undefined;
  if (!u || u.hp <= 0) return null;
  const enemyHq = state.board.bases[1 - side]!,
    stops = draft!.stops.length ? draft!.stops : u.route,
    hq = stops.at(-1) === enemyHq && (dirty() || (u.order === "hold" && u.route.length > 0));
  return {
    hq,
    follow: u.order === "follow" && !draft!.stops.length,
    route: armed || (!hq && (dirty() ? draft!.stops.length > 0 : u.order === "hold" && u.route.length > 0)),
  };
}
function plan(action: string) {
  if (!playing || paused) return;
  if (action === "next") return commitDraft(), nextTank();
  if (!draft) return say("Tap one of your tanks first.");
  const id = draft.id,
    on = actState();
  // Tapping the order that's already on clears it: the tank goes back to fighting on its own.
  if (on && ((action === "hq" && on.hq) || (action === "follow" && on.follow) || (action === "route" && on.route)))
    action = "clear";
  armed = false;
  if (action === "hq") {
    draft.stops = [state.board.bases[1 - side]!];
    if (!draftCells()) draft.stops = [];
    lockRoute();
  } else if (action === "follow") {
    if (id === commander(state).id) return say("Your tank leads; the others fall in on you.");
    command(state, { type: "order", order: "follow", ids: [id] });
    draft.stops = [];
    say(`Tank ${tankNo(id)} falling in on you.`);
  } else if (action === "route") {
    armed = true;
    say(`${tankName(id)}: tap the map to plant the flag.`);
  } else if (action === "clear") {
    command(state, { type: "clear", id });
    draft.stops = [];
    say(`${tankName(id)}: ${state.events.at(-1)}`);
  }
  cmdPanel();
}
/** Move your HQ (planning only). The squad redeploys around it; routes start over. */
function moveHq(id: number) {
  const test = structuredClone(state.board);
  if (!moveBase(test, side, id))
    return say("Your HQ needs open ground on your half, off the water, with a way through to the enemy.");
  hqMove = { key: mapKey(), cell: id };
  preview();
  say("HQ moved. Your squad redeployed around it.");
}
function startBattle() {
  if (!planning) return;
  if (loadoutCost(roles) > 12) return say("Over budget: downgrade a tank in Loadout first.");
  commitDraft();
  hqPick = false;
  planning = false;
  panel = "home";
  showCards();
  // Squad orders go to the whole squad again once the battle starts.
  selected = -1;
  draft = null;
  $("#bf-order-label").textContent = "ORDERS · WHOLE SQUAD";
  setCommand(false);
  setAim({ mode: railLayout.matches ? (autoOn ? "auto" : "free") : "pointer" });
  follow = true;
  undrag();
  clearInput();
  syncUi();
  fit();
  view.center();
  audio.play("start");
  say("Battle started. Tap Command any time to redirect your squad.");
  if (tipsPending) (tipsPending = false), requestAnimationFrame(() => coach(true));
}
/** Planning cards: which one shows, and where. Settings cards sit on the side away from your
 *  team (so they don't cover your platoon); the plan card takes the top corner away from it. */
function showCards() {
  const plan = planning,
    away = side === 0 ? "right" : "left";
  $("#bf-plan-home").hidden = !plan || panel !== "home";
  $("#bf-card-platoon").hidden = !plan || panel !== "platoon";
  $("#bf-card-loadout").hidden = !plan || panel !== "loadout";
  for (const c of document.querySelectorAll<HTMLElement>(".bf-pcard, #bf-cmd")) c.dataset.away = away;
  syncUi();
}
function showPanel(next: Panel, pick = true) {
  if (!planning) return;
  if (panel === "plan" && next !== "plan") commitDraft();
  panel = next;
  hqPick = false;
  showCards();
  if (next === "plan") setCommand(true, pick);
  else {
    commanding = false;
    selected = -1;
    draft = null;
    armed = false;
    aimButtons();
    cmdPanel();
    view.render(selected, paused, reduced.matches);
  }
}
/** The plan card (info, Move HQ / Move Tanks) and the buttons that ride beside the tank. */
function cmdPanel() {
  if (root.dataset.plan !== String(planning)) root.dataset.plan = String(planning);
  const panelEl = $("#bf-cmd");
  // Touch battle: the field is the card (no info box); orders sit beside the tank.
  panelEl.hidden = !commanding || (!planning && railLayout.matches);
  rideAlong();
  if (panelEl.hidden) return;
  const u = draft ? state.units[draft.id] : undefined,
    alive = u && u.hp > 0;
  text("#bf-cmd-mode span", planning ? "PLAN · TIME FROZEN" : "COMMAND · HALF SPEED");
  // Badge: the same platoon key as the list (colour = health, pips = size, number).
  const badge = $("#bf-cmd-badge"),
    key = alive ? `${u!.role}|${tankNo(u!.id)}` : "";
  if (badge.dataset.key !== key) {
    badge.dataset.key = key;
    badge.innerHTML = alive ? unitKey(u!.role, u!.id === commander(state).id ? "★" : String(tankNo(u!.id))) : "";
  }
  badge.dataset.hp = alive ? healthTone(u!) : "lost";
  text("#bf-cmd-hp", alive ? `${Math.ceil(u!.hp)} HP` : "");
  $("#bf-cmd-hp").dataset.hp = badge.dataset.hp;
  const cells = draftCells(),
    on = actState();
  text(
    "#bf-cmd-hint",
    hqPick
      ? "Tap behind the dashed line: your HQ and platoon move there."
      : !alive
        ? "Tap one of your tanks, or its number."
        : armed
          ? "Tap the map to plant the flag."
          : dirty()
            ? cells
              ? "Drag the line or the flag, then tap the check."
              : "A stop is blocked. Drag it to open ground."
            : on?.hq
              ? "Attacking the enemy HQ. Tap it again to clear."
              : on?.follow
                ? "Following you. Tap it again to clear."
                : on?.route
                  ? "Route locked. The arrow moves to the next tank."
                  : "Pick an order beside the tank: Attack HQ, Follow, or Command.",
  );
  text("#bf-cmd-tank", alive ? `${tankName(u!.id).toUpperCase()} · ${u!.role.toUpperCase()}` : "NO TANK SELECTED");
  text(
    "#bf-cmd-state",
    !alive
      ? ""
      : dirty()
        ? "DRAFT"
        : on?.hq
          ? "ATTACKING HQ"
          : u!.order === "hold" && u!.route.length
            ? `EN ROUTE · ${u!.route.length} STOP${u!.route.length > 1 ? "S" : ""}`
            : u!.order === "hold"
              ? "HOLDING"
              : u!.order === "follow"
                ? "FOLLOWING YOU"
                : u!.order === "attack"
                  ? "ATTACKING"
                  : u!.order === "retreat"
                    ? "REPAIRING"
                    : "ON ITS OWN",
  );
  for (const [id, onMode] of [["#bf-mode-hq", hqPick], ["#bf-mode-tanks", !hqPick]] as const)
    $(id).setAttribute("aria-checked", String(onMode));
  $(".bf-mode").dataset.on = hqPick ? "hq" : "tanks";
  if (planning) $("#bf-start").hidden = false;
  hqGuide();
}
/** The orders bubble rides above the selected tank; the check rides beside its flag. Positions
 *  come from the cached view geometry, so this costs no layout reads. */
let actsWidth = 0,
  actsHeight = 0;
function rideAlong() {
  const acts = $("#bf-acts"),
    check = $("#bf-check"),
    u = commanding && draft && !hqPick ? state.units[draft.id] : undefined,
    alive = !!u && u.hp > 0,
    on = alive ? actState() : null;
  acts.hidden = !alive;
  const cells = alive ? draftCells() : null,
    canLock = alive && dirty() && !!cells && draft!.stops.length > 0,
    // After the lock the check stays by the flag, lit, until you move on.
    locked = alive && !dirty() && !!on?.route && !on.hq && u!.route.length > 0,
    stops = canLock ? draft!.stops : locked ? u!.route : null;
  check.hidden = !stops;
  check.dataset.state = canLock ? "draft" : "locked";
  if (!alive) return;
  const own = u!.id === commander(state).id;
  for (const b of acts.querySelectorAll<HTMLButtonElement>("[data-act]")) {
    const k = b.dataset.act as "hq" | "follow" | "route";
    b.setAttribute("aria-pressed", String(!!on?.[k]));
    b.disabled = k === "follow" && own;
  }
  // Next shows once this tank has an order (or a drawn route it will lock).
  $("#bf-next").hidden = !(on && (on.hq || on.follow || on.route || dirty()));
  const p = view.toStage(u!),
    W = view.vw,
    H = view.vh,
    bw = (actsWidth ||= acts.offsetWidth) || 100,
    bh = (actsHeight ||= acts.offsetHeight) || 30,
    gap = 10,
    pad = 10;
  // Above the tank and its yellow hint label; below the tank when that would leave the screen.
  const above = p.y - view.tile * 0.5 - 26,
    below = above - bh < pad;
  const y = below ? Math.min(H - pad - bh, p.y + view.tile * 0.7) : Math.min(H - pad, above),
    rowTop = below ? y : y - bh;
  // Next sits right over the Command key; with no room above, beside the row (right, else
  // left), lined up with it. The whole stack keeps clear of the notch and the screen edges.
  let next: "up" | "right" | "left" = !below && rowTop - gap - bh >= pad ? "up" : "right";
  if (next === "right" && Math.min(p.x, W) + bw / 2 + gap + bh > W - safe.r - pad) next = "left";
  const lo = safe.l + pad + bw / 2 + (next === "left" ? gap + bh : 0),
    hi = W - safe.r - pad - bw / 2 - (next === "right" ? gap + bh : 0),
    x = Math.max(lo, Math.min(hi, p.x));
  acts.dataset.next = next;
  acts.classList.toggle("below", below);
  acts.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`;
  if (stops) {
    const end = point(state.board, stops.at(-1)!),
      q = view.toStage(end);
    // left/top, not transform: transform is the key's own press motion.
    check.style.left = `${Math.max(safe.l + 30, Math.min(W - safe.r - 30, q.x + view.tile * 1.4)).toFixed(0)}px`;
    check.style.top = `${Math.max(30, Math.min(H - 30, q.y - view.tile * 0.6)).toFixed(0)}px`;
  }
}
/** Route lines: in command mode every wingman's, otherwise only the selected tank's. */
function routeLines(): RouteLine[] {
  const out: RouteLine[] = [];
  const enemyHq = state.board.bases[1 - side]!;
  for (const u of state.units) {
    if (u.side !== side || u.hp <= 0) continue;
    const sel = u.id === selected;
    if (u.id === commander(state).id && !sel && !u.route.length) continue;
    if (!commanding && !sel) continue;
    const own = cell(state.board, u);
    if (sel && draft && dirty()) {
      const cells = draftCells();
      out.push({ id: u.id, cells: [own, ...(cells ?? plot(state.board, own, draft.stops.slice(0, -1)) ?? [])], stops: draft.stops, n: tankNo(u.id), selected: true, draft: true, bad: !cells, hq: draft.stops.at(-1) === enemyHq });
      continue;
    }
    const stops = u.route.length ? u.route : u.order === "hold" && u.hold !== null ? [u.hold] : [];
    const cells = stops.length ? (plot(state.board, own, stops) ?? [own, ...u.path]) : [own, ...u.path];
    out.push({ id: u.id, cells: cells[0] === own ? cells : [own, ...cells], stops, n: tankNo(u.id), selected: sel, draft: false, bad: false, hq: stops.at(-1) === enemyHq });
  }
  return out;
}
function order(order: Order) {
  if (!playing || paused) return;
  const ids =
    selected >= 0 && selected !== commander(state).id
      ? [selected]
      : state.units
          .filter((u) => u.side === side && u.id !== commander(state).id)
          .map((u) => u.id);
  if (order === "attack")
    command(state, { type: "focus", ids, target: aim.mode === "unit" ? aim.id : null });
  else command(state, { type: "order", order, ids });
  if (draft) draft.stops = [];
  cmdPanel();
  say(state.events.at(-1) ?? "");
  updateHUD();
}
function clearInput() {
  keys.clear();
  touch.clear();
  for (const n of document.querySelectorAll(".down")) n.classList.remove("down");
  input.x = input.y = 0;
  input.fire = false;
  input.aim = null;
  pointer = null;
  stickMove(null);
}
function setPause(value: boolean) {
  if (!playing || state.winner !== null || paused === value) return;
  paused = value;
  accumulator = 0;
  clearInput();
  if (paused) {
    audio.silence();
    cancelAnimationFrame(frame);
  } else {
    last = 0;
    frame = requestAnimationFrame(loop);
  }
  lease.setActive(!paused);
  if (!paused) root.classList.remove("menu-open");
  pauseButton();
  status.textContent = paused ? "PAUSED" : planning ? "PLAN" : "LIVE";
  say(paused ? "Battle paused." : planning ? "Back to planning." : "Battle resumed.");
}
function pauseButton() {
  $("#bf-pause").setAttribute("aria-pressed", String(paused));
  // The white flag pauses the battle and asks: keep fighting or give up. Not for the
  // rotate / full-screen gate or the tips, which pause on their own.
  const show = paused && $("#bf-gate").hidden && $("#bf-coach").hidden && state.winner === null,
    card = $("#bf-giveup");
  if (card.hidden === show) {
    card.hidden = !show;
    if (show) $<HTMLButtonElement>("#bf-giveup-no").focus({ preventScroll: true });
  }
  $("#bf-dim").hidden = !show;
}
function fullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  else void enterFullscreen();
}
/** Must run inside a tap. Fullscreen first, then a landscape lock where allowed (Android Chrome). */
function enterFullscreen(): Promise<void> {
  const root = document.documentElement;
  if (!canFullscreen() || document.fullscreenElement) return lockLandscape();
  return root
    .requestFullscreen({ navigationUI: "hide" })
    .then(lockLandscape)
    .catch(() => {});
}
function lockLandscape() {
  return (
    (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> })
      .lock?.("landscape")
      .catch(() => {}) ?? Promise.resolve()
  );
}
/* ---------- Touch "ready gate": landscape + full screen before the battle runs ---------- */
const portrait = matchMedia("(orientation: portrait)"),
  installed = matchMedia("(display-mode: fullscreen), (display-mode: standalone)");
function canFullscreen() {
  return !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false;
}
/** Home-screen apps are already full screen; iOS Safari tabs cannot be, so only rotation is required there. */
function gateReason(): "rotate" | "fullscreen" | null {
  if (!coarse.matches) return null;
  // Every stage is landscape-only on a phone; full screen is only asked for once you play.
  if (portrait.matches && railLayout.matches) return "rotate";
  if (!playing || state.winner !== null) return null;
  if (canFullscreen() && !document.fullscreenElement && !installed.matches) return "fullscreen";
  return null;
}
let gatePaused = false,
  readyOnce = false;
function checkGate() {
  const reason = gateReason(),
    gate = $("#bf-gate");
  if (reason) {
    const ios = !canFullscreen() && !installed.matches;
    $("#bf-gate-title").textContent = reason === "rotate" ? "Rotate to landscape" : "Full screen to play";
    $("#bf-gate-copy").textContent =
      reason === "rotate"
        ? ios
          ? "Turn your phone sideways. For true full screen on iPhone: Share → Add to Home Screen, then play from the icon."
          : "Battlefield is a widescreen game. Turn your phone sideways."
        : "The battle waits until it has the whole screen. Tap to go full screen.";
    $("#bf-gate-go").hidden = reason === "rotate";
    $("#bf-gate-exit").hidden = !playing;
    gate.dataset.reason = reason;
    gate.hidden = false;
    setMenu(false);
    if (!paused) {
      setPause(true);
      gatePaused = true;
    }
    return;
  }
  // Already landscape and full screen (no gate shown): the cockpit is ready now.
  if (gate.hidden) return ready();
  gate.hidden = true;
  if (gatePaused) {
    gatePaused = false;
    setPause(false);
  }
  // Paused before the gate came up: the surrender card comes back with the field.
  pauseButton();
  ready();
}
/** First time the cockpit is ready: show the button tips (if enabled). */
let tipsPending = false,
  tipsSeen = false;
function ready() {
  if (readyOnce || !playing) return;
  readyOnce = true;
  // Touch tips label the battle controls, so they wait for the battle itself.
  // Once a visit (and never after "Don't show again"); the ? key brings them back any time.
  if (coarse.matches && !tipsOff() && !tipsSeen) (tipsSeen = true), planning ? (tipsPending = true) : coach(true);
}
/* ---------- Install for true full screen (Battlefield only) ----------
   iPhone Safari tabs can never hide the browser UI; a Home Screen web app can.
   Android Chrome offers a native install prompt; the installed app launches full screen. */
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
const ios =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let installPrompt: InstallPrompt | null = null;
/** The intro card shows once on a phone or tablet; Fullscreen brings it back where the browser can't. */
const INTRO = "dom-battlefield:intro";
function isInstalled() {
  return installed.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function installMode(): "ios" | "app" | "menu" | null {
  if (isInstalled() || !coarse.matches) return null;
  if (installPrompt) return "app";
  return ios ? "ios" : "menu";
}
function installCard(show: boolean) {
  const card = $("#bf-install"),
    mode = show ? installMode() : null;
  $("#bf-install-ios").hidden = mode !== "ios";
  $("#bf-install-app").hidden = mode !== "app";
  $("#bf-install-menu").hidden = mode !== "menu";
  $("#bf-install-go").hidden = mode !== "app";
  card.hidden = !mode;
  if (mode && playing && !paused) {
    setPause(true);
    installPaused = true;
  }
}
let installPaused = false;
function installDone() {
  installCard(false);
  try {
    localStorage.setItem(INTRO, "seen");
  } catch {}
  if (installPaused) (installPaused = false), setPause(false);
}
async function install() {
  if (!installPrompt) return;
  const p = installPrompt;
  installPrompt = null;
  await p.prompt().catch(() => {});
  const choice = await p.userChoice.catch(() => ({ outcome: "dismissed" }));
  say(choice.outcome === "accepted" ? "Installed. Open Battlefield from your Home Screen for full screen." : "Install skipped.");
  installDone();
}
listen(window, "beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e as InstallPrompt;
  if (!$("#bf-install").hidden) installCard(true);
});
listen(window, "appinstalled", () => {
  installPrompt = null;
  installDone();
});
listen($("#bf-install-go"), "click", () => void install());
listen($("#bf-install-later"), "click", installDone);
/* Keep the screen awake during a battle; browsers release it on tab hide, so re-request. */
let wake: { release(): Promise<void> } | null = null;
function keepAwake(on: boolean) {
  const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } };
  if (!on) {
    void wake?.release().catch(() => {});
    wake = null;
  } else if (!wake && nav.wakeLock && document.visibilityState === "visible")
    nav.wakeLock.request("screen").then((w) => (wake = w), () => {});
}
function deploy(quick = false) {
  if (playing) return;
  if (loadoutCost(roles) > 12) return;
  audio.unlock();
  audio.play("start");
  const entering = coarse.matches ? enterFullscreen() : Promise.resolve();
  playing = true;
  readyOnce = false;
  tipsPending = false;
  document.documentElement.classList.add("bf-playing");
  $("#battlefield").dataset.active = "true";
  paused = false;
  selected = -1;
  setPan(false);
  follow = true;
  setAim({ mode: railLayout.matches ? (autoOn ? "auto" : "free") : "pointer" });
  $("#bf-order-label").textContent = "ORDERS · WHOLE SQUAD";
  // Plan battle opens the frozen planning step on its home cards; Quick start skips it.
  planning = !quick;
  panel = "home";
  draft = null;
  setCommand(false);
  showCards();
  setup.hidden = true;
  $("#bf-go").hidden = true;
  $("#bf-result").hidden = true;
  $("#bf-controls").hidden = false;
  pauseButton();
  lease.setActive(true);
  last = 0;
  accumulator = 0;
  root.toggleAttribute("data-blank", false);
  undrag();
  syncUi();
  view.resize();
  view.center();
  if (planning) $("#bf-start").hidden = false;
  say(
    quick
      ? "Battle started. Tap Command any time to direct your squad."
      : "Plan your battle: set your Platoon and Loadout, then Plan each tank. Start battle when ready.",
  );
  frame = requestAnimationFrame(loop);
  keepAwake(true);
  // Check the gate once the fullscreen/orientation request settles.
  void entering.then(() => requestAnimationFrame(checkGate));
  if (!coarse.matches) ready();
}
function reset() {
  if (quickSaved) {
    ({ side, formation, per } = quickSaved);
    roles = quickSaved.roles;
    quickSaved = null;
    pressed("#bf-side", "side", String(side));
    pressed("#bf-formation", "formation", formation);
    pressed("#bf-size", "size", String(per));
  }
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  $("#bf-giveup").hidden = true;
  keysPanel(false);
  cancelAnimationFrame(frame);
  audio.close();
  playing = false;
  gatePaused = false;
  $("#bf-gate").hidden = true;
  keepAwake(false);
  document.documentElement.classList.remove("bf-playing");
  $("#battlefield").dataset.active = "false";
  setMenu(false);
  coachPaused = false;
  coach(false);
  paused = false;
  selected = -1;
  planning = commanding = false;
  draft = null;
  hqPick = false;
  armed = false;
  panel = "home";
  $("#bf-start").hidden = true;
  showCards();
  setMenu(false);
  aimButtons();
  cmdPanel();
  clearInput();
  lease.setActive(false);
  setup.hidden = false;
  undrag();
  $("#bf-go").hidden = !picked;
  $("#bf-result").hidden = true;
  $("#bf-controls").hidden = true;
  preview();
}
function updateHUD() {
  const p = commander(state);
  // The order key the squad (or the selected tank) is on stays lit, so a tap visibly lands.
  const crew = state.units.filter((u) => u.side === side && u.hp > 0 && u.id !== p.id && (selected < 0 || selected === p.id || u.id === selected)),
    now = crew.length && crew.every((u) => u.order === crew[0]!.order) ? crew[0]!.order : "";
  for (const n of document.querySelectorAll<HTMLElement>("[data-order]")) {
    const on = String(n.dataset.order === now);
    if (n.getAttribute("aria-pressed") !== on) n.setAttribute("aria-pressed", on);
  }
  text("#bf-armor", `${Math.ceil((p.hp / p.maxHp) * 100)}%`);
  text(
    "#bf-allies",
    `${state.units.filter((u) => u.side === side && u.hp > 0).length}/${state.per}`,
  );
  text(
    "#bf-enemies",
    `${state.units.filter((u) => u.side !== side && u.hp > 0).length}/${state.per}`,
  );
  text(
    "#bf-clock",
    `${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, "0")}`,
  );
  text(
    "#bf-progress",
    MISSIONS[mission]!.objective === "eliminate"
      ? "PLATOON ELIMINATION"
      : `A ${Math.floor(state.capture[0]!)}s / B ${Math.floor(state.capture[1]!)}s`,
  );
  text("#bf-comms-progress", `${$("#bf-progress").textContent}`);
  text(
    "#bf-drawer-objective",
    `${$("#bf-objective-label").textContent} · ${$("#bf-progress").textContent} · ${$("#bf-clock").textContent}`,
  );
  const phase = !playing
    ? "PREPARE"
    : planning
      ? "PLAN"
      : paused
      ? "PAUSED"
      : state.winner === null
        ? "LIVE"
        : "COMPLETE";
  if (status.textContent !== phase) status.textContent = phase;
  const roster = $("#bf-roster");
  const allies = state.units.filter((u) => u.side === side);
  // Platoon keys: the same square arcade key as every control. Colour = health (green over 60%,
  // yellow over 30%, red below), pips = size (1 scout, 2 medium, 3 heavy), the big number is the
  // one painted on the field. Lost tanks rest pressed flat and disabled. Tap to command.
  if (!roster.childElementCount)
    for (const u of allies) {
      const n = document.createElement("button");
      n.className = "bf-arcade bf-unit";
      n.innerHTML = unitKey(u.role, "");
      press(n, () => selectUnit(u.id, true));
      roster.append(n);
    }
  allies.forEach((u, i) => {
    const n = roster.children[i] as HTMLButtonElement;
    const you = u.id === commander(state).id;
    n.classList.toggle("active", selected === u.id);
    n.classList.toggle("you", you);
    n.disabled = u.hp <= 0;
    const no = you ? "★" : String(u.id % state.per),
      hp = u.hp / u.maxHp;
    const tone = healthTone(u);
    if (n.dataset.hp !== tone) n.dataset.hp = tone;
    const t = n.querySelector("b")!;
    if (t.textContent !== no) t.textContent = no;
    const label = `${you ? "Your tank" : `Tank ${no}`}, ${u.role}, ${Math.max(0, Math.ceil(hp * 100))}% health${u.hp <= 0 ? ", lost" : ""}`;
    if (n.getAttribute("aria-label") !== label) {
      n.setAttribute("aria-label", label);
      n.title = label;
    }
  });
}
function loop(now: number) {
  if (!playing) return;
  const dt = last ? Math.min(0.04, (now - last) / 1000) : 0;
  last = now;
  if (!paused) {
    held.clear();
    for (const k of keys) held.add(k);
    for (const k of touch.values()) held.add(k);
    input.x =
      stick.id !== -1
        ? stick.x
        : Number(held.has("KeyD") || held.has("ArrowRight")) -
          Number(held.has("KeyA") || held.has("ArrowLeft"));
    input.y =
      stick.id !== -1
        ? stick.y
        : Number(held.has("KeyS") || held.has("ArrowDown")) -
          Number(held.has("KeyW") || held.has("ArrowUp"));
    input.fire = !commanding && (held.has("Space") || held.has("MouseFire"));
    if (planning) input.x = input.y = 0;
    const previousEvents = state.events.at(-1),
      shots = state.nextId,
      hp = commander(state).hp;
    input.aim = resolveAim();
    // Fixed simulation ticks; bounded catch-up prevents tab stalls from spiraling.
    accumulator = planning ? 0 : Math.min(0.1, accumulator + dt * (commanding ? 0.5 : 1));
    while (accumulator >= 1 / 60) {
      step(state, 1 / 60, input);
      accumulator -= 1 / 60;
    }
    if (state.nextId > shots && input.fire) {
      audio.play("fire");
      buzz(8);
    }
    if (commander(state).hp < hp) {
      audio.play("hurt");
      buzz(28);
    }
    if (state.events.at(-1) !== previousEvents && state.events.at(-1) === "Enemy tank destroyed.") buzz([12, 40, 12]);
    if (state.events.at(-1) !== previousEvents) audio.play("kill");
    if (state.events.at(-1) !== previousEvents && state.events.length)
      say(state.events.at(-1)!);
    // Driving always brings the camera back to your tank (after a pan, a look round in Command).
    if ((input.x || input.y) && !pan) follow = true;
    if (follow && !drag && !pan && commander(state).hp > 0) view.follow(commander(state));
    view.render(selected, paused, reduced.matches);
    view.routes(routeLines());
    const hintFor = commanding && draft ? state.units[draft.id] : undefined;
    view.hint(
      hintFor && hintFor.hp > 0 ? (!draft!.stops.length ? "TAP WHERE IT GOES" : dirty() ? "DRAG TO BEND · LOCK ✓" : "") : "",
      hintFor ?? null,
    );
    const lead = commander(state),
      auto = state.units.find((u) => u.id === lead.target && u.hp > 0);
    view.aim(aim.mode, aim.mode === "auto" ? (auto ?? null) : aim.mode === "pointer" || aim.mode === "free" ? null : input.aim);
    if (now - uiAt > 160) {
      updateHUD();
      cmdPanel();
      uiAt = now;
    }
    if (state.winner !== null) {
      audio.play(state.winner === side ? "won" : "gameover");
      clearInput();
      lease.setActive(false);
      const won = state.winner === side,
        result = $("#bf-result");
      result.hidden = false;
      result.classList.toggle("won", won);
      $("#bf-result-kicker").textContent = won ? "STAGE CLEAR" : "INSERT COIN";
      $("#bf-result-title").textContent = won ? "MISSION COMPLETE" : "GAME OVER";
      $("#bf-result-copy").textContent = won
        ? "Your platoon took the objective. Try the other side, heavier terrain or a new plan."
        : "Your platoon is down. Regroup, rethink the routes, and go again.";
      $("#bf-r-time").textContent = $("#bf-clock").textContent!;
      $("#bf-r-kills").textContent = String(state.units.filter((u) => u.side !== side && u.hp <= 0).length);
      $("#bf-r-lost").textContent = String(state.units.filter((u) => u.side === side && u.hp <= 0).length);
      updateHUD();
      return;
    }
  }
  frame = requestAnimationFrame(loop);
}
function setPan(value: boolean) {
  pan = value;
  if (pan) follow = false;
  $("#bf-pan").setAttribute("aria-pressed", String(pan));
  viewport.classList.toggle("panning", pan);
  say(
    pan
      ? "Pan mode: drag the map. Tap Pan again to give orders."
      : "Command mode: select a teammate, then an open square.",
  );
}
/* Step 1, location: each row carries a 5x5 thumbnail drawn with the real tile styles (the
   middle 3x3 is that ground's signature shapes). Picking one shows its terrain and opens the
   density panel right under it. */
const THUMBS = [
  ["hedge", "hedge", "hedge", "ground", "house", "ground", "hedge", "ground", "hedge"],
  ["rock", "ground", "fence", "ground", "car", "ground", "hedge", "ground", "rock"],
  ["house", "road", "rock", "road", "road", "road", "rock", "road", "house"],
  ["house", "water", "house", "road", "water", "car", "house", "water", "hedge"],
];
function thumb(i: number) {
  const tiles = Array.from({ length: 25 }, (_, k) => {
    const x = k % 5,
      y = Math.floor(k / 5),
      inner = x > 0 && x < 4 && y > 0 && y < 4;
    return `<i class="bf-tile" data-kind="${inner ? THUMBS[i]![(y - 1) * 3 + x - 1] : "ground"}" data-v="${k % 4}"></i>`;
  });
  return `<span class="bf-world bf-thumb" data-terrain="${MISSIONS[i]!.terrain}" aria-hidden="true">${tiles.join("")}</span>`;
}
function pickMission(i: number) {
  mission = i;
  picked = true;
  for (const [j, el] of document.querySelectorAll(".bf-mission").entries())
    el.setAttribute("aria-pressed", String(j === i));
  const terrain = $("#bf-terrain");
  document.querySelectorAll(".bf-mission")[i]!.after(terrain);
  terrain.hidden = false;
  // The card is full height and scrolls: bring the picked place and its Terrain into view.
  requestAnimationFrame(() => {
    const list = $("#bf-missions"),
      bottom = terrain.offsetTop + terrain.offsetHeight - list.offsetTop,
      top = (terrain.previousElementSibling as HTMLElement).offsetTop - list.offsetTop;
    if (bottom > list.scrollTop + list.clientHeight || top < list.scrollTop)
      list.scrollTo({ top: Math.max(0, Math.min(top - 4, bottom - list.clientHeight + 8)), behavior: reduced.matches ? "instant" : "smooth" });
  });
  $("#bf-go").hidden = false;
  preview();
  say(MISSIONS[i]!.brief);
}
for (const [i, m] of MISSIONS.entries()) {
  const n = document.createElement("button");
  n.className = "bf-mission";
  n.innerHTML = `${thumb(i)}<span class="bf-mission-text"><span>0${i + 1} / ${m.region}</span><strong>${m.name}</strong><small>${m.objective === "capture" ? "Capture headquarters" : m.objective === "hold" ? "Hold the objective" : "Platoon battle"}</small></span>`;
  n.setAttribute("aria-pressed", "false");
  n.onclick = () => pickMission(i);
  $("#bf-missions").append(n);
}
for (let i = 0; i < 4; i++) {
  const slot = document.createElement("div");
  slot.className = "bf-slot";
  slot.dataset.slot = String(i);
  // Each row has an emblem like a platoon key: a star (and an outline) for your tank or the
  // wingman's field number, over 1-3 dots for the size picked.
  if (i === 0) slot.classList.add("you");
  slot.innerHTML = `<span class="bf-emblem" aria-hidden="true">${i === 0 ? "<b>★</b>" : `<i>${i}</i>`}<i class="bf-pips"></i></span><div class="bf-seg" role="group" aria-label="${i === 0 ? "Your tank" : `Wingman ${i}`} loadout">${Object.entries(
    ROLES,
  )
    .map(
      ([id, r]) =>
        `<button data-role="${id}" aria-pressed="false"><canvas class="bf-ico" data-icon="${id}" aria-hidden="true"></canvas><span><b>${id.toUpperCase()}</b><small>${r.cost} PTS</small></span></button>`,
    )
    .join("")}</div>`;
  $("#bf-loadout").append(slot);
}
// Segmented pickers share one delegated handler each.
function picker(sel: string, attr: string, apply: (v: string) => void) {
  listen($(sel), "click", ((e: MouseEvent) => {
    const b = (e.target as Element).closest<HTMLElement>(`[data-${attr}]`);
    if (!b) return;
    apply(b.dataset[attr]!);
    for (const n of $(sel).querySelectorAll(`[data-${attr}]`))
      n.setAttribute("aria-pressed", String(n === b));
    preview();
  }) as EventListener);
}
// A new side moves the cards to the other side, so dragged positions start over.
picker("#bf-side", "side", (v) => ((side = Number(v)), undrag()));
picker("#bf-size", "size", (v) => (per = Number(v)));
press($("#bf-auto"), autoAim);
press($("#bf-target"), startPick);
picker("#bf-formation", "formation", (v) => (formation = v));
listen($("#bf-loadout"), "click", ((e: MouseEvent) => {
  const b = (e.target as Element).closest<HTMLElement>("[data-role]");
  if (!b) return;
  roles[Number(b.closest<HTMLElement>("[data-slot]")!.dataset.slot)] = b.dataset.role as Role;
  preview();
}) as EventListener);
listen($("#bf-deploy"), "click", () => deploy());
// Quick start: everything this page didn't set (platoon, loadout) is rolled at random.
let quickSaved: { side: number; formation: string; per: number; roles: Role[] } | null = null;
listen($("#bf-quick"), "click", () => {
  // The rolled platoon is for this battle only; your own setup comes back afterwards.
  quickSaved = { side, formation, per, roles: [...roles] };
  randomPlatoon();
  randomLoadout();
  preview();
  deploy(true);
});
picker("#bf-density", "density", (v) => (density = Number(v)));
// Dice: a new layout at the chosen density (the density stays put).
for (const d of document.querySelectorAll<SVGSVGElement>(".bf-die")) dieFace(d, 5);
listen($("#bf-reroll"), "click", () => {
  rollDie($("#bf-reroll"));
  seed = 1 + Math.floor(Math.random() * 1e6);
  hqMove = null;
  preview();
  say("New layout. Same density.");
});
function pressed(sel: string, attr: string, value: string) {
  for (const n of document.querySelectorAll<HTMLElement>(`${sel} [data-${attr}]`))
    n.setAttribute("aria-pressed", String(n.dataset[attr] === value));
}
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
/** Randomize (Platoon): side, formation and squad size. */
function randomPlatoon() {
  side = pick([0, 1]);
  formation = pick(["wedge", "line", "column"]);
  per = pick([4, 8, 12]);
  pressed("#bf-side", "side", String(side));
  pressed("#bf-formation", "formation", formation);
  pressed("#bf-size", "size", String(per));
}
/** Randomize (Loadout): four tanks that fit the 12-point budget. */
function randomLoadout() {
  do roles = [0, 1, 2, 3].map(() => pick(["scout", "medium", "heavy"] as Role[]));
  while (loadoutCost(roles) > 12);
}
for (const n of document.querySelectorAll<HTMLElement>("[data-rand]"))
  listen(n, "click", () => {
    rollDie(n);
    if (n.dataset.rand === "bf-card-platoon") {
      randomPlatoon();
      preview();
      showCards();
      say(`Platoon: ${side ? "B" : "A"} side, ${formation}, ${per} tanks a side.`);
    } else {
      randomLoadout();
      preview();
      say(`Loadout: ${roles.join(", ")}.`);
    }
  });
for (const n of document.querySelectorAll<HTMLElement>("[data-open]"))
  listen(n, "click", () => showPanel(n.dataset.open as Panel));
listen($("#bf-rematch"), "click", () => {
  reset();
  deploy();
});
/* Comms toast: tap or swipe it away. */
listen($(".bf-footer"), "pointerup", () => $(".bf-footer").classList.remove("show"));
/* Planning cards float over the field: drag any of them by its grip or an empty part. They stay
   where you drop them until the stage changes. */
function dragCard(card: HTMLElement) {
  let from: { x: number; y: number; left: number; top: number; moved: boolean } | null = null;
  listen(card, "pointerdown", ((e: PointerEvent) => {
    const t = e.target as Element;
    if (e.button > 0 || (t.closest("button, [role=group]") && !t.closest(".bf-card-grip"))) return;
    const r = card.getBoundingClientRect(),
      host = (card.offsetParent as HTMLElement | null)?.getBoundingClientRect() ?? { left: 0, top: 0 };
    from = { x: e.clientX, y: e.clientY, left: r.left - host.left, top: r.top - host.top, moved: false };
    try {
      card.setPointerCapture(e.pointerId);
    } catch {}
    e.stopPropagation();
  }) as EventListener);
  listen(card, "pointermove", ((e: PointerEvent) => {
    if (!from) return;
    const dx = e.clientX - from.x,
      dy = e.clientY - from.y;
    if (!from.moved && Math.hypot(dx, dy) < 5) return;
    from.moved = true;
    const host = card.offsetParent as HTMLElement | null,
      W = host?.clientWidth ?? innerWidth,
      H = host?.clientHeight ?? innerHeight;
    card.dataset.moved = "";
    card.style.left = `${Math.max(4, Math.min(W - card.offsetWidth - 4, from.left + dx)).toFixed(0)}px`;
    card.style.top = `${Math.max(4, Math.min(H - card.offsetHeight - 4, from.top + dy)).toFixed(0)}px`;
    card.style.right = card.style.bottom = "auto";
  }) as EventListener);
  for (const t of ["pointerup", "pointercancel"])
    listen(card, t, ((e: PointerEvent) => {
      // A mouse drag never doubles as a click on the card (a touch drag sends no click).
      if (from?.moved && e.pointerType === "mouse") card.addEventListener("click", (c) => c.stopPropagation(), { capture: true, once: true });
      from = null;
    }) as EventListener);
}
/* The yellow handle on a card's bottom edge: drag it up to make the card shorter (down to 30% of
   the window) and see more of the field; drag down to give it the full height again. */
for (const h of document.querySelectorAll<HTMLElement>(".bf-card-size")) {
  const card = h.parentElement!;
  let from: { y: number; h: number; max: number } | null = null;
  listen(h, "pointerdown", ((e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const host = card.offsetParent as HTMLElement | null;
    from = { y: e.clientY, h: card.offsetHeight, max: (host?.clientHeight ?? innerHeight) - card.offsetTop - 12 };
    try {
      h.setPointerCapture(e.pointerId);
    } catch {}
  }) as EventListener);
  listen(h, "pointermove", ((e: PointerEvent) => {
    if (!from) return;
    const next = Math.max(innerHeight * 0.3, Math.min(from.max, from.h + e.clientY - from.y));
    card.style.height = `${next.toFixed(0)}px`;
  }) as EventListener);
  for (const t of ["pointerup", "pointercancel"]) listen(h, t, () => (from = null));
}
/* Double-tap a card's icon box (the plan card's tank badge) to fold the card down to that square,
   with its round shortcuts tucked behind it; double-tap again to open it. It still drags. */
for (const box of document.querySelectorAll<HTMLElement>(".bf-pcard .bf-card-icon, #bf-cmd-badge")) {
  const card = box.closest<HTMLElement>(".bf-card")!;
  // Also a real control: focusable, and Enter / Space fold or open it.
  box.removeAttribute("aria-hidden");
  box.setAttribute("role", "button");
  box.tabIndex = 0;
  box.setAttribute("aria-label", "Fold or open this card");
  box.setAttribute("aria-expanded", "true");
  listen(box, "keydown", ((e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    box.setAttribute("aria-expanded", String(!card.classList.toggle("folded")));
  }) as EventListener);
  let lastUp = 0,
    down: { x: number; y: number } | null = null;
  // The card captures the pointer for dragging, so the release is heard on the card.
  listen(box, "pointerdown", ((e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
  }) as EventListener);
  listen(card, "pointerup", ((e: PointerEvent) => {
    const from = down;
    down = null;
    if (!from || Math.hypot(e.clientX - from.x, e.clientY - from.y) > 8) return void (lastUp = 0);
    const now = e.timeStamp;
    if (now - lastUp < 350) {
      lastUp = 0;
      const folded = card.classList.toggle("folded");
      box.setAttribute("aria-expanded", String(!folded));
      buzz(10);
    } else lastUp = now;
  }) as EventListener);
}
/** Cards back to their places: unfolded, undragged, full height. */
function undrag() {
  for (const c of document.querySelectorAll<HTMLElement>(".folded")) c.classList.remove("folded");
  for (const b of document.querySelectorAll<HTMLElement>(".bf-card-icon, #bf-cmd-badge")) b.setAttribute("aria-expanded", "true");
  for (const c of document.querySelectorAll<HTMLElement>(".bf-card")) {
    delete c.dataset.moved;
    c.style.left = c.style.top = c.style.right = c.style.bottom = c.style.height = "";
  }
}
for (const c of document.querySelectorAll<HTMLElement>(".bf-loc, .bf-card-row, .bf-pcard, #bf-cmd")) dragCard(c);
// Grips and the resize grab are pointer gestures; cards keep working without them.
for (const g of document.querySelectorAll<HTMLElement>(".bf-card-grip, .bf-card-size")) g.setAttribute("aria-hidden", "true");
/* Desktop docks Auto / Lock / Command in the bottom bar beside Pause; the touch cockpit keeps them
   on the right rail inside the stage (its rail CSS is positioned against the stage). */
const aimHome = $(".bf-aim").parentElement!,
  aimNext = $(".bf-aim").nextElementSibling;
function dockAim() {
  const aim = $(".bf-aim");
  if (railLayout.matches) {
    if (aim.parentElement !== aimHome) aimHome.insertBefore(aim, aimNext);
  } else if (aim.parentElement !== $(".bf-quick")) $(".bf-quick").prepend(aim);
}
// Desktop tiles scale to the viewport: refit when the docked card (or anything else) resizes it.
let vpSize = "";
new ResizeObserver(() => {
  const k = `${viewport.clientWidth}x${viewport.clientHeight}`;
  if (k === vpSize) return;
  vpSize = k;
  if (view && !railLayout.matches) requestAnimationFrame(fit);
}).observe(viewport);
/* Keyboard controls and button tips are game-play help: on desktop they sit with the battlefield
   title, not in the header; the phone drawer keeps tips with its header keys. */
function dockHelp() {
  const keys = $(".bf-keys"),
    tips = $("#bf-tips"),
    spot = $(".bf-help-keys");
  if (railLayout.matches) {
    if (tips.parentElement === spot) $("#bf-fullscreen").before(keys, tips);
  } else if (tips.parentElement !== spot) spot.append(keys, tips);
}
/* Desktop: the objective and the message line leave the footer for the comms panel above the
   map, where they read as part of the tank's instruments. Touch keeps its overlay footer. */
const footer = $(".bf-footer");
function dockComms() {
  const obj = $("#bf-objective-label"),
    msg = announcement,
    [objSlot, msgSlot] = [...document.querySelectorAll<HTMLElement>(".bf-comms-slot")];
  if (railLayout.matches) {
    if (obj.parentElement !== footer) footer.append(obj, msg);
  } else if (obj.parentElement !== objSlot) (objSlot!.append(obj), msgSlot!.append(msg));
  footer.hidden = !railLayout.matches;
}
dockAim();
dockHelp();
dockComms();
listen(railLayout, "change", () => {
  dockAim();
  dockHelp();
  dockComms();
  syncUi();
  aimButtons();
  if (playing && !planning) fit();
  else preview(true);
});
/* Surrender lives on the PAUSED sticker and asks first: the battle stays held while it is up. */
listen($("#bf-giveup-no"), "click", () => setPause(false));
listen($("#bf-giveup-yes"), "click", () => {
  const b = $("#bf-giveup-yes");
  b.classList.add("go");
  setTimeout(() => {
    b.classList.remove("go");
    reset();
  }, reduced.matches ? 0 : 450);
});
/* Header keyboard key: hover (fine pointers) or click shows the controls as keycaps. */
function keysPanel(open: boolean) {
  $("#bf-keys-panel").hidden = !open;
  $("#bf-keys").setAttribute("aria-expanded", String(open));
}
listen($("#bf-keys"), "click", (e) => {
  e.stopPropagation();
  keysPanel($("#bf-keys-panel").hidden === true);
});
if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
  listen($(".bf-keys"), "mouseenter", () => keysPanel(true));
  listen($(".bf-keys"), "mouseleave", () => keysPanel(false));
}
listen(document, "click", ((e: MouseEvent) => {
  if (!(e.target as Element).closest(".bf-keys")) keysPanel(false);
}) as EventListener);
listen($("#bf-new-operation"), "click", reset);
// Phones that can't go full screen (iPhone Safari) get the add-to-home-screen card instead.
listen($("#bf-fullscreen"), "click", () => {
  if (coarse.matches && !canFullscreen() && !isInstalled()) return installCard(true);
  fullscreen();
});
listen(document, "fullscreenchange", () => {
  const full = !!document.fullscreenElement;
  $("#bf-fullscreen").setAttribute("aria-pressed", String(full));
  $("#bf-fullscreen").setAttribute("aria-label", full ? "Leave full screen" : "Enter full screen");
  fit();
  checkGate();
});
listen(portrait, "change", () => {
  fit();
  checkGate();
});
listen($("#bf-gate-go"), "click", () => {
  void enterFullscreen().then(() => requestAnimationFrame(checkGate));
});
listen($("#bf-gate-exit"), "click", reset);
// iOS ignores user-scalable=no: block pinch and double-tap zoom while a battle runs.
for (const type of ["gesturestart", "gesturechange"])
  document.addEventListener(type, (e) => playing && e.preventDefault(), { signal: abort.signal, passive: false });
document.addEventListener(
  "touchmove",
  (e) => {
    if (playing && e.touches.length > 1) e.preventDefault();
  },
  { signal: abort.signal, passive: false },
);
listen(document, "contextmenu", (e) => {
  if (playing) e.preventDefault();
});
// Touch: the menu pauses and drops the header in; tap it again (or resume) to play on.
press($("#bf-squad"), () => {
  const open = !root.classList.contains("menu-open");
  if (open) setPause(true);
  setMenu(open);
  if (!open) setPause(false);
});
listen($("#bf-tips"), "click", () => {
  root.classList.remove("menu-open");
  $("#bf-squad").setAttribute("aria-expanded", "false");
  if (paused && $("#bf-gate").hidden) setPause(false);
  coach(true);
});
listen($("#bf-coach"), "click", ((e: MouseEvent) => {
  const label = (e.target as Element).closest(".bf-tip-label");
  if (label) {
    const open = label.getAttribute("aria-expanded") !== "true";
    for (const n of document.querySelectorAll(".bf-tip-label")) n.setAttribute("aria-expanded", "false");
    label.setAttribute("aria-expanded", String(open));
    keepOnScreen($("#bf-coach"));
    return;
  }
  if ((e.target as Element).closest(".bf-tip-label + p")) return;
  if ((e.target as Element).closest("#bf-coach-off"))
    try {
      localStorage.setItem(TIPS, "off");
    } catch {}
  coach(false);
}) as EventListener);
press($("#bf-pause"), () => setPause(!paused));
press($("#bf-command"), () => {
  // While planning, Command brings a hidden card back; in battle it toggles command mode.
  if (planning) return showPanel("plan");
  setCommand(!commanding);
});
listen($("#bf-check"), "click", () => {
  lockRoute();
  cmdPanel();
});
listen($("#bf-next"), "click", () => plan("next"));
for (const n of document.querySelectorAll<HTMLElement>("[data-act]"))
  listen(n, "click", () => plan(n.dataset.act!));
// START BATTLE: the sticker flashes red as the battle begins, then peels away.
listen($("#bf-start"), "click", () => {
  const b = $("#bf-start");
  if (!planning) return;
  b.classList.add("go");
  startBattle();
  if (planning) return b.classList.remove("go");
  setTimeout(() => {
    b.hidden = true;
    b.classList.remove("go");
  }, reduced.matches ? 0 : 450);
});
// Move HQ (planning): the next tap on the map moves your HQ, and your platoon with it.
// Move HQ / Move Tanks: a two-way switch, one side always on (tap the other side to switch).
for (const n of document.querySelectorAll<HTMLElement>("[data-mode]"))
  listen(n, "click", () => {
    if (!planning || panel !== "plan") return;
    const next = n.dataset.mode === "hq";
    if (next === hqPick) return;
    hqPick = next;
    if (hqPick) {
      commitDraft();
      selected = -1;
      draft = null;
      armed = false;
      view.render(selected, paused, reduced.matches);
    } else nextTank();
    say(hqPick ? "Move HQ: tap behind the dashed line, or drag your HQ. Your platoon moves with it." : "Move Tanks: tap a tank, then pick an order.");
    cmdPanel();
  });
press($("#bf-pan"), () => setPan(!pan));
press($("#bf-center"), () => {
  follow = true;
  view.center();
  say("Camera following your tank.");
});
for (const n of document.querySelectorAll<HTMLElement>("[data-order]"))
  press(n, () => order(n.dataset.order as Order));
listen(document, "keydown", ((e: KeyboardEvent) => {
  if ((e.target as Element).matches("input,select,textarea")) return;
  if (!playing) return;
  if (e.code === "Escape") {
    e.preventDefault();
    if (!$("#bf-giveup").hidden) return setPause(false);
    if (picking) {
      setAim({ mode: "auto" }, "Lock cancelled. Auto-aim.");
      return;
    }
    if (commanding && selected < 0 && !planning) {
      setCommand(false);
      return;
    }
    if (selected >= 0) {
      selected = -1;
      draft = null;
      view.highlight(-1);
      cmdPanel();
      say("Selection cleared.");
    } else setPause(!paused);
    return;
  }
  if (e.code === "KeyP") {
    e.preventDefault();
    if (!e.repeat) setPause(!paused);
    return;
  }
  if (paused) return;
  if (
    [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
    ].includes(e.code)
  ) {
    e.preventDefault();
    keys.add(e.code);
  }
  if (!e.repeat) {
    if (e.code === "KeyF") order("follow");
    if (e.code === "KeyR") order("retreat");
    if (e.code === "KeyE") order("advance");
    if (e.code === "KeyG") order("attack");
    if (e.code === "KeyQ") autoAim();
    if (e.code === "KeyO") setCommand(!commanding);
    if (commanding) {
      if (e.code === "Enter") e.preventDefault(), lockRoute();
      if (e.code === "Backspace") plan("clear");
      if (e.code === "KeyN") plan("next");
      if (e.code === "KeyH") plan("hq");
    }
    if (e.code === "KeyT") startPick();
    if (e.code === "KeyC") {
      follow = true;
      view.center();
    }
    if (e.code === "KeyM") setPan(!pan);
    if (/^Digit[1-9]$/.test(e.code) && Number(e.code.at(-1)) < state.per)
      selectUnit(commander(state).id + Number(e.code.at(-1)));
  }
}) as EventListener);
listen(document, "keyup", ((e: KeyboardEvent) => {
  keys.delete(e.code);
}) as EventListener);
listen(window, "blur", () => {
  if (playing && !paused) setPause(true);
});
listen(document, "visibilitychange", () => {
  if (document.hidden && playing && !paused) {
    hiddenPause = true;
    setPause(true);
  } else if (!document.hidden && playing) keepAwake(true);
  if (!document.hidden && hiddenPause) {
    hiddenPause = false;
    say("Paused while away. Resume when ready.");
  }
});
/** Touch identifiers are kept apart from pointer ids (and from -1, "no finger"). */
const touchKey = (t: Touch) => -2 - t.identifier;
for (const n of document.querySelectorAll<HTMLElement>("[data-key]")) {
  n.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (!playing || paused) return;
      for (const t of e.changedTouches) touch.set(touchKey(t), n.dataset.key!);
      n.classList.add("down");
    },
    active,
  );
  for (const type of ["touchend", "touchcancel"])
    n.addEventListener(type, ((e: TouchEvent) => {
      for (const t of e.changedTouches) touch.delete(touchKey(t));
      if (![...touch.values()].includes(n.dataset.key!)) n.classList.remove("down");
    }) as EventListener, options);
  listen(n, "pointerdown", ((e: PointerEvent) => {
    if (e.pointerType === "touch" && touchEvents) return;
    e.preventDefault();
    if (!playing || paused) return;
    n.setPointerCapture(e.pointerId);
    touch.set(e.pointerId, n.dataset.key!);
    n.classList.add("down");
  }) as EventListener);
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    listen(n, event, ((e: PointerEvent) => {
      if (!touch.delete(e.pointerId)) return;
      n.classList.remove("down");
    }) as EventListener);
}
/* Analog thumbstick: one layout read per touch start; direction + throttle from the drag. */
function stickMove(e: { clientX: number; clientY: number } | null) {
  const knob = $(".bf-knob");
  if (!e) {
    stick.id = -1;
    stick.x = stick.y = 0;
    knob.style.transform = "";
    $("#bf-stick").classList.remove("down");
    return;
  }
  let dx = (e.clientX - stick.cx) / stick.r,
    dy = (e.clientY - stick.cy) / stick.r;
  const d = Math.hypot(dx, dy);
  if (d > 1) (dx /= d), (dy /= d);
  // Dead zone, then rescale so a light push still creeps forward.
  const m = Math.min(1, d),
    k = m < 0.15 ? 0 : (m - 0.15) / 0.85 / (m || 1);
  stick.x = dx * k;
  stick.y = dy * k;
  knob.style.transform = `translate(${(dx * stick.r).toFixed(1)}px,${(dy * stick.r).toFixed(1)}px)`;
}
/** A new finger on the stick always takes it: a stick still waiting for a release the browser
 *  dropped (a home-bar or edge swipe mid-drive) would otherwise ignore every touch after. */
function stickGrab(id: number, at: { clientX: number; clientY: number }) {
  const el = $("#bf-stick"),
    r = el.getBoundingClientRect();
  el.classList.add("down");
  stick.id = id;
  stick.cx = r.left + r.width / 2;
  stick.cy = r.top + r.height / 2;
  stick.r = Math.max(1, r.width * 0.36);
  stickMove(at);
}
const stickEl = $("#bf-stick");
stickEl.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    if (playing && !paused && t) stickGrab(touchKey(t), t);
  },
  active,
);
stickEl.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (touchKey(t) === stick.id) stickMove(t);
  },
  active,
);
for (const type of ["touchend", "touchcancel"])
  stickEl.addEventListener(type, ((e: TouchEvent) => {
    for (const t of e.changedTouches) if (touchKey(t) === stick.id) stickMove(null);
  }) as EventListener, options);
listen(stickEl, "pointerdown", ((e: PointerEvent) => {
  if (e.pointerType === "touch" && touchEvents) return;
  e.preventDefault();
  if (!playing || paused) return;
  stickEl.setPointerCapture(e.pointerId);
  stickGrab(e.pointerId, e);
}) as EventListener);
listen(stickEl, "pointermove", ((e: PointerEvent) => {
  if (e.pointerId === stick.id) stickMove(e);
}) as EventListener);
for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
  listen(stickEl, type, ((e: PointerEvent) => {
    if (e.pointerId === stick.id) stickMove(null);
  }) as EventListener);
/** Any touch event lists every finger still down: a stick or Fire key held by a finger that is
 *  gone (its release never arrived) lets go. */
for (const type of ["touchstart", "touchend", "touchcancel"])
  listen(document, type, ((e: TouchEvent) => {
    const down = new Set([...e.touches].map(touchKey));
    if (stick.id < -1 && !down.has(stick.id)) stickMove(null);
    for (const [id, key] of touch)
      if (id < -1 && !down.has(id)) {
        touch.delete(id);
        if (![...touch.values()].includes(key))
          for (const n of document.querySelectorAll(`[data-key="${key}"]`)) n.classList.remove("down");
      }
  }) as EventListener);
let drag: {
  x: number;
  y: number;
  left: number;
  top: number;
  id: number;
} | null = null;
listen(viewport, "pointerdown", ((e: PointerEvent) => {
  if (pan || e.button === 1) {
    e.preventDefault();
    viewport.setPointerCapture(e.pointerId);
    follow = false;
    drag = {
      x: e.clientX,
      y: e.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
      id: e.pointerId,
    };
  }
}) as EventListener);
listen(viewport, "pointermove", ((e: PointerEvent) => {
  if (drag) {
    viewport.scrollLeft = drag.left + drag.x - e.clientX;
    viewport.scrollTop = drag.top + drag.y - e.clientY;
    view.scrolled();
    view.render(selected, paused, reduced.matches);
    return;
  }
  const p = view.location(e);
  if (e.pointerType === "mouse") pointer = p;
  if (
    selected >= 0 &&
    p.x >= 0 &&
    p.y >= 0 &&
    p.x < state.board.cols &&
    p.y < state.board.rows
  )
    view.highlight(cell(state.board, p));
}) as EventListener);
for (const event of ["pointerup", "pointercancel"])
  listen(viewport, event, () => {
    drag = null;
  });
listen(viewport, "click", ((e: MouseEvent) => {
  if (!playing || paused || pan || commanding) return;
  const p = view.location(e);
  if (p.x < 0 || p.y < 0 || p.x >= state.board.cols || p.y >= state.board.rows)
    return;
  if (picking) {
    const c = point(state.board, cell(state.board, p));
    setAim({ mode: "cell", x: c.x, y: c.y }, "Aim locked on that square. Tap Auto to release.");
    return;
  }
  if (selected < 0) return;
  const id = cell(state.board, p);
  if (command(state, { type: "move", id: selected, cell: id })) {
    view.highlight(id);
    say(state.events.at(-1)!);
  } else say("Blocked or unreachable square. Choose an open lane.");
}) as EventListener);
listen(viewport, "contextmenu", (e) => e.preventDefault());
/* Command gestures. Drag a stop or the flag to move it; drag the line to add a bend; drag open
   map to pan; tap a square to send the selected tank there. One layout read: the cached view. */
/** The HQ boundary shows while you're choosing a new spot (Move HQ) or dragging the HQ. */
function hqGuide() {
  view?.hqLine(planning && (hqPick || gesture?.kind === "hq") ? hqLimit(state.board, side) : null);
}
let gesture: { id: number; kind: "tap" | "pan" | "stop" | "hq"; stop: number; x: number; y: number; left: number; top: number; moved?: boolean } | null = null;
const cellAt = (e: PointerEvent) => {
  const p = view.location(e);
  return p.x < 0 || p.y < 0 || p.x >= state.board.cols || p.y >= state.board.rows ? -1 : cell(state.board, p);
};
listen(viewport, "pointerdown", ((e: PointerEvent) => {
  if (!playing || paused || pan || !commanding || gesture || e.button > 0) return;
  const t = e.target as Element;
  if (t.closest(".bf-tank")) return;
  const g = { id: e.pointerId, kind: "tap" as "tap" | "pan" | "stop" | "hq", stop: -1, x: e.clientX, y: e.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
  // Planning: press on your HQ and drag it somewhere else on your half.
  const at = view.location(e),
    base = point(state.board, state.board.bases[side]!);
  if (planning && Math.hypot(at.x - base.x, at.y - base.y) < 1.6) g.kind = "hq";
  if (g.kind === "hq") queueMicrotask(hqGuide);
  const handle = t.closest("[data-stop]");
  if (g.kind === "hq") {
    // handled on release
  } else if (draft && handle) (g.kind = "stop"), (g.stop = Number(handle.getAttribute("data-stop")));
  else if (draft && t.closest(".bf-route-hit")) {
    // Bend: insert a stop on the leg nearest the finger, then drag it.
    const c = cellAt(e),
      u = state.units[draft.id]!;
    let from = cell(state.board, u),
      leg = draft.stops.length - 1,
      best = Infinity;
    draft.stops.forEach((stop, k) => {
      for (const id of plot(state.board, from, [stop]) ?? []) {
        const d = Math.hypot((id % state.board.cols) - (c % state.board.cols), Math.floor(id / state.board.cols) - Math.floor(c / state.board.cols));
        if (d < best) (best = d), (leg = k);
      }
      from = stop;
    });
    draft.stops.splice(leg, 0, c);
    if (!draftCells()) draft.stops.splice(leg, 1);
    else (g.kind = "stop"), (g.stop = leg);
  }
  gesture = g;
  try {
    viewport.setPointerCapture(e.pointerId);
  } catch {}
  e.preventDefault();
}) as EventListener);
listen(viewport, "pointermove", ((e: PointerEvent) => {
  if (!gesture || e.pointerId !== gesture.id) return;
  if (gesture.kind === "stop" && draft) {
    const c = cellAt(e),
      i = gesture.stop,
      before = draft.stops[i];
    if (c < 0 || c === before || solid(state.board.tiles[c]!)) return;
    draft.stops[i] = c;
    if (!draftCells()) draft.stops[i] = before!;
    view.highlight(c);
    cmdPanel();
    return;
  }
  if (gesture.kind === "hq") {
    if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 8) gesture.moved = true;
    const c = cellAt(e);
    if (gesture.moved && c >= 0) view.highlight(c);
    return;
  }
  if (gesture.kind === "tap" && Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 8) {
    gesture.kind = "pan";
    follow = false;
  }
  if (gesture.kind === "pan") {
    viewport.scrollLeft = gesture.left + gesture.x - e.clientX;
    viewport.scrollTop = gesture.top + gesture.y - e.clientY;
    view.scrolled();
  }
}) as EventListener);
for (const type of ["pointerup", "pointercancel"])
  listen(viewport, type, ((e: PointerEvent) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    const g = gesture;
    gesture = null;
    view.highlight(-1);
    if (g.kind === "hq") hqGuide();
    if (type === "pointerup" && g.kind === "hq" && g.moved) {
      const c = cellAt(e);
      if (c >= 0) moveHq(c);
    } else if (type === "pointerup" && (g.kind === "tap" || g.kind === "hq")) {
      const c = cellAt(e);
      if (c >= 0 && hqPick) {
        moveHq(c);
      } else if (c >= 0) setDest(c);
    }
    cmdPanel();
  }) as EventListener);
listen(viewport, "pointerdown", ((e: PointerEvent) => {
  if (
    playing &&
    !paused &&
    !pan &&
    !commanding &&
    (e.button === 2 ||
      (e.button === 0 &&
        e.pointerType === "mouse" &&
        selected < 0 &&
        !picking &&
        !(e.target as Element).closest(".bf-tank")))
  ) {
    keys.add("MouseFire");
    viewport.setPointerCapture(e.pointerId);
  }
}) as EventListener);
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  listen(viewport, event, () => keys.delete("MouseFire"));
listen($("#bf-minimap"), "click", ((e: MouseEvent) => {
  const r = $("#bf-minimap").getBoundingClientRect();
  viewport.scrollTo({
    left:
      view.ox + ((e.clientX - r.left) / r.width) * view.world.clientWidth -
      viewport.clientWidth / 2,
    top:
      view.oy + ((e.clientY - r.top) / r.height) * view.world.clientHeight -
      viewport.clientHeight / 2,
    behavior: "instant",
  });
  view.scrolled();
  view.render(selected, paused, reduced.matches);
}) as EventListener);
// Eject: back to DOM VIRUS, where the board folds shut and the cartridge pops out of the console.
listen($("#bf-eject"), "click", () => {
  location.href = $("#bf-eject").dataset.href!;
});
listen($("#bf-theme"), "click", () => {
  requestAnimationFrame(() => drawIcons(root));
  const root = $("#battlefield");
  root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
  // Remembered, and shared with the DOM VIRUS site so both stay in the same theme.
  try {
    localStorage.setItem("dom-virus:theme", root.dataset.theme);
  } catch {}
});
/* The sound key starts in the saved state (muted stays muted after a reload). */
function soundButton() {
  const b = $("#bf-sound");
  b.setAttribute("aria-pressed", String(audio.enabled));
  b.setAttribute("aria-label", audio.enabled ? "Mute game sound" : "Enable game sound");
}
soundButton();
// No Web Audio, no sound key. iPhone: play through the ring/silent switch (the key is the off switch).
$("#bf-sound").hidden = !("AudioContext" in window);
function unlockSound(e: Event) {
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session && session.type !== "playback")
    try {
      session.type = "playback";
    } catch {}
  audio.unlock(e);
}
listen(document, "pointerdown", unlockSound);
listen(document, "keydown", unlockSound);
listen($("#bf-sound"), "click", () => {
  audio.toggle();
  soundButton();
  if (audio.enabled) audio.unlock();
});
listen(window, "resize", () => {
  readSafe();
  actsWidth = actsHeight = 0;
  // Setup and planning use a bigger screen (full screen) for a bigger map; a live battle re-fits.
  if (playing && !planning) fit();
  else preview(true);
  if (!$("#bf-coach").hidden) coach(true);
});
listen(window, "pagehide", () => {
  coach(false);
  keepAwake(false);
  cancelAnimationFrame(frame);
  audio.close();
  lease.setActive(false);
  clearInput();
  view.destroy();
  abort.abort();
});
// Show the remembered setup on its buttons.
pressed("#bf-side", "side", String(side));
pressed("#bf-formation", "formation", formation);
pressed("#bf-size", "size", String(per));
pressed("#bf-density", "density", String(density));
preview();
try {
  if (!localStorage.getItem(INTRO)) installCard(true);
} catch {}
checkGate();
// Small read-only diagnostic contract for lifecycle and command tests.
Object.defineProperty(window, "battlefield", {
  value: {
    snapshot: () => structuredClone(state),
    get playing() {
      return playing;
    },
    get paused() {
      return paused;
    },
    get install() {
      const c = document.querySelector<HTMLElement>("#bf-install")!;
      return c.hidden ? null : installMode();
    },
    get gate() {
      const g = document.querySelector<HTMLElement>("#bf-gate")!;
      return g.hidden ? null : g.dataset.reason;
    },
    get aim() {
      return { ...aim, picking };
    },
    /** Test-only (?debug): end the battle now to check the after-action screen. */
    end(won: boolean) {
      if (!location.search.includes("debug") || !playing) return;
      for (const u of state.units) if (u.side === (won ? 1 - side : side) && (won || u.id === commander(state).id)) u.hp = 0;
      planning = false;
    },
    get command() {
      return { on: commanding, planning, selected, draft: draft && { ...draft, stops: [...draft.stops] } };
    },
  },
  configurable: true,
});
