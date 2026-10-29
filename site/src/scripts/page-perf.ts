// The Settings switch for the performance overlay (fizlet/perf) on a page. Off by default: until a
// visitor turns it on (the header key or F9) nothing loads and nothing runs. On, it loads the
// Fizlet kernel and the overlay and measures the page's own frames with an engine of its own
// (no systems: fps, frame times, dropped frames, heap). Off again, that engine stops (no frames).
// The choice lives in localStorage (dom-virus:perf), shared with the game and the DOM VIRUS sites.
import { setting, PERF_KEY } from "../../../vendor/fizlet/ui/board-ui";

export function pagePerf(button: HTMLElement) {
  let overlay: { show(on: boolean): void } | undefined, engine: { start(): void; stop(): void } | undefined, loading = false;
  const key = setting(button, PERF_KEY, (on) => {
    if (overlay && engine) return overlay.show(on), on ? engine.start() : engine.stop();
    if (!on || loading) return;
    loading = true;
    Promise.all([import("../../../vendor/fizlet/kernel/engine"), import("../../../vendor/fizlet/perf")]).then(([{ createEngine }, { perf }]) => {
      // Typing in a field must not freeze the meter: only a hidden tab pauses it.
      engine = createEngine({ pause: { editable: false } });
      overlay = perf(engine as Parameters<typeof perf>[0], { corner: "br", key: null, on: key.on });
      if (key.on) engine.start();
    });
  }, new AbortController().signal);
  document.addEventListener("keydown", (e) => {
    if (e.code === "F9" && !e.repeat) key.set(!key.on);
  });
}
