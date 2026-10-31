// Gameplay events for the site's play pages (site code: the games in src/, dist/ and vendor/ never call
// analytics). Every track() is a no-op until the visitor accepts, and on a build with no ids (no runtime
// on the page). Props are numbers and fixed words only: no names, no free text.
import { track } from "./track.mjs";

type Standing = { kills: number; deaths: number; you: boolean };
type Game = { readonly state: string; readonly platoons: boolean };

/**
 * Wraps a createBlitz call (the Blitz board at /blitz/play/): game_start when a match leaves the intro
 * (or a rematch starts), game_end from its onEnd standings (your kills, deaths, place, the field size,
 * the match length in seconds).
 */
export function played<T extends Game>(game: string, make: (onEnd: (st: Standing[]) => void) => T): T {
  let at = 0;
  let mode = "solo";
  const g = make((st) => {
    const i = st.findIndex((s) => s.you);
    const you = st[i];
    track("game_end", {
      game,
      mode,
      ...(you ? { kills: you.kills, deaths: you.deaths, place: i + 1 } : {}),
      tanks: st.length,
      duration: at ? Math.round((performance.now() - at) / 1000) : 0,
    });
    at = 0;
  });
  if (typeof window !== "undefined" && "siteAnalytics" in window) {
    // The module has no start callback: read its state once a second (no-op builds skip this).
    let last = g.state;
    const tick = setInterval(() => {
      let now: string;
      try {
        now = g.state;
      } catch {
        return clearInterval(tick); // destroyed
      }
      if ((now === "count" || now === "play") && (last === "intro" || last === "end")) {
        at = performance.now();
        mode = g.platoons ? "platoon" : "solo";
        track("game_start", { game, mode });
      }
      last = now;
    }, 1000);
  }
  return g;
}
