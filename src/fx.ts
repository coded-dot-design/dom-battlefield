/** Big-moment keys (START BATTLE, Quick start, Plan battle): the key presses into the page, flashes
 *  and bursts into neon pixels that scatter and fade — the DOM VIRUS hit burst, done in the DOM.
 *  A copy plays the effect, so the game moves on at once. START BATTLE also fires the first shot:
 *  a tracer from your HQ to theirs, bursting where it lands. One short-lived layer, then gone. */
const COLORS = ["--k-sys", "--k-cmd", "--k-attack", "--k-fire", "--k-advance", "--k-fallin"];
type Point = { x: number; y: number };

export function blast(el: HTMLElement, host: HTMLElement, shot?: { from: Point; to: Point; color: string }, at?: DOMRect) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = at ?? el.getBoundingClientRect();
  if (!r.width) return;
  const css = getComputedStyle(host),
    colors = COLORS.map((c) => css.getPropertyValue(c).trim()).filter(Boolean),
    layer = document.createElement("div");
  layer.className = "bf-fx";
  layer.setAttribute("aria-hidden", "true");
  host.append(layer);
  // The key: a copy sinks onto its base, flashes, then pops.
  const ghost = el.cloneNode(true) as HTMLElement;
  for (const n of [ghost, ...ghost.querySelectorAll("[id]")]) n.removeAttribute("id");
  ghost.tabIndex = -1;
  ghost.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;right:auto;bottom:auto;width:${r.width}px;height:${r.height}px;margin:0;translate:none;transition:none;animation:none`;
  layer.append(ghost);
  ghost.animate(
    [
      { transform: "translateY(0)", filter: "none", opacity: 1 },
      { transform: "translateY(5px)", filter: "none", opacity: 1, offset: 0.22 },
      { transform: "translateY(5px) scale(1.07)", filter: "brightness(2.2)", opacity: 1, offset: 0.4 },
      { transform: "translateY(5px) scale(0.55)", filter: "brightness(2.2)", opacity: 0 },
    ],
    { duration: 520, easing: "ease-out", fill: "forwards" },
  );
  const burst = (cx: number, cy: number, w: number, h: number, count: number, reach: number, delay: number) => {
    for (let i = 0; i < count; i++) {
      const p = document.createElement("i"),
        x = cx + (Math.random() - 0.5) * w,
        y = cy + (Math.random() - 0.5) * h,
        a = Math.atan2(y - cy, x - cx) + (Math.random() - 0.5) * 0.9,
        d = reach * (0.35 + Math.random() * 0.65),
        s = 4 + Math.round(Math.random() * 5);
      p.className = "bf-px";
      p.style.cssText = `left:${x}px;top:${y}px;width:${s}px;height:${s}px;background:${colors[i % colors.length]}`;
      layer.append(p);
      p.animate(
        [
          { transform: "translate(-50%,-50%)", opacity: 1 },
          { transform: `translate(calc(-50% + ${Math.cos(a) * d}px),calc(-50% + ${Math.sin(a) * d}px)) rotate(${Math.round((Math.random() - 0.5) * 540)}deg) scale(0.3)`, opacity: 0 },
        ],
        { duration: 520 + Math.random() * 420, delay, easing: "cubic-bezier(0.15, 0.75, 0.3, 1)", fill: "both" },
      );
    }
    const ring = document.createElement("i");
    ring.className = "bf-ring";
    ring.style.cssText = `left:${cx}px;top:${cy}px;width:${Math.max(w, h)}px;height:${Math.max(w, h)}px`;
    layer.append(ring);
    ring.animate(
      [
        { transform: "translate(-50%,-50%) scale(0.2)", opacity: 1 },
        { transform: "translate(-50%,-50%) scale(1.9)", opacity: 0 },
      ],
      { duration: 460, delay, easing: "ease-out", fill: "both" },
    );
  };
  burst(r.left + r.width / 2, r.top + r.height / 2, r.width, r.height, 44, Math.max(110, r.width * 1.2), 150);
  let end = 1100;
  if (shot) {
    // The first shot: a tracer from your HQ to theirs, a burst where it lands, a flash.
    const dx = shot.to.x - shot.from.x,
      dy = shot.to.y - shot.from.y,
      len = Math.hypot(dx, dy),
      t = document.createElement("i");
    t.className = "bf-tracer";
    t.style.cssText = `left:${shot.from.x}px;top:${shot.from.y}px;width:${len}px;rotate:${Math.atan2(dy, dx)}rad;--tc:${shot.color}`;
    layer.append(t);
    t.animate(
      [
        { transform: "scaleX(0)", opacity: 1 },
        { transform: "scaleX(1)", opacity: 1, offset: 0.6 },
        { transform: "scaleX(1)", opacity: 0 },
      ],
      { duration: 420, delay: 120, easing: "ease-in", fill: "both" },
    );
    burst(shot.to.x, shot.to.y, 30, 30, 26, 90, 380);
    const flash = document.createElement("i");
    flash.className = "bf-flash";
    layer.append(flash);
    flash.animate([{ opacity: 0.22 }, { opacity: 0 }], { duration: 260, delay: 380, fill: "both" });
    end = 1400;
  }
  setTimeout(() => layer.remove(), end);
}
