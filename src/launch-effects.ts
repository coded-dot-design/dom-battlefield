import "./launch-effects.css";

/** Launch keys blow up like the hub hero's bad guys: the key presses in and its face inverts (light for dark, same hues), then it
 *  shatters into spinning chunks with a flash, a shock ring and square debris that falls away.
 *  The action stays synchronous so mobile fullscreen keeps its user activation; the inert copy
 *  survives the resulting layout. */
export function createLaunchEffects(
  root: HTMLElement,
  signal: AbortSignal,
  reduced: () => boolean,
  impact: () => void,
) {
  let cancel = () => {};
  signal.addEventListener("abort", () => cancel(), { once: true });
  const PRESS = 90, LIFE = 760, COLS = 3, ROWS = 2;
  const ease = "cubic-bezier(.15,.8,.3,1)";
  // The inverse of the key: light turns dark and dark light, each colour keeping its hue.
  const INVERT = "invert(1) hue-rotate(180deg)";

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
        const rect = button.getBoundingClientRect(), style = getComputedStyle(button);
        const ink = style.color;
        layer = document.createElement("div");
        layer.className = "bf-launch-burst";
        layer.setAttribute("aria-hidden", "true");
        layer.inert = true;
        Object.assign(layer.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
        // On <body>, "fixed" is the viewport whatever layout the action switches the game to.
        document.body.append(layer);
        const cap = copy(button, style, rect);
        layer.append(cap);
        const shadow = style.boxShadow.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/);
        const sink = Number(shadow?.[2] || 5);
        // Press into its own base, the face flips to its ink (the inverse), then it is gone.
        animations.push(cap.animate([
          { transform: "translate3d(0,0,0)", boxShadow: style.boxShadow, filter: "invert(0) hue-rotate(0deg)" },
          { transform: `translate3d(0,${sink}px,0)`, boxShadow: "0 0 0 transparent", filter: INVERT, offset: 0.9 },
          { transform: `translate3d(0,${sink}px,0)`, boxShadow: "0 0 0 transparent", filter: INVERT, opacity: 0 },
        ], { duration: PRESS + 10, easing: "ease-out", fill: "both" }));

        const add = (el: HTMLElement, frames: Keyframe[], ms: number, delay = PRESS) => {
          layer!.append(el);
          animations.push(el.animate(frames, { duration: ms, delay, easing: ease, fill: "both" }));
        };
        // The key itself breaks apart: each chunk is the key, clipped, flying off and turning.
        const w = rect.width, h = rect.height;
        for (let i = 0; i < COLS * ROWS; i++) {
          const col = i % COLS, row = Math.floor(i / COLS), chunk = copy(button, style, rect);
          Object.assign(chunk.style, { filter: INVERT, boxShadow: "none", translate: `0 ${sink}px` });
          chunk.style.clipPath = `inset(${(row * 100) / ROWS}% ${100 - ((col + 1) * 100) / COLS}% ${100 - ((row + 1) * 100) / ROWS}% ${(col * 100) / COLS}%)`;
          const cx = (col + 0.5) / COLS - 0.5, cy = (row + 0.5) / ROWS - 0.5;
          const dx = cx * w * 1.1 + (i % 2 ? 8 : -8), dy = cy * h * 1.4 - 18, spin = (cx || 0.3) * (col === 1 ? 60 : 120);
          chunk.style.transformOrigin = `${(col + 0.5) * (100 / COLS)}% ${(row + 0.5) * (100 / ROWS)}%`;
          add(chunk, [
            { transform: "translate(0,0) rotate(0) scale(1)", opacity: 1 },
            { transform: `translate(${dx}px,${dy}px) rotate(${spin}deg) scale(.82)`, opacity: 1, offset: 0.55 },
            { transform: `translate(${dx * 1.15}px,${dy + 46}px) rotate(${spin * 1.4}deg) scale(.6)`, opacity: 0 },
          ], LIFE - PRESS - 60);
        }
        const dot = (cls: string, size: number, color: string) => {
          const el = document.createElement("i");
          el.className = cls;
          Object.assign(el.style, { width: `${size}px`, height: `${size}px`, left: `${w / 2 - size / 2}px`, top: `${h / 2 - size / 2 + sink}px` });
          el.style.setProperty("--tone", color);
          return el;
        };
        const r = Math.min(w, h);
        add(dot("bf-launch-flash", r * 0.6, "#fff4ff"), [{ transform: "scale(.3)", opacity: 1 }, { transform: "scale(2.6)", opacity: 0.9, offset: 0.35 }, { transform: "scale(3.2)", opacity: 0 }], 320);
        add(dot("bf-launch-flash", r * 0.45, ink), [{ transform: "scale(.4)", opacity: 1 }, { transform: "scale(2.2)", opacity: 1, offset: 0.4 }, { transform: "scale(.2)", opacity: 0 }], 460);
        add(dot("bf-launch-ring", r * 0.5, ink), [{ transform: "scale(.5)", opacity: 1 }, { transform: "scale(5)", opacity: 0 }], 480);
        const palette = getComputedStyle(root),
          tones = [ink, ...["--k-attack", "--k-flag", "--k-cmd"].map((v) => palette.getPropertyValue(v).trim() || ink)];
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + (i % 2) * 0.3, d = r * 0.9 + (i % 3) * 18, s = 5 + (i % 3) * 2;
          const dx = Math.cos(a) * d * (w / h > 1.5 ? 1.5 : 1), dy = Math.sin(a) * d;
          add(dot("bf-launch-bit", s, tones[i % 4]!), [
            { transform: "translate(0,0) rotate(0)", opacity: 1 },
            { transform: `translate(${dx}px,${dy}px) rotate(${(i % 2 ? 1 : -1) * (90 + i * 25)}deg)`, opacity: 1, offset: 0.78 },
            { transform: `translate(${dx}px,${dy + 16}px)`, opacity: 0 },
          ], 640);
        }
        button.classList.add("bf-igniting");
        impactTimer = window.setTimeout(impact, PRESS);
      }
      button.classList.add("go");
      finishTimer = window.setTimeout(finish, reduced() ? 90 : LIFE);
      try { action(); } catch (error) { finish(); throw error; }
    },
  };
}

/** An inert copy of the key with its look frozen, so it survives the layout the action causes. */
function copy(button: HTMLButtonElement, style: CSSStyleDeclaration, rect: DOMRect) {
  const cap = button.cloneNode(true) as HTMLButtonElement;
  cap.removeAttribute("aria-label");
  cap.removeAttribute("data-tip");
  cap.classList.remove("go", "down");
  cap.classList.add("bf-launch-cap");
  cap.tabIndex = -1;
  const originals = [button, ...button.querySelectorAll<HTMLElement | SVGElement>("*")];
  const copies = [cap, ...cap.querySelectorAll<HTMLElement | SVGElement>("*")];
  const properties = ["background-color", "color", "border", "border-radius", "padding", "gap", "display", "grid-auto-flow", "grid-template-columns", "align-items", "align-content", "justify-content", "justify-items", "font", "letter-spacing", "width", "height", "fill", "stroke"];
  originals.forEach((node, i) => {
    const computed = i ? getComputedStyle(node) : style;
    for (const property of properties) copies[i]!.style.setProperty(property, computed.getPropertyValue(property));
    copies[i]!.removeAttribute("id");
  });
  Object.assign(cap.style, {
    position: "absolute", left: "0", top: "0", right: "auto", bottom: "auto", margin: "0", translate: "none", rotate: "none", scale: "none",
    transition: "none", animation: "none", minHeight: "0", boxSizing: "border-box", pointerEvents: "none",
    width: `${rect.width}px`, height: `${rect.height}px`, boxShadow: style.boxShadow,
  });
  return cap;
}
