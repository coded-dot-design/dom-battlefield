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
} from "./model";
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
  density = 1,
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
const mapKey = () => `${mission}:${seed}:${density}:${per}:${side}`;
function remember() {
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
/** While planning, the command card can be tucked away (Hide); a tank tap or Command reopens it. */
let cmdHidden = false;
/** A platoon key's inside: the tank number over 1-3 size pips. */
const PIPS: Record<string, number> = { scout: 1, medium: 2, heavy: 3 };
const unitKey = (role: string, no: string) => `<b>${no}</b><i class="bf-pips" data-n="${PIPS[role]}">${"<s></s>".repeat(PIPS[role] ?? 1)}</i>`;
const healthTone = (u: { hp: number; maxHp: number }) =>
  u.hp <= 0 ? "lost" : u.hp / u.maxHp > 0.6 ? "ok" : u.hp / u.maxHp > 0.3 ? "hurt" : "critical";
const audio = createGameAudio(document, "battlefield");
/** Player aim: auto (nearest visible enemy), pointer (mouse), a locked tank, or a locked square. */
type Aim =
  | { mode: "auto" | "pointer" }
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
  TIPS = "dom-battlefield:tips";
const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
  options = { signal: abort.signal };
function listen(target: EventTarget, type: string, fn: EventListener) {
  target.addEventListener(type, fn, options);
}
function say(text: string) {
  announcement.textContent = text;
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
  const controls = () => [...document.querySelectorAll<HTMLElement>("#battlefield [data-tip]")].filter((n) => n.getClientRects().length > 0);
  const place = () => {
    layer.querySelectorAll(".bf-coach-tip").forEach((n) => n.remove());
    const mid = innerWidth / 2;
    for (const n of controls()) {
      const r = n.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const tip = document.createElement("div");
      tip.className = "bf-coach-tip";
      tip.style.cssText = `left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px`;
      const left = r.left + r.width / 2 < mid;
      tip.dataset.at = n.dataset.tipAt ?? (r.top < 60 ? (left ? "below" : "below-r") : left ? "right" : "left");
      const label = document.createElement("button");
      label.className = "bf-tip-label";
      label.textContent = n.dataset.tip!;
      label.setAttribute("aria-expanded", "false");
      const more = document.createElement("p");
      more.textContent = n.dataset.tipMore ?? "";
      tip.append(label, more);
      layer.append(tip);
    }
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
/** The field size the screen allows (clamped like generate()). Touch maps are fixed and scroll. */
function mapSize() {
  const touchMap = innerWidth < 760 || coarse.matches,
    grow = per === 12 ? 12 : per === 8 ? 6 : 0,
    unit = per === 12 ? 28 : per === 8 ? 32 : 36,
    cols = touchMap ? 26 + grow : Math.floor(viewport.clientWidth / unit),
    rows = touchMap ? 20 + grow / 2 : Math.floor(viewport.clientHeight / unit);
  return { cols: Math.max(18, Math.min(48, cols)), rows: Math.max(14, Math.min(30, rows)) };
}
/** Set when the player keeps the current field size after entering full screen. */
let mapLock: { cols: number; rows: number } | null = null,
  expandAsked = false;
function offerExpand() {
  const next = mapSize(),
    ask = !!state && (!playing || planning) && !mapLock && !expandAsked &&
      (next.cols > state.board.cols || next.rows > state.board.rows);
  if (!ask) return;
  expandAsked = true;
  mapLock = { cols: state.board.cols, rows: state.board.rows };
  $("#bf-expand").hidden = false;
  text("#bf-expand-size", `${state.board.cols}×${state.board.rows} → ${next.cols}×${next.rows}`);
}
function preview(resized = false) {
  // Setup, or a strategy change during the plan step (same seed, so the same ground).
  if (playing && !planning) return;
  // Entering full screen may resize before fullscreenchange fires: ask before growing.
  if (resized && document.fullscreenElement) offerExpand();
  // Bigger squads get a bigger field; the camera already scrolls on touch.
  const { cols, rows } = mapLock ?? mapSize();
  // Planning: a resize that doesn't change the map size (address bars, rails) just re-fits.
  if (resized && planning && state && state.board.cols === cols && state.board.rows === rows) return fit();
  view?.destroy();
  $("#bf-roster").replaceChildren();
  const b = generate(cols, rows, mission, seed, density);
  if (hqMove && hqMove.key === mapKey()) moveBase(b, side, hqMove.cell);
  state = createBattle(
    b,
    mission,
    side,
    loadoutCost(roles) <= 12 ? roles : ["medium", "medium", "medium", "medium"],
    formation,
    per,
  );
  view = new View(viewport, state, selectUnit);
  view.center();
  mapTools();
  $("#bf-operation").textContent = MISSIONS[mission]!.name;
  $("#bf-brief").textContent = MISSIONS[mission]!.brief;
  $("#bf-tip").textContent = MISSIONS[mission]!.tip;
  $("#bf-points").textContent = `${loadoutCost(roles)} / 12 points`;
  setup.classList.toggle("bf-over", loadoutCost(roles) > 12);
  for (const n of document.querySelectorAll<HTMLElement>("[data-slot] [data-role]"))
    n.setAttribute(
      "aria-pressed",
      String(roles[Number(n.closest<HTMLElement>("[data-slot]")!.dataset.slot)] === n.dataset.role),
    );
  const start = $<HTMLButtonElement>("#bf-deploy");
  start.disabled = loadoutCost(roles) > 12;
  $("#bf-cost-error").textContent = start.disabled
    ? "Over budget — downgrade a tank before deploying."
    : "";
  $("#bf-objective-label").textContent =
    MISSIONS[mission]!.objective === "capture"
      ? "CAPTURE HQ / 12s"
      : MISSIONS[mission]!.objective === "hold"
        ? "HOLD CROSSROADS / 45s"
        : "ELIMINATE OPPOSING PLATOON";
  const sum = `${side ? "B · CORAL" : "A · MINT"} · ${formation.toUpperCase()} · ${per} TANKS · ${loadoutCost(roles)}/12`;
  text("#bf-strat-chip", `${side ? "B" : "A"} · ${formation.toUpperCase()} · ${per}`);
  text("#bf-strat-summary", `STRATEGY · ${sum} · edit it while you plan`);
  remember();
  updateHUD();
  if (planning) {
    selected = -1;
    draft = null;
    view.resize();
    view.center();
    nextTank();
    cmdPanel();
    $<HTMLButtonElement>("#bf-start").disabled = loadoutCost(roles) > 12;
  }
}
function selectUnit(id: number) {
  if (!playing || paused || pan) return;
  cmdHidden = false;
  const u = state.units.find((u) => u.id === id);
  if (!u || u.hp <= 0) return;
  if (u.side !== side) {
    // Tapping an enemy: with a wingman selected, it attacks that tank. Outside command mode
    // your own aim locks on too.
    if (!commanding) lockUnit(u.id);
    if (selected >= 0) {
      command(state, { type: "focus", ids: [selected], target: u.id });
      draft = { id: selected, stops: [] };
      say(`Tank ${tankNo(selected)} attacking that tank.`);
      cmdPanel();
    }
    return;
  }
  if (draft && draft.id !== id) commitDraft();
  // Tapping one of your wingmen mid-battle opens Command on it: see its route, change it.
  if (!commanding && !planning && u.id !== commander(state).id) setCommand(true, false);
  selected = u.id === commander(state).id ? -1 : id;
  draft = selected < 0 ? null : { id: selected, stops: [...u.route] };
  $("#bf-order-label").textContent =
    selected < 0 ? "SQUAD ORDERS" : `TANK ${tankNo(id)} SELECTED`;
  say(
    selected < 0
      ? "Squad selected."
      : commanding
        ? `Tank ${tankNo(id)}: tap a square to send it, or Attack HQ.`
        : `Tank ${tankNo(id)}: tap a square to move, or an enemy to attack it.`,
  );
  setDrawer(false);
  cmdPanel();
  view.render(selected, paused, reduced.matches);
}
function aimButtons() {
  $("#bf-auto").setAttribute("aria-pressed", String(!commanding && aim.mode === "auto"));
  $("#bf-target").setAttribute("aria-pressed", String(!commanding && (picking || aim.mode === "unit" || aim.mode === "cell")));
  $("#bf-command").setAttribute("aria-pressed", String(commanding));
  $("#battlefield").classList.toggle("picking", picking);
  $("#battlefield").classList.toggle("commanding", commanding);
}
function setAim(next: Aim, message?: string) {
  // Aim and command are one switch: picking an aim mode leaves command mode (not while planning).
  if (commanding && !planning) setCommand(false);
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
  // On desktop, Auto toggles back to mouse aiming.
  if (aim.mode === "auto" && !coarse.matches) setAim({ mode: "pointer" }, "Mouse aim.");
  else setAim({ mode: "auto" }, "Auto-aim: nearest visible enemy.");
}
function startPick() {
  if (!playing || paused || planning) return;
  if (picking) return setAim({ mode: "auto" }, "Auto-aim.");
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
  return null;
}
function setDrawer(open: boolean) {
  $("#battlefield").classList.toggle("squad-open", open);
  $("#bf-squad").setAttribute("aria-expanded", String(open));
}
/** Command mode on/off. Your gun stops and time halves, so directing the squad is a risk. */
function setCommand(on: boolean, pick = true) {
  if (planning && !on) return;
  if (!on) commitDraft();
  commanding = on;
  picking = false;
  if (!on) {
    // Back to fighting: squad orders go to the whole squad again.
    selected = -1;
    draft = null;
    $("#bf-order-label").textContent = "SQUAD ORDERS";
    $("#bf-cmd").hidden = true;
  } else {
    if (selected < 0 && pick) nextTank();
    say(planning ? "Plan your attack: tap a tank, then a square. Lock each route, then Start battle." : "Command mode: half speed, your gun is off. Direct a tank, then switch back to Auto.");
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
  if (draft.stops.length === 1 && before.length === 0) say("Route drawn. Drag the line to bend it, then Lock.");
  cmdPanel();
}
/** Moving on (another tank, Start, leaving Command) never throws a drawn route away. */
function commitDraft() {
  if (draft && dirty() && draft.stops.length && draftCells()) {
    lockRoute();
    say(`Tank ${tankNo(draft.id)}: route locked.`);
  }
}
function lockRoute() {
  if (!draft || !draft.stops.length || !dirty()) return;
  if (command(state, { type: "route", id: draft.id, cells: draft.stops })) {
    say(`Tank ${tankNo(draft.id)}: ${state.events.at(-1)}`);
    buzz(12);
  } else say("That route is blocked now. Adjust it.");
  cmdPanel();
}
function plan(action: string) {
  if (!playing || paused) return;
  if (action === "next") return nextTank();
  if (!draft) return say("Tap one of your numbered tanks first.");
  const id = draft.id;
  if (action === "hq") {
    draft.stops = [state.board.bases[1 - side]!];
    if (!draftCells()) draft.stops = [];
    lockRoute();
  } else if (action === "follow") {
    command(state, { type: "order", order: "follow", ids: [id] });
    draft.stops = [];
    say(`Tank ${tankNo(id)} falling in on you.`);
  } else if (action === "clear") {
    command(state, { type: "order", order: "advance", ids: [id] });
    draft.stops = [];
    say(`Tank ${tankNo(id)}: route cleared, back to squad orders.`);
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
  if (loadoutCost(roles) > 12) return say("Over budget: downgrade a tank in Strategy first.");
  commitDraft();
  hqPick = false;
  planning = false;
  strategy(false);
  // Squad orders go to the whole squad again once the battle starts.
  selected = -1;
  draft = null;
  $("#bf-order-label").textContent = "SQUAD ORDERS";
  setCommand(false);
  setAim({ mode: coarse.matches ? "auto" : "pointer" });
  audio.play("start");
  say("Battle started. Tap Command any time to redirect your squad.");
}
/** The command panel: what mode you're in, which tank, and what its route is doing. */
function cmdPanel() {
  const root = $("#battlefield");
  if (root.dataset.plan !== String(planning)) root.dataset.plan = String(planning);
  const panel = $("#bf-cmd");
  panel.hidden = !commanding || (planning && cmdHidden);
  if (panel.hidden) return;
  const u = draft ? state.units[draft.id] : undefined,
    alive = u && u.hp > 0;
  text("#bf-cmd-mode span", planning ? "PLAN · TIME FROZEN" : "COMMAND · HALF SPEED · GUN OFF");
  // Close: in battle it is Auto (command off, aim back on); while planning it just tucks the card away.
  const close = $("#bf-cmd-close");
  if (close.dataset.plan !== String(planning)) {
    close.dataset.plan = String(planning);
    close.querySelector("span")!.textContent = planning ? "Hide" : "Auto";
    close.setAttribute("aria-label", planning ? "Hide the command card (tap a tank to bring it back)" : "Close command: back to auto-aim (Q)");
    close.title = planning ? "Hide · tap a tank or Command to reopen" : "Q · Back to auto-aim";
  }
  // Badge: the same platoon key as the list (colour = health, pips = size, number).
  const badge = $("#bf-cmd-badge"),
    key = alive ? `${u!.role}|${tankNo(u!.id)}` : "";
  if (badge.dataset.key !== key) {
    badge.dataset.key = key;
    badge.innerHTML = alive ? unitKey(u!.role, String(tankNo(u!.id))) : "";
  }
  badge.dataset.hp = alive ? healthTone(u!) : "lost";
  text("#bf-cmd-hp", alive ? `${Math.ceil(u!.hp)} HP` : "");
  $("#bf-cmd-hp").dataset.hp = badge.dataset.hp;
  const cells = draftCells(),
    hq = !!draft && draft.stops.at(-1) === state.board.bases[1 - side];
  text(
    "#bf-cmd-hint",
    !alive
      ? planning
        ? "Tap one of your numbered tanks, or drag your HQ to move it."
        : "Tap one of your numbered tanks."
      : !draft!.stops.length
        ? "Tap a square to send it there, or Attack HQ."
        : dirty()
          ? cells
            ? "Drag the line to bend it · drag the flag to move it · then Lock."
            : "A stop is blocked. Drag it to open ground."
          : planning
            ? "Locked. Next tank, drag your HQ, or Start battle."
            : "Locked. Switch back to Auto to fight.",
  );
  text("#bf-cmd-tank", alive ? `TANK ${tankNo(u!.id)} · ${u!.role.toUpperCase()}` : "NO TANK SELECTED");
  text(
    "#bf-cmd-state",
    !alive
      ? ""
      : dirty()
        ? "DRAFT"
        : u!.order === "hold" && u!.route.length
          ? hq
            ? "ATTACKING HQ"
            : `EN ROUTE · ${u!.route.length} STOP${u!.route.length > 1 ? "S" : ""}`
          : u!.order === "hold"
            ? "HOLDING"
            : u!.order === "follow"
              ? "FOLLOWING YOU"
              : u!.order === "attack"
                ? "ATTACKING"
                : u!.order === "retreat"
                  ? "REPAIRING"
                  : "ADVANCING",
  );
  $<HTMLButtonElement>("#bf-lock").disabled = !alive || !dirty() || !cells || !draft!.stops.length;
  for (const n of document.querySelectorAll<HTMLButtonElement>("[data-plan]"))
    n.disabled = n.dataset.plan !== "next" && !alive;
  if (planning) $("#bf-start").hidden = false;
  $("#bf-move-hq").setAttribute("aria-pressed", String(hqPick));
}

/** Route lines: in command mode every wingman's, otherwise only the selected tank's. */
function routeLines(): RouteLine[] {
  const out: RouteLine[] = [];
  const enemyHq = state.board.bases[1 - side]!;
  for (const u of state.units) {
    if (u.side !== side || u.hp <= 0 || u.id === commander(state).id) continue;
    const sel = u.id === selected;
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
    selected >= 0
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
  pauseButton();
  status.textContent = paused ? "PAUSED" : planning ? "PLAN" : "LIVE";
  say(paused ? "Battle paused." : planning ? "Back to planning." : "Battle resumed.");
}
function pauseButton() {
  const b = $("#bf-pause");
  b.setAttribute("aria-pressed", String(paused));
  b.setAttribute("aria-label", paused ? "Resume" : "Pause");
  b.querySelector("span")!.textContent = paused ? "Resume" : "Pause";
  b.querySelector("path")!.setAttribute("d", paused ? "M6 4l10 6-10 6Z" : "M7 4v12M13 4v12");
  // The PAUSED sticker is for a pause you chose, not the rotate/full-screen gate or the tips.
  $("#bf-paused").hidden = !(paused && $("#bf-gate").hidden && $("#bf-coach").hidden && $("#bf-giveup").hidden && state.winner === null);
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
  if (!coarse.matches || !playing || state.winner !== null) return null;
  if (portrait.matches) return "rotate";
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
    gate.dataset.reason = reason;
    gate.hidden = false;
    setDrawer(false);
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
  ready();
}
/** First time the cockpit is ready: show the button tips (if enabled). */
function ready() {
  if (readyOnce || !playing) return;
  readyOnce = true;
  if (coarse.matches && !tipsOff()) coach(true);
}
/* ---------- Install for true full screen (Battlefield only) ----------
   iPhone Safari tabs can never hide the browser UI; a Home Screen web app can.
   Android Chrome offers a native install prompt; the installed app launches full screen. */
type InstallPrompt = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> };
const ios =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let installPrompt: InstallPrompt | null = null,
  installLater = false;
try {
  installLater = sessionStorage.getItem("dom-battlefield:install") === "later";
} catch {}
function isInstalled() {
  return installed.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function installMode(): "ios" | "app" | null {
  if (isInstalled() || !coarse.matches) return null;
  if (installPrompt) return "app";
  return ios ? "ios" : null;
}
function installCard(floating = false) {
  const card = $("#bf-install"),
    mode = installMode();
  $("#bf-install-ios").hidden = mode !== "ios";
  $("#bf-install-app").hidden = mode !== "app";
  $("#bf-install-go").hidden = mode !== "app";
  $("#bf-install-help").hidden = !mode;
  // The gear only holds Install for now: no install path, no gear.
  $(".bf-settings").hidden = !mode;
  card.classList.toggle("floating", floating);
  // Floating (from the in-game panel) the card leaves the hidden setup panel; it returns on close.
  if (floating) $("#battlefield").append(card);
  else if (card.parentElement !== $(".bf-setup-scroll")) $("#bf-missions").before(card);
  card.hidden = !mode || (!floating && installLater);
}
async function install() {
  if (!installPrompt) return;
  const p = installPrompt;
  installPrompt = null;
  await p.prompt().catch(() => {});
  const choice = await p.userChoice.catch(() => ({ outcome: "dismissed" }));
  say(choice.outcome === "accepted" ? "Installed. Open Battlefield from your Home Screen for full screen." : "Install skipped.");
  installCard();
}
listen(window, "beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e as InstallPrompt;
  installCard();
});
listen(window, "appinstalled", () => {
  installPrompt = null;
  installCard();
});
listen($("#bf-install-go"), "click", () => void install());
listen($("#bf-install-later"), "click", () => {
  const floating = $("#bf-install").classList.contains("floating");
  if (!floating) {
    installLater = true;
    try {
      sessionStorage.setItem("dom-battlefield:install", "later");
    } catch {}
  }
  installCard();
  if (floating && playing && paused && !gatePaused) setPause(false);
});
listen($("#bf-install-help"), "click", () => {
  settings(false);
  setDrawer(false);
  if (installPrompt) return void install();
  if (playing && !paused) setPause(true);
  installCard(true);
});
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
  document.documentElement.classList.add("bf-playing");
  $("#battlefield").dataset.active = "true";
  paused = false;
  selected = -1;
  setPan(false);
  follow = true;
  setAim({ mode: coarse.matches ? "auto" : "pointer" });
  $("#bf-order-label").textContent = "SQUAD ORDERS";
  // Plan strategy opens a frozen planning step in command mode; Quick battle skips it.
  planning = !quick;
  draft = null;
  setCommand(!quick);
  setup.hidden = true;
  $("#bf-result").hidden = true;
  $("#bf-controls").hidden = false;
  pauseButton();
  lease.setActive(true);
  last = 0;
  accumulator = 0;
  view.resize();
  view.center();
  say(quick ? "Battle started. Tap one of your tanks any time to direct it." : "Plan your attack: tap a tank, then a square. Lock each route, then Start battle.");
  frame = requestAnimationFrame(loop);
  keepAwake(true);
  // Check the gate once the fullscreen/orientation request settles.
  void entering.then(() => requestAnimationFrame(checkGate));
  if (!coarse.matches) ready();
}
function reset() {
  cmdHidden = false;
  dockCard();
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  $("#bf-paused").hidden = true;
  $("#bf-giveup").hidden = true;
  keysPanel(false);
  $("#bf-expand").hidden = true;
  mapLock = null;
  expandAsked = false;
  settings(false);
  cancelAnimationFrame(frame);
  audio.close();
  playing = false;
  gatePaused = false;
  $("#bf-gate").hidden = true;
  keepAwake(false);
  document.documentElement.classList.remove("bf-playing");
  $("#battlefield").dataset.active = "false";
  setDrawer(false);
  coachPaused = false;
  coach(false);
  paused = false;
  selected = -1;
  planning = commanding = false;
  draft = null;
  hqPick = false;
  $("#bf-start").hidden = true;
  strategy(false);
  aimButtons();
  cmdPanel();
  clearInput();
  lease.setActive(false);
  setup.hidden = false;
  $("#bf-result").hidden = true;
  $("#bf-controls").hidden = true;
  preview();
}
function updateHUD() {
  const p = commander(state);
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
      n.onclick = () => selectUnit(u.id);
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
      stick.id >= 0
        ? stick.x
        : Number(held.has("KeyD") || held.has("ArrowRight")) -
          Number(held.has("KeyA") || held.has("ArrowLeft"));
    input.y =
      stick.id >= 0
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
    view.aim(aim.mode, aim.mode === "auto" ? (auto ?? null) : aim.mode === "pointer" ? null : input.aim);
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
for (const [i, m] of MISSIONS.entries()) {
  const n = document.createElement("button");
  n.className = "bf-mission";
  n.innerHTML = `<span>0${i + 1} / ${m.region}</span><strong>${m.name}</strong><small>${m.objective === "capture" ? "Capture headquarters" : m.objective === "hold" ? "Hold the objective" : "Platoon battle"}</small>`;
  n.setAttribute("aria-pressed", String(i === mission));
  n.onclick = () => {
    mission = i;
    document
      .querySelectorAll(".bf-mission")
      .forEach((el, j) => el.setAttribute("aria-pressed", String(j === i)));
    preview();
  };
  $("#bf-missions").append(n);
}
for (let i = 0; i < 4; i++) {
  const slot = document.createElement("div");
  slot.className = "bf-slot";
  slot.dataset.slot = String(i);
  slot.innerHTML = `<span>${i === 0 ? "YOUR TANK" : `WINGMAN ${i}`}</span><div class="bf-seg" role="group" aria-label="${i === 0 ? "Your tank" : `Wingman ${i}`} loadout">${Object.entries(
    ROLES,
  )
    .map(
      ([id, r]) =>
        `<button data-role="${id}" aria-pressed="false">${id.toUpperCase()} <small>${r.cost}</small></button>`,
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
picker("#bf-side", "side", (v) => (side = Number(v)));
picker("#bf-size", "size", (v) => (per = Number(v)));
listen($("#bf-auto"), "click", autoAim);
listen($("#bf-target"), "click", startPick);
picker("#bf-formation", "formation", (v) => (formation = v));
listen($("#bf-loadout"), "click", ((e: MouseEvent) => {
  const b = (e.target as Element).closest<HTMLElement>("[data-role]");
  if (!b) return;
  roles[Number(b.closest<HTMLElement>("[data-slot]")!.dataset.slot)] = b.dataset.role as Role;
  preview();
}) as EventListener);
listen($("#bf-deploy"), "click", () => deploy());
listen($("#bf-quick"), "click", () => deploy(true));
picker("#bf-density", "density", (v) => (density = Number(v)));
// Random terrain: a new layout at a random density (light, normal or heavy).
listen($("#bf-reroll"), "click", () => {
  seed = 1 + Math.floor(Math.random() * 1e6);
  density = [0.6, 1, 1.45][Math.floor(Math.random() * 3)]!;
  pressed("#bf-density", "density", String(density));
  preview();
});
function pressed(sel: string, attr: string, value: string) {
  for (const n of document.querySelectorAll<HTMLElement>(`${sel} [data-${attr}]`))
    n.setAttribute("aria-pressed", String(n.dataset[attr] === value));
}
function strategy(open: boolean) {
  $("#bf-strategy").hidden = !open;
  $("#bf-strat-toggle").setAttribute("aria-expanded", String(open));
}
listen($("#bf-strat-toggle"), "click", () => strategy($("#bf-strategy").hidden === true));
listen($("#bf-strat-close"), "click", () => strategy(false));
// Randomize: side, formation, squad size and a loadout that fits the 12-point budget.
listen($("#bf-randomize"), "click", () => {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;
  side = pick([0, 1]);
  formation = pick(["wedge", "line", "column"]);
  per = pick([4, 8, 12]);
  do roles = [0, 1, 2, 3].map(() => pick(["scout", "medium", "heavy"] as Role[]));
  while (loadoutCost(roles) > 12);
  pressed("#bf-side", "side", String(side));
  pressed("#bf-formation", "formation", formation);
  pressed("#bf-size", "size", String(per));
  preview();
  say(`Strategy: ${side ? "B" : "A"} side, ${formation}, ${per} tanks a side.`);
});
listen($("#bf-rematch"), "click", () => {
  reset();
  deploy();
});
listen($("#bf-cmd-close"), "click", () => {
  if (planning) {
    cmdHidden = true;
    cmdPanel();
  } else setAim({ mode: "auto" }, "Command off. Auto-aim: nearest visible enemy.");
});
/* Desktop docks the command card above the map (in flow, the map rescales to fit) instead of over
   it; the touch cockpit has no spare room, so there it stays over the field. */
const cmdHome = $("#bf-cmd").parentElement!,
  cmdNext = $("#bf-cmd").nextElementSibling;
function dockCmd() {
  const c = $("#bf-cmd");
  if (railLayout.matches) {
    if (c.parentElement !== cmdHome) cmdHome.insertBefore(c, cmdNext);
  } else if (c.nextElementSibling !== $(".bf-stage")) $(".bf-stage").before(c);
}
/* Desktop docks Auto / Lock / Command in the bottom bar beside Pause; the touch cockpit keeps them
   on the right rail inside the stage (its rail CSS is positioned against the stage). */
const railLayout = matchMedia("(pointer: coarse) and (max-width: 1400px), (max-width: 759px)"),
  aimHome = $(".bf-aim").parentElement!,
  aimNext = $(".bf-aim").nextElementSibling;
function dockAim() {
  const aim = $(".bf-aim");
  if (railLayout.matches) {
    if (aim.parentElement !== aimHome) aimHome.insertBefore(aim, aimNext);
  } else if (aim.parentElement !== $(".bf-quick")) $(".bf-quick").prepend(aim);
}
// The docked card's real height comes off the stage's, so the page never scrolls.
new ResizeObserver(([e]) => {
  if (e) $(".bf-main").style.setProperty("--cmd-h", `${Math.ceil(e.borderBoxSize[0]?.blockSize ?? e.contentRect.height) + 10}px`);
}).observe($("#bf-cmd"));
// Desktop tiles scale to the viewport: refit when the docked card (or anything else) resizes it.
let vpSize = "";
new ResizeObserver(() => {
  const k = `${viewport.clientWidth}x${viewport.clientHeight}`;
  if (k === vpSize) return;
  vpSize = k;
  if (view && !railLayout.matches) requestAnimationFrame(fit);
}).observe(viewport);
/* The command card can be dragged anywhere by its grip; double-click (or Enter) docks it again. */
function floatCmd(x: number, y: number) {
  const c = $("#bf-cmd"),
    w = c.offsetWidth,
    h = c.offsetHeight;
  c.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, x))}px`;
  c.style.top = `${Math.max(8, Math.min(innerHeight - h - 8, y))}px`;
}
function dockCard() {
  const c = $("#bf-cmd");
  c.classList.remove("floating");
  c.style.left = c.style.top = "";
}
{
  const grip = $("#bf-cmd-grip"),
    card = $("#bf-cmd");
  let from: { x: number; y: number; left: number; top: number } | null = null;
  listen(grip, "pointerdown", ((e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const r = card.getBoundingClientRect();
    card.classList.add("floating");
    floatCmd(r.left, r.top);
    const f = card.getBoundingClientRect();
    from = { x: e.clientX, y: e.clientY, left: f.left, top: f.top };
    try {
      grip.setPointerCapture(e.pointerId);
    } catch {}
  }) as EventListener);
  listen(grip, "pointermove", ((e: PointerEvent) => {
    if (from) floatCmd(from.left + e.clientX - from.x, from.top + e.clientY - from.y);
  }) as EventListener);
  for (const t of ["pointerup", "pointercancel"]) listen(grip, t, () => (from = null));
  listen(grip, "dblclick", dockCard);
  listen(grip, "keydown", ((e: KeyboardEvent) => {
    const step = { ArrowLeft: [-24, 0], ArrowRight: [24, 0], ArrowUp: [0, -24], ArrowDown: [0, 24] }[e.key];
    if (e.key === "Enter" || e.key === " ") return e.preventDefault(), dockCard();
    if (!step) return;
    e.preventDefault();
    e.stopPropagation();
    const r = card.getBoundingClientRect();
    card.classList.add("floating");
    floatCmd(r.left + step[0]!, r.top + step[1]!);
  }) as EventListener);
  listen(window, "resize", () => {
    if (card.classList.contains("floating")) floatCmd(card.offsetLeft, card.offsetTop);
  });
}
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
dockAim();
dockCmd();
dockHelp();
listen(railLayout, "change", () => (dockAim(), dockCmd(), dockHelp()));
/* Surrender lives on the PAUSED sticker and asks first: the battle stays held while it is up. */
let giveupResume = false;
function giveup(open: boolean) {
  if (open === !$("#bf-giveup").hidden) return;
  if (open) {
    giveupResume = !paused;
    setDrawer(false);
    $("#bf-giveup").hidden = false;
    setPause(true);
    pauseButton();
    $<HTMLButtonElement>("#bf-giveup-no").focus();
  } else {
    $("#bf-giveup").hidden = true;
    if (giveupResume) setPause(false);
    else pauseButton();
  }
}
listen($("#bf-surrender"), "click", () => giveup(true));
listen($("#bf-giveup-no"), "click", () => giveup(false));
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
listen($("#bf-resume"), "click", () => setPause(false));
/* Header ⚙: the less-used options (install as an app, surrender). Closes on pick or outside tap. */
function settings(open: boolean) {
  $("#bf-settings-menu").hidden = !open;
  $("#bf-settings").setAttribute("aria-expanded", String(open));
}
listen($("#bf-settings"), "click", ((e: MouseEvent) => {
  e.stopPropagation();
  settings($("#bf-settings-menu").hidden === true);
}) as EventListener);
listen(document, "click", ((e: MouseEvent) => {
  if (!(e.target as Element).closest(".bf-settings")) settings(false);
  if (!(e.target as Element).closest(".bf-keys")) keysPanel(false);
}) as EventListener);
listen($("#bf-new-operation"), "click", reset);
listen($("#bf-fullscreen"), "click", fullscreen);
listen($("#bf-expand-yes"), "click", () => {
  mapLock = null;
  $("#bf-expand").hidden = true;
  preview();
});
listen($("#bf-expand-no"), "click", () => ($("#bf-expand").hidden = true));
listen(document, "fullscreenchange", () => {
  const full = !!document.fullscreenElement;
  $("#bf-fullscreen").setAttribute("aria-pressed", String(full));
  $("#bf-fullscreen").setAttribute("aria-label", full ? "Leave full screen" : "Enter full screen");
  if (full) offerExpand();
  else ($("#bf-expand").hidden = true), (expandAsked = false);
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
listen($("#bf-squad"), "click", () =>
  setDrawer(!$("#battlefield").classList.contains("squad-open")),
);
// The compact scoreboard expands into the drawer on touch.
listen($(".bf-metrics"), "click", () => {
  if (playing && coarse.matches)
    setDrawer(!$("#battlefield").classList.contains("squad-open"));
});
listen($("#bf-tips"), "click", () => {
  setDrawer(false);
  coach(true);
});
listen($("#bf-coach"), "click", ((e: MouseEvent) => {
  const label = (e.target as Element).closest(".bf-tip-label");
  if (label) {
    const open = label.getAttribute("aria-expanded") !== "true";
    for (const n of document.querySelectorAll(".bf-tip-label")) n.setAttribute("aria-expanded", "false");
    label.setAttribute("aria-expanded", String(open));
    return;
  }
  if ((e.target as Element).closest(".bf-tip-label + p")) return;
  if ((e.target as Element).closest("#bf-coach-off"))
    try {
      localStorage.setItem(TIPS, "off");
    } catch {}
  coach(false);
}) as EventListener);
listen($("#bf-pause"), "click", () => setPause(!paused));
listen($("#bf-command"), "click", () => {
  // While planning, Command brings a hidden card back; in battle it toggles command mode.
  if (planning) return (cmdHidden = false), cmdPanel();
  setCommand(!commanding);
});
listen($("#bf-lock"), "click", lockRoute);
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
listen($("#bf-move-hq"), "click", () => {
  hqPick = !hqPick;
  say(hqPick ? "Tap where your HQ should go. Your platoon moves with it." : "HQ stays put.");
  cmdPanel();
});
for (const n of document.querySelectorAll<HTMLElement>("[data-plan]"))
  listen(n, "click", () => plan(n.dataset.plan!));
listen($("#bf-pan"), "click", () => setPan(!pan));
listen($("#bf-center"), "click", () => {
  follow = true;
  view.center();
  say("Camera following your tank.");
});
for (const n of document.querySelectorAll<HTMLElement>("[data-order]"))
  listen(n, "click", () => order(n.dataset.order as Order));
listen(document, "keydown", ((e: KeyboardEvent) => {
  if ((e.target as Element).matches("input,select,textarea")) return;
  if (!playing) return;
  if (e.code === "Escape") {
    e.preventDefault();
    if (!$("#bf-giveup").hidden) return giveup(false);
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
      if (e.code === "Enter") lockRoute();
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
for (const n of document.querySelectorAll<HTMLElement>("[data-key]")) {
  listen(n, "pointerdown", ((e: PointerEvent) => {
    e.preventDefault();
    if (!playing || paused) return;
    n.setPointerCapture(e.pointerId);
    touch.set(e.pointerId, n.dataset.key!);
    n.classList.add("down");
  }) as EventListener);
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    listen(n, event, ((e: PointerEvent) => {
      touch.delete(e.pointerId);
      n.classList.remove("down");
    }) as EventListener);
}
/* Analog thumbstick: one layout read per touch start; direction + throttle from the drag. */
function stickMove(e: PointerEvent | null) {
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
listen($("#bf-stick"), "pointerdown", ((e: PointerEvent) => {
  e.preventDefault();
  if (!playing || paused || stick.id >= 0) return;
  const el = $("#bf-stick"),
    r = el.getBoundingClientRect();
  el.setPointerCapture(e.pointerId);
  el.classList.add("down");
  stick.id = e.pointerId;
  stick.cx = r.left + r.width / 2;
  stick.cy = r.top + r.height / 2;
  stick.r = r.width * 0.36;
  stickMove(e);
}) as EventListener);
listen($("#bf-stick"), "pointermove", ((e: PointerEvent) => {
  if (e.pointerId === stick.id) stickMove(e);
}) as EventListener);
for (const type of ["pointerup", "pointercancel", "lostpointercapture"])
  listen($("#bf-stick"), type, ((e: PointerEvent) => {
    if (e.pointerId === stick.id) stickMove(null);
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
    if (type === "pointerup" && g.kind === "hq" && g.moved) {
      const c = cellAt(e);
      if (c >= 0) moveHq(c);
    } else if (type === "pointerup" && (g.kind === "tap" || g.kind === "hq")) {
      const c = cellAt(e);
      if (c >= 0 && hqPick) {
        hqPick = false;
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
      ((e.clientX - r.left) / r.width) * view.world.clientWidth -
      viewport.clientWidth / 2,
    top:
      ((e.clientY - r.top) / r.height) * view.world.clientHeight -
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
  const root = $("#battlefield");
  root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
});
listen(document, "pointerdown", (e) => audio.unlock(e));
listen(document, "keydown", (e) => audio.unlock(e));
listen($("#bf-sound"), "click", () => {
  audio.toggle();
  $("#bf-sound").setAttribute("aria-pressed", String(audio.enabled));
  $("#bf-sound").setAttribute(
    "aria-label",
    audio.enabled ? "Mute game sound" : "Enable game sound",
  );
  if (audio.enabled) audio.unlock();
});
listen(window, "resize", () => {
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
installCard();
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
