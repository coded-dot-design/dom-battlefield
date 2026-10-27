import "./launch-effects.css";

/** One short, bounded burst made from the actual game button. The action stays synchronous so
 * mobile fullscreen keeps its user activation; the inert copy survives the resulting layout. */
export function createLaunchEffects(
  root: HTMLElement,
  signal: AbortSignal,
  reduced: () => boolean,
  impact: () => void,
) {
  let cancel = () => {};
  signal.addEventListener("abort", () => cancel(), { once: true });

  return {
    cancel: () => cancel(),
    play(button: HTMLButtonElement, action: () => void, done: () => void = () => {}) {
      if (signal.aborted || button.disabled) return;
      cancel();
      const animations: Animation[] = [];
      let layer: HTMLElement | null = null, impactTimer = 0, finishTimer = 0, finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        clearTimeout(impactTimer);
        clearTimeout(finishTimer);
        for (const animation of animations) animation.cancel();
        layer?.remove();
        button.classList.remove("go", "bf-igniting");
        cancel = () => {};
        done();
      };
      cancel = finish;

      if (!reduced()) {
        // One event-time measurement. There are no simulation-loop reads or particle timers.
        const rect = button.getBoundingClientRect(), style = getComputedStyle(button);
        layer = document.createElement("div");
        layer.className = "bf-launch-burst";
        layer.setAttribute("aria-hidden", "true");
        layer.inert = true;
        Object.assign(layer.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
        const cap = button.cloneNode(true) as HTMLButtonElement;
        cap.removeAttribute("id");
        cap.removeAttribute("aria-label");
        cap.removeAttribute("data-tip");
        cap.classList.remove("go", "down");
        cap.classList.add("bf-launch-cap");
        cap.tabIndex = -1;
        // Preserve the three buttons' different layouts, faces and icon sizes without new art.
        const originals = [button, ...button.querySelectorAll<HTMLElement | SVGElement>("*")];
        const copies = [cap, ...cap.querySelectorAll<HTMLElement | SVGElement>("*")];
        const properties = ["background-color", "color", "border", "border-radius", "padding", "gap", "display", "grid-auto-flow", "grid-template-columns", "align-items", "align-content", "justify-content", "justify-items", "font", "letter-spacing", "width", "height", "fill", "stroke"];
        originals.forEach((node, i) => {
          const computed = i ? getComputedStyle(node) : style;
          for (const property of properties) copies[i]!.style.setProperty(property, computed.getPropertyValue(property));
          copies[i]!.removeAttribute("id");
        });
        Object.assign(cap.style, { width: `${rect.width}px`, height: `${rect.height}px`, boxShadow: style.boxShadow });
        layer.append(cap);
        root.append(layer);
        const shadow = style.boxShadow.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/);
        const x = Number(shadow?.[1] || 0), y = Number(shadow?.[2] || 5);
        const pressed = `translate3d(${x}px,${y}px,0)`;
        animations.push(cap.animate([
          { transform: "translate3d(0,0,0)", opacity: 1, boxShadow: style.boxShadow, offset: 0 },
          { transform: pressed, opacity: 1, boxShadow: "0 0 0 transparent", offset: 0.24 },
          { transform: pressed, opacity: 1, boxShadow: "0 0 0 transparent", offset: 0.33 },
          { transform: pressed, opacity: 0, boxShadow: "0 0 0 transparent", offset: 0.58 },
          { transform: pressed, opacity: 0, boxShadow: "0 0 0 transparent" },
        ], { duration: 460, easing: "linear", fill: "both" }));
        const ring = document.createElement("i");
        ring.className = "bf-launch-ring";
        layer.append(ring);
        animations.push(ring.animate([
          { transform: "scale(.85)", opacity: 0 },
          { transform: "scale(1)", opacity: .9, offset: .15 },
          { transform: "scale(1.55)", opacity: 0 },
        ], { delay: 110, duration: 300, fill: "both" }));
        for (let i = 0; i < 16; i++) {
          const pixel = document.createElement("i"), col = i % 4, row = Math.floor(i / 4);
          pixel.className = "bf-launch-pixel";
          pixel.style.left = `${(col + .5) * rect.width / 4}px`;
          pixel.style.top = `${(row + .5) * rect.height / 4}px`;
          pixel.style.setProperty("--pixel", `${6 + i % 3 * 3}px`);
          pixel.style.background = ["var(--k-sys)", "var(--k-cmd)", "var(--k-attack)", "var(--k-flag)"][i % 4]!;
          layer.append(pixel);
          const dx = (col - 1.5) * (42 + i % 3 * 12), dy = (row - 1.5) * 38 - 26;
          animations.push(pixel.animate([
            { transform: "translate3d(0,0,0)", opacity: 0 },
            { transform: "translate3d(0,0,0)", opacity: 1, offset: .08 },
            { transform: `translate3d(${dx}px,${dy}px,0) scale(.25)`, opacity: 0 },
          ], { delay: 110 + i % 4 * 12, duration: 280 + i % 4 * 25, easing: "cubic-bezier(.12,.65,.3,1)", fill: "both" }));
        }
        button.classList.add("bf-igniting");
        impactTimer = window.setTimeout(() => { cap.classList.add("bf-launch-impact"); impact(); }, 110);
      }
      button.classList.add("go");
      finishTimer = window.setTimeout(finish, reduced() ? 90 : 560);
      try { action(); } catch (error) { finish(); throw error; }
    },
  };
}
