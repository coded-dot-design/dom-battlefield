/* Screen-reader announcements: one polite live region per document, rate-limited.
   Local stand-in for Fizlet's `fizlet/announce` brick, with the same contract, so a later
   vendor sync swaps this import for the brick's. Call it from view code, change-only: never from
   the model, and never per frame unless something changed.

   - The region is `[data-fz-announce]` (role="status", aria-live="polite", aria-atomic="true"),
     visually hidden (clipped to 1px, never display:none), appended to document.body on the first
     write and shared by every announcer on the page. destroy() removes it only if this instance
     created it.
   - say(key, text) queues text under key; a newer text for the same key replaces the pending one.
   - At most one write per `gap` seconds. A write joins the pending texts in first-queued order
     with ". ". The same text again is still announced (a trailing space toggles).
   - flush() writes now (results); a later write still waits out the gap. */
export interface Announcer {
  say(key: string, text: string): void;
  flush(): void;
  destroy(): void;
}

const HIDE = "position:fixed;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap";

export function announcer({ gap = 1, doc = document }: { gap?: number; doc?: Document } = {}): Announcer {
  const keys: string[] = [], texts = new Map<string, string>();
  let region: HTMLElement | null = null, own = false, last = -Infinity, timer = 0, prev = "";
  function el() {
    if (region?.isConnected) return region;
    region = doc.querySelector<HTMLElement>("[data-fz-announce]");
    if (!region) {
      region = doc.createElement("div");
      region.setAttribute("data-fz-announce", "");
      region.setAttribute("role", "status");
      region.setAttribute("aria-live", "polite");
      region.setAttribute("aria-atomic", "true");
      region.style.cssText = HIDE;
      doc.body.append(region);
      own = true;
    }
    return region;
  }
  const now = () => (doc.defaultView ?? globalThis).performance.now() / 1000;
  function write() {
    if (timer) clearTimeout(timer), (timer = 0);
    if (!keys.length) return;
    let text = keys.map((k) => texts.get(k)).join(". ");
    keys.length = 0;
    texts.clear();
    if (text === prev.trimEnd()) text = prev.endsWith(" ") ? text : text + " ";
    el().textContent = prev = text;
    last = now();
  }
  function schedule() {
    if (timer) return;
    const wait = last + gap - now();
    if (wait <= 0) return write();
    timer = setTimeout(write, wait * 1000) as unknown as number;
  }
  return {
    say(key, text) {
      if (!texts.has(key)) keys.push(key);
      texts.set(key, text);
      schedule();
    },
    flush: write,
    destroy() {
      if (timer) clearTimeout(timer), (timer = 0);
      keys.length = 0;
      texts.clear();
      if (own) region?.remove();
      region = null;
      own = false;
      prev = "";
      last = -Infinity;
    },
  };
}
