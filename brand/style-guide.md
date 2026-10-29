# Style guide — DOM Battlefield

Preset: cyberpunk-tron · flat colors only (no gradients, blur or glow) · hard shadows straight down · shared 3D key (Board UI)

Cyber Punk × Tron: flat neon faces on one ink rim, mono caps on every control, hard bases straight
below. Colour is the job, paint is the budget. DOM Battlefield is the reference board for the shared
3D key, which Fizlet's Board UI kit was extracted from (v0.18.4).
<!-- src: fizlet src/ui/tokens.json "source"; dom-battlefield board-ui/BOARD-UI.md §2.1 -->

```tokens
{
  "brand": "DOM Battlefield",
  "color": {
    "sys": "#19f0ff",
    "cmd": "#9a63ff",
    "fire": "#ff2b4e",
    "aim": "#ff7389",
    "attack": "#ff2e88",
    "advance": "#ff8a1f",
    "fallin": "#a8ff3e",
    "flag": "#f6f3ff",
    "go": "#39ffb0",
    "teamA": "#39ffb0",
    "teamB": "#ff5c8f",
    "hurt": "#ffc21a",
    "critical": "#f0506e",
    "rim": "#07060f",
    "accent": "#19f0ff",
    "dark": { "bg": "#07060f", "surface": "#110d22", "raised": "#1d1738", "card": "#120f26", "ink": "#f6f3ff", "muted": "#aea4d6", "line": "#3b3170", "cmdInk": "#b48cff" },
    "light": { "bg": "#eef0fb", "surface": "#ffffff", "raised": "#e6e4f8", "card": "#ffffff", "ink": "#1b1636", "muted": "#5d5684", "line": "#b9b2e3", "sysInk": "#0088b3", "cmdInk": "#6a3ae6", "fireInk": "#d4143a", "teamAInk": "#00a36d", "teamBInk": "#e0245e" },
    "map": { "dark": "#090818", "light": "#e4e6f7" },
    "startKey": { "face": "#10233f", "label": "#f6f3ff", "icon": "#19f0ff", "base": "#f6f3ff", "baseLight": "#1b1636" },
    "overlayDim": "#2a2d38"
  },
  "font": {
    "sans": "Inter, \"SF Pro Display\", \"Segoe UI\", system-ui, -apple-system, Arial, sans-serif",
    "mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    "controls": "mono caps, bold, spaced",
    "headings": "sans 800, tight tracking"
  },
  "key": {
    "rim": "#07060f",
    "labelInk": "#07060f",
    "shadowAngle": "180deg",
    "baseDepth": { "baseKey": "3px", "arcadeKey": "4px", "stickerKey": "5px", "card": "5px", "panel": "6px", "startKey": "8px" },
    "radius": { "baseKey": "6px", "arcadeKey": "10px", "stickerKey": "12px", "card": "10px", "panel": "14px", "startKey": "18px" },
    "shadow": { "arcadeKey": "0 4px 0 #07060f", "panel": "0 6px 0 #07060f", "startKey": "0 8px 0 #f6f3ff", "pressed": "0 0 0 #07060f" },
    "travel": "120ms ease-out, press 50ms",
    "tilt": { "sticker": "-4deg", "cartridge": "-4deg" }
  },
  "byline": { "text": "by Chris Cooley", "url": "https://coded.design/" }
}
```
<!-- src: dom-battlefield src/style.css lines 45-53, 66-76, 89-101, 117-136; board-ui/board-ui.css lines 98, 155-158; site/src/styles/site.css lines 5-6, 136-141, 357-367; fizlet src/ui/tokens.json. Shadow colours here are the flat target; shipped bases mix the face colour into the rim. Sizes in u = 1px on desktop. -->

## Rules

- **One rim, flat faces.** Every key, sticker and card sits on the ink rim `#07060f`, in both
  themes. Text on a neon face is rim-coloured.
- **Colour is the job.** One colour per job (sys = navigate, cmd = plan and every locked order,
  fire = the gun, go = start). Same jobs on desk and phone, dark and light. Map hues never colour a
  control; control colours never colour terrain.
- **Hard bases, straight down.** `box-shadow: 0 <depth> 0 <base>`. Never blurred, never diagonal,
  never to the side. Tilt is a rotation, not a shadow.
- **Only Board UI keys.** Arcade, link, icon, sticker, round, platoon, pager, grip. No one-off
  button CSS.
- **Overlays are a ritual.** Grey dim, a white sticker tilted −4° that slams in, at most two
  sticker keys; explanations go to the comms toast.
- **Surrender is the white flag** in your team colour; the face never turns red.
- **Mono for controls, sans for prose.** Mono caps on keys, labels, eyebrows, HUDs.
- **Dark by default, light everywhere.** The theme choice is shared with the game and DOM VIRUS.
- **Reduced motion:** no loops, bursts or slams; static end states; the hero becomes a still frame.
- **The byline** "by Chris Cooley" → <https://coded.design/> on every page.

## Current styles (documented, Phase 2 lock)

- **Palette:** the root block in `src/style.css` lines 43–145 (dark), light overrides at
  lines 116–138. Kit copy: `board-ui/tokens.json`, identical to Fizlet's `src/ui/tokens.json`.
- **Keys:** `board-ui/board-ui.css` — face on a hard base (line 98), hover lifts by `--hy`
  (line 118), press drops the face flat in 50ms (line 126), focus is a 3u bg gap plus a 6u sys-ink
  ring (line 150). Arcade key: 4u base in the face colour mixed 45% into the rim (lines 155–158).
- **Site furniture:** `site/src/styles/site.css` — sans and mono stacks (lines 5–6), panels with a
  14px radius and a 6px hard base (lines 136–141), sticky header (lines 152–158).
- **START BATTLE:** navy `#10233f` face, 4px white border, 8px white base straight below, 18px
  radius, cyan skull icon (`site.css` lines 354–367); base turns ink `#1b1636` on light.
- **Cartridge:** tilted −4°, base straight below, no side face (`site/src/pages/index.astro`
  lines 888–1010).
- **Byline:** footer "Created by Chris Cooley" (`site/src/layouts/Base.astro` line 96).

## Exceptions (Phase 2 lock)

Shipped and kept as they are; new pages use the flat tokens above.

- **Arcade key glow on dark:** soft colour halo at rest, hover and press (14u / 18u / 22u, face
  colour at 40% / 55% / 70%), off on light; the locked state breathes with it.
  <!-- src: board-ui/board-ui.css lines 161-163, 179-187; fizlet src/ui/tokens.json line 40 -->
- **Lit panel halo:** `.panel.lit` adds a 28px violet halo on dark. <!-- src: site.css line 145 -->
- **START BATTLE halo:** a 40px cyan halo, 56px on hover. <!-- src: site.css lines 367, 386, 391 -->
- **Header frost:** the sticky header uses a 10px backdrop blur. <!-- src: site.css line 157 -->
- **Hero wash and grid:** a radial violet wash and a masked grid behind the landing hero.
  <!-- src: site/src/pages/index.astro lines 291, 302-304 -->
- **Sticker drop shadow** while the overlay sticker falls (soft, then hard on landing).
  <!-- src: board-ui/board-ui.css line 499 -->
