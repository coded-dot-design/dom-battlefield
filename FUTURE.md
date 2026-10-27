# DOM Battlefield: Future phases

Repo-specific items. The shared roadmap (controls layer, hub performance, hardening, platform) is
the hub [FUTURE.md](https://github.com/coded-dot-design/dom-virus/blob/main/FUTURE.md). Phase 1
state is in [HANDOFF.md](HANDOFF.md). Move items to the README changelog when they ship.

## Phase 2

### Controls layer (shared, top priority)

- Move onto the shared stick, Fire and press code (`dom-virus/src/touch-controls.ts`, or its
  successor package) and delete the local stick in `src/client.ts` and the `[data-key]` press
  wiring. Keep the analog magnitude (creep vs full throttle), which the base layer should pass
  through for every game.
- Extend it with Battlefield's commands through the extension layer, without forking the base:
  auto-aim, lock (tank or square), orders (fall in, retreat, advance, attack), squad selection,
  pan and center.
- Hand the landscape + full-screen ready gate, safe-area rails, wake lock and zoom/scroll blocking
  to the shared mobile layer, so other games can opt in.
- Adopt shared styling tokens for the 3D press families (`--px/--py/--hx/--hy`) from the style guide.

### Gameplay

- Distinct enemy silhouettes (both teams use the Sherman sprite today).
- More operations and a seeded "random operation" picker.
- Show each wingman's route and hold point on the minimap too (the map shows them since 0.7.0).
- Command mode next steps: multi-select (drag a box) to route a group; per-tank stance on arrival
  (hold / ambush, i.e. don't fire until spotted / return to squad); saved plans per operation;
  give the enemy AI the same route + hold behaviour so it flanks.
- Real-device pass of the command gestures (iOS Safari, Android Chrome): flag and line drags,
  pan vs tap threshold (8 px), the panel on 667x300.

### Multiplayer (later version, the Bolo promise)

DOM VIRUS started with Bolo: tanks, two machines, a network, a human opponent.
Battlefield's squads make it the best fit for 2-player team play after Sherman Bytes. Plan (see the
hub's FUTURE.md): WebRTC data channels, peer to peer, no game server; send orders and inputs, not
state; a hot-seat/couch mode first.

### Performance and size

- Win back headroom under the **61,500-byte** gzip gate. Version 0.17.0 measures **60,672 bytes**
  (HTML 8,453 + JavaScript 33,061 + CSS 19,158), leaving 828 bytes. The allowance was explicitly
  raised from 57,500 bytes for card navigation, launch feedback, overlays and responsive controls;
  the measured increase from 0.16.2 is 3,353 bytes, with no new runtime dependency. Audit duplicated
  CSS and shared control rules without weakening the physical-button or responsive behaviour.
- Measure 12-per-side battles on a low-end Android device.

### Tests

- `tests/browser.mjs` already reports named scenarios, including desktop/mobile themes, compact
  desktop feedback, mobile overlays, installation, touch controls, narrow layouts and preferences.
  Consider making those scenarios independently runnable to shorten focused regression checks.
- The 0.17.0 regression suite covers planning navigation and native fold activation, bounded
  launch cleanup, repeatable overlay presses and interaction blocking, and stationary desktop
  button bases during release. Extend the broader 3D-button audit across hover, held, selected
  and disabled states in every button family, including real touch hardware.

### Accessibility

- Keyboard-only setup and play audit; screen-reader announcements for orders and objective changes.

### Docs and provenance

- Re-run `node scripts/sync-shared.mjs` so `shared/ORIGIN.json` labels match current owners
  (it still says Sherman 0.5.1 and hub 0.11.1; the bytes are unchanged).

## Phase 3

- A shared entity adapter so other games' actors (Swarm bugs, Null aliens) can appear on the map
  without moving their assets into Battlefield.
- Multiplayer: co-op or versus over an authoritative transport, building on the DOM-free model and
  command objects. Networking, sync, authentication and cheat prevention are not implemented.
- Map editor that turns a real page's layout into a Battlefield map.
