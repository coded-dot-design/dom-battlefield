# DOM Battlefield: Phase 1 handoff

## Start here (for agents)

DOM Battlefield (`@coded-design/dom-battlefield`, `0.6.8`, private, MIT) is a separate full-screen
squad-tactics app in the DOM VIRUS family: you command a Sherman tank and a platoon on a DOM-built
grid map. It is **not** an engine game. It has its own model, view and controls, and takes snapshots
of Sherman Bytes' sprites and two hub modules. The hub ships its committed `dist/` at `/battlefield/`,
and it is the special-edition cartridge 02 on the shelf. Ecosystem context is in the hub
[HANDOFF.md](https://github.com/coded-dot-design/dom-virus/blob/main/HANDOFF.md); next steps are in
[FUTURE.md](FUTURE.md). The README holds the player-facing controls table and the changelog.

- **Play:** https://coded-dot-design.github.io/dom-virus/battlefield/ (pinned release, via the hub)
- **Preview:** https://coded-dot-design.github.io/dom-battlefield/ (every checked `main` push)

| Task | Where |
|---|---|
| Maps, units, commands, pathfinding, combat, objectives (no DOM) | `src/model.ts` |
| DOM grid/terrain, tank buttons, minimap, projectiles, debris, camera | `src/view.ts` |
| Input, stick, buttons, setup, ready gate, install card, loop, lifecycle | `src/client.ts` |
| Markup for every control and panel | `index.html` |
| Styles, 3D button families, cockpit rails | `src/style.css` |
| Manifest and Home Screen icons | `public/` |
| Tank art, selection lock, audio | not here: `sherman-bytes/src/sprites.ts`, `dom-virus/src/{selection-lock,audio}.ts`, then `node scripts/sync-shared.mjs` |
| Size budget | `scripts/size.mjs` |

**Invariants**

- Never edit `shared/` by hand. Change the owning repo, then run `node scripts/sync-shared.mjs`
  (needs sibling checkouts); `shared/ORIGIN.json` records version and SHA-256 per file.
- `dist/` is committed and is what the hub ships. Rebuild it with `npm run build` (which also writes
  `dist/build.json` with the version and file hashes); CI fails if it differs.
- A release bumps `package.json`, both top-level version fields in `package-lock.json` and the
  README changelog together with the rebuilt `dist/`. CI tags `v<version>`; update
  `dom-virus/battlefield.json` (`version` and `ref`) only after the tag exists.
- Every button follows the 3D press rule. `src/style.css` documents it: families set
  `--px/--py` (base offset) and `--hx/--hy` (hover lift); press and selected land exactly on the
  base; no `scale()`, no overshoot.
- Hot paths move only transforms and opacity. Layout is read once per touch start or resize (cached
  in `View`), never per frame or per `pointermove`; DOM writes happen only on change.
- Respect reduced motion (`prefers-reduced-motion` is passed to `view.render` and styled).
- Mobile must stay smooth and fit: landscape rails must not overlap at 844x330 or 667x300.
- Terrain colours live in CSS variables set per `[data-terrain]` (on both the world and the
  viewport); tile rules only read variables. Add a climate by adding one variable block.
- Setup (location, density, seed, side, formation, size, loadout) persists in
  `localStorage["dom-battlefield:setup"]`. The Strategy panel (`#bf-strategy`, fixed, outside the
  stage so it layers over the rails) edits it during the plan step; `preview()` rebuilds while
  `planning`. `?debug` adds `battlefield.end(won)` for after-action tests.
- Button tips (`coach()`) place only after the `[data-tip]` targets stop moving for 8 frames; any
  control can set `data-tip-more` (tap-to-expand detail) and `data-tip-at` (label side).

**Verify before you push**

```sh
npm ci                   # Node 24 recommended (CI uses 24)
npm run check            # typecheck, model tests, build (dist + build.json)
npm run size             # fails above 30,000 B gzip for html + js + css
CHROMIUM_PATH=/path/to/chrome npm run test:browser   # or: npx playwright install chromium
git status               # dist/ must be committed and match the build
```

## 1. The game

Pick one of four seeded operations (Hedgerow breach, Desert spearhead, Winter crossroads, Twin
bridges), a side, a formation, a squad size (4/8/12 per side) and scout/medium/heavy loadouts
within a 12-point budget. Capture the enemy HQ, hold a crossroads or eliminate the platoon; your
command tank must survive. Aim modes (Auto, lock a tank, lock a square, or **Command**), squad
orders (fall in, retreat, advance, attack), routes for wingmen, repair kits and HQ repair.

**Command (0.7.0), the core of the strategy layer.** Every battle opens with a frozen *plan step*
in command mode (`planning` in `client.ts`; the loop skips `step()`). Command is one switch with
Auto/Lock (`setCommand`, `setAim`); live, time runs at 0.5x and the player's gun is off. The
client keeps a `draft` (stops) for the selected tank; `plot()` (model) previews it leg by leg;
Lock sends `{ type: "route", id, cells }`. In the model a unit's `route` is its remaining stops;
`arrive()` shifts to the next; at the end the order is `hold` at `hold` (enemy HQ = capture).
Squad orders and attack commands clear routes. Gestures (command mode only): drag a stop/flag
(`[data-stop]`), drag the line (`.bf-route-hit`) to insert a stop on the nearest leg, drag open map
to pan, tap a square to set the destination. Routes draw on one SVG in map units
(`View.routes`), rebuilt only when their JSON key changes.

## 2. How it uses the DOM

The map is a DOM grid built at setup; terrain (houses, hedges, cars, towers) are elements that are
destroyed into debris and rubble by updating existing nodes. Each tank is a DOM button carrying the
small cached Sherman canvas renderer; there is no full-screen canvas board.

## 3. Architecture

`model.ts` is serializable state and pure rules (a boundary for a future transport); `view.ts` owns
nodes and layout caches; `client.ts` wires input and the one animation loop (fixed 60 Hz steps with
bounded catch-up). `shared/` holds `sherman-sprites.ts`, `selection-lock.ts` and `audio.ts`.
`.github/workflows/pages.yml` builds, checks and deploys the preview from `dist/`.

## 4. Controls

- **Desktop:** WASD/arrows drive; pointer aims; hold Space or click to fire; Q auto-aim, T lock,
  G attack, F/R/E fall in, retreat, advance; 1–9 select a wingman; M pan, C center; P pause, Esc.
  O command mode (Enter lock, Backspace clear, N next tank, H attack HQ).
- **Mobile (own implementation, not the engine kit):** an analog thumbstick with a 0.15 dead zone
  and proportional throttle; a hold-to-fire button (`data-key="Space"`, auto-aim); icon-only arcade
  buttons for Auto, Lock, Center, Pan, Pause and orders; the `.down` class for held presses.
- **Mobile shell:** Deploy requests full screen and a landscape lock; a ready gate pauses the battle
  until the phone is landscape and full screen (landscape only where full screen is unavailable,
  e.g. iOS Safari tabs). An iOS card explains Add to Home Screen; Android gets an Install button.
  Safe-area rails, wake lock, no scroll/zoom/callouts while playing, follow camera, haptics.
- **Eject** returns to `dom-virus/?board=battlefield#console`, playing the board-closing return.

## 5. Performance

Line-of-sight refreshes at 5 Hz per tank; one occupancy set per tick for pathfinding; caps of 48x30
cells, 200 shots and 96 effects; minimap moves in tenth-cell steps; cached viewport and pointer
geometry; diffed highlights; no per-tile inline grid styles; pause cancels the loop.

## 6. Size

`scripts/size.mjs` gzips `dist/index.html`, `assets/battlefield.js` and `assets/battlefield.css`
and fails above **40,000 B** total. At 0.8.0: 5,985 + 20,929 + 10,611 = **37,525 B** gzip (about
2.5 KB headroom). The budget went 24 → 28 KB (0.3.0) → 30 KB (0.5.0) → 36 KB (0.7.0, command mode)
→ 40 KB (0.8.0, terrain themes and the two-step setup).

## 7. Release and hub pin

`check.yml` runs `npm run check`, `size`, `git diff --exit-code -- dist`, installs Playwright
Chromium and runs `test:browser`; `tag-version` then tags `v<version>` on `main`. The hub's
`scripts/prepare-battlefield.mjs` checks the pin against `package.json` and `dist/build.json` hashes
(a sibling checkout must match the pin, so pin after the tag). Hourly hub builds follow the newest
tag in the pinned major line; bump `battlefield.json` to pin a build or move to a new major line.

## 8. On the hub

Cartridge **02**, special edition (sticker, two console LEDs), accent cyan, "SQUAD TACTICS". Two
actions: **RED LAUNCH** (pad A) grows the screen and folds open the board, then loads `/battlefield/`;
**BLUE INFO** (pad B) morphs into the info page `/games/battlefield/`, which swaps to Sherman Bytes
via `swapHref` (Sherman's page swaps back).

## 9. Lessons and pitfalls

- iOS Safari tabs cannot go full screen; only a Home Screen launch can. Home Screen PNG icons must
  be full-bleed (0.6.5) because iOS rounds and clips borders.
- Short landscape screens (~300–330 px with Safari bars): rails size from `dvh` (0.4.1).
- Browser tests: leave full screen before resizing; send waypoint taps to the map so a passing tank
  cannot intercept them; tolerate fast waypoint arrival. Failures are reported as CI annotations.
- `shared/ORIGIN.json` labels the sprites as Sherman 0.5.1 (the file is identical in 0.5.2) and the
  hub files as 0.11.1; hashes match current sources. Re-sync to refresh the labels.

## Keeping this file current

Update HANDOFF.md and FUTURE.md as part of any change that alters behaviour, architecture or
workflow. Every repo in the ecosystem keeps both files.
