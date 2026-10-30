# DOM Battlefield

A separate, lightweight squad-tactics app in the DOM Virus family. Battlefield builds the map, terrain, objectives and platoon simulation. Sherman Bytes owns the tank artwork and its cached renderer. Battlefield adds **zero bytes** to the Sherman game bundle.

Site: https://coded-dot-design.github.io/dom-battlefield/ (landing page, every checked `main` push)
Style guide: https://coded-dot-design.github.io/dom-battlefield/style-guide/ (Board UI, the board design system)
Preview: https://coded-dot-design.github.io/dom-battlefield/play/ (the game, every checked `main` push)
Play: https://coded-dot-design.github.io/dom-virus/battlefield/ (latest release, via the hub)

Custom domain (battlefield.domvirus.com): set the repo variables `SITE_URL=https://battlefield.domvirus.com`
and `SITE_BASE=/`, then the Pages custom domain in the repo settings. The Pages build writes `CNAME` from
`SITE_URL`. Blitz's own site is battlefieldblitz.domvirus.com (repo dom-battlefield-blitz); `/blitz/` here stays
for old links and embeds (`/blitz/blitz.js`), with its canonical on battlefieldblitz.domvirus.com.

Release flow: push to `main` → checks pass → `vX.Y.Z` tag is created from `package.json` and the site deploys. The hub's hourly Pages build picks up the newest tag in the pinned major line automatically; bump `dom-virus/battlefield.json` only for a new major line or to pin a specific build. Roll back by re-pinning an older tag in the hub.

## The site

`site/` is an Astro site for GitHub Pages, seeded from the game: the page is a Board UI root
(`<html class="bui">`), so it wears the game's own tokens, keys and vertical shadows.

| Path | What | Source |
|---|---|---|
| `/` | Landing page; the hero is a live battle on Fizlet (game sprites, airstrikes, shootable headline; a still poster under reduced motion) | `site/src/pages/index.astro`, `site/src/scripts/arena/`, `site/src/components/ArenaPoster.astro` |
| `/style-guide/` | Board UI, live (palette switcher, every component, isolation demo) | `site/src/pages/style-guide/index.astro` |
| `/play/` | The game: a copy of `dist/` | `scripts/pages.mjs` |
| `/v/<version>/` | Every release, the current one included: each release's own committed `dist/` at its tag, unchanged and `noindex`; the landing page's EVERY BUILD picker opens them | `site/archive.json`, `scripts/archive.mjs` |
| `/blitz/` | **Battlefield Blitz** (the Blitz version): landing page, a live bot battle in the hero | `site/src/pages/blitz/index.astro` |
| `/blitz/play/` | Blitz, the game (free for all, 3-minute match) | `site/src/pages/blitz/play/index.astro` |
| `/blitz/blitz.js` | Blitz drop-in for any website | `vendor/blitz/` |

`npm run build && npm run site:build` writes `artifacts/pages` (and checks every local link);
`npm run test:site` tests it; `npm run sync:archive` re-pins `site/archive.json` to every tag up to and including the current version (run it after a release is tagged; `tests/archive.mjs` fails while one is missing; every `/v/<version>/` page is `noindex`); `npm run shots` retakes the landing-page screenshots from `dist/`.
The site's Board UI is `fizlet/ui` from the vendored Fizlet engine (`vendor/fizlet/ui/`); its spec is
[BOARD-UI.md](https://github.com/coded-dot-design/fizlet/blob/main/src/ui/BOARD-UI.md) in the Fizlet repo.

**Battlefield Blitz** (the arcade version) is its own repo,
[dom-battlefield-blitz](https://github.com/coded-dot-design/dom-battlefield-blitz), built on the
[Fizlet](https://github.com/coded-dot-design/fizlet) engine. Its pages live here so they share the
Battlefield brand and styling; `vendor/blitz/` pins its build (`node scripts/sync-blitz.mjs` after a
Blitz release; `ORIGIN.json` records the version and commit).

**Custom domain (dombattlefield.com):** set the repo variables `SITE_URL=https://dombattlefield.com`
and `SITE_BASE=/` (Settings → Secrets and variables → Actions), add the domain under
Settings → Pages, and point the DNS at GitHub Pages. Both the original and Blitz then live there.

## The game

Four seeded arcade operations: Hedgerow breach, Desert spearhead, Winter crossroads and Twin bridges. Choose either fictional side, one of three deployment formations, and a squad of 4, 8 or 12 tanks per side. A four-slot scout/medium/heavy loadout fits within a 12-point budget and repeats for larger squads. Capture an opposing HQ, hold a contested crossroads, or eliminate a platoon. Your command tank must survive.

**Three stages.** *Setup:* an empty field with the two HQs and a location card; pick a place (each has a terrain thumbnail) and its ground appears, with Terrain (Light / Normal / Heavy, and a dice for a new layout at the same density) right under it. Then **Quick start** (anything not picked is rolled at random) or **Plan battle**. *Plan:* time is frozen and three cards float over the whole field: **Platoon** (side, formation, squad size), **Loadout** (four tanks, 12 points) and **Plan**. Cards open on the side away from your team, carry round shortcuts to the other cards, and can be dragged anywhere. *Battle:* on phones, a see-through rail on each side of a full-screen field.

**Move through planning.** On desktop, a purple footer gives Platoon a **Next** key and Loadout **Previous / Next** keys. The round card shortcuts remain available; on phones their compact labels show the next step without adding a footer. Click or tap a card's raised icon (the number on Plan) once to shrink it, and again to expand it. An arcade hint points at that key, and hover or keyboard focus explains the action. The desktop **Start battle** key keeps its place at the bottom centre while cards and sides change.

**Command your squad.** In Plan, tap a field tank or its platoon key and pick one of the three orders beside it: Attack HQ, Follow me, or Command (tap the map to plant a flag, drag the line or the flag, then the check). Tap a lit order again to clear it. The arrow above the orders locks any draft and moves to the next tank. Move HQ / Move Tanks is a switch on the plan card. Locked tanks drive their route and hold that square when they arrive (on the enemy HQ that is a capture). Start battle when you're ready. During the battle, Command is the third aim mode beside Auto and Lock: time runs at half speed and your gun is off, so redirect quickly and switch back. Fall in follows your command tank; Retreat returns to headquarters, where tanks repair. Advance returns the squad to the objective. Every map has alternate connected routes. Houses, hedges and parked cars can be destroyed into pixel debris and rubble. Rocks and water remain permanent; fences stop tanks but allow shells through.

Setup and planning always show the whole field (fit to width or height). Desktop battles keep that view; phone battles zoom in with a camera (Pan, Center, minimap), and Command slides the right rail off so you can see and direct the squad. Auto-aim on phones is a switch: it stays on through Command and locks until you turn it off. The first time a phone loads the game, one card explains how to get true full screen (iPhone: Add to Home Screen; Android: Install); Full screen brings it back where the browser can't go full screen. On iPhone, sound plays through the silent switch (the mute key is the off switch). Resizing an active battle adjusts presentation without resetting terrain, damage or positions.

When the desktop footer runs short of room, the platoon moves into its own draggable card below the sector map, with 44px tank keys and the same grid / column / row choices as full screen. Pause and result overlays grey out the field, block background interaction, and place their action keys near the map's bottom centre. Every entry repeats the sticker's slam and press, including Game over.

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move command tank | WASD / arrows | Analog thumbstick |
| Aim | Pointer | Nearest visible enemy |
| Fire | Hold Space / click / right-click | Hold Fire |
| Fall in / retreat / advance | F / R / E | Labeled buttons |
| Select wingman | 1–9 or click | Tap tank / platoon key |
| Command mode | O | Command (chevrons) beside Auto / Lock |
| Send a tank | Command: click tank, then a square | Command: tap tank, then a square |
| Bend / move a route | Drag the line / the flag | Drag the line / the flag |
| Lock · clear · next · attack HQ | Enter · Backspace · N · H | Check · tap the lit order · arrow · flag |
| Button tips | ? beside the battlefield title | First battle of a visit; Menu → ?; tap a label for details |
| Keyboard controls | Keyboard icon beside the battlefield title (hover or click) | — |
| Performance overlay (off by default) | Bar-chart key in the header, or F9: fps, frame times, dropped frames, engine work, heap over the map's corner (remembered, shared with DOM VIRUS) | Menu → bar-chart key |
| Planning cards | Next / Previous footer keys or round shortcuts | Labeled round shortcuts |
| Shrink / expand a card | Click its icon or Plan number; Enter / Space when focused | Tap its icon or Plan number |
| Move a card | Drag its grip or any empty part | Same |
| Platoon layout | Floating card corner key: grid / column / row | — |
| Pause · surrender | White flag (P): Keep fighting or Surrender | White flag (Menu also pauses, with the header) |
| Route your own tank | ★ platoon key, then a square, Lock · steer to override | Same |
| Move HQ (plan only) | Drag your HQ, or Move HQ then a square | Same |
| Pan / recenter | M + drag / C | Pan + drag / Center |
| Pause / deselect | P / Esc | Pause / select your tank |

Sound is gesture-activated, optional, synthesized and bounded. Reduced motion keeps gameplay while reducing cosmetic effects. Pause, tab visibility, restart and exit clean up input, audio and mobile text-selection ownership.

**Quick start**, **Plan battle** and **Start battle** share a short press-and-pixel launch effect made from the actual button. The action starts on the same click; the cosmetic burst cleans up after 560ms, uses at most 16 square fragments, and adds no runtime dependency. Reduced motion uses a brief press without fragments.

## Local development

Node 24 recommended.

```sh
npm ci
npm run dev
npm run check
npm run size
npx playwright install chromium
npm run test:browser
```

`dist/` is the reproducible static app copied by the DOM Virus site's build; there is no runtime framework or server requirement. `npm test` runs the model tests, the replay test and the zero-allocation test (one file at a time, `--expose-gc`). `npm run size` checks the combined gzip size of JavaScript, styles and markup against **72,500 bytes**. Version 1.0.0 measures **71,911 bytes** (9,488 HTML + 40,211 JavaScript + 22,212 CSS). The allowance rises from 68,000 bytes for the move onto the Fizlet engine: the vendored kernel and `fizlet/rules` drops add 4,295 bytes of JavaScript over 0.18.13 (67,617 bytes), measured, with no runtime dependency.

## Boundaries

- `src/model.ts`: serializable map, units, commands, pathfinding, collision, objectives and combat. No DOM dependency.
- `src/view.ts`: DOM grid/terrain and actor ownership, minimap, bounded projectiles and debris. Each tank is a DOM button carrying the original small cached Sherman canvas renderer; no fullscreen canvas board.
- `src/client.ts`: input, camera, setup, UI and lifecycle. The battle runs as one system on a Fizlet engine (`read` samples input, `step` simulates, `render` draws).
- `src/planning-cards.ts`: native fold keys, card state, navigation focus and reset behaviour.
- `src/battle-overlays.ts`: pause/result focus containment, saved background `inert` state, map-relative placement and repeatable sticker entry.
- `src/launch-effects.ts` and `src/launch-effects.css`: bounded launch feedback cloned from the pressed button; transient animations and timers clean up on completion, reset or abort.
- `vendor/fizlet/`: the [Fizlet](https://github.com/coded-dot-design/fizlet) engine's source, vendored with its version, commit and SHA-256 per file in `ORIGIN.json`. `node scripts/sync-fizlet.mjs` refreshes it from a sibling checkout (`../fizlet`, or `FIZLET_DIR`). Never edit it by hand.
- `shared/`: generated snapshots from owning repositories, with source versions and SHA-256 provenance in `ORIGIN.json`. `node scripts/sync-shared.mjs` refreshes them from sibling checkouts. The tank artwork is not independently maintained here.

Maps cap at 48×30 cells, with up to 24 tanks, 200 projectiles and 96 effects. The battle runs on the Fizlet kernel: one shared clock, fixed 60 Hz steps with bounded catch-up (3 steps a frame); pause stops the engine until resume. The step allocates nothing once warm (pooled shells and bursts, typed path buffers), and every random roll comes from the engine's seeded `random`, restarted from the map's seed, so a seed and the same orders replay the same battle. Repair kits are `fizlet/rules` drops. Cosmetic launch feedback uses bounded Web Animations and short cleanup timers, without a second simulation loop. Terrain is regenerated only during setup; destruction updates existing nodes. Geometry, presentation and command data stay separate.

This is a **single-player** game. Multiplayer, friend invites, co-op/opposing players, extension overlays and cross-game mashups are future work. Command objects and DOM-independent state provide a boundary for a future authoritative transport; networking, synchronization, authentication and cheat prevention are not implemented or implied. A future entity adapter can add other games' actors without moving their assets into the map engine.

## Historical inspiration

The presets are fictional arcade exercises, not accurate reconstructions or authentic opposing armies. Both teams currently use the Sherman silhouette. Inspiration: [US Army Ordnance Corps — Rhino tanks and Normandy hedgerows](https://goordnance.army.mil/history/Rhino.html), [National Army Museum — El Alamein](https://www.nam.ac.uk/explore/battle-alamein), and [US Army Center of Military History — The Ardennes](https://history.army.mil/Publications/Publications-Catalog/The-Ardennes-Battle-Of-The-Bulge/). Twin bridges is a fictional training drill.

MIT · Chris Cooley / coded.design

## Changelog

### Unreleased

- Site: every release is playable at `/v/<version>/`, the current one included (`/v/v1.0.1/`, the tagged 1.0.1 `dist/`); `site/archive.json` adds v0.18.13, v1.0.0 and v1.0.1 (68 builds, v0.1.0 to v1.0.1). Every `/v/<version>/` page is `noindex` (its canonical and `og:url` still point at `/play/`), so search engines list `/play/` only. `tests/archive.mjs` (in `npm run test:site`) fails while a released tag is missing from `site/archive.json`, checks every served build is `noindex` and boots v0.15.8 and the current release from the landing page's picker. The picker reads EVERY BUILD (was PAST BUILDS) and marks the current release. No game change.
- **Site: the hero battle at 30 fps (no game change)**
  - The landing hero's engine takes `fps: 30`, the Fizlet default for ambient heroes (every other Fizlet hero runs capped). It had no cap, so on a phone it asked for a frame on every vsync and redrew its full-hero canvas (585 × 1,274 px at 390 wide) each time. That kept the main thread pegged until the battle rested 30 s later. The battle still steps at a fixed 60 Hz (two steps a frame), so it plays the same. Between frames the engine is off the clock on one timer. Settle, the offscreen pause, reduced motion and Recall are unchanged.
  - Measured (Chromium, 390 × 844 phone, 4× CPU, seconds 6–11 after load, median of 3, the hero-less page in the same run at 0.5 %): main thread busy 91.7 % → 49.4 %, 45.7 → 23.1 rAF/s. Once settled, 0.2–0.3 % with or without the change. `test:site` now holds the cap on a phone: ≤ 33 rAF calls a second while battling, 0 once settled. It fails on the old build (60.0).

### 1.0.1 — Fizlet 0.19.0; the landing hero on Fizlet

- Fizlet 0.19.0 in `vendor/fizlet/` (the release tag; main had vendored a commit between 0.18.0 and 0.19.0, so the files are identical and only `ORIGIN.json` moves). No gameplay change; `dist/` measures 72,745 B gzip (40,919 JS + 22,277 CSS + markup).
- Site: the landing hero's battle runs on Fizlet bricks instead of its own loop. `fizlet/slot` mounts it once the hero is near and the page is idle (the landing page's own script drops from 7,821 to 1,730 B gzip); the kernel reads layout in its read phase only, steps the battle at a fixed 60 Hz and writes the page through its ledger (letters, HUD, the copy's shake), so Recall gives the hero back byte for byte. Explosions, scorch marks and pop words are `fizlet/fx`; the Sherman is `fizlet/sprite` data, pixel for pixel the game's tank (`test:browser` compares them). The battle steps without allocating (`tests/arena.test.mjs`: 20,000 busy steps, no minor GC).
- Same battle, same look: platoons, AI, shells, airstrikes, flattened shapes, knocked and squashed letters (the same keyframes and easings, now on the engine's clock instead of Web Animations and timers).
- New: 30 s after the last pointer move, tap or scroll, the battle rests (no new shots, the last ones land) and the engine settles to no frames until the visitor moves again. Reduced motion shows a still poster (`ArenaPoster.astro`: tanks parked mid-fight, both HQs) and never loads the scene. Sound still starts off; its synth loads with the first press of the sound key.
- Measured (Chromium, 1440 × 900, 5 s of battle, median of 3): hero frame script p50 0.9 ms / p95 4.5 ms (was 1.2 / 9.7); at 4× CPU throttle 3.6 / 7.5 ms (was 4.1 / 11.0). The live chunk is 12.3 KB gzip (scene 9.8 + kernel 2.5), loaded once the page is idle; Fizlet's hero goal is 10 KB.

### 1.0.0 — On the Fizlet engine

- The battle runs on [Fizlet](https://github.com/coded-dot-design/fizlet) 0.15.0, vendored in `vendor/fizlet/` (`node scripts/sync-fizlet.mjs`): the game's own animation loop is gone, and one Fizlet engine reads input, steps the battle at a fixed 60 Hz and renders. Command mode's half speed is every other step; planning still freezes time.
- Replayable: every random roll in a battle (repair kits, salvage) comes from the engine's seeded `random`, restarted from the map's seed. Same seed and orders, same battle, frame for frame; no `Math.random` in play (`tests/replay.test.mjs`).
- Zero allocation once warm: shells and bursts are pooled, paths fill typed buffers, line-of-sight candidates sort in scratch arrays, tanks share one object shape, and `Math.hypot` is gone from the step. Twenty thousand busy steps (twelve a side, every system working) make no minor GC (`tests/zero-gc.test.mjs`).
- Repair kits are `fizlet/rules` drops (they land where they spawn and stay until collected); the battle still times them (first at 4.2 s, then every 7 s) and caps them as before.
- Gameplay is unchanged: the new step plays the same battles as 0.18.13's to six decimals over whole matches (all four operations, 4 to 12 a side, with steering and firing).
- The site's Board UI is `fizlet/ui` (the vendored kit) instead of the hand-kept copy in `board-ui/`, which is gone; the style guide's spec and tokens links point at the Fizlet repo.
- Size gate 68,000 → 72,500 bytes gzip: 1.0.0 measures 71,911 (JavaScript +4,295 for the kernel and drops).

### Site — page keys press right (no game change)

- Every key on the site pages, link or button, presses onto its base and clicks anywhere on face or base. On a mouse a link key used to stay lifted when pressed (the kit's hover rule outranked press), and a click on the base missed (the base is a box-shadow). `board-ui/` takes Fizlet 0.14.1's fix: press beats hover, a `.bui-key::before` hit area over face and base, `pressCue` (Enter shows the press; iOS `:active`), aria-disabled link keys, a darker face under reduced motion.
- Every in-page key wears `bui-key`; START BATTLE and PLAY BLITZ are the kit sticker key (`bui-key bui-sticker-key bui-call`) at page size instead of their own `.start-key` states. `test:site` presses every page key (`tests/keys.mjs`: centre, top edge and base, Enter, taps at 390). `dist/` unchanged.

### 0.18.13 — Its own host: battlefield.domvirus.com

- The site is ready for battlefield.domvirus.com: with the repo variables `SITE_URL` and `SITE_BASE=/` the Pages build writes its `CNAME` and every canonical and og URL moves to the new host. The game's and the site's DOM VIRUS links now go to domvirus.com.
- Blitz lives on its own site, battlefieldblitz.domvirus.com: the nav and footer link there, and `/blitz/` here stays for old links and embeds with its canonical on the new host.

### 0.18.12 — Your tank's orders on the plan card

- Your own tank's pill and order keys now see its route: Attack HQ reads ATTACKING HQ (and the key lights, so a second tap clears it), a sent spot reads ROGER · GRID 0412. Your tank keeps its own order while it drives a route, which the card used to miss.

### 0.18.11 — Your tank on the plan card

- Your own tank's plan-card pill no longer says ON ITS OWN. It shows the same orders as the squad (ATTACKING HQ, ROGER · GRID 0412, PLOTTING), and with no order it reads YOU'RE DRIVING in your team colour with a star.

### Site — landing page and style guide (no game change)

- The repo's GitHub Pages is now the game's own site: a landing page at `/` (the hero is a live battle with the game's tank sprites: shells and treads knock the headline around, tap anywhere for an airstrike), the Board UI style guide at `/style-guide/` (moved here from DOM VIRUS with its kit and spec in `board-ui/`), and the game itself at `/play/`.
- Board UI kit: link keys (`<a class="bui-key ...">`) get the same face, base, hover, press and focus as button keys.

### 0.18.10 — Planning footer matches battle

- On a compact desktop the planning footer uses the same key logic as battle: with the platoon off the bar, keys switch to icons when their labels don't fit, so the AIM keys no longer sit on top of Attack.

### 0.18.9 — Planning footer stays on one row

- Planning on a compact desktop (below 1160px with more than four tanks, or whenever the platoon can't fit): the footer drops the PLATOON · RADIOS keys instead of wrapping, and the other keys get their labels back. You pick tanks on the plan card and the map; in battle the platoon card goes under the map as before.

### 0.18.8 — Plan card pill on the top edge, radio talk

- The order pill moved to the card's top edge, opposite the LOADOUT tab: flat (no 3D shadow) and breathing with the same glow as the selected tank key, so the two read as one. The Move HQ / Move Tanks switch and the tank number now sit opposite each other.
- Radio talk: a sent command location reads ROGER · GRID 0412 (the last waypoint's grid). Unsent routes read PLOTTING. Other orders keep their names.
- In Move HQ the card's badge shows the HQ icon instead of an empty box, and the title reads MOVE HQ.

### 0.18.7 — Plan card order pill, cards that fit

- Planning cards fit their content (up to the old height cap): the Next / Previous footer closes up instead of leaving an empty card over the map, and the resize handle can't stretch a card past its content.
- Plan card: the PLAN · TIME FROZEN line is gone (the comms bar says "Time is frozen"). The tank's order is a pill in the top right in the order's own colour and icon: ATTACKING HQ (attack pink, flag), FOLLOWING YOU (fall-in lime), COMMAND · N STOPS / HOLDING / DRAFT (command violet, chevrons), REPAIRING (your team colour, home), or ON ITS OWN (grey). Move HQ hides it; the Move HQ / Move Tanks switch sits under it, and the card keeps room at the top for the LOADOUT tab.

### 0.18.6 — Planning keys

- The first planning step is three keys, not cards: no grip, and they don't drag. The cards they open still do.
- Step keys: on phones the icon and its PREV / NEXT caption sit together; on desktop they take the rounded-square shape of the other icon keys instead of a circle.
- Full screen planning: the waiting platoon card sits in the top corner on your team's side (it covered the Loadout card on the far side), and follows a side change.

### 0.18.5 — Readable install card

- The install card never drops below one pixel a unit, so it reads on an upright phone too (the rest of the layout keeps its landscape scale).
- The "Best as an app" card is bigger (12u body, 14u title, 44u keys) and waits for landscape: while the phone is upright the rotate gate already carries the Add to Home Screen tip, so the card no longer covers it.

### 0.18.4 — The platoon row never wraps

- The desktop bar measures the platoon row (one 44px key and gap per tank) before choosing a layout: labels when everything fits on one line, icon keys when it doesn't (and always with more than four tanks below 1750px), and in battle the platoon moves to its card on the map (always with more than four tanks below 1160px). Eight or twelve keys no longer wrap to a second row.

### 0.18.3 — Labels and a clearer plan step

- **Desktop bar labels read like the full-screen cards**, first word bold: RADIO · EACH TANK, RADIO · WHOLE SQUAD (RADIO · TANK 2 with a tank selected), PLATOON · RADIOS and AIM · AUTO / LOCK. The compact desktop bar (icon keys, platoon card on the map) keeps one word per group: RADIO, WHOLE SQUAD, PLATOON, AIM. Full screen and touch are unchanged.
- **Planning keys.** The round Platoon / Loadout / Plan keys are bigger on desktop and phones (the phone caption keeps its size; the icon grows). Every planning tank icon has the ink outline of the Move Tanks key, and the Plan icon's route is one connected dashed line in command violet.
- **A clear plan step.** The round card keys no longer crowd the Plan card (as when it is shrunk); a LOADOUT tab on its top edge goes back a step. On phones the toast shows at the bottom of the field while the Plan card is up, instead of being squeezed off the edge.
- Size budget 68 KB.

### 0.18.2 — Full-screen card polish

- Keyboard focus on a 3D key: the ring wraps the face and its hard base together (the outline used to stop short of the base).
- Full screen from the first screen: the platoon card waits in the map's top-right corner during setup and planning (it used to land in the middle, over START BATTLE), then moves under the sector map in battle.
- Full-screen action cards share one spacing system: a header row with the card title (RADIO, AIM) and the list / grid switch (no longer clipped), group labels EACH TANK and WHOLE SQUAD, and each key's shortcut on its right edge.

### 0.18.1 — Full screen stays on

- Surrender, rematch and a new operation no longer drop you out of full screen; only the full-screen key (or Esc) turns it off.
- Phone planning: the round card keys (with PREV / NEXT) are bigger, so the icon reads and the caption has room. The planning toast spans the open side of the field instead of sliding under the open card.
- An unpinned orders card never lands on the Plan card: on unpin or drop it keeps a 10px buffer, moving below the card (or beside it when there is no room).

### 0.18.0 — Phase 1 go-live

- **Cartridge hand-off.** Launched from the hub's console, the pink doors close over the screen and stay shut through the page load (the stand-in DEPLOYING SQUAD board is gone). The game paints the same shut doors, holds its whole boot until it has loaded, then opens them onto the grid. A one-time session flag (`dom-virus:doors`) carries the hand-off; a direct link or a refresh plays the boot as before.
- **Boot screen.** LOADING and PRESS START share one spot, halfway between the sticker and the bottom edge, so the key landing never shifts the sticker. Once pressed and blown up, the key stays gone while the screen clears (it no longer fades back in under the pointer).
- **Command mode on desktop keeps out of the way.** In a battle the Plan card starts shrunk in the top-left corner and the orders card unpinned beside it. Shrinking, opening, pinning and unpinning are remembered (`dom-battlefield:battle-cards`). Planning keeps its pinned tooltip card.
- **Wave the white flag.** SURRENDER's icon is your team's colour in any theme with the flag always white. Pressed, the squares white out one by one, the flag waves, a losing sound plays and the key blows up over the next setup screen.
- **Button tips read on every theme.** The page now dims behind them (the backdrop colour was invalid), rings are thicker dashed lines with a light halo, and each ring hugs its keys (not the spacers beside them). On desktop the bottom bar's labels sit above their group, and the tips card moves to the top.
- **Full screen.** The floating cards have room in their header for the label and the corner switch, and the switch shows its mode (a list with labels, a grid for icons only). Entering full screen during planning no longer loses the platoon card when the battle starts.
- Platoon keys no longer spring up and back down on release (the selection paints at once).
- Size budget 66 KB.

### 0.17.1 — Boot screen, back-button guard

- **A boot screen when you open the game directly.** The hub's pink cartridge doors fold open, the grid fades in and lights up square by square, the two HQs draw in, and the BATTLEFIELD sticker (with the DOM VIRUS cartridge skull) slams down and presses in. LOADING gives way to **PRESS START** (click, tap, Enter or Space). Pressing it blasts the key, the sticker breaks up, the header and readouts drop in from the top, the map frame draws in from the top and down the sides, and the location card opens in the middle. Coming from the hub skips the doors (the cartridge already opened them); reduced motion skips the screen.
- **Back / forward guard.** Leaving the page shuts the game down, so a page the browser brings back with its back / forward buttons can't play. The game notices (on return, or on the first tap, key or focus) and locks itself behind a greyed field with a SOMETHING WENT WRONG · REFRESH sticker and a REFRESH BROWSER key that reloads to the start screen.
- **Command mode is easy to leave.** It turns your gun off, so firing now hands the gun back. On desktop, Space, right-click or the red GUN OFF · FIGHT key on the map all leave command mode (holding Space keeps firing), and the map gets a violet frame. On phones the Fire key stays when the right rail slides away: about a third smaller, slid right clear of the safe area, its crosshair turned 45° into an x. Tap it to close command mode and shoot.
- **Launch keys explode like the hub hero's bad guys.** Quick start, Plan battle, Start battle and PRESS START press in and flip to their inverse (light for dark, same hues), then shatter into spinning chunks with a flash, a round shock ring and square debris that falls away. This fixes the red flash, the square outline, and the burst landing off to one side when the layout changed.
- **Phone toast matches the desktop comms bar** (cyan signal edge, hard base, glow), sits above every key and card, and keeps clear of the header when it shows (setup, planning, menu, after a game over). Overlay stickers replay their slam and press on every entry, and again when you return to a backgrounded tab.
- The tank on the Move HQ / Move Tanks switch has an ink outline (it no longer melts into its team-colour key), and the plan card's tank badge keeps a base in its own colour, not violet.
- Size budget 66 KB (64.3 KB used).

### 0.17.0 — Clear planning, a dramatic launch and steady controls

- **Planning has a visible next step.** Desktop Platoon gets a purple footer with Next; Loadout gets Previous and Next. Existing round shortcuts still work, with compact step labels on phones instead of another footer. The loadout budget guard applies to both routes through the cards.
- **One press shrinks a card.** Platoon and Loadout icons and the Plan number are raised native buttons. Click, tap, Enter or Space shrinks or expands the card; a strong arcade hint points at the key, and its hover/focus tooltip says “Click to shrink” or “Click to expand”. This replaces double-click/double-tap folding.
- **All three launch keys get the same impact.** Quick start, Plan battle and Start battle press into the page and break into up to 16 square fragments from the actual button, with a short flash and ring. The game action happens in the original click; the local 560ms cosmetic effect cleans up its clone, animations and timers. Reduced motion keeps a brief press without particles. No runtime dependency is added.
- **Overlays follow one rule.** Pause and result panels grey out the field and make background controls inert, keep keyboard focus in the active panel, slam and press their sticker on every entry, and centre their action keys near the map's bottom edge on desktop and phone. Repeated Game over and Mission complete entries press correctly. Mobile menu and install-card flows retain their intended controls and pause state.
- **Desktop planning stays still.** Start battle keeps a reserved bottom-centre lane when cards or sides change. A crowded gameplay footer gives the platoon its own draggable card below the sector map, with 44px keys and the remembered grid / column / row layout.
- **Physical keys release cleanly.** Desktop radio, squad orders and platoon controls use matching cap and shadow timing, without the release bounce or a locked glow resetting the shadow between states.
- **Size:** 60,672 bytes gzip, up 3,353 bytes from 0.16.2's 57,319 bytes. The explicit feature allowance rises from 57,500 to 61,500 bytes; 828 bytes remain. Browser regression coverage includes card navigation and native folding, launch cleanup, repeated overlays, compact platoon placement and stationary button bases during release.

### 0.16.2 — Desktop full screen: a platoon card of its own

- The platoon leaves the sector map card for its own see-through card, just under the map until you drag it anywhere. It sizes to its keys (square), and its corner key cycles **grid** (2, 3 or 4 a row by squad size) → **column** (wraps to a second column past six tanks) → **row**; the choice is remembered.

### 0.16.1 — Polish: overlays, phone header, first screen, cards

- **Overlays grey the field out on their own** (a gunmetal veil with the field desaturated), on every stage and both layouts. The sticker header now slams in: it drops with a soft shadow far below it, hits with its hard base, then presses itself into the screen. Keys are bigger, and on the phone they sit at the bottom where START BATTLE and the setup keys are; the toast moves to the top.
- **Phone:** the Menu key lets go when the menu closes (it stayed pressed). The setup / plan header is taller, with a bigger logo, title and full-size keys.
- **First screen:** a clearer grid whose squares light up at random in the control colours; the two HQs face off across the middle (the enemy HQ takes its spot once you pick a place).
- **Cards:** a foldable card says so the first time it opens ("double-tap ▣ to fold"). An over-budget Loadout turns red, shakes and says what to fix, and no other card opens until it's fixed. Changing side (by hand or with the dice) puts the Platoon card back on the side away from your team.
- **Colour:** tank identity (your star, the wingman numbers, on the field and in Loadout) and the Loadout, Plan and formation icons use the command violet; no yellow left in the controls. The idle Auto / Lock key is a dim red cap that stands off the dark rim. The ★ key on your own tank lights in your team colour.
- **Orders card:** its pointer sits behind the keys (it no longer cuts one in half). Follow me on your own tank is a grey key resting pressed in.
- **Desktop:** the plan card in battle drops the planning-only Move HQ / Move Tanks switch. The left group is RADIO · EACH TANK (you radio a tank its coordinates). Every bar key is the same height. In full screen the map cards stack their keys in a column, and a corner key switches both to icons only (remembered).
- Size budget 57.5 KB.

### 0.16.0 — One control palette, locked orders, cleaner overlays

- **One colour system for every control, the same on desktop and phone, dark and light.** Cyberpunk meets Tron: neon caps on an ink rim. Cyan = navigation, violet = command (Command, routes, the check, and every locked order), red = the gun with Auto and Lock as its lighter twin, magenta = Attack, orange = Advance, lime = Fall in / Follow me, your team colour = Retreat to HQ, yellow = tank identity only (your star, wingman numbers). Faces read on both themes; text uses a deeper twin on light. All palette tokens live in one block (ready to be passed in from config later); duplicate and overridden rules were removed.
- **Locked vs. call.** A locked key rests pressed in its lock colour and breathes a soft glow; a key that wants a press keeps its top up and sends a ring out from the bottom of its base (the route check, the pager's forward key). All hard shadows now fall straight down.
- **Squad orders lock and release.** A squad order sets the plan aside instead of erasing it. Tap the lit order again to release the squad back to its routes. Attack picks its prey, takes on the next enemy in sight, and when none is left it ends by itself and the tanks drive on to their flags.
- **Orders card per tank.** A pager on top (back · ★ jump to your tank · forward; each move locks the current tank's orders) over Attack HQ / Follow me / Command. Pinned, it's a tooltip pointing at the tank; unpin it to get a grab bar and park it where it doesn't hide the field. Keys: B / N / Y.
- **Overlays are a sticker and two keys.** Give up?, Mission complete and Game over slap a sticker onto the dimmed field above two sticker keys (Keep fighting / Surrender, Rematch / New campaign). What it means — and the debrief: time, kills, losses — goes out over comms.
- **Desktop bar:** Command (TASKING) holds the far left opposite Surrender, then ORDERS · WHOLE SQUAD, the platoon in the middle, AIM on the right. Labels give way to icons when the platoon needs the room.
- **Desktop full screen:** the header leaves (a pressed full-screen key by the armour readout brings it back); the bar becomes see-through cards on the map — commands bottom left, aim and Surrender bottom right (both draggable) — and the platoon moves into the sector map card as a 2×2 / 3×3 / 4×4 grid.
- Size budget 56 KB (from 54.5 KB).

### 0.15.9 — Phone controls fix

- **Fix: on iPhone (above all from the Home Screen) the stick could stop driving your tank, and orders tapped while driving seemed dead.** Battle controls now listen to native touch events, which iOS delivers to every finger, and cancel them so a second finger is never read as a pinch or scroll. A new finger on the stick always takes it, and lifting every finger releases a stick or Fire key whose release iOS dropped, so a stuck stick can no longer survive a new battle.
- Order keys flash when tapped, and the order your squad (or the selected tank) is on stays lit.
- A tank jammed behind its own squad for more than a moment squeezes past instead of waiting forever.
- Loadout: your star is yellow with a dark rim, like the wingman number discs.
- Size budget 54.5 KB (from 54 KB).

### 0.15.8 — Audit fixes

- **Fix (0.15.7): tapping Menu on a phone could open the coded.design link** that drops in under the finger with the header. After a touch press, the click that follows is swallowed wherever it lands, so every key acts exactly once (a long hold no longer toggles twice; Pause no longer clicks the dim).
- Planning survives a resize (address bar, full screen, rotation): the map re-fits instead of regenerating, so routes and ground stay. A moved HQ is tied to the map size it was placed on.
- Enter (lock route) no longer also clicks the focused order button and clears the route.
- Cards: dragged, folded and resized cards go back to place when the battle starts and when you switch sides; a touch drag no longer eats the next tap on the card.
- Phone sector map taps aim where you tap (the rail margin is included). The Command key during desktop planning opens Plan.
- Move HQ / Move Tanks: tapping the lit side does nothing; tap the other side to switch. Fold boxes are focusable (Enter / Space); grips are hidden from screen readers.
- Quick start's rolled platoon is for that battle only: your own setup comes back afterwards.
- Removed dead CSS.

### 0.15.7 — Every key answers a second finger

- Touch presses on battle keys act the moment the finger lands (like Fire), so the orders, aim keys and platoon keys work while another finger drives or holds, in the phone cockpit and in the desktop layout on touch screens (tablets, touch laptops).

### 0.15.6 — First click counts

- Fix: on desktop a key clicked in the first moments after the page loaded could be ignored (0.15.5).

### 0.15.5 — Keys work while you drive

- Every rail key (Auto, Lock, the order diamond, Command, Center, Pan, menu, flag) now answers a second finger while your thumb is on the stick; before, phones only let Fire through.
- The invisible card grab has no hover outline on desktop.

### 0.15.4 — Steady keys

- The route check no longer jumps on hover or press: it presses into its base like every key, and once the route is locked it rests pressed and ignores taps.
- Next sits right over the Command key; with no room above it moves beside the row (right, or left near the edge), lined up and clear of the screen edges.
- The Plan icon's dashed route is in your team colour (readable on white). The rotate hint's phone has its camera at the top again (and turns clockwise, as before).

### 0.15.3 — Fold a card

- Double-tap a card's icon box (the plan card's tank badge) to fold the card down to that square, with its round shortcuts tucked behind it; drag it anywhere, double-tap to open it again.
- The resize grab on a card's bottom edge has no visual handle any more: just grab the bottom middle.
- Battle rails (and the stats and sector map panels) are about 20% more see-through, so tanks under them show.

### 0.15.1 — Full-height cards

- Location, Platoon and Loadout cards run the full height of the field (with a margin) and scroll; drag the yellow handle on the bottom edge to make one shorter (down to 30% of the window).
- A little more type and key height across the cards; cards are wider. The picked squad size sits in a solid dark box. On phones the side keys are just a bigger tank. Line and Column show three tanks, Wedge four.
- START BATTLE moves into the open space beside an open card; the white flag sits in the bottom corner on your side. The plan toast sits at the top of the open space. Picking a place scrolls its Terrain panel into view.
- Desktop: big squads (8 or 12) get narrower platoon keys, so the bottom bar no longer overlaps.

### 0.15.0 — Readable cards, real icons, safe-area HQs

- **Icons from the game's own Sherman sprite**, in your team colour: Platoon (three tanks in a wedge), Loadout (a heavy tank and its weight classes), Plan (a tank, its dashed route and the flag), plus tank keys for sides, formations (the four tanks in wedge, line or column; you are the yellow one) and loadout sizes.
- **Bigger type and keys everywhere** (phones and desktop): the location card, Platoon, Loadout, the plan card and its badges, the yellow tank hint and the radio toast. Squad size shows its number in a rounded box. Loadout swaps the row labels for emblems: a big star and a team-colour outline for your tank, the field number disc for each wingman.
- **Move HQ / Move Tanks** is two joined icon keys inside the plan card: one down, one up.
- **Dice** replace Randomize (dice only on phones) and the terrain re-roll; they tumble when tapped. Platoon and Loadout have no close key: the round shortcuts move on.
- **START BATTLE** is a wider, stacked sticker at the bottom centre with the white flag beside it, on open ground between the platoons. Orbit buttons are bigger.
- **Safe areas:** on phones both HQs sit far enough in from the edges to clear the notch, so every tank can be tapped; the order bubble flips under the tank near the top and stays clear of the edges. The enemy HQ now starts somewhere new in its zone on each map.
- **One shared yellow** from army yellow #FFCB05: a brighter flat neon on dark, the army tone on light (no more brown), and ink for yellow text on light.
- **Camera:** driving always brings the camera back to your tank (it could stay put after a pan in planning). The Terrain box lines up under the picked place.

### 0.14.1 — Narrow windows

- The phone layout scales by width as well as height, so a narrow desktop window keeps both rails side by side (the white flag was covered at 390px wide).

### 0.14.0 — The redesigned flow: setup, plan, battle

- **Setup:** an empty field with the two HQs until you pick a place. A location card with a terrain thumbnail per place; picking one shows its ground and opens Terrain under it (Light by default; the dice rolls a new layout without changing the density). Two sticker keys: Quick start (rolls anything not picked) and Plan battle.
- **Plan:** the whole field, frozen, with three cards (Platoon, Loadout, Plan) and Start battle bottom right on every one. Platoon and Loadout open on the side away from your team with round shortcuts to the other cards; every card has a yellow rim and grab pill and can be dragged anywhere.
- **Per-tank orders:** tap a tank and three round orders ride beside it (Attack HQ, Follow me, Command). One at a time; tap a lit one to clear it. Command plants a flag with a tap; a check by the flag locks the route and the arrow moves to the next tank. Move HQ / Move Tanks is a switch on the plan card.
- **Phone battle cockpit:** see-through rails over a full-screen field. Left: menu and white flag, stats, Command, Center and Pan, the stick. Right: a bigger sector map, the order diamond (Attack, Retreat, Advance, Fall in), Auto and Lock over a big Fire key. Command slides the right rail away; Auto stays on until you switch it off. No header in battle: Menu pauses and brings it in over a gunmetal dim; the flag pauses with the card only. Comms is a short radio toast (tap to clear). The numbered platoon list stays on desktop.
- **Phone header** like desktop (brand with version, SHERMAN OPERATIONS, ?, full screen, sound, theme, Eject). The settings gear is gone: a one-time intro card explains installing for full screen (and comes back from Full screen where the browser can't). Sound hides without Web Audio; on iPhone it plays through the silent switch.
- **Tips** on phones label each rail control separately, line up beside the rails without overlapping, and always stay on screen. They show once a visit, at the first battle.
- Setup is landscape-only on phones; the white flag in planning (bottom left on phones) backs out to setup. Removed "Defaults are fine. Change anything; it sticks."

### 0.13.6 — Theme and sound are remembered

- The theme you pick is saved (under the same key as the DOM VIRUS site, so the site and the game stay in sync) and applied before first paint. The mute key now starts in its saved state, so muted stays visibly muted after a reload.

### 0.13.5 — HQ boundary line

- Your HQ must now stay 7 squares behind the middle of the field (was 3; small fields keep at least 4 columns of room).
- While Move HQ is on, or while you drag the HQ, a dashed line in your team's colour shows the boundary.
- Light theme: the GIVE UP? card's hard shadow is ink instead of near-white.

### 0.13.4 — No more stuck tanks

- Tanks never start on top of each other: deployment keeps them at least 0.85 cells apart, and a tank that ends up too close to another may always drive away (before, two overlapping tanks could never move).
- Deployment clears the ground: every starting tank gets a one-square ring of open ground (cover is removed; water stays), so the formation, squad size and HQ position shape the map instead of trapping the platoon. Changing them while planning (or moving the HQ) rebuilds the field and clears around the new spots.

### 0.13.3 — Team-coloured shells that read in light mode

- Shells are in their team's colour (mint for A, coral for B) with an ink rim and a tracer tail. Dark maps keep a soft glow; light maps use deeper team shades with a crisp dark outline, so they stay visible on every terrain.

### 0.13.2 — Flat press colour

- START BATTLE and SURRENDER flash a flat cyberpunk red-pink (#f0506e) when pressed, with no glow; critical health uses the same colour.

### 0.13.1 — Full screen just grows the field

- Removed the "Expand the map?" prompt. On desktop, setup and planning size the field to the space they have, so full screen adds squares straight away. (Phones keep a fixed field that scrolls.)

### 0.13.0 — Command your own tank, one pause screen, team colours

- **Your tank takes routes too.** Tap its ★ key in the platoon (or tap it in Command / while planning), tap a square, Lock. When you're not steering it drives to its flag; steer any time to take over, let go and it carries on. Clear drops the route. Shoot while it drives, or take the wheel.
- **Pause is the white flag.** The footer key (and P) pauses and asks GIVE UP? with two matching sticker keys: **Keep fighting** (the DOM VIRUS skull) and **Surrender** (white flag, flashes red). No extra confirm step.
- **Command card** floats over the field again (the map keeps its full size), two rows, and you can drag it anywhere by its grip or any empty spot; double-click to put it back.
- **Team colours:** route lines, flags and healthy platoon keys follow your side (mint or coral); the enemy HQ flag is theirs. Hurt is flat amber, critical flat red with hazard stripes.
- Auto is always blue and burns brighter when on. Keyboard controls and tips sit in the header right after the logo. Sound and full-screen keys lift and press like the rest. Comms text ends in an ellipsis instead of running out. New icons: Attack is a rocket, Advance is a double chevron.
- Size budget 46KB → 48KB gzip.

### 0.12.1 — Compact result sticker on phones

- On short screens (phones in landscape) MISSION COMPLETE / GAME OVER, PAUSED and GIVE UP? shrink to a compact card: smaller sticker, tighter stats and buttons, so they no longer cover the field.

### 0.12.0 — Comms panel, balanced footer

- Desktop: the objective (with live progress) and the message line moved out of the footer into a slim **comms** panel above the map, beside the title. A small LED blinks once per new message. On narrower windows the panel takes its own row. Touch keeps its overlay line.
- Footer: three labelled groups, platoon in the middle: **ORDERS · WHOLE SQUAD / TANK n** (Fall in, Retreat, Advance, Attack) · **PLATOON** · **AIM** (Auto, Lock, Command) + Pause. Narrow windows drop button text to icons.
- The map takes the height the old footer line used.
- Attack has a clearer icon: a shell in flight.

### 0.11.1 — Movable command card, header fixes

- The command card has a grip on its top edge: drag it anywhere on screen (arrow keys work too); double-click or Enter on the grip docks it back.
- Command is always yellow and burns brighter while on.
- Theme key shows a moon in dark and a sun in light, and sits with the other header keys (it was pushed to the far right on narrow windows). Sound shows waves or a cross. Header keys no longer rest pressed.
- Keyboard controls and button tips moved beside the battlefield title on desktop (they are game-play help); the phone drawer keeps tips with its header keys, now all one size.

### 0.11.0 — Docked command card, platoon keys

- Command card: on desktop it docks above the map instead of covering it (the map rescales into the space left); on touch it stays over the field. Its head is organised: the tank's key (colour = health, pips = size, number), the mode, TANK n · ROLE with an HP chip and status, then the hint.
- Close key on the card: **Auto** in battle (command off, aim back on — the same thing the Auto key does); **Hide** while planning (tap a tank or Command to bring it back).
- Platoon list: back to square keys, the same arcade key as every other control. Colour is health (green, yellow under 60%, red under 30%), 1–3 pips are size (scout, medium, heavy), the big number matches the field (★ is you). Lost tanks rest pressed, grey, struck through and disabled. A PLATOON tag leads the list.
- Size budget 44KB → 46KB gzip.

### 0.10.1 — Docked aim keys, Tron winter, dashed = weaker

- Desktop: Auto / Lock / Command dock in the bottom bar beside Pause (they no longer float over the map); keycap hints drop on narrow windows. The touch cockpit keeps them on the right rail.
- Winter buildings are flat neon outlines like the other climates: cabins, lodges and an outlined star turned 45°.
- Cover reads at a glance: filled shapes are permanent (rock), solid outlines are full-strength, dashed or dotted outlines fall to fewer shells (city and winter dashed blocks 40 HP vs 90, winter dashed peaks and rings 35 HP and can be shot away, desert scrub 20 HP). Fences still let shells pass.

### 0.10.0 — Squad keys, keyboard panel, surrender on pause

- Squad list: each tank is a pressable 3D shape. Shape is the size (scout triangle, medium circle, heavy hexagon), colour is health (green over 60%, yellow over 30%, red below), the label is the number (★ is you). Tap to command.
- The keyboard help line is now a keyboard icon in the header: hover or click for the controls as keycaps (hidden on touch).
- Surrender lives only on the PAUSED sticker and asks "Give up?" with a white-flag sticker button (flashes red) or Keep fighting.
- Header: theme is a moon, the gear is a real cog and only appears when there is something in it (Install as an app).
- Light theme: the Start sticker flips to a light face with an ink rim and base. Start hides while a pause or surrender sticker is up.

### 0.9.0 — Cleaner controls, new ground every map

- Header: tips, full screen, sound and theme are icon keys; less-used options live under a gear menu (in the drawer on phones). New operation is now **Surrender** with a white flag.
- Pause shows a PAUSED sticker with Resume and Surrender. Start battle is its own sticker on the staging area (skull grid, flashes red on press).
- Command panel groups: ROUTE (Clear, Next, Lock), ORDERS (Attack HQ, Follow) and PLAN (strategy, Move HQ — planning only).
- Squad roster: small square chips with a number circle and HP bar; tapping one opens command on that tank.
- Formations are now distinct shapes: wedge (arrowhead), line (abreast) and column (file).
- Roads change by terrain and seed: winding lanes and a farm track (hedgerow), a highway and a diagonal track (desert), a true crossroads (winter); twin bridges keeps its avenues.
- Lone bushes in the hedgerow, street trees in the city, and flat city blocks in five shapes (square, slab, round tower, dashed triangle, dashed ring); winter adds dashed peaks and rings.
- Center and Pan hide when the whole field fits.
- Size budget 40KB → 44KB gzip.

### 0.8.2 — Tron desert

- Desert spearhead redrawn flat, Tron style: a black-amber field under a glowing grid with sand dots, roads with amber rails, mesas as neon-outlined blocks, glowing barbed wire, outlined wrecks, and new dotted scrub (soft cover). No shading gradients; winter's ice is flat too.

### 0.8.1 — Move your HQ

- During the plan step, drag your HQ (it pulses: DRAG TO MOVE) to another open spot on your half. Water and dead ends are refused; the ground under it is cleared and your squad redeploys around it. The move sticks for that map.

### 0.8.0 — Climates, a simpler setup, GAME OVER

- **Terrain themes:** each operation has its own climate in the neon key. Hedgerow: night fields, rounded green hedges, stone farms. Desert: dusk dunes, sandstone mesas, barbed wire, burnt wrecks. Winter: ice blues and purples, snow-roofed chalets, ice crystals. Twin bridges is now a river city: a street grid of lit towers, cars with headlights and a canal. The minimap follows each palette, light and dark.
- **Two-step setup:** 01 Location, 02 Terrain (Light / Normal / Heavy obstacles, or Random for a new layout at a random density), then **Plan strategy** or **Quick battle**. Side, formation, squad size and loadout moved into a **Strategy** slide-out during the plan step, with Randomize; changes rebuild the battle on the same ground. Everything is remembered for next time.
- **Directing, smoother:** tap one of your tanks mid-battle to open Command on it; a hint rides above the selected tank (TAP WHERE IT GOES, then DRAG TO BEND · LOCK ✓); Lock pulses while there is a draft; a drawn route is locked automatically when you move on (another tank, Start, leaving Command).
- **After action:** an arcade sticker. GAME OVER in pink (INSERT COIN) or MISSION COMPLETE in green, with time, kills and losses, **Start another campaign** and **Rematch**.
- Size budget 36KB → 40KB gzip.

### 0.7.1 — Header clears the status bar

- Full screen and Home Screen app on phones: the setup header (Theme, Eject) sat under the status bar and could not be tapped, so there was no way out. It now pads by the safe-area insets (top, and the notch side in landscape).

### 0.7.0 — Command your squad

- **Plan step:** every battle opens frozen in command mode with your first wingman selected. Tap a numbered tank, tap a square (or Attack HQ), drag the line to add a turn or the flag to move the destination, Lock, Next tank, then Start battle.
- **Routes that stick:** a locked route drives through each turn in order, then the tank holds that square (the enemy HQ means capture). Before, every waypoint was re-pathed to the shortest line and the tank went back to its old order on arrival, so a route could not be shaped or kept.
- **Command mode in battle:** the third aim mode beside Auto and Lock (O). Every wingman's route shows on the map; time runs at half speed and your gun is off. Picking Auto or Lock leaves it.
- **Command panel:** mode, tank, route state (DRAFT, EN ROUTE, HOLDING, FOLLOWING…), plus Lock, Attack HQ, Follow, Clear, Next and Start battle. Wingmen show their number in command mode.
- **Button tips:** placed once the layout stops moving (they used to miss on phones that were already landscape and full screen, where they never appeared at all), re-placed on resize, stay until dismissed, and every label opens a longer explanation on tap.
- Size budget 30KB → 36KB gzip.

### 0.6.8 — Eject is a real 3D button

- Eject is now a panel button like Sound and Theme (same 3D surface, hover lift and press); in the phone cockpit it is icon-only, like Theme.

### 0.6.7 — Eject

- The header's Exit is now **Eject**: it goes back to DOM VIRUS and plays the board-closing return, ejecting the cartridge from the console.

### 0.6.6 — Exact 3D button presses

- Every hard-shadow button presses onto its own shadow: hover lifts only the top (the base edge stays put), press and selected states land exactly on the base, with no scale, wobble or overshoot. Selected choices (mission, side, formation, size, loadouts, Auto/Lock/Pan/Pause, roster) rest pressed and don't lift. Fire's touch press matches the mouse press.

### 0.6.5 — Home Screen icons without the frame

- PNG app icons drop the cyan border so iOS/Android corner masks never clip it; the browser-tab SVG keeps it.

### 0.6.4 — Final logo

- The solid DOM Virus skull on the map grid, with the floating virus pixel. No hole or notch.

### 0.6.0 — Better touch driving, follow camera, DOM Virus logo

- **Analog thumbstick** replaces the touch D-pad: drive in any direction; push lightly to creep, fully for top speed (dead zone at the centre). Keyboard unchanged.
- **Follow camera:** the view eases after your tank when it leaves the middle of the screen. Pan or dragging the map pauses it; Center resumes it.
- **Haptics** (where the browser supports vibration, e.g. Android): light tap on fire, stronger on hits, a double pulse per enemy kill.
- **Logo:** the DOM Virus skull on a tactical map grid, in Battlefield mint with the virus pixel, for the header, favicon and Home Screen icons.

### 0.5.0 — Install for true full screen (Battlefield only)

- **iPhone / iPad:** Safari tabs cannot hide the browser UI. The setup screen shows a "Play full screen" card: Share → Add to Home Screen, then launch from the icon. The Home Screen app runs with no address bar, tabs or toolbar (status bar hidden in landscape). The card hides once running as the installed app; "Full-screen app" in the in-game panel shows it again.
- **Android:** Chrome's install prompt is offered via an Install button; the installed app launches full screen in landscape.
- PNG app icons (180/192/512, maskable) for iOS and Android home screens. Desktop never sees the card. Size budget 30KB (~28.1KB).

### 0.4.1 — Height-adaptive rails

- Rail controls size from the visible height (`dvh`), so nothing overlaps when Safari's bars leave ~300px in landscape. The D-pad and Fire shrink only when they must; the minimap drops its progress line (it stays in the slide-out panel).

### 0.4.0 — Mobile game shell: landscape + full screen gate, safe areas

- **Ready gate (touch only):** Deploy requests full screen and a landscape lock. The battle stays paused behind a gate until the phone is landscape and full screen; rotating back to portrait or leaving full screen mid-battle pauses it again, and one tap restores it. Desktop is unaffected.
- **iPhone:** Safari tabs cannot go full screen, so there the gate only requires landscape and explains Share → Add to Home Screen. The web app manifest (`display: fullscreen`, `orientation: landscape`) makes the home-screen icon launch full screen.
- **Safe areas:** each rail grows by its side's `safe-area-inset`, so controls and the minimap never sit under a notch or camera cutout; the home-bar inset is respected at the bottom.
- **Shell hygiene while playing:** no page scroll or bounce, pinch/double-tap zoom blocked (including iOS gesture events), no long-press callouts or context menu, screen wake lock (re-acquired after tab switches).

### 0.3.0 — Aim modes, attack orders, bigger battles, longer fights

- **Aim:** Auto (Q) tracks the nearest visible enemy. Tap any enemy tank to lock onto it; the lock follows it and returns to auto-aim when it is destroyed. Lock (T), then tap a square to keep shooting there (cover, buildings). Esc cancels. Desktop: Auto toggles between auto-aim and mouse aim.
- **Attack (G):** the squad (or the selected wingman) attacks your locked tank, or hunts the nearest enemy. With a wingman selected, tapping an enemy sends that wingman after it.
- **Squad size:** 4, 8 or 12 tanks per side, on larger maps. Your four-slot loadout repeats for extra wingmen.
- **Repairs:** repair kits appear on open ground (+45 armor) and drop from some wrecks and destroyed towers; HQ repair is faster (8/s, wider radius); every kill restores 15 armor to the shooter. Badly damaged AI tanks detour to nearby kits.
- **Quieter terrain:** low-contrast flat blocks sit in the background; tanks get a soft team glow.
- **Performance:** line-of-sight targeting refreshes at 5Hz per tank; pathfinding reuses one occupancy set per tick. Budget raised to 28KB gzip (~25.4KB).

### 0.2.0 — Widescreen touch cockpit, Tron/cyberpunk skin, slower armor

- **Landscape cockpit:** the map owns the middle of the screen; two thumb rails (each ≤ ~17% width) hold the controls. Left: menu, pause, minimal scoreboard, D-pad. Right: minimap, camera tools, squad orders, Fire. Nothing overlays the map.
- **Slide-out panel:** tap the menu or the scoreboard for the full scoreboard, roster, tips, fullscreen, new operation, sound, theme and exit.
- **Arcade buttons:** icon-only colored caps with a hard drop shadow and springy press; held touch controls stay visibly pressed.
- **First-run tips:** dotted rings label each control while the battle waits; tap to play, "Don't show again" remembers it, and the panel can show them again.
- **Fullscreen:** Deploy requests fullscreen and a landscape lock where the browser allows (Android Chrome). iOS falls back to the edge-to-edge layout. Portrait stays playable with a bottom deck.
- **Setup:** one-tap segmented pickers for side, formation (with diagrams) and each tank's class. Landscape phones see the whole setup on one screen.
- **Look:** flat neon terrain — firewalls, towers, data crystals, laser fences, hover cars, pixel debris — on a single background grid.
- **Tanks:** about 20% slower top speed; damaged tanks lose up to 45% of their speed.
- **Performance:** no per-frame layout reads (viewport/pointer geometry cached on resize/scroll), unit/minimap/camera DOM writes only when values change, diffed path/target highlights, no per-tile inline grid styles, cheaper target search.

### Mobile cockpit (0.1.1)

Deploy requests browser fullscreen where available; unsupported browsers use an edge-to-edge viewport layout. Landscape places movement and fire on opposite edges, with squad orders in a collapsible panel. Portrait remains playable with a rotation hint. Full screen toggles browser fullscreen, and New operation returns to setup. Flat slate, lavender, cyan, and pink terrain replaces natural grass/sand styling without changing terrain rules.
