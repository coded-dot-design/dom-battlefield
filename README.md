# DOM Battlefield

A separate, lightweight squad-tactics app in the DOM Virus family. Battlefield builds the map, terrain, objectives and platoon simulation. Sherman Bytes owns the tank artwork and its cached renderer. Battlefield adds **zero bytes** to the Sherman game bundle.

Play: https://coded-dot-design.github.io/dom-virus/battlefield/ (latest release, via the hub)
Preview: https://coded-dot-design.github.io/dom-battlefield/ (every checked `main` push)

Release flow: push to `main` → checks pass → `vX.Y.Z` tag is created from `package.json` and the preview deploys. The hub's hourly Pages build picks up the newest tag in the pinned major line automatically; bump `dom-virus/battlefield.json` only for a new major line or to pin a specific build. Roll back by re-pinning an older tag in the hub.

## First release

Four seeded arcade operations: Hedgerow breach, Desert spearhead, Winter crossroads and Twin bridges. Choose either fictional side, one of three deployment formations, and four scout/medium/heavy tanks within a 12-point budget. Capture an opposing HQ, hold a contested crossroads, or eliminate a platoon. Your command tank must survive.

Select a friendly wingman, then an open grid square to send it there. Its previous order resumes on arrival. Fall in follows your command tank; Retreat returns to headquarters, where tanks repair. Advance returns the squad to the objective. Every map has alternate connected routes. Houses, hedges and parked cars can be destroyed into pixel debris and rubble. Rocks and water remain permanent; fences stop tanks but allow shells through.

Desktop maps fit the available viewport. Mobile uses a larger grid with deliberate Pan mode, minimap camera positioning and a Center button. Resizing an active battle adjusts presentation without resetting terrain, damage or positions.

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move command tank | WASD / arrows | Analog thumbstick |
| Aim | Pointer | Nearest visible enemy |
| Fire | Hold Space / click / right-click | Hold Fire |
| Fall in / retreat / advance | F / R / E | Labeled buttons |
| Select wingman | 1–3 or click | Tap tank / roster |
| Assign waypoint | Click an open grid square | Tap an open grid square |
| Pan / recenter | M + drag / C | Pan + drag / Center |
| Pause / deselect | P / Esc | Pause / select your tank |

Sound is gesture-activated, optional, synthesized and bounded. Reduced motion keeps gameplay while reducing cosmetic effects. Pause, tab visibility, restart and exit clean up input, audio and mobile text-selection ownership.

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

`dist/` is the reproducible static app copied by the DOM Virus site's build; there is no runtime framework or server requirement. JavaScript, styles and markup have a combined 30KB gzip budget (0.6.0: ~29.1KB).

## Boundaries

- `src/model.ts`: serializable map, units, commands, pathfinding, collision, objectives and combat. No DOM dependency.
- `src/view.ts`: DOM grid/terrain and actor ownership, minimap, bounded projectiles and debris. Each tank is a DOM button carrying the original small cached Sherman canvas renderer; no fullscreen canvas board.
- `src/client.ts`: input, camera, setup, UI, one animation loop and lifecycle.
- `shared/`: generated snapshots from owning repositories, with source versions and SHA-256 provenance in `ORIGIN.json`. `node scripts/sync-shared.mjs` refreshes them from sibling checkouts. The tank artwork is not independently maintained here.

Maps cap at 48×30 cells, with up to 24 tanks, 200 projectiles and 96 effects. One fixed 60Hz simulation clock with bounded catch-up. No timers or extra animation loops. Pause cancels the loop until resume. Terrain is regenerated only during setup; destruction updates existing nodes. Geometry, presentation and command data stay separate.

This is a **single-player** first release. Multiplayer, friend invites, co-op/opposing players, extension overlays and cross-game mashups are future work. Command objects and DOM-independent state provide a boundary for a future authoritative transport; networking, synchronization, authentication and cheat prevention are not implemented or implied. A future entity adapter can add other games' actors without moving their assets into the map engine.

## Historical inspiration

The presets are fictional arcade exercises, not accurate reconstructions or authentic opposing armies. Both teams currently use the Sherman silhouette. Inspiration: [US Army Ordnance Corps — Rhino tanks and Normandy hedgerows](https://goordnance.army.mil/history/Rhino.html), [National Army Museum — El Alamein](https://www.nam.ac.uk/explore/battle-alamein), and [US Army Center of Military History — The Ardennes](https://history.army.mil/Publications/Publications-Catalog/The-Ardennes-Battle-Of-The-Bulge/). Twin bridges is a fictional training drill.

MIT · Chris Cooley / coded.design

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
