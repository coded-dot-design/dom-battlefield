# DOM Battlefield

A separate, lightweight squad-tactics app in the DOM Virus family. Battlefield builds the map, terrain, objectives and platoon simulation. Sherman Bytes owns the tank artwork and its cached renderer. Battlefield adds **zero bytes** to the Sherman game bundle.

Play: https://coded-dot-design.github.io/dom-virus/battlefield/ (latest release, via the hub)
Preview: https://coded-dot-design.github.io/dom-battlefield/ (every checked `main` push)

Release flow: push to `main` → checks pass → `vX.Y.Z` tag is created from `package.json` and the preview deploys. The hub's hourly Pages build picks up the newest tag in the pinned major line automatically; bump `dom-virus/battlefield.json` only for a new major line or to pin a specific build. Roll back by re-pinning an older tag in the hub.

## First release

Four seeded arcade operations: Hedgerow breach, Desert spearhead, Winter crossroads and Twin bridges. Choose either fictional side, one of three deployment formations, and four scout/medium/heavy tanks within a 12-point budget. Capture an opposing HQ, hold a contested crossroads, or eliminate a platoon. Your command tank must survive.

**Command your squad.** Every battle opens with a frozen plan step in command mode: tap a numbered tank, tap where it should go (or Attack HQ), drag the route line to bend it or the flag to move it, and Lock. Locked tanks drive their route and hold that square when they arrive (on the enemy HQ that is a capture). Start battle when you're ready. During the battle, Command is the third aim mode beside Auto and Lock: time runs at half speed and your gun is off, so redirect quickly and switch back. Fall in follows your command tank; Retreat returns to headquarters, where tanks repair. Advance returns the squad to the objective. Every map has alternate connected routes. Houses, hedges and parked cars can be destroyed into pixel debris and rubble. Rocks and water remain permanent; fences stop tanks but allow shells through.

Desktop maps fit the available viewport. Mobile uses a larger grid with deliberate Pan mode, minimap camera positioning and a Center button. Resizing an active battle adjusts presentation without resetting terrain, damage or positions.

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
| Lock · clear · next · attack HQ | Enter · Backspace · N · H | Panel buttons |
| Button tips | ? in the header | First run; ? in the drawer; tap a label for details |
| Keyboard controls | Keyboard icon beside the battlefield title (hover or click) | — |
| Move the command card | Drag its grip · double-click to dock | Drag its grip |
| Pause · surrender | White flag (P): Keep fighting or Surrender | White flag on the rail |
| Route your own tank | ★ platoon key, then a square, Lock · steer to override | Same |
| Move HQ (plan only) | Drag your HQ, or Move HQ then a square | Same |
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

`dist/` is the reproducible static app copied by the DOM Virus site's build; there is no runtime framework or server requirement. JavaScript, styles and markup have a combined 48KB gzip budget, checked by `npm run size` (0.13.0: ~46.3KB; 30KB until 0.7.0, 36KB in 0.7.x, 40KB in 0.8.x, 44KB in 0.9–0.10, 46KB in 0.11–0.12).

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
