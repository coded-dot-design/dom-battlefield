# Voice — DOM Battlefield

Brand level: game · by Chris Cooley (https://coded.design/)

DOM Battlefield is a squad tactics board game in the DOM VIRUS family. Battlefield Blitz lives on
the same site and inherits this voice (`brand/blitz/voice.md` lists what differs).
<!-- src: games spec (number 02, SQUAD TACTICS, board, classic); dom-battlefield site/src/pages/blitz/ -->

## Who we talk to

- **Players first.** People who want a real tactics game in a browser tab, on a desk or a phone.
- **Commanders, not spectators.** "You" pick the ground, freeze time, give orders, radio the squad.
- **Curious web people, second.** They like that every square on the board is a real element.
  They get the short tech beat, never install directions: the board is played on this site.

## How we sound

The game talks first: short, loud, physical. Military radio inside the game, arcade swagger on the
page. Play now, always first.

- Imperatives and two-beat headlines; the second beat takes the accent.
- One idea per sentence. No hedging, no hype with nothing behind it.
- Eyebrows in mono caps with an index (`01 HOW A BATTLE PLAYS`); labels as `FIRST WORD · detail`.
- Radio pills and stickers: ROGER · GRID 0412, ATTACKING HQ, BATTLE PAUSED / GIVE UP?, MISSION COMPLETE.
- Player copy says **key**, never "button".

Lines that ship, to tune by:

- "Squad tactics in a browser tab."
- "Twelve tanks. One radio." · "Plan it frozen. Fight it live."
- "Every square on the board is a real element. It is a web page, fighting back."
- "COMMS · Pick an order. The squad is listening."
<!-- src: games spec site.tagline; dom-battlefield site/src/pages/index.astro lines 30, 47, 108, 154 -->

**Mix:** 80–90% gameplay (the hero, how a battle plays, the radio, fronts and tanks, the phone
cockpit). 10–20% engine and size ("Tiny on purpose", "The grid is the DOM").

**The maker's note** (one short paragraph at most, after the gameplay, first person, Chris Cooley):
excited, opinionated about craft. Battlefield is his love letter to Bolo; the note may credit
that, never sell with it. Example tone: "Every order is one key. If it doesn't work under a thumb,
it isn't done."

## Facts we say

- Command a platoon of up to twelve tanks. Pick the ground, freeze time to plan every route, then
  radio your squad through a live firefight. No install, no account.
  <!-- src: games spec site.description -->
- Three stages: Setup, Plan (time frozen), Battle. <!-- src: dom-battlefield README line 44 -->
- Every square on the board is a real DOM element. <!-- src: site/src/pages/index.astro line 30 -->
- Desktop and phones (landscape cockpit, add to home screen), light and dark, full screen.
  <!-- src: site/src/pages/index.astro lines 26-31 -->
- Four fronts: Hedgerow breach, Desert spearhead, Winter crossroads, Twin bridges.
  <!-- src: site/src/pages/index.astro line 22 -->
- A single-player game. Multiplayer is future work, said without a date. <!-- src: dom-battlefield README line 110 -->
- No runtime dependencies. Open source, MIT: github.com/coded-dot-design/dom-battlefield.
  <!-- src: dom-battlefield scripts/size.mjs comment; site/src/layouts/Base.astro line 96 -->
- Size: **about 68 KB gzipped, the whole game** (HTML + JS + CSS). Measured: 67,632 bytes gzip on
  the committed `dist/`, v0.18.12, budget 68,000 enforced. Pair it with a play benefit.
  <!-- src: dom-battlefield main f901af9, scripts/size.mjs (9,504 + 35,916 + 22,212) -->
- The tanks are Sherman Bytes sprites: "Explore the original Sherman Bytes".
  <!-- src: games spec builtFrom: sherman-bytes -->
- Not built on Fizlet today. Say nothing about an engine port until it ships.
  <!-- src: games spec engine.runtime: own -->

CTA labels: **START BATTLE** · **Play** · **Play now** · **How it plays** · **Play Blitz** ·
**About Blitz** · **Source on GitHub**. In-game keys keep their shipped labels.

## Byline

Every page says **by Chris Cooley**, linked to <https://coded.design/>: header or footer, the
About / credits block, and JSON-LD `author` and `creator` (Person "Chris Cooley", url
`https://coded.design/`). The shipped footer reads "Created by Chris Cooley".
<!-- src: site/src/layouts/Base.astro line 96; site/engine.config.json brand.author -->

## Avoid

- revolutionary
- game-changing
- cutting-edge
- best-in-class
- world-class
- seamless
- next-gen
- AAA
- unleash
- blazing fast
- fastest
- instant
- zero load time
- full speed on anything
- days instead of months
- authentic
- historically accurate
- accurate reconstruction
- real armies
- invite a friend
- multiplayer soon
- online battles
- put it on your site
- install it on your site
- use it in your project
- npm install
- script tag

## Limits

- max sentence words: 25
- max exclamations: 1
