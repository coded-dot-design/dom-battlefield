# Battlefield Blitz: voice

Blitz speaks in the DOM Battlefield voice. **Everything in [`../voice.md`](../voice.md) applies**:
who we talk to, the arcade attitude, the words to avoid, the credit line, the content mix, the
limits. This file lists only what Blitz does differently. Look: [`style-guide.md`](style-guide.md).

---

## Who we talk to

The same players, in a different mood. Battlefield is for people who want to plan. Blitz is for
people who want to drop in and blow things up right now: "No planning, no radio: eight tanks
parachute onto a blinking grid and blow each other up for three minutes. Most kills wins."
(`site/src/pages/blitz/index.astro:39`). New players get PRACTICE: "learn the keys, with tips"
(Blitz `src/game.ts:1135`).

---

## How we sound

Battlefield's voice with the planning taken out: faster, louder, more arcade cabinet than radio
net. Battlefield's radio talk ("ROGER · GRID 0412") gives way to cabinet talk: BLITZ!, PRESS
START, DOUBLE KILL, RAMPAGE, NUKED, INSERT COIN.

Real lines:

1. "Free-for-all tank chaos. The arcade version of DOM Battlefield." (Blitz `README.md:3`)
2. "Battlefield Blitz. *Every tank for itself.*" (`site/src/pages/blitz/index.astro:38`)
3. "Same tanks. *No mercy.*" (`site/src/pages/blitz/index.astro:54`)
4. "Every tank respawns by parachute, invulnerable on the way down. Nobody is ever out."
   (`site/src/pages/blitz/index.astro:25`)
5. "Read the square. Then run." (`site/src/pages/blitz/index.astro:68`)
6. Coach, in game: "Tap STRIKE (F), then tap where the bombs go. They never hurt you." (Blitz
   `src/game.ts:1071`); trick: "Mines blink fast and red. Drive around them, or lure someone over
   one." (Blitz `src/game.ts:1082`)

Patterns:

- **Rules as two-word kickers** (SOLO OR PLATOON, PARACHUTE IN, THE GRID BLINKS, TWO GUNS,
  AIRSTRIKES, KILL STREAKS, THREE MINUTES) with a short title and one or two sentences each
  (`blitz/index.astro:22-31`).
- **Coach steps:**
  - A one-word title (DRIVE, FIRE, AUTO AIM, LONG SHOT, AIRSTRIKE).
  - One instruction that names the key and its shortcut: "Tap LOCK (T)." (Blitz
    `src/game.ts:1065-1076`).
  - Then FREE PLAY · TRICK lines.
- **Legend lines:** `<b>KEY</b>` and a plain phrase: "STRIKE tap a spot, the bombs go boom"
  (Blitz `src/game.ts:1136`).

---

## Words we use (in addition to Battlefield's)

free for all, every tank for itself, solo, platoon, wingmen, practice, coach · parachute in, drop
back in, respawn · the blinking grid, power tiles, lit squares, slot machine · Rapid, Triple,
Airstrike, Shield, Health, Long, Mine · cannon, overheat, the LONG gun, long shot, lock on · STRIKE,
bomber, carpet bomb, NUKE · kill streak, supply crate, jackpot · most kills wins, three minutes,
standings, rematch.

## Words we avoid (in addition to Battlefield's)

| Avoid | Why |
|---|---|
| plan, radio, orders, command, freeze time | Blitz has "No planning, no radio" (`blitz/index.astro:39`). Those are Battlefield's words. |
| battle royale | The rulebook's working style name says "battle-royale pace", but no Blitz copy uses it, and there is no shrinking zone or last-tank-standing. Use "free for all" and "most kills wins". |
| online, multiplayer, players, PvP | Every other tank is a bot ("you + 7 bots", Blitz `CHANGELOG.md` 0.1.0). |
| "the Blitz version" in headlines | Used in the page title and eyebrow (`blitz/index.astro:33`, `:37`). Public copy otherwise says "the arcade version". Prefer that. |

---

## CTA labels (exact)

| Label | Goes to | Where today |
|---|---|---|
| **PLAY BLITZ** (two lines, sticker key) | `/blitz/play/` | Blitz hero (`blitz/index.astro:41`) |
| **Play** (header key) | `/blitz/play/` on Blitz pages | `Base.astro:60` |
| **Play Blitz** / **Play Blitz ↗** | `/blitz/play/` | Battlefield landing (`index.astro:92`), Blitz family card (`blitz/index.astro:97`) |
| **About Blitz** | `/blitz/` | Battlefield landing (`index.astro:93`), Blitz play bar (`blitz/play/index.astro:13`) |
| **The original: DOM Battlefield** | Battlefield landing | Blitz hero (`blitz/index.astro:44`), play bar (`blitz/play/index.astro:13`) |
| **Play the original ↗** | Battlefield landing | Blitz family card (`blitz/index.astro:94`) |
| **Explore the original Sherman Bytes** | Sherman Bytes' demo page (`family.json`) | **required by the rulebook (§7) on the landing and play screen; missing today** |

In-game keys (locked): PRESS START, SOLO, PLATOON, PRACTICE, END PRACTICE, KEEP FIGHTING,
SURRENDER, REMATCH, NEW GAME.

Not for a board, per the rulebook (open question 1): **Put it on your site**, **Drop Blitz on this
page**, **Put Blitz on your page** and the script snippets (`blitz/index.astro:43`, `:80-90`;
`index.astro:94`; `blitz/play/index.astro:13`).

---

## Avoid

All of Battlefield's list, plus:
- Battlefield's planning vocabulary (above).
- Calling Blitz a demo, a mode or a mini-game. It's a game with three modes. `dom-virus/GAMES.md` once
  planned it as "a second mode" of Battlefield; it shipped as its own repo.
- Waves, bosses, high scores and weekly boards: in the original plan (`dom-virus/GAMES.md`
  §1), not shipped.

---

## Limits: claims we may and may not make

**May (with the source):**

| Claim | Source |
|---|---|
| Three modes: PRACTICE, SOLO, PLATOON | Blitz `README.md` "The game", `CHANGELOG.md` 0.3.0, 0.4.0 |
| Solo: eight tanks, every tank for itself | `README.md`; `blitz/index.astro:23` |
| Platoon: you and three wingmen against two other platoons of four; no friendly fire | `README.md`; `CHANGELOG.md` 0.3.0 |
| Most kills in three minutes wins (board) | `README.md`; `blitz/index.astro:30` |
| Respawn by parachute, invulnerable on the way down | `blitz/index.astro:25` |
| Seven tile types (Rapid, Triple, Airstrike, Shield, Health, Long, Mine) | `README.md` tile table; `blitz/index.astro:13-21` |
| Two guns; 3 long shots to start | `README.md`; `blitz/index.astro:27` |
| Kill streaks 2 / 3 / 5 / 8 → long shot / airstrike / carpet bomb / nuke | `README.md`; `CHANGELOG.md` 0.2.0 |
| Supply crates "every 20 seconds or so" | `README.md`; `game.ts:1081` |
| A 10-step practice coach | `CHANGELOG.md` 0.4.0 |
| Built on Fizlet; tanks drawn with Sherman Bytes sprites; no runtime dependencies | `README.md`; `vendor/fizlet/ORIGIN.json` (Fizlet 0.2.4) in the Blitz repo |
| Same Board UI keys as DOM Battlefield, light and dark | `README.md`; `CHANGELOG.md` 0.5.0 |
| Size (below) | `scripts/size.mjs` in the Blitz repo |

**May not:**

- Online play, real opponents or multiplayer.
- "Battle royale" (above).
- Any size other than the measured one, or the 0.1.0 "17 KB" figure as today's size. That was
  before the kit and later features.
- Install or embed claims on board pages (open question 1).

---

## Content mix

Same rule: 80–90% gameplay, 10–20% tech. The Blitz landing page today:

- **Gameplay:** hero, eight rules, the blinking grid, two ways to fight.
- **Tech:** the one-line "Built on Fizlet" note.
- **Drop-in:** a whole section, which the rulebook would not allow on a board page
  (open question 1).

---

## Size and speed

- **Measured today:** `npm run size` in the Blitz repo (0.6.5), 2026-10-28:
  - `dist/blitz.js` **34,501 bytes gzip**.
  - `dist/blitz.mjs` 34,618 bytes.
  - Budget **40,960 bytes** (40 KB) each.
- **What it includes:** "the whole drop-in (game + engine + art + the Board UI kit CSS)"
  (`scripts/size.mjs` comment). The README says "budget: 40 KB gzip (today ~34 KB, engine, art and
  the Board UI kit included)", and `CHANGELOG.md` 0.5.0 says "the kit CSS is ~3 KB of it".
- **How to say it:** "~34 KB gzip, engine, art and the Board UI kit included", the budget of
  40 KB, and a smaller next target (open question 3).
- The Blitz landing page states no size today, though the rulebook asks every game landing page
  to (open question 3).
- No speed claims exist in Blitz copy.

---

## Credit line

Same as Battlefield: **By Chris Cooley · [coded.design](https://coded.design)**, linked.

- The Blitz pages get the Battlefield footer (`Base.astro:96`), so they share its gap
  ([`../voice.md`](../voice.md#open-questions) question 6).
- The README says "MIT © Chris Cooley / coded.design".

---

## How we refer to each other

| Name | How Blitz copy refers to it |
|---|---|
| **Battlefield Blitz** | Full name first, then "Blitz". Sticker wordmark **BLITZ!** with a pink `!`, under the kicker "BATTLEFIELD · FREE FOR ALL" (`game.ts:1127-1134`). |
| **DOM Battlefield** | "the original" / "The original: DOM Battlefield". Blitz is "the arcade version of DOM Battlefield" (`README.md:3`, `blitz/index.astro:39`). Shared features are credited to it: "like the Battlefield cockpit", "the Battlefield hero's triple blasts", "exactly as in DOM Battlefield". |
| **Sherman Bytes** | Its sprites draw the tanks: "draws tanks with Sherman Bytes sprites" (`README.md`). Back-link, exact: **Explore the original Sherman Bytes** (rulebook §7, `family.json` `builtFrom`). |
| **Fizlet** | "Built on Fizlet, the tiny engine behind the DOM VIRUS arcade." (`blitz/index.astro:99`). Keep the engine to one line on game pages. |
| **Both games together** | "TWO WAYS TO FIGHT" (`blitz/index.astro:92`): Battlefield = squad tactics, Blitz = arcade. Internally the original is the "OG" and Blitz its "arcade sibling" (`dom-virus/GAMES.md:21`). |

---

## Open questions

Battlefield's open questions ([`../voice.md`](../voice.md#open-questions)) apply too. Blitz adds:

1. **The drop-in.** Blitz ships a drop-in for any website: snippets on `/blitz/#drop`, a "Drop
   Blitz on this page" demo, "Put it on your site" keys on three pages, `/blitz/blitz.js`, and the
   README's "Drop-in options" and "As a module". The rulebook says board games are never
   installable and get no install directions. `dom-virus/GAMES.md` planned two builds: an embed for any page
   and a board mode on Battlefield's site.
   - Is Blitz a board game with an embeddable twin (which would make it behave like an embedded
     game for this purpose)?
   - Or does the drop-in copy come off the board pages?
2. **URL.** Existing copy and links assume `/blitz/` (landing), `/blitz/play/` (play) and
   `/blitz/blitz.js` (drop-in), all on the Battlefield site. The rulebook proposes
   `battlefield.domvirus.com/blitz/` and `/play/blitz/`, or its own `blitz.domvirus.com`.
   `family.json` already lists `productionPlay: …/play/blitz/`.
   - Today's copy implies Blitz stays on the Battlefield site, under `/blitz/`.
   - Moving play to `/play/blitz/` needs a redirect from `/blitz/play/`.
   - The drop-in URL is baked into every snippet anyone has copied, so it can't move.
3. **Size on the landing page.** The rulebook asks every game landing page for the measured size,
   its target and a smaller next target. The Blitz page has none. The facts exist (34,501 bytes,
   40,960 budget); the smaller target doesn't.
4. **"Modern" vs "arcade".** Blitz is "Modern" in the rulebook (working name). Copy calls it "the
   arcade version" everywhere and never "Modern". The rulebook also says "battle-royale pace";
   copy says "free for all".
5. **"The Blitz version".** The page title is "Battlefield Blitz · the Blitz version of DOM
   Battlefield" and the eyebrow says "BLITZ VERSION" (`blitz/index.astro:33`, `:37`). The
   description and lead say "the arcade version". Pick one.
6. **Reduced motion.** Screen shake and phone vibration have no reduced-motion check in
   `game.ts`. The rulebook requires reduced-motion fallbacks, and the game is locked.
