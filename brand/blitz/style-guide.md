# Battlefield Blitz: style guide

Preset: cyberpunk-tron · flat colors in the game layer (hard, unblurred shadows; the shadow angle is a brand token). Read by astro-base-engine; the site renders its own look.

Battlefield Blitz is part of the DOM Battlefield brand: its pages live on the Battlefield site
(`/blitz/`, `/blitz/play/`) and "share its styling" (Blitz `README.md`). **Everything in
[`../style-guide.md`](../style-guide.md) applies.** This file lists only what Blitz does
differently. Voice: [`voice.md`](voice.md).

Phase 2 rule: the game is locked (rulebook §13). This documents what ships.

---

## 1. The live sources

| What | Source |
|---|---|
| Blitz landing page (hero = the game's demo mode with bots) | [`site/src/pages/blitz/index.astro`](../../site/src/pages/blitz/index.astro) |
| Blitz play page (phone app mode) | [`site/src/pages/blitz/play/index.astro`](../../site/src/pages/blitz/play/index.astro) |
| The pinned build the site ships | [`vendor/blitz/`](../../vendor/blitz/) ([`ORIGIN.json`](../../vendor/blitz/ORIGIN.json): 0.6.5) |
| In-game CSS (one string, `CSS`) and colour constants | [`dom-battlefield-blitz/src/game.ts`](https://github.com/coded-dot-design/dom-battlefield-blitz/blob/main/src/game.ts) lines 44–58 (colours), 93–173 (icons, CSS), 176–200 (markup) |
| Keys and overlays | the same Board UI kit, compiled in from Fizlet's `ui` brick (`__KIT_CSS__`, Fizlet 0.2.4) |

---

## 2. What differs from Battlefield

**Same:** rim, surfaces, light and dark values, the 3D key family, the overlay ritual, the launch
burst, the white flag, mono type, hard bases straight down. Blitz "wears the Board UI kit …
the same CSS as DOM Battlefield, so keys look and behave the same on both boards in dark and light"
(Blitz `CHANGELOG.md` 0.5.0).

**Different:**

1. **Accent: attack pink.**
   - Battlefield's landing accents lean on command violet, team mint and sys cyan.
   - Blitz's page accent is `--k-attack` `#ff2e88`: the `h1`/`h2` `<em>` beat ("*Every tank for
     itself.*", "*No mercy.*"), the `BLITZ` label in the play-page bar and the pink bolt on the
     Blitz badge (`game.ts` line 94).
   - `family.json` gives Blitz `accent: "pink"` (Battlefield: `"cyan"`).
2. **Stage colour.** Both Blitz heroes and the play stage sit on the map navy `#090818`, in both
   themes. The canvas map flips to `#e4e6f7` on light (`game.ts` line 1466).
3. **Hero.**
   - Battlefield's hero: a hand-built arena over a page.
   - Blitz's hero: the real game in demo mode (`createBlitz(…, { demo: true, bots: 6 })`), at 85%
     opacity, under a left-to-right navy scrim so the copy reads (`blitz/index.astro` lines
     140–153).
   - The scrim is a gradient on page furniture, not in the game layer. On narrow screens it turns
     vertical (`blitz/index.astro` line 382).
4. **Arcade HUD instead of a cockpit.**
   - A floating HUD pill: KILLS · TIME · ARMOR · STREAK, plus TEAM · LEADER in platoons.
   - A kill feed on the right.
   - A slanted banner for streaks.
   - A blinking pink tip strip (AIRSTRIKE · TAP WHERE THE BOMBS GO).
   - All on kit tokens, so they flip with the theme (Blitz `CHANGELOG.md` 0.5.0).
5. **Round arcade pad** (bottom right) instead of rails. See §4.
6. **Power-tile colours** and **four platoon colours** (token block below).
7. **More tilt:** the streak banner leans −2°. The start and overlay stickers lean −4° like
   Battlefield's.
8. **Embed surface.** Blitz renders in a shadow root (`:host{all:initial}`), so a host page can't
   reach in. The drop-in build sits at `z-index: 2147483000` (`game.ts` lines 96–97, 157). Brand
   status of the drop-in: see [`voice.md`](voice.md#open-questions).

---

## 3. Tokens (only what differs)

```tokens
{
  "brand": "Battlefield Blitz",
  "inherits": "DOM Battlefield (../style-guide.md tokens block)",
  "$source": {
    "game": "dom-battlefield-blitz/src/game.ts lines 44-58, 93-173 (v0.6.5)",
    "landing": "site/src/pages/blitz/index.astro lines 13-21, 129-385",
    "play": "site/src/pages/blitz/play/index.astro lines 23-82"
  },
  "color": {
    "accent": { "var": "--k-attack", "value": "#ff2e88", "use": "headline <em>, BLITZ label, badge bolt, STRIKE key, tip strip" },
    "stage": "#090818",
    "stageLight": "#e4e6f7",
    "heroScrim": "linear-gradient(90deg, #090818ee 0%, #090818aa 45%, transparent 75%)",
    "heroText": { "h1": "#f6f3ff", "lead": "#cfc7f0" },
    "platoons": { "YOUR": "#39ffb0", "VIPER": "#ff5c8f", "NOVA": "#19f0ff", "BRICK": "#ffc21a" },
    "soloTanks": ["#39ffb0", "#ff5c8f", "#19f0ff", "#ffc21a", "#b48cff", "#ff8a1f", "#a8ff3e", "#f6f3ff", "#ff2e88", "#7cf0ff", "#e8b4ff"],
    "tiles": {
      "rapid":  "#39ffb0",
      "triple": "#19f0ff",
      "strike": "#ff2e88",
      "shield": "#f6f3ff",
      "mine":   "#ff2b4e",
      "health": "#a8ff3e",
      "long":   "#ffc21a"
    },
    "fx": ["#fff4ff", "#ffc21a", "#ff8a1f", "#ff2e88", "#19f0ff", "#39ffb0", "#9a63ff", "#07060f"],
    "banner": { "face": "#10233f", "border": "#f6f3ff", "base": "#f6f3ff", "word": "#ffc21a", "kicker": "#19f0ff" },
    "coach": {
      "dark":  { "face": "#10233f", "text": "#f6f3ff", "border": "#f6f3ff", "title": "var(--hurt)" },
      "light": { "face": "#f6f3ff", "text": "var(--rim)", "border": "var(--rim)", "title": "#b07400" }
    },
    "youOnLight": "#0a8a55",
    "overlayDim": "color-mix(in srgb, #2a2d38 72%, transparent)",
    "keys": {
      "FIRE": "bui-fire (--k-fire), heat ring in --hurt, --k-fire when overheated",
      "AUTO / LOCK": "bui-aim (--k-aim), dim off, lit and breathing when locked",
      "LONG": "--c: var(--hurt)",
      "STRIKE": "bui-attack, --lock: var(--k-attack)",
      "Pause": "bui-flag (white flag)",
      "grip": "bui-grip (flat violet tab)"
    }
  },
  "font": {
    "game": "600 12px/1.3 ui-monospace, SFMono-Regular, Menlo, monospace",
    "hudValue": "900 17px mono",
    "hudLabel": "8px mono, letter-spacing 0.16em, --muted",
    "startWord": "900 clamp(34px, 7vw, 58px)/1 mono, letter-spacing 3px",
    "bannerWord": "900 clamp(20px, 4vw, 34px)/1 mono",
    "countdown": "900 96px/1 mono",
    "roundKeyCaption": "900 8px/1 mono, letter-spacing 0.12em"
  },
  "radius": {
    "roundKey": "50%", "hud": "12px", "banner": "14px", "sticker": "12px", "coach": "12px",
    "table": "12px", "legend": "10px", "tip": "8px", "feedItem": "6px"
  },
  "size": {
    "fire": "96px", "roundKey": "62px", "autoLock": "52px", "pad": "200 x 256px", "padScalePhoneUnder620px": 0.82
  },
  "shadow": {
    "rule": "Same as Battlefield: hard, straight down, never blurred.",
    "shadowAngle": { "var": "--shadow-angle", "value": "180deg", "meaning": "straight down, inherited" },
    "depth": { "roundKey": "5px", "hud": "5px", "banner": "6px", "sticker": "6px", "coach": "5px", "table": "5px", "legend": "4px", "tip": "4px" },
    "tilt": { "sticker": "-4deg", "banner": "-2deg" },
    "exceptions": "countdown digits glow (text-shadow 0 0 30px var(--k-sys)); sticker word carries a hard 0 4px 0 text shadow"
  },
  "motion": {
    "stickerSlam": "bui-slam 1.1s linear both",
    "countdown": "bui-slam 0.5s",
    "stickerKeyPop": "0.38s after 0.9s, var(--bui-spring)",
    "blink": "1s steps(2) infinite (sticker kicker, PRESS START label, tip strip)",
    "overheat": "0.25s steps(2) infinite",
    "coachHighlight": "3px dashed outline, offset 6px to 10px, 1s ease-in-out infinite",
    "hpBar": "width 0.2s",
    "shake": "only blasts near your tank and hits you take, harder the bigger the hit",
    "haptics": "navigator.vibrate on hits, max 400ms",
    "reducedMotion": "sticker, countdown and tip stop animating; launch burst becomes a press; landing hero demo not started"
  }
}
```

---

## 4. The shared 3D key, as Blitz uses it

Every Blitz key is a Board UI kit key, "the same as DOM Battlefield's" (Blitz `README.md`).

- **Round arcade keys** (`.rk.bui-arcade`, 50% radius, 5px base):
  - **FIRE** (96px, hold) carries a heat ring that fills in `--hurt` and blinks `--k-fire` when the
    cannon overheats.
  - **AUTO** and **LOCK** (52px, `bui-aim`) "ride on FIRE's shoulders (the Battlefield cockpit)":
    dim when off, lit and breathing when locked.
  - **LONG** (amber `--hurt`) and **STRIKE** (`bui-attack`) sit in a row above. Count badges ride
    their top-right corners; on desktop a `kbd` chip shows the shortcut (Q, T, E, F, SPACE).
- **The grip:** the pad's drag handle is the kit's `.bui-grip`, "a flat violet tab with dark dots,
  with a bigger invisible touch area" (Blitz `CHANGELOG.md` 0.6.2). Drag moves the whole pad
  (remembered); double-click puts it back.
- **Sticker keys:**
  - **PRESS START** (calling, with a play-on-grid icon) and **REMATCH / NEW GAME** on results.
  - **KEEP FIGHTING / SURRENDER** on pause.
  - White face and ink rim in light. PRESS START bursts with the kit's `launch()`.
- **Segmented choice:** the mode picker SOLO · PLATOON · PRACTICE is the kit's `bui-seg`; the
  picked mode stays pressed in (Blitz `CHANGELOG.md` 0.5.0).
- **The white flag:** a `bui-flag` key top left (Esc / P) next to the full-screen key. Pause
  **is** the surrender question, "exactly as in DOM Battlefield": BATTLE PAUSED / GIVE UP? with
  KEEP FIGHTING and SURRENDER. Surrender whites out your team grid, waves the flag, bursts and
  ends the match (Blitz `CHANGELOG.md` 0.6.0).
- **Overlays:** the kit overlay throughout.

| Overlay | Sticker | Keys |
|---|---|---|
| Start | BATTLEFIELD · FREE FOR ALL / PLATOONS / PRACTICE over **BLITZ!** (pink `!`) | SOLO · PLATOON · PRACTICE, then PRESS START |
| Pause | BATTLE PAUSED / GIVE UP? | KEEP FIGHTING · SURRENDER |
| Won | STAGE CLEAR / YOU WIN (or PLATOON WINS) | REMATCH · NEW GAME |
| Lost | INSERT COIN / *NAME* WINS | REMATCH · NEW GAME |
| Gave up | WHITE FLAG / GAME OVER | REMATCH · NEW GAME |

- **Practice coach:** a navy card with a white base. Step counter in sys ink, the step title in
  amber, an **END PRACTICE** arcade key in attack pink. The key it teaches gets a pulsing dashed
  outline.
- **Not used:** Battlefield's planning cards, orbits, pager, platoon keys, radio orders and
  comms toast. Blitz has no planning stage.

---

## 5. Light and dark

Inherited. The board follows the page's `<html data-theme>`. HUD, feed, table and notes use kit
tokens, so they flip with it (Blitz `README.md`, `CHANGELOG.md` 0.2.0, 0.5.0).

Blitz-only light rules:
- The coach turns to a white face with an ink rim; its title turns `#b07400`.
- "You" rows and kill counts turn `#0a8a55`.
- The canvas map turns `#e4e6f7` and cover blocks turn `#f6f3ff` (`game.ts` lines 110, 153–154,
  166, 1466, 1502).

---

## 6. Motion and reduced motion

- **Drama is the point:**
  - Airstrikes: a bomber flies over your shoulder and the bombs go off "with the Battlefield
    hero's triple blasts and black scorch" (Blitz `README.md`).
  - Pop words: BOOM, KABOOM, WRECKED, DIRECT HIT, BLAM, FLATTENED, DOUBLE KILL, RAMPAGE, NUKED and
    more (`game.ts` line 54).
  - Parachute drops, a streak banner that slams in, and a 3-2-1 countdown that slams.
- **Screen shake is about you:** "only blasts near your tank move the screen (closer = harder),
  hits you take shake it by how hard they were, and phones vibrate when you're hit" (Blitz
  `CHANGELOG.md` 0.4.0).
- **Reduced motion today** (Blitz):
  - The start sticker, countdown and tip strip stop animating (`game.ts` line 173).
  - The launch burst becomes a brief press (`game.ts` lines 1151, 1231–1232).
  - The landing hero's demo battle never starts (`blitz/index.astro` line 111).
  - Screen shake and haptics have no reduced-motion check in `game.ts`. This is listed as an open
    question in [`voice.md`](voice.md#open-questions). The game is locked, so it is not changed
    here.

---

## 7. Phone app mode

`/blitz/play/` is the shipped reference for the rulebook's phone app mode ("shipped on
`/blitz/play/`, Phase 1"):

- `<Base … app>` gives the no-zoom viewport (`maximum-scale=1, user-scalable=no,
  viewport-fit=cover`) and blocks pinch and double-tap on coarse pointers.
- On `(pointer: coarse), (max-width: 760px)` the page hides header, footer, skip link and the
  controls bar. It locks scroll and overscroll, and pins the stage to the full screen
  (`blitz/play/index.astro` lines 54–75).
- In game:
  - A full-screen key top left: real full screen where allowed (landscape on phones), else the
    board fills the window.
  - Safe-area insets on every floating piece.
  - The round pad bottom right, scaled to 0.82 under 620px.
  - Short-screen rules (`max-height: 460px`) that hide the legend and shrink the sticker.

---

## 8. Never (in addition to Battlefield's)

- Never invent a new key family for Blitz: kit keys only (arcade, round arcade, sticker, grip,
  flag).
- Never give Blitz its own palette roles. It uses the kit roles; pink is an accent of the existing
  `--k-attack`, not a new token.
- Never put planning or radio UI in Blitz; it is "No planning, no radio" (`blitz/index.astro`
  line 39).
- Never let the power-tile colours drift from the tiles legend on the landing page
  (`blitz/index.astro` lines 13–21) and the game's `TILE_COLOR` (`game.ts` line 53). They are the
  same set.
