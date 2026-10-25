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
- Show each wingman's standing order and waypoint on the minimap.

### Multiplayer (later version, the Bolo promise)

DOM VIRUS started with Bolo: tanks, two machines, a network, an opponent across the room.
Battlefield's squads make it the best fit for 2-player team play after Sherman Bytes. Plan (see the
hub's FUTURE.md): WebRTC data channels, peer to peer, no game server; send orders and inputs, not
state; a hot-seat/couch mode first.

### Performance and size

- Win back headroom under the 30 KB budget (29.3 KB now); the CSS is about 8 KB gzip and is the
  main candidate (2,086 lines in `src/style.css`).
- Measure 12-per-side battles on a low-end Android device.

### Tests

- Split `tests/browser.mjs` (one long pass) into named scenarios so failures point at one flow.
- Add a 3D button audit to the browser test (base fixed on hover, press lands exactly).

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
