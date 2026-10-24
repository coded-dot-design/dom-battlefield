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
const input: Input = { x: 0, y: 0, fire: false, aim: null },
  keys = new Set<string>(),
  touch = new Map<number, string>(),
  lease = createMobileSelectionLock(document),
  abort = new AbortController();
const reduced = matchMedia("(prefers-reduced-motion: reduce)"),
  options = { signal: abort.signal };
function listen(target: EventTarget, type: string, fn: EventListener) {
  target.addEventListener(type, fn, options);
}
function say(text: string) {
  announcement.textContent = text;
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
  const cols = innerWidth < 760 ? 26 : Math.floor(viewport.clientWidth / 36),
    rows = innerWidth < 760 ? 20 : Math.floor(viewport.clientHeight / 36);
  const b = generate(cols, rows, mission, seed);
  state = createBattle(
    b,
    mission,
    side,
    loadoutCost(roles) <= 12 ? roles : ["medium", "medium", "medium", "medium"],
    formation,
  );
  view = new View(viewport, state, selectUnit);
  view.center();
  $("#bf-operation").textContent = MISSIONS[mission]!.name;
  $("#bf-brief").textContent = MISSIONS[mission]!.brief;
  $("#bf-tip").textContent = MISSIONS[mission]!.tip;
  $("#bf-points").textContent = `${loadoutCost(roles)} / 12 points`;
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
  if (u?.side !== side || u.hp <= 0) return;
  selected = u.id === side * 4 ? -1 : id;
  $("#bf-order-label").textContent =
    selected < 0 ? "SQUAD ORDERS" : `TANK ${(id % 4) + 1} SELECTED`;
  say(
    selected < 0
      ? "Squad selected."
      : `Tank ${(id % 4) + 1}: click an open grid square to move. It will then resume its orders.`,
  );
  $("#battlefield").classList.remove("squad-open");
  $("#bf-squad").setAttribute("aria-expanded", "false");
  view.render(selected, paused, reduced.matches);
}
function order(order: Order) {
  if (!playing || paused) return;
  const ids =
    selected >= 0
      ? [selected]
      : state.units
          .filter((u) => u.side === side && u.id !== side * 4)
          .map((u) => u.id);
  command(state, { type: "order", order, ids });
  say(state.events.at(-1) ?? "");
  updateHUD();
}
function clearInput() {
  keys.clear();
  touch.clear();
  input.x = input.y = 0;
  input.fire = false;
  input.aim = null;
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
  $("#bf-pause").textContent = paused ? "Resume" : "Pause";
  $("#bf-pause").setAttribute("aria-pressed", String(paused));
  status.textContent = paused ? "PAUSED" : "LIVE";
  say(paused ? "Battle paused." : "Battle resumed.");
}
function fullscreen() {
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => {});
  } else if (document.documentElement.requestFullscreen) {
    void document.documentElement.requestFullscreen().catch(() => {});
  }
}
function deploy() {
  if (playing) return;
  if (loadoutCost(roles) > 12) return;
  audio.unlock();
  audio.play("start");
  if (matchMedia("(pointer: coarse)").matches) fullscreen();
  playing = true;
  $("#battlefield").dataset.active = "true";
  paused = false;
  selected = -1;
  setPan(false);
  $("#bf-order-label").textContent = "SQUAD ORDERS";
  setup.hidden = true;
  $("#bf-result").hidden = true;
  $("#bf-controls").hidden = false;
  $("#bf-pause").textContent = "Pause";
  lease.setActive(true);
  last = 0;
  accumulator = 0;
  view.resize();
  view.center();
  say(
    "Battle started. WASD moves. Aim with the pointer; hold Space or Fire to shoot.",
  );
  frame = requestAnimationFrame(loop);
}
function reset() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  cancelAnimationFrame(frame);
  audio.close();
  playing = false;
  $("#battlefield").dataset.active = "false";
  $("#battlefield").classList.remove("squad-open");
  $("#bf-squad").setAttribute("aria-expanded", "false");
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
  const p = state.units.find((u) => u.id === side * 4)!;
  $("#bf-armor").textContent = `${Math.ceil((p.hp / p.maxHp) * 100)}%`;
  $("#bf-allies").textContent =
    `${state.units.filter((u) => u.side === side && u.hp > 0).length} / 4`;
  $("#bf-enemies").textContent =
    `${state.units.filter((u) => u.side !== side && u.hp > 0).length} / 4`;
  $("#bf-clock").textContent =
    `${Math.floor(state.time / 60)}:${String(Math.floor(state.time % 60)).padStart(2, "0")}`;
  $("#bf-progress").textContent =
    MISSIONS[mission]!.objective === "eliminate"
      ? "PLATOON ELIMINATION"
      : `A ${Math.floor(state.capture[0]!)}s / B ${Math.floor(state.capture[1]!)}s`;
  status.textContent = !playing
    ? "PREPARE"
    : paused
      ? "PAUSED"
      : state.winner === null
        ? "LIVE"
        : "COMPLETE";
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
    const text = `${u.id === side * 4 ? "YOU" : u.id % 4} · ${u.role} · ${Math.ceil(u.hp)} HP`;
    if (n.textContent !== text) n.textContent = text;
  });
}
function loop(now: number) {
  if (!playing) return;
  const dt = last ? Math.min(0.04, (now - last) / 1000) : 0;
  last = now;
  if (!paused) {
    const held = new Set([...keys, ...touch.values()]);
    input.x =
      Number(held.has("KeyD") || held.has("ArrowRight")) -
      Number(held.has("KeyA") || held.has("ArrowLeft"));
    input.y =
      Number(held.has("KeyS") || held.has("ArrowDown")) -
      Number(held.has("KeyW") || held.has("ArrowUp"));
    input.fire = held.has("Space") || held.has("MouseFire");
    const previousEvents = state.events.at(-1),
      shots = state.nextId,
      hp = state.units.find((u) => u.id === side * 4)!.hp;
    // Fixed simulation ticks; bounded catch-up prevents tab stalls from spiraling.
    accumulator = Math.min(0.1, accumulator + dt);
    while (accumulator >= 1 / 60) {
      step(state, 1 / 60, input);
      accumulator -= 1 / 60;
    }
    if (state.nextId > shots && input.fire) audio.play("fire");
    if (state.units.find((u) => u.id === side * 4)!.hp < hp) audio.play("hurt");
    if (state.events.at(-1) !== previousEvents) audio.play("kill");
    if (state.events.at(-1) !== previousEvents && state.events.length)
      say(state.events.at(-1)!);
    view.render(selected, paused, reduced.matches);
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
  input.aim = null;
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
  const label = document.createElement("label");
  label.innerHTML = `<span>${i === 0 ? "YOUR TANK" : `WINGMAN ${i}`}</span><select aria-label="${i === 0 ? "Your tank" : `Wingman ${i}`} loadout">${Object.entries(
    ROLES,
  )
    .map(
      ([id, r]) =>
        `<option value="${id}" ${roles[i] === id ? "selected" : ""}>${id.toUpperCase()} · ${r.cost} PT</option>`,
    )
    .join("")}</select>`;
  label.querySelector("select")!.onchange = (e) => {
    roles[i] = (e.target as HTMLSelectElement).value as Role;
    preview();
  };
  $("#bf-loadout").append(label);
}
listen($("#bf-side"), "change", () => {
  side = Number($<HTMLSelectElement>("#bf-side").value);
  preview();
});
listen($("#bf-formation"), "change", () => {
  formation = $<HTMLSelectElement>("#bf-formation").value;
  preview();
});
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
});
listen($("#bf-squad"), "click", () => {
  const open = $("#battlefield").classList.toggle("squad-open");
  $("#bf-squad").setAttribute("aria-expanded", String(open));
});
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
    if (e.code === "KeyC") view.center();
    if (e.code === "KeyM") setPan(!pan);
    if (/^Digit[123]$/.test(e.code))
      selectUnit(side * 4 + Number(e.code.at(-1)));
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
  } else if (!document.hidden && hiddenPause) {
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
  }) as EventListener);
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    listen(n, event, ((e: PointerEvent) => {
      touch.delete(e.pointerId);
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
    view.render(selected, paused, reduced.matches);
    return;
  }
  const p = view.location(e);
  if (e.pointerType === "mouse") input.aim = p;
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
  if (!playing || paused || pan || selected < 0) return;
  const p = view.location(e);
  if (p.x < 0 || p.y < 0 || p.x >= state.board.cols || p.y >= state.board.rows)
    return;
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
  cancelAnimationFrame(frame);
  audio.close();
  lease.setActive(false);
  clearInput();
  view.destroy();
  abort.abort();
});
preview();
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
  },
  configurable: true,
});
