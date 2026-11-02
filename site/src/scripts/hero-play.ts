/**
 * Play in page: a landing hero that plays its game in the background (attract mode) and, on one
 * key, becomes the game.
 *
 * - Attract mode (the default) is plain page: the game draws behind the copy and takes no input
 *   (its stage is pointer-events: none, no wheel or touch listener cancels anything), so a wheel,
 *   a trackpad, a swipe or the keyboard scrolls the page straight through the hero.
 * - The Play in page key (`[data-hero-play-open]`) pins the hero itself over the viewport
 *   (position: fixed, inset 0: hero-play.css; not the Fullscreen API), locks the page's scroll
 *   (the body is pinned where it was, the scrollbar's width kept, so nothing jumps; iOS-safe),
 *   makes the hero a modal dialog (role="dialog", aria-modal, named by `[data-hero-play-label]`;
 *   the rest of the page inert,
 *   so focus stays in it), moves focus into it, says "Playing in page, press Escape to exit."
 *   and calls `engage()`: the page hands its game the input.
 * - Exit (`[data-hero-play-exit]`, Escape, or the phone's back gesture: one history entry while
 *   engaged) calls `exit()` (the game goes back to attract mode), puts every change back through a
 *   Fizlet ledger (Recall: the page's HTML is byte for byte what it was), restores the scroll
 *   position and gives focus back to the Play in page key.
 *
 * The hero carries `data-hero-play`; engaged it also carries `data-play="on"`, the hook for the CSS
 * and for the game (a scene can read it to take input only when engaged).
 */
import { Ledger } from "../../../vendor/fizlet/kernel/ledger";

export interface HeroPlayOptions {
  /** Engaged: give the game its input (or start a playable one). */
  engage(): void;
  /** Exit: take the input away again; the game goes back to attract mode. */
  exit(): void;
}
export interface HeroPlay {
  open(): void;
  close(): void;
  readonly engaged: boolean;
}

/** What a screen reader hears when the hero takes over. */
export const SAY = "Playing in page, press Escape to exit.";
const SKIP = /^(SCRIPT|STYLE|LINK|TEMPLATE|NOSCRIPT)$/;

export function heroPlay(root: HTMLElement, o: HeroPlayOptions): HeroPlay {
  const doc = root.ownerDocument, win = doc.defaultView!, html = doc.documentElement, body = doc.body;
  const key = root.querySelector<HTMLElement>("[data-hero-play-open]");
  const live = root.querySelector<HTMLElement>("[data-hero-play-live]");
  const label = root.querySelector<HTMLElement>("[data-hero-play-label]");
  let L: Ledger | null = null, ac: AbortController | null = null, y = 0, backing = false;
  // While our history entry lives, the browser must not restore a scroll of its own on the way back
  // (it would land late, over the exact one close() restores).
  const hist = win.history, auto = () => (hist.scrollRestoration = "auto");

  function open() {
    if (L) return;
    L = new Ledger();
    ac = new AbortController();
    const on = { signal: ac.signal, capture: true };
    y = win.scrollY;
    const r = root.getBoundingClientRect(), vw = html.clientWidth, vh = win.innerHeight;
    // Android back closes it: one entry while engaged (same URL), pushed before the lock.
    hist.scrollRestoration = "manual";
    if (!hist.state?.heroPlay || backing) hist.pushState({ heroPlay: 1 }, "");
    // The hero keeps its place in the flow (a spacer of its height), so nothing below it moves.
    const spacer = L.add(doc.createElement("div"));
    spacer.style.height = `${r.height}px`;
    root.before(spacer);
    // Scroll lock: the body is pinned at the current scroll (iOS ignores overflow alone) and padded
    // by the scrollbar it loses, so the page does not shift sideways.
    L.style(html, "overflow", "hidden");
    L.style(html, "overscroll-behavior", "none");
    L.style(body, "position", "fixed");
    L.style(body, "top", `${-y}px`);
    L.style(body, "left", "0");
    L.style(body, "right", "0");
    if (win.innerWidth > vw) L.style(body, "padding-right", `${win.innerWidth - vw}px`);
    // The expand starts from where the hero was on screen (hero-play.css clips from these insets).
    const px = (n: number) => `${Math.max(0, Math.round(n))}px`;
    L.style(root, "--hp-t", px(r.top));
    L.style(root, "--hp-r", px(vw - r.right));
    L.style(root, "--hp-b", px(vh - r.bottom));
    L.style(root, "--hp-l", px(r.left));
    // The dialog: labelled, modal, focusable, pinch-locked (fizlet/touch + the kit's touch-action).
    L.attr(root, "data-play", "on");
    L.attr(root, "role", "dialog");
    L.attr(root, "aria-modal", "true");
    // Named by the hidden label (e.g. "DOM Battlefield, playing in page"); written in place, so the
    // hero's own aria-labelledby comes back where it was.
    if (label) L.attr(root, "aria-labelledby", label.id);
    // The game's own layer is read while engaged (a page hides it from AT as decoration).
    for (const stage of root.querySelectorAll<HTMLElement>("[data-play-stage][aria-hidden]")) L.attr(stage, "aria-hidden", "false");
    L.attr(root, "tabindex", "-1");
    L.attr(root, "data-touch-lock", "");
    // Focus trap: everything outside the hero is inert (no focus, no clicks, hidden from AT).
    for (let el: Element = root; el.parentElement && el !== body; el = el.parentElement)
      for (const sib of el.parentElement.children) if (sib !== el && sib !== spacer && !SKIP.test(sib.tagName) && !sib.hasAttribute("inert")) L.attr(sib as HTMLElement, "inert", "");
    root.focus({ preventScroll: true });
    if (live) live.textContent = SAY;
    win.addEventListener("keydown", (ev) => ev.key === "Escape" && (ev.preventDefault(), ev.stopImmediatePropagation(), close()), on);
    doc.addEventListener("focusin", (ev) => root.contains(ev.target as Node) || root.focus({ preventScroll: true }), on);
    o.engage();
  }

  function close(fromHistory = false) {
    if (!L) return;
    ac!.abort();
    o.exit();
    if (live) live.textContent = "";
    L.restore();
    L = ac = null;
    win.scrollTo({ top: y, left: 0, behavior: "instant" });
    key?.focus({ preventScroll: true });
    if (!fromHistory && hist.state?.heroPlay) (backing = true), hist.back();
    else if (!backing) auto();
  }

  key?.addEventListener("click", open);
  // The back gesture closes it (but not the back() an exit sent itself, which lands a moment later).
  win.addEventListener("popstate", () => {
    if (backing) (backing = false), L || auto();
    else close(true);
  });
  root.querySelector("[data-hero-play-exit]")?.addEventListener("click", () => close());
  return {
    open,
    close: () => close(),
    get engaged() {
      return !!L;
    },
  };
}
