/** Pause and results share a map-aligned presentation and one modal interaction boundary. */
export function createBattleOverlays(root: HTMLElement, viewport: HTMLElement, signal: AbortSignal) {
  let current: HTMLElement | null = null, previous: HTMLElement | null = null, frame = 0;
  const locked = new Map<HTMLElement, boolean>();
  const menu = () => current?.id === "bf-giveup" && root.classList.contains("menu-open")
    ? root.querySelector<HTMLElement>(".bf-header") : null;
  function mask() {
    const header = menu();
    for (const node of root.children) {
      if (!(node instanceof HTMLElement) || node === current || node.tagName === "SCRIPT") continue;
      if (!locked.has(node)) locked.set(node, node.inert);
      // An explicitly opened mobile menu owns the header controls. Ordinary pause/results do not.
      node.inert = node === header ? locked.get(node)! : true;
    }
  }
  function layout() {
    frame = 0;
    if (!current) return;
    const r = viewport.getBoundingClientRect(), left = Math.max(0, r.left), right = Math.min(innerWidth, r.right);
    const top = Math.max(0, r.top), bottom = Math.min(innerHeight, r.bottom);
    root.style.setProperty("--overlay-x", `${(left + right) / 2}px`);
    root.style.setProperty("--overlay-y", `${top + (bottom - top) * .4}px`);
    root.style.setProperty("--overlay-bottom", `${Math.max(0, innerHeight - bottom)}px`);
    root.style.setProperty("--overlay-width", `${Math.max(1, right - left)}px`);
  }
  function restore(focus = true) {
    cancelAnimationFrame(frame);
    for (const [node, inert] of locked) node.inert = inert;
    locked.clear();
    current = null;
    if (focus && previous?.isConnected && previous.getClientRects().length) previous.focus({ preventScroll: true });
    previous = null;
  }
  function schedule() {
    if (current && !frame) frame = requestAnimationFrame(layout);
  }
  window.addEventListener("resize", schedule, { signal });
  window.addEventListener("scroll", schedule, { signal, passive: true });
  document.addEventListener("keydown", (event) => {
    if (!current || event.key !== "Tab") return;
    const header = menu();
    const keys = [current, ...(header ? [header] : [])].flatMap((node) =>
      [...node.querySelectorAll<HTMLElement>("button:not(:disabled), a[href]")].filter((key) => key.getClientRects().length));
    if (!keys.length) return;
    event.preventDefault();
    const index = keys.indexOf(document.activeElement as HTMLElement);
    keys[(index + (event.shiftKey ? -1 : 1) + keys.length) % keys.length]!.focus();
  }, { signal });
  signal.addEventListener("abort", () => restore(false), { once: true });
  return {
    get active() { return current !== null; },
    set(overlay: HTMLElement, show: boolean) {
      if (!show) {
        overlay.hidden = true;
        if (current === overlay) restore();
        return;
      }
      if (current === overlay && !overlay.hidden) { mask(); return; }
      if (current) { current.hidden = true; restore(false); }
      previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      current = overlay;
      overlay.hidden = false;
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      mask();
      layout();
      // Rewind the same approved slam on every entry, including repeated GAME OVER screens.
      for (const animation of overlay.querySelector(".bf-sticker")?.getAnimations() ?? []) {
        animation.currentTime = 0;
        animation.play();
      }
      overlay.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    },
  };
}
