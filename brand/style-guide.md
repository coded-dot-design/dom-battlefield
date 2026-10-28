# DOM Battlefield: style guide

The look of the DOM Battlefield brand (the landing page, the play page, the `/style-guide/` page
and every marketing slot the engine fills on the Battlefield site). Battlefield Blitz inherits all
of it and overrides only what [`blitz/style-guide.md`](blitz/style-guide.md) lists.

This file **summarises and points**. The live sources below win whenever they disagree with it;
fix this file, not them. Structure, voice and URLs come from the family rulebook
(`dom-virus/brand/README.md`, `dom-virus/brand/family.json`); the voice for this brand is
[`voice.md`](voice.md).

Phase 2 rule: the games are locked. This guide documents what ships; it never asks for a change
to the game layer, the hero or any in-page animation.

---

## 1. The live sources

| What | Source (this repo unless noted) |
|---|---|
| The Board UI kit, live: palette switcher, every key, card, overlay, launch burst, isolation demo | [`site/src/pages/style-guide/index.astro`](../site/src/pages/style-guide/index.astro) → `/style-guide/` |
| Kit spec (states, timings, layouts, lessons) | [`board-ui/BOARD-UI.md`](../board-ui/BOARD-UI.md) |
| Kit CSS and JS | [`board-ui/board-ui.css`](../board-ui/board-ui.css), [`board-ui/board-ui.ts`](../board-ui/board-ui.ts) |
| Kit tokens (machine-readable) | [`board-ui/tokens.json`](../board-ui/tokens.json) |
| Kit source of truth (the copy in `board-ui/` is byte-identical today) | `fizlet/src/ui/` |
| The game's own tokens: control palette, team colours, map hues, terrain themes, light theme | [`src/style.css`](../src/style.css) (root block at lines 43–145, terrain from line 490) |
| Launch burst in the game | [`src/launch-effects.css`](../src/launch-effects.css), [`src/launch-effects.ts`](../src/launch-effects.ts) |
| Site furniture: type, panels, header, footer, START BATTLE key | [`site/src/styles/site.css`](../site/src/styles/site.css) |
| Page frame, theme bootstrap, phone app mode switch | [`site/src/layouts/Base.astro`](../site/src/layouts/Base.astro) |
| Landing hero (live battle, shootable headline) and the cartridge | [`site/src/pages/index.astro`](../site/src/pages/index.astro), [`site/src/scripts/arena.ts`](../site/src/scripts/arena.ts) |
| Blitz pages (same brand) | [`site/src/pages/blitz/`](../site/src/pages/blitz/) |

---

## 2. Default style: cyberpunk meets Tron, flat colour

- **Neon caps on an ink rim.** Every key, sticker and card sits on one ink rim (`--rim: #07060f`,
  the same in both themes). Faces are flat neon; text on a face is rim-coloured
  (`board-ui/BOARD-UI.md` §1.6, §3.4).
- **Colour is the job.** One colour per job, the same on desktop and phone, dark and light. Never
  colour by decoration (`BOARD-UI.md` §1.3, §3.1). Map hues (terrain, grid) are a separate set and
  never colour a control; control colours never colour terrain (`BOARD-UI.md` §3.4,
  `src/style.css` lines 54–64).
- **Mono for every control.** Mono caps, spaced, for keys, labels, stickers, eyebrows and HUDs.
  Headlines and body copy on the site use the sans stack (`site/src/styles/site.css` lines 5–6,
  105–131).
- **Pixel characters.** The DOM VIRUS skull (crisp-edge SVG, `site/src/components/Skull.astro`)
  is the brand mark; the tanks are Sherman Bytes sprites (`shared/`).
- **Flat in the game layer.** No gradients, blurs or glows in the game layer unless measured
  (rulebook §2). What ships today:
  - The board itself is flat fills and hard bases. The kit adds a soft neon glow to arcade keys
    on dark only (rest 14u at 40%, hover 18u at 55%, press 22u at 70%; none on light;
    `BOARD-UI.md` §3.2). See open questions in [`voice.md`](voice.md#open-questions) and §11 below.
  - The site's page furniture is allowed a little more: the hero's radial violet wash
    (`index.astro` line 291), the masked hero grid (lines 297–305), the sticky header's 10px
    backdrop blur (`site.css` line 157) and glows on `.panel.lit` and the START BATTLE key. Keep
    them on the page, never inside the board.

---

## 3. Tokens

Exact values from the files cited in each `$source`. The kit's per-game palette is the only input
a board changes; everything else is derived (`BOARD-UI.md` §3.2).

```tokens
{
  "brand": "DOM Battlefield",
  "$source": {
    "palette": "board-ui/tokens.json (palette), identical to src/style.css lines 43-145",
    "site": "site/src/styles/site.css lines 4-16, 136-149, 354-421",
    "cartridge": "site/src/pages/index.astro lines 890-1010",
    "kit": "board-ui/BOARD-UI.md sections 3-5, 9, 14"
  },
  "colour": {
    "controls": {
      "sys":     { "var": "--k-sys",     "value": "#19f0ff", "job": "navigation, focus ring, comms edge" },
      "cmd":     { "var": "--k-cmd",     "value": "#9a63ff", "job": "command, planning, cards, every locked order, tank identity" },
      "fire":    { "var": "--k-fire",    "value": "#ff2b4e", "job": "the gun" },
      "aim":     { "var": "--k-aim",     "value": "#ff7389", "job": "Auto / Lock, fire's lighter twin, dim when off" },
      "attack":  { "var": "--k-attack",  "value": "#ff2e88", "job": "Attack, Attack HQ, the cartridge doors" },
      "advance": { "var": "--k-advance", "value": "#ff8a1f", "job": "Advance" },
      "fallin":  { "var": "--k-fallin",  "value": "#a8ff3e", "job": "Fall in, Follow me" },
      "flag":    { "var": "--k-flag",    "value": "#f6f3ff", "job": "white flag, overlay sticker face" },
      "go":      { "var": "--k-go",      "value": "#39ffb0", "job": "start and confirm, comms LED" }
    },
    "teams": {
      "teamA": { "var": "--team-a", "value": "#39ffb0", "lightInk": "#00a36d", "note": "mint; Retreat = your team colour" },
      "teamB": { "var": "--team-b", "value": "#ff5c8f", "lightInk": "#e0245e", "note": "coral" }
    },
    "health": { "hurt": "#ffc21a", "critical": "#f0506e" },
    "inks": {
      "dark":  { "--k-sys-ink": "#19f0ff", "--k-cmd-ink": "#b48cff", "--k-fire-ink": "#ff2b4e" },
      "light": { "--k-sys-ink": "#0088b3", "--k-cmd-ink": "#6a3ae6", "--k-fire-ink": "#d4143a" }
    },
    "surfaces": {
      "dark":  { "--bg": "#07060f", "--surface": "#110d22", "--raised": "#1d1738", "--card": "#120f26", "--ink": "#f6f3ff", "--muted": "#aea4d6", "--line": "#3b3170", "--rim": "#07060f" },
      "light": { "--bg": "#eef0fb", "--surface": "#ffffff", "--raised": "#e6e4f8", "--card": "#ffffff", "--ink": "#1b1636", "--muted": "#5d5684", "--line": "#b9b2e3", "--rim": "#07060f" }
    },
    "site": {
      "themeColor": "#07060f",
      "panelBase": { "dark": "color-mix(in srgb, var(--k-cmd) 38%, var(--rim))", "light": "color-mix(in srgb, var(--k-cmd) 30%, var(--line))" },
      "gridLine": { "dark": "color-mix(in srgb, var(--k-sys) 9%, transparent)", "light": "color-mix(in srgb, var(--k-cmd) 9%, transparent)" },
      "startKey": { "face": "#10233f", "label": "#f6f3ff", "icon": "#19f0ff", "iconTile": "#0b1830", "border": "#f6f3ff", "base": "#f6f3ff", "lightBorderAndBase": "#1b1636" },
      "cartridge": { "face": "#3a3f5c", "base": "#23263a", "labelBorder": "var(--k-attack)", "art": "var(--team-a) on #0b1830" },
      "overlayDim": "#2a2d38 at 82%",
      "mapDark": "#090818",
      "mapLight": "#e4e6f7"
    }
  },
  "font": {
    "sans": "Inter, \"SF Pro Display\", \"Segoe UI\", system-ui, -apple-system, Arial, sans-serif",
    "mono": "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    "kitMono": "ui-monospace, \"SFMono-Regular\", Menlo, monospace",
    "body": "16px/1.6 sans",
    "lead": "18px/1.65 sans, --muted",
    "h1Hero": "800, clamp(56px, 11vw, 148px), line-height 0.92, letter-spacing -0.05em",
    "h2": "800, clamp(30px, 4.2vw, 50px), letter-spacing -0.035em, line-height 1.02",
    "h3": "800, 19px, letter-spacing -0.02em",
    "eyebrow": "700 11px mono, letter-spacing 0.16em, uppercase, --muted; bold word in --k-sys-ink",
    "keyLabel": "700 12u mono",
    "groupLabel": "9u mono caps, 1.4u tracking, FIRST WORD bold",
    "stickerWord": "900 34u mono",
    "stickerKicker": "800 8u mono, 4u tracking, blinking",
    "startKeyLabel": "900 30px/1.05 mono, letter-spacing 0.12em"
  },
  "unit": {
    "--u": { "desktop": "1px", "phone": "clamp(0.7px, min(100dvh / 390, 100dvw / 844), 1.3px)", "desktopTouchFullScreen": "1.5px" }
  },
  "radius": {
    "baseKey": "6u", "arcadeKey": "10u", "stickerKey": "12u", "card": "10u", "dock": "12u",
    "pill": "4-6u", "round": "50%", "sitePanel": "14px", "startKey": "18px",
    "cartridge": "12px 12px 0 0, clipped top-right corner"
  },
  "shadow": {
    "rule": "Hard and offset, never blurred. One base straight below the face: box-shadow 0 <depth> 0 <base colour>. Never to the side.",
    "shadowAngle": { "var": "--shadow-angle", "value": "180deg", "meaning": "straight down (x offset 0, y offset = depth)", "status": "not yet a CSS variable in this repo; every base is written as 0 <depth> 0" },
    "depth": { "baseKey": "3u", "arcadeKey": "4u", "stickerKey": "5u", "orb": "5u", "card": "5u", "sitePanel": "6px", "startKey": "8px", "toast": "3u", "cartridgeBand": "inset 0 -12px 0" },
    "hoverLift": { "baseKey": "1u", "arcadeKey": "2u", "stickerKey": "2u", "startKey": "3px" },
    "baseColour": { "arcade": "color-mix(in srgb, var(--c) 45%, var(--rim))", "card": "color-mix(in srgb, var(--k-cmd) 50%, var(--rim))", "stickerKey": "#f6f3ff", "baseKey": "var(--line)" },
    "tilt": { "cartridge": "-4deg", "overlaySticker": "-4deg", "cartridgeEdition": "-4deg", "cartridgeSkullSticker": "-9deg" }
  },
  "motion": {
    "keyTravel": "transform + box-shadow 120ms ease-out; press 50ms",
    "colour": "background-color 140ms, border-color 140ms",
    "locked": "breath 1.8s ease-in-out infinite (steady in footer bars)",
    "call": "ring 1.4s ease-out infinite from the bottom of the base",
    "startKeyCall": "1.6s ease-out infinite",
    "slam": "1100ms: drop 0-36% ease-in, hit, settle 1.04 at 46%, hold to 72%, press in to 100%",
    "kickerBlink": "1s steps(2) infinite",
    "launch": "press + invert 90ms, 6 chunks, flash 320ms, core 460ms, ring 480ms, 12 bits 640ms, total 760ms (game: 560ms, max 16 fragments)",
    "surrender": "16 cells x 18ms steps(2), flag wave 120ms x 4, burst at 480ms",
    "bootDoors": "620ms rotateY +/-100deg after 120ms",
    "toast": "opacity + translate 200ms",
    "commandRail": "translate 240ms ease",
    "cartridgeHover": "translate 0 -4px, 0.12s ease-out",
    "spring": "cubic-bezier(0.34, 1.7, 0.5, 1) (pop-ins only, never key travel)",
    "out": "cubic-bezier(0.15, 0.8, 0.3, 1)",
    "reducedMotion": "no loops, no bursts, no slams; static end states; instant transitions; hero becomes a still frame"
  }
}
```

---

## 4. The cartridge shadow: `--shadow-angle`

The rulebook makes the shadow direction a per-brand parameter (`--shadow-angle`, rulebook §5).

- **Battlefield's value: straight down** (`180deg` in the token block: x offset 0, y offset =
  depth). Every key, card, panel, sticker, toast and the cartridge sits on a hard base directly
  below it. `BOARD-UI.md` §1.1: "Never a diagonal or side shadow on the board (the hub's marketing
  site uses diagonal shadows; the board does not)."
- **The cartridge** on the landing page (`index.astro` lines 888–1010) is the hub's shell in
  Battlefield colours "with Board UI depth: the thick face sits on a base straight below", with
  "no side face". It is tilted −4° as a whole; the tilt is a rotation, not a shadow direction.
- **Contrast with the parent:** the DOM VIRUS hub's cartridge and console use a diagonal stacked
  shadow down and to the right (`dom-virus/site-kit/components/CartridgeShelf.astro` line 99).
  Battlefield never borrows it.
- Today there is no `--shadow-angle` variable in this repo; each base is written as
  `box-shadow: 0 <depth> 0 <colour>`. When the shared cartridge component reads the variable,
  Battlefield passes "straight down".

---

## 5. The shared 3D key, as Battlefield uses it

The Board UI key family is the one component shared by the whole family (rulebook §2). Battlefield
is its reference implementation (`BOARD-UI.md` §2.1: "When they differ, Battlefield wins"). Spec:
`BOARD-UI.md` §5; live: `/style-guide/` sections 03–04.

| Family | Class | Where Battlefield uses it |
|---|---|---|
| Arcade key | `.bui-arcade` + role (`bui-cmd`, `bui-fallin`, `bui-retreat`, `bui-advance`, `bui-attack`, `bui-aim`, `bui-fire`, `bui-sys`, `bui-go`) | The radio (Fall in F, Retreat R, Advance E, Attack G, Command O), Auto, Lock, Fire, Menu; site: the header **Play** key (`bui-go`), **How it plays** (`bui-sys`), **Visit DOM VIRUS** (`bui-cmd`), the hero **Airstrike** key (`bui-attack`) |
| Link key | `<a class="bui-key bui-arcade …">` | Any key that navigates (Play, Play Blitz, About Blitz); same face, base, hover, press and focus as a button |
| Base / icon key | `.bui-key`, `.bui-icon-key` | Header icons: GitHub, theme (moon / sun), sound, help, full screen |
| Sticker key | `.bui-sticker-key` | Launch and overlay keys: QUICK START, PLAN BATTLE, START BATTLE, PRESS START, KEEP FIGHTING, SURRENDER, REMATCH, NEW CAMPAIGN, REFRESH BROWSER. Left = primary (navy, cyan icon); right = secondary (dark, white glyph) |
| Page-size sticker key | `.start-key` (site only) | **START BATTLE** on the landing hero and final call: skull tile + two-line word on navy `#10233f`, white base 8px straight below, a call ring (`site.css` lines 354–439) |
| Round key | `.bui-orb` | Planning steps: Platoon, Loadout, Plan |
| Platoon key | `.bui-unit` | Number over size pips; health colours; lost = struck through |
| Pager | `.bui-pager` | ‹ ★ › on the orders card |
| Grip | `.bui-grip` | The flat violet tab on a card's top edge (no rim, no base, never presses) |

**States** (`BOARD-UI.md` §5.2):

- **Rest:** face up on its base.
- **Hover:** fine pointers only; lifts by `--hy`, base grows by the same.
- **Press:** face drops onto the base in 50ms.
- **Locked** (`aria-pressed=true`): rests pressed in the lock colour (command violet for every
  locked order) and breathes. Tap again to release. A locked key never calls.
- **Call** (`.bui-call`): the one key to press next keeps its face up and sends a ring from the
  bottom of its base (START BATTLE, PRESS START, the route check).
- **Disabled:** opacity 0.45.

**Overlays** (`BOARD-UI.md` §9) are a ritual: grey dim `#2a2d38` at 82%, a white sticker
tilted −4° that slams and presses in 40% down the map, at most two sticker keys at the map's bottom
edge, the explanation in the comms toast.

| Overlay | Sticker | Keys |
|---|---|---|
| Pause | BATTLE PAUSED / GIVE UP? | KEEP FIGHTING · SURRENDER |
| Lost | INSERT COIN / GAME OVER | REMATCH · NEW CAMPAIGN |
| Won | STAGE CLEAR / MISSION COMPLETE | REMATCH · NEW CAMPAIGN |
| Stale page | SOMETHING WENT WRONG / REFRESH | REFRESH BROWSER |

**The white-flag surrender key** (`BOARD-UI.md` §9.3): a 4 × 4 grid in **your team colour** with a
**white flag** in any theme; the face never turns red. Pressed: the cells white out one by one, the
flag waves, a losing cue plays and the key blows up in the launch burst. Pause **is** surrender:
the white flag (P) opens BATTLE PAUSED / GIVE UP?.

**The launch burst** (`BOARD-UI.md` §10): every key that starts or ends a game presses in, flips
to its inverse, then shatters into chunks with a flash, a shock ring and square debris. The site's
START BATTLE keys use the same `launch()` before navigating (`index.astro` lines 257–263).

---

## 6. Light and dark

- **Dark by default.** `<html class="bui" data-theme="dark">` (`Base.astro` line 20). Neon on ink.
- **Light everywhere.** The header's theme key flips `data-theme`; the choice is shared with the
  game and DOM VIRUS through `localStorage["dom-virus:theme"]` and applied before paint
  (`Base.astro` lines 36–41, 103–112).
- What changes on light (`src/style.css` lines 116–138; `board-ui/tokens.json`):
  - Surfaces go to paper (`--bg #eef0fb`, cards `#ffffff`) with ink `#1b1636`.
  - Text and thin lines switch to the deeper `-ink` twins (`#0088b3`, `#6a3ae6`, `#d4143a`; teams
    `#00a36d` / `#e0245e`).
  - Glows switch off.
  - The START BATTLE key's white border and base become ink `#1b1636` (`site.css` lines 419–421).
- **What never changes:** the rim (`#07060f`), the faces (same hues, same jobs), the hard bases
  straight down. Landing copy: "Neon on ink at night, crisp on paper by day. Same colours, same
  jobs." (`index.astro` line 32).

---

## 7. Motion and reduced motion

- **Keys are snappy, moments are theatrical** (`/style-guide/` section 11):
  - Key travel is 120ms ease-out, and press is 50ms.
  - Springs are for pop-ins only.
  - Stickers slam (1100ms), launch keys shatter (760ms in the kit, 560ms in the game) and the
    boot doors fold open.
  - All timings are in the token block and `BOARD-UI.md` §14.
- **The landing hero** is a live battle on one canvas (`arena.ts`):
  - Shells and treads knock the headline's letters, which are real elements.
  - Pop words: BOOM, KABOOM, WRECKED, DIRECT HIT, BLAM and FLATTENED (`arena.ts` lines 27, 170).
  - Tap the field to call an airstrike.
  - It stops when the hero is off screen or the tab is hidden (`arena.ts` line 551).
- **Reduced motion:**
  - The kit drops loops, bursts and slams; static end states, instant transitions
    (`BOARD-UI.md` §14).
  - The hero renders a still poster of parked tanks and ignores taps (`arena.ts` lines 569–591).
  - The START BATTLE call ring stops (`site.css` lines 435–439) and smooth scrolling turns off
    (`site.css` lines 27–31).
  - In the game, gameplay stays and only cosmetic effects reduce: the launch burst becomes a
    brief press and the boot screen is skipped (README "Controls" and "Local development"
    sections; `BOARD-UI.md` §12.1).

---

## 8. Accessibility

The floor is the rulebook's §10: one `h1`, landmarks, alt text, keyboard paths, visible focus,
reduced-motion fallbacks and AA contrast in both themes. What Battlefield already does:

- **Skip link and landmarks:**
  - "Skip to content" link (`Base.astro` line 44).
  - `header`, `nav aria-label="Site"`, `main`, `footer`.
  - `aria-current` on the active nav item.
- **Hero headline:** the shootable letters are `aria-hidden`; the `h1` carries the real text
  through `aria-label` (`index.astro` lines 47–51).
- **Focus:**
  - Site: a 3px `--k-sys-ink` outline at 3px offset (`site.css` lines 57–60).
  - Kit keys: a 3u `--bg` gap and a 6u sys-ink ring drawn on the face **and** the base
    (`BOARD-UI.md` §5.2).
- **Real buttons:** every key is a `<button>` or `<a>` with an accessible name. Icon-only keys keep
  their label as the name; toggles use `aria-pressed`.
- **Comms line:** `aria-live="polite"` (`index.astro` line 154).
- **Overlays:**
  - Overlays trap focus and make the background `inert`.
  - Esc / P resume.
  - The stickers' explanation is spoken through the toast (`BOARD-UI.md` §9.1).
- **Contrast:** every face must carry rim text at ≥ 4.5:1 for 12u bold labels; light faces are
  fine, and deep reds and violets need checking (`BOARD-UI.md` §3.4). On light, text uses the
  `-ink` twins.
- **Touch targets:** ≥ 44u on phones (`BOARD-UI.md` §4).

---

## 9. Phone app mode (play pages)

A play page loads like an app on phones (rulebook §5, "Board play page"):

- **The Battlefield game** (`/play/`, the committed `dist/`) is the app itself:
  - `maximum-scale=1, user-scalable=no, viewport-fit=cover`, and a web manifest.
  - Apple web-app tags and the home-screen title "Battlefield" (`dist/index.html` lines 5–16).
  - Landscape cockpit behind a rotate gate, with notch-safe rails.
  - A one-time "Best as an app" card (Add to Home Screen on iPhone; Install on Android).
  - A full-screen key.
- **Site play pages** opt in with `<Base app>` (`Base.astro` lines 9–10, 23, 99–102):
  - The no-zoom viewport, and pinch and double-tap blocked on coarse pointers.
  - On phones the page hides header, footer and skip link, locks scroll, and the stage fills the
    screen (`site/src/pages/blitz/play/index.astro` lines 54–75).
- Every play page ships the shared kit: a full-screen key, pause = the surrender overlay, light
  and dark, and the 3D keys.

---

## 10. Never

- Never a diagonal or side shadow on Battlefield, and never a blurred shadow as a base.
- Never a key that is not a Board UI key (no flat links styled as buttons, no one-off button CSS).
- Never colour a control by decoration, use a map hue for a control, or use a control colour for
  terrain.
- Never make Retreat anything but your team colour, or the surrender face red.
- Never put explanations on an overlay or a key: they go to the comms toast.
- Never more than two keys on an overlay, or more than one calling key per area.
- Never gradients, blurs or glows inside the board unless measured. The page furniture may keep
  the existing hero wash and header blur.
- Never a different look per theme: same faces, same jobs, same rim.
- Never ignore reduced motion: every loop, burst and slam needs a static end state.
- Never install or reuse directions for the board (rulebook §3, §9). See [`voice.md`](voice.md).
- Never edit `board-ui/` or `shared/` by hand: change `fizlet/src/ui/` or the owning repo, then
  sync.
- Never change the game, hero or in-page animations in Phase 2 (rulebook §13).

---

## 11. Gaps between this guide and the live sources

These need an owner decision; full list in [`voice.md`](voice.md#open-questions).

- `--shadow-angle` does not exist as a variable yet (§4).
- The kit's dark-theme key glow and the site's `.panel.lit` and START BATTLE glows predate the
  rulebook's "no glows unless measured" rule. Keep them, measure them, or drop them?
