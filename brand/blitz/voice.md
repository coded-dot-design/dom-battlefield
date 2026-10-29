# Battlefield Blitz: voice

Blitz speaks in the DOM Battlefield voice. **Everything in [`../voice.md`](../voice.md) applies**:
who's talking (the game first, then a short maker's note), the byline, the words to avoid, the
content mix, the limits. This file lists only what Blitz does differently. Look:
[`style-guide.md`](style-guide.md).

---

## Who's talking

**The game talks first, and louder.** Battlefield with the planning taken out: more arcade cabinet
than radio net. In the persona's words, Blitz is pure arcade.

Then **a short maker's note** from Chris Cooley, first person, after the gameplay. Blitz is the one
game that runs on Fizlet today, so the note may say so, in one line, as a fact about the game, not a
pitch for the engine. Creative licence on tone, never on facts or biography.

## Who we talk to

The same players, in a different mood. Battlefield is for people who want to plan; Blitz is for
people who want to drop in and blow things up now: "No planning, no radio: eight tanks parachute
onto a blinking grid and blow each other up for three minutes. Most kills wins." New players get
PRACTICE: "learn the keys, with tips".

## How the game sounds

Cabinet talk instead of radio talk: BLITZ!, PRESS START, DOUBLE KILL, RAMPAGE, NUKED, INSERT COIN.

- "Free-for-all tank chaos. The arcade version of DOM Battlefield."
- "Battlefield Blitz. *Every tank for itself.*"
- "Same tanks. *No mercy.*"
- "Every tank respawns by parachute, invulnerable on the way down. Nobody is ever out."
- "Read the square. Then run."
- Coach: "Tap STRIKE (F), then tap where the bombs go. They never hurt you."

Patterns: rules as two-word kickers (SOLO OR PLATOON, PARACHUTE IN, THE GRID BLINKS, KILL STREAKS,
THREE MINUTES) with one or two sentences each; coach steps with a one-word title, then one
instruction naming the key and its shortcut ("Tap LOCK (T).").

## The maker's note

Themes that fit Blitz: arcade feel in a few kilobytes, a grid that blinks with power tiles, kill
streaks that escalate, parachute respawns so nobody sits out, building it on a small engine.

| Don't | Do |
|---|---|
| "The ultimate battle royale, online now!" | "Every tank for itself. Most kills in three minutes wins." |
| "Built in days on the engine that runs everything." | "Blitz runs on Fizlet, my tiny engine, with Sherman Bytes drawing the tanks." |
| "Blazing fast on any device." | "About 34 KB gzipped: engine, art and the keys included." (from the size script) |

Sample maker's lines (style, not facts):
- "Nobody sits out. You get blown up, you parachute back in. That's the whole point of an arcade."
- "If a kill streak doesn't make you grin, it isn't done."

## Words we use (in addition to Battlefield's)

free for all, every tank for itself, solo, platoon, wingmen, practice, coach · parachute in, drop
back in, respawn · the blinking grid, power tiles, lit squares · Rapid, Triple, Airstrike, Shield,
Health, Long, Mine · cannon, overheat, long shot, lock on · STRIKE, carpet bomb, NUKE · kill
streak, supply crate · most kills wins, three minutes, standings, rematch · arcade (the copy's word
for the Modern style, A2).

## Words we never use (in addition to Battlefield's)

- **plan, radio, orders, command, freeze time**: Battlefield's words ("No planning, no radio").
- **battle royale**: no shrinking zone, no last tank standing. Say "free for all", "most kills
  wins".
- **online, multiplayer, players, PvP**: every other tank is a bot ("you + 7 bots").
- **demo, mode, mini-game** for Blitz itself: it's a game with three modes.
- **install or drop-in copy on board pages**: the drop-in lives on the hub's embedded page
  (`/games/blitz/`, A1); `/blitz/blitz.js` keeps working forever.

## CTA labels (exact)

**PLAY BLITZ** (sticker key, hero) · **Play** (header) · **Play Blitz** / **Play Blitz ↗** ·
**About Blitz** · **The original: DOM Battlefield** · **Play the original ↗** · **Explore the
original Sherman Bytes** (required, A7). Board URLs follow A4: landing
`battlefield.domvirus.com/blitz/`, board `/play/blitz/` (from `family.json`). Not on board pages:
"Put it on your site", "Drop Blitz on this page", script snippets. In-game keys are locked.

## Claims: what we may and may not say

**May (sourced from the Blitz repo):** three modes (PRACTICE, SOLO, PLATOON); solo is eight tanks,
every tank for itself; platoon is you and three wingmen against two platoons of four, no friendly
fire; most kills in three minutes wins; parachute respawn, invulnerable on the way down; seven tile
types; two guns, 3 long shots to start; kill streaks 2 / 3 / 5 / 8 → long shot / airstrike / carpet
bomb / nuke; supply crates "every 20 seconds or so"; a 10-step practice coach; **built on Fizlet**,
tanks drawn with Sherman Bytes sprites, no runtime dependencies; the same Board UI keys as DOM
Battlefield, light and dark.

**May not:** online play or multiplayer; "battle royale"; the 0.1.0 "17 KB" figure as today's
size; "built in days" or other persona lines that aren't measured (cite git instead: 0.1.0 to 0.6.5
on 2026-10-28, C4); install or embed claims on board pages.

## Size

Measured with `npm run size` in the Blitz repo (0.6.5, 2026-10-28): `dist/blitz.js` 34,501 bytes
gzip, budget 40,960. It is "the whole drop-in (game + engine + art + the Board UI kit CSS)". Say
"~34 KB gzip, engine, art and the Board UI kit included", the 40 KB budget and a smaller next
target labelled "target" (C1). Generate it from the build (C2). No speed claims.

## Avoid

<!-- Read by astro-base-engine (voice.avoid): one word or phrase per bullet, flagged wherever it
appears in page copy. The reasons are in the sections above and in ../voice.md. -->

- revolutionary
- game-changing
- cutting-edge
- best-in-class
- world-class
- seamless
- synergy
- put it on your site
- use it in your project
- install it on your site
- accurate reconstruction
- authentic
- invite a friend
- zero load time
- fastest
- next-gen
- AAA
- disruptive
- unleash
- blazing fast
- full speed on anything
- days instead of months
- multiplayer soon
- battle royale
- drop blitz on this page

## Limits

<!-- Read by astro-base-engine (voice.maxSentenceWords, voice.maxExclamations). -->

- max sentence words: 25
- max exclamations: 1

## Open questions

Battlefield's open questions ([`../voice.md`](../voice.md#open-questions)) apply too. Blitz adds:

1. **"The Blitz version".** The page title and eyebrow say "Blitz version"; the description and lead
   say "the arcade version". This file prefers "the arcade version". Confirm.
2. **Reduced motion.** Screen shake and phone vibration have no reduced-motion check in `game.ts`.
   The family requires reduced-motion fallbacks, and the game is locked.
