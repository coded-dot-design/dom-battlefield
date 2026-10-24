# DOM Battlefield

A separate, lightweight squad-tactics app in the DOM Virus family. Battlefield builds the map, terrain, objectives and platoon simulation. Sherman Bytes owns the tank artwork and its cached renderer. Battlefield adds **zero bytes** to the Sherman game bundle.

Play: https://coded-dot-design.github.io/dom-virus/battlefield/

## First release

Four seeded arcade operations: Hedgerow breach, Desert spearhead, Winter crossroads and Twin bridges. Choose either fictional side, one of three deployment formations, and four scout/medium/heavy tanks within a 12-point budget. Capture an opposing HQ, hold a contested crossroads, or eliminate a platoon. Your command tank must survive.

Select a friendly wingman, then an open grid square to send it there. Its previous order resumes on arrival. Fall in follows your command tank; Retreat returns to headquarters, where tanks repair. Advance returns the squad to the objective. Every map has alternate connected routes. Houses, hedges and parked cars can be destroyed into pixel debris and rubble. Rocks and water remain permanent; fences stop tanks but allow shells through.

Desktop maps fit the available viewport. Mobile uses a larger grid with deliberate Pan mode, minimap camera positioning and a Center button. Resizing an active battle adjusts presentation without resetting terrain, damage or positions.

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move command tank | WASD / arrows | D-pad |
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

`dist/` is the reproducible static app copied by the DOM Virus site's build; there is no runtime framework or server requirement. JavaScript, styles and markup have a combined 24KB gzip budget.

## Boundaries

- `src/model.ts`: serializable map, units, commands, pathfinding, collision, objectives and combat. No DOM dependency.
- `src/view.ts`: DOM grid/terrain and actor ownership, minimap, bounded projectiles and debris. Each tank is a DOM button carrying the original small cached Sherman canvas renderer; no fullscreen canvas board.
- `src/client.ts`: input, camera, setup, UI, one animation loop and lifecycle.
- `shared/`: generated snapshots from owning repositories, with source versions and SHA-256 provenance in `ORIGIN.json`. `node scripts/sync-shared.mjs` refreshes them from sibling checkouts. The tank artwork is not independently maintained here.

Maps cap at 40×26 cells, with 8 tanks, 80 projectiles and 64 effects. One fixed 60Hz simulation clock with bounded catch-up. No timers or extra animation loops. Pause cancels the loop until resume. Terrain is regenerated only during setup; destruction updates existing nodes. Geometry, presentation and command data stay separate.

This is a **single-player** first release. Multiplayer, friend invites, co-op/opposing players, extension overlays and cross-game mashups are future work. Command objects and DOM-independent state provide a boundary for a future authoritative transport; networking, synchronization, authentication and cheat prevention are not implemented or implied. A future entity adapter can add other games' actors without moving their assets into the map engine.

## Historical inspiration

The presets are fictional arcade exercises, not accurate reconstructions or authentic opposing armies. Both teams currently use the Sherman silhouette. Inspiration: [US Army Ordnance Corps — Rhino tanks and Normandy hedgerows](https://goordnance.army.mil/history/Rhino.html), [National Army Museum — El Alamein](https://www.nam.ac.uk/explore/battle-alamein), and [US Army Center of Military History — The Ardennes](https://history.army.mil/Publications/Publications-Catalog/The-Ardennes-Battle-Of-The-Bulge/). Twin bridges is a fictional training drill.

MIT · Chris Cooley / coded.design

### Mobile cockpit (0.1.1)

Deploy requests browser fullscreen where available; unsupported browsers use an edge-to-edge viewport layout. Landscape places movement and fire on opposite edges, with squad orders in a collapsible panel. Portrait remains playable with a rotation hint. Full screen toggles browser fullscreen, and New operation returns to setup. Flat slate, lavender, cyan, and pink terrain replaces natural grass/sand styling without changing terrain rules.
