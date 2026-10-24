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
} from "./model";
import type { Battle, Role, Order, Input } from "./model";
import { View } from "./view";
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
  formation = "wedge",
  per = 4,
  roles: Role[] = ["medium", "scout", "medium", "heavy"];
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
  hiddenPause = false;
const audio = createGameAudio(document, "battlefield");
/** Player aim: auto (nearest visible enemy), pointer (mouse), a locked tank, or a locked square. */
type Aim =
  | { mode: "auto" | "pointer" }
  | { mode: "unit"; id: number }
  | { mode: "cell"; x: number; y: number };
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
/** First-run tips: dotted rings and labels on each visible control; one layout read when shown. */
function coach(show: boolean) {
  const layer = $("#bf-coach");
  clearTimeout(coachTimer);
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
  const mid = innerWidth / 2;
  for (const n of document.querySelectorAll<HTMLElement>("#battlefield [data-tip]")) {
    const r = n.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const tip = document.createElement("div");
    tip.className = "bf-coach-tip";
    tip.style.cssText = `left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px`;
    const left = r.left + r.width / 2 < mid;
    tip.dataset.at = r.top < 60 ? (left ? "below" : "below-r") : left ? "right" : "left";
    const label = document.createElement("span");
    label.textContent = n.dataset.tip!;
    tip.append(label);
    layer.append(tip);
  }
  coachTimer = window.setTimeout(() => coach(false), 7000);
}
function fit() {
  if (!view) return;
  view.resize();
  view.render(selected, paused, reduced.matches);
}
function preview() {
  if (playing) return;
  view?.destroy();
  $("#bf-roster").replaceChildren();
  // Bigger squads get a bigger field; the camera already scrolls on touch.
  const touchMap = innerWidth < 760 || coarse.matches,
    grow = per === 12 ? 12 : per === 8 ? 6 : 0,
    unit = per === 12 ? 28 : per === 8 ? 32 : 36,
    cols = touchMap ? 26 + grow : Math.floor(viewport.clientWidth / unit),
    rows = touchMap ? 20 + grow / 2 : Math.floor(viewport.clientHeight / unit);
  const b = generate(cols, rows, mission, seed);
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
  updateHUD();
}
function selectUnit(id: number) {
  if (!playing || paused || pan) return;
  const u = state.units.find((u) => u.id === id);
  if (!u || u.hp <= 0) return;
  if (u.side !== side) {
    // Tapping an enemy locks your aim; with a wingman selected it also orders that attack.
    lockUnit(u.id);
    if (selected >= 0) {
      command(state, { type: "focus", ids: [selected], target: u.id });
      say(`Tank ${(selected % state.per) + 1} attacking. Your aim is locked on the same tank.`);
    }
    return;
  }
  selected = u.id === commander(state).id ? -1 : id;
  $("#bf-order-label").textContent =
    selected < 0 ? "SQUAD ORDERS" : `TANK ${(id % state.per) + 1} SELECTED`;
  say(
    selected < 0
      ? "Squad selected."
      : `Tank ${(id % state.per) + 1}: tap a square to move, or an enemy to attack it.`,
  );
  setDrawer(false);
  view.render(selected, paused, reduced.matches);
}
function aimButtons() {
  $("#bf-auto").setAttribute("aria-pressed", String(aim.mode === "auto"));
  $("#bf-target").setAttribute("aria-pressed", String(picking || aim.mode === "unit" || aim.mode === "cell"));
  $("#battlefield").classList.toggle("picking", picking);
}
function setAim(next: Aim, message?: string) {
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
  if (!playing || paused) return;
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
  status.textContent = paused ? "PAUSED" : "LIVE";
  say(paused ? "Battle paused." : "Battle resumed.");
}
function pauseButton() {
  const b = $("#bf-pause");
  b.setAttribute("aria-pressed", String(paused));
  b.setAttribute("aria-label", paused ? "Resume" : "Pause");
  b.querySelector("span")!.textContent = paused ? "Resume" : "Pause";
  b.querySelector("path")!.setAttribute("d", paused ? "M6 4l10 6-10 6Z" : "M7 4v12M13 4v12");
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
  if (gate.hidden) return;
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
  if (coarse.matches && !tipsOff()) requestAnimationFrame(() => coach(true));
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
function deploy() {
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
  setAim({ mode: coarse.matches ? "auto" : "pointer" });
  $("#bf-order-label").textContent = "SQUAD ORDERS";
  setup.hidden = true;
  $("#bf-result").hidden = true;
  $("#bf-controls").hidden = false;
  pauseButton();
  lease.setActive(true);
  last = 0;
  accumulator = 0;
  view.resize();
  view.center();
  say(
    "Battle started. WASD moves. Aim with the pointer; hold Space or Fire to shoot.",
  );
  frame = requestAnimationFrame(loop);
  keepAwake(true);
  // Check the gate once the fullscreen/orientation request settles.
  void entering.then(() => requestAnimationFrame(checkGate));
  if (!coarse.matches) ready();
}
function reset() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
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
    : paused
      ? "PAUSED"
      : state.winner === null
        ? "LIVE"
        : "COMPLETE";
  if (status.textContent !== phase) status.textContent = phase;
  const roster = $("#bf-roster");
  const allies = state.units.filter((u) => u.side === side);
  if (!roster.childElementCount)
    for (const u of allies) {
      const n = document.createElement("button");
      n.className = "bf-roster-unit";
      n.onclick = () => selectUnit(u.id);
      roster.append(n);
    }
  allies.forEach((u, i) => {
    const n = roster.children[i] as HTMLButtonElement;
    n.classList.toggle("active", selected === u.id);
    n.disabled = u.hp <= 0;
    const text = `${u.id === commander(state).id ? "YOU" : u.id % state.per} · ${u.role} · ${Math.ceil(u.hp)} HP`;
    if (n.textContent !== text) n.textContent = text;
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
      Number(held.has("KeyD") || held.has("ArrowRight")) -
      Number(held.has("KeyA") || held.has("ArrowLeft"));
    input.y =
      Number(held.has("KeyS") || held.has("ArrowDown")) -
      Number(held.has("KeyW") || held.has("ArrowUp"));
    input.fire = held.has("Space") || held.has("MouseFire");
    const previousEvents = state.events.at(-1),
      shots = state.nextId,
      hp = commander(state).hp;
    input.aim = resolveAim();
    // Fixed simulation ticks; bounded catch-up prevents tab stalls from spiraling.
    accumulator = Math.min(0.1, accumulator + dt);
    while (accumulator >= 1 / 60) {
      step(state, 1 / 60, input);
      accumulator -= 1 / 60;
    }
    if (state.nextId > shots && input.fire) audio.play("fire");
    if (commander(state).hp < hp) audio.play("hurt");
    if (state.events.at(-1) !== previousEvents) audio.play("kill");
    if (state.events.at(-1) !== previousEvents && state.events.length)
      say(state.events.at(-1)!);
    view.render(selected, paused, reduced.matches);
    const lead = commander(state),
      auto = state.units.find((u) => u.id === lead.target && u.hp > 0);
    view.aim(aim.mode, aim.mode === "auto" ? (auto ?? null) : aim.mode === "pointer" ? null : input.aim);
    if (now - uiAt > 160) {
      updateHUD();
      uiAt = now;
    }
    if (state.winner !== null) {
      audio.play(state.winner === side ? "won" : "gameover");
      clearInput();
      lease.setActive(false);
      $("#bf-result").hidden = false;
      $("#bf-result-title").textContent =
        state.winner === side ? "OPERATION COMPLETE" : "PLATOON LOST";
      $("#bf-result-copy").textContent =
        state.winner === side
          ? "Your platoon secured the objective. Try the other side or a different formation."
          : "Regroup, adjust your loadout, and try another approach.";
      updateHUD();
      return;
    }
  }
  frame = requestAnimationFrame(loop);
}
function setPan(value: boolean) {
  pan = value;
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
listen($("#bf-deploy"), "click", deploy);
listen($("#bf-reroll"), "click", () => {
  seed++;
  preview();
});
listen($("#bf-restart"), "click", reset);
listen($("#bf-new-operation"), "click", reset);
listen($("#bf-fullscreen"), "click", fullscreen);
listen(document, "fullscreenchange", () => {
  $("#bf-fullscreen").textContent = document.fullscreenElement ? "Window" : "Full screen";
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
  if ((e.target as Element).closest("#bf-coach-off"))
    try {
      localStorage.setItem(TIPS, "off");
    } catch {}
  coach(false);
}) as EventListener);
listen($("#bf-pause"), "click", () => setPause(!paused));
listen($("#bf-pan"), "click", () => setPan(!pan));
listen($("#bf-center"), "click", () => view.center());
for (const n of document.querySelectorAll<HTMLElement>("[data-order]"))
  listen(n, "click", () => order(n.dataset.order as Order));
listen(document, "keydown", ((e: KeyboardEvent) => {
  if ((e.target as Element).matches("input,select,textarea")) return;
  if (!playing) return;
  if (e.code === "Escape") {
    e.preventDefault();
    if (picking) {
      setAim({ mode: "auto" }, "Lock cancelled. Auto-aim.");
      return;
    }
    if (selected >= 0) {
      selected = -1;
      view.highlight(-1);
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
    if (e.code === "KeyT") startPick();
    if (e.code === "KeyC") view.center();
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
  if (!playing || paused || pan) return;
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
listen(viewport, "pointerdown", ((e: PointerEvent) => {
  if (
    playing &&
    !paused &&
    !pan &&
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
  if (playing) fit();
  else preview();
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
  },
  configurable: true,
});
