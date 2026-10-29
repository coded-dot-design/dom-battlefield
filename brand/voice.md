# DOM Battlefield: voice

How DOM Battlefield sounds on its landing page, play page, style guide, release notes and anything
the marketing engine writes for it. Battlefield Blitz inherits this voice and overrides only what
[`blitz/voice.md`](blitz/voice.md) lists. Look: [`style-guide.md`](style-guide.md).

A game brand in the DOM VIRUS voice family (`dom-virus/brand/README.md`, `voice.md`,
`DECISIONS.md`, `family.json`). The persona behind the family is Chris Cooley's persona story
(`coded` `clients/domvirus/cd-domvirus-persona-story.md`, "The voice").

---

## Who's talking

**The game talks first.** Battlefield's own voice: short, loud, physical, military radio in the
game and arcade swagger on the page. Play now, always first.

Then **a short maker's note** from Chris Cooley, first person: excited, opinionated about craft,
one short paragraph at most, after the gameplay. Creative licence on tone, never on facts or
biography. In the persona's words, Battlefield is his love letter to Bolo; the note may credit
that inspiration, never use it to sell.

## Who we talk to

- **Players first.** People who want a real tactics game in a browser tab, on a desk or a phone:
  "Command a platoon of up to twelve tanks. … No install, no account."
- **Commanders, not spectators.** "You" pick the ground, freeze time, give orders, radio the squad.
- **Curious web people, second.** They like that "every square on the board is a real element".
  They get the 10–20% tech share and the maker's note, never install directions.

## How the game sounds

Imperatives and two-beat headlines, second beat in the accent. One idea per sentence. No hedging.

- "Twelve tanks. One radio."
- "Plan it frozen. Fight it live."
- "Freeze time. Draw the war." / "Then it all goes loud."
- "Every square on the board is a real element. It is a web page, fighting back."
- Comms: "COMMS · Pick an order. The squad is listening."

Patterns: eyebrows in mono caps with an index (`01 HOW A BATTLE PLAYS`); radio pills (ROGER · GRID
0412, ATTACKING HQ, HOLDING); arcade stickers (BATTLE PAUSED / GIVE UP?, MISSION COMPLETE); labels
as `FIRST WORD · detail`; keys one or two words.

## The maker's note

Themes that fit Battlefield: a whole platoon on a grid of real elements, freezing time to plan,
one key = one order on desk and phone, what fits in the size budget, why the board is the DOM.

| Don't | Do |
|---|---|
| "The most authentic tank tactics game ever made." | "Twelve tanks. One radio." |
| "Built on Fizlet, the engine that powers everything." | "Every square on the board is a real element. I wanted the page to fight back." |
| "Invite a friend and battle online!" | "Single-player today. Multiplayer is planned." |

Sample maker's lines (style, not facts):
- "I wanted planning to feel like stopping time. So you do: freeze it, draw the war, let it go."
- "Every order is one key. If it doesn't work under a thumb, it isn't done."

## The byline

Every page says **"by Chris Cooley"**: **By Chris Cooley · coded.design** (`family.json` →
`credit`), linked to <https://coded.design/>, play screen included (A6). JSON-LD `author` /
`creator`: Person "Chris Cooley", url `https://coded.design/`.

## Words we use / words we never use

- **Use:** squad, platoon, tanks, command tank, wingman; radio, orders, comms, ROGER; freeze time,
  plan, route, flag; fronts, operations, the ground; scout / medium / heavy, loadout, 12-point
  budget; cockpit, rails, stick; **key** (never "button" in player copy); board, grid; cartridge,
  the arcade, DOM VIRUS; white flag, surrender, rematch; "Add it to your home screen" (C8).
- **Never:** install, npm, script tag, embed, "put it on your site" (boards are played on our
  site); "Get the code & setup instructions" (embedded games only; Battlefield says "Source on
  GitHub"); real armies, "accurate", "authentic" (the presets are "fictional arcade exercises");
  multiplayer as a present feature; "instant", "fastest", "zero load time"; gore or real-war
  framing (tanks are wrecked, flattened, blown up).

## CTA labels (exact)

Play first, everywhere. **START BATTLE** (sticker key, hero and final call) · **Play** (header) ·
**Play now** (footer) · **How it plays** · **Play it inside DOM VIRUS ↗** · **Visit DOM VIRUS** ·
**Open the style guide** · **Play Blitz** / **About Blitz** · **Explore the original Sherman
Bytes** (required on the landing and play screen, A7) · **Source on GitHub** · **Release notes**.
In-game keys are locked.

## What we never do

- Install, embed or reuse directions for the board.
- Invent numbers: maps, tanks and sizes come from the model, the size script or the changelog.
- Claim multiplayer, accounts, leaderboards or online play; historical accuracy or real armies.
- Long help on keys or overlays; tech before play; hype with nothing behind it.
- Biography beyond the persona (no employers, family, places or hobbies).
- Hard-code another site's host: links come from `family.json`.

## Claims: what we may and may not say

**May (sourced):** up to twelve tanks a side, "12 v 12"; four fronts (Hedgerow breach, Desert
spearhead, Winter crossroads, Twin bridges); three roles and a 12-point loadout; three stages
(Setup, Plan with time frozen, Battle); no install, no account, no runtime framework or server;
desktop and phones, light and dark, full screen; single-player; every square is a real DOM
element; zero runtime dependencies; open source, MIT; the measured size (below).

**May not:** multiplayer as available ("multiplayer: planned" until E4 is scheduled, C3, never with
a date); "built on Fizlet" (only Blitz runs on Fizlet today; Battlefield ports later); any size,
speed, frame-rate or load-time number not measured and cited; the persona story's unmeasured lines
("full speed on anything", "days instead of months").

## Content mix and size

80–90% gameplay (hero, how a battle plays, the radio, fronts and tanks, the phone cockpit); 10–20%
tech and maker ("Tiny on purpose", "The grid is the DOM", the size, the maker's note). The deep tech
story lives on Fizlet's site and the hub's engine page.

Size: measured with `npm run size` on the committed `dist/` (0.18.12, 2026-10-28): 67,632 bytes
gzip (HTML + JS + CSS), budget 68,000. Say "about 68 KB gzipped, the whole game", paired with a play
benefit, plus a smaller next target labelled "target" (C1). Generate it from the build (C2).

## Avoid

<!-- Read by astro-base-engine (voice.avoid): one word or phrase per bullet, flagged wherever it
appears in page copy. The reasons are in the sections above. -->

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

## Limits

<!-- Read by astro-base-engine (voice.maxSentenceWords, voice.maxExclamations). -->

- max sentence words: 25
- max exclamations: 1

## Open questions

1. **Credit and back-link on the locked play screen.** A6 and A7 require the byline and "Explore
   the original Sherman Bytes" on `/play/`, but Phase 2 locks the game. Where do they go?
2. **Size wording.** The family rule says "gzip, game + engine"; Battlefield has no separate
   engine, so its number is the whole game. Confirm "the whole game".
