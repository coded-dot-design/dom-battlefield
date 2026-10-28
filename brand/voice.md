# DOM Battlefield: voice

How the DOM Battlefield brand sounds on its landing page, play page, style guide, release notes
and every post or slot the marketing engine writes for it. Battlefield Blitz inherits this voice
and overrides only what [`blitz/voice.md`](blitz/voice.md) lists. The look is in
[`style-guide.md`](style-guide.md).

Rules come from the family rulebook (`dom-virus/brand/README.md`, `dom-virus/brand/family.json`):
a game brand, in the DOM VIRUS voice family ("every brand sounds like it came from the same
arcade"). Everything below is taken from existing copy and cited. Where copy is missing or
contradicts the rulebook, it goes to [Open questions](#open-questions) instead of being made up.

---

## Who we talk to

- **Players first.** People who want a real tactics game in a browser tab, on a desk or a phone,
  with no install and no account. The landing description:
  "Command a platoon of up to twelve tanks. … No install, no account."
  (`site/src/pages/index.astro:11`).
- **Commanders, not spectators.** Copy speaks to "you" as the platoon commander: you pick the
  ground, freeze time, give orders and radio the squad (`index.astro:22-24`).
- **Curious web people, second.** People who like that "every square on the board is a real
  element" (`index.astro:31`) and that the whole game is small. They get the 10–20% tech share,
  never install directions (rulebook §3, §9).

---

## How we sound

Short, loud and physical. Imperatives and two-beat headlines. Military radio talk in the game,
arcade swagger on the page. One idea per sentence. No hedging.

Real lines:

1. "Twelve tanks. One radio." (the hero headline, `site/src/pages/index.astro:13`, `:47`)
2. "Plan it frozen. Fight it live." (`site/src/pages/index.astro:108`)
3. "Freeze time. Draw the war." / "Then it all goes loud." (`site/src/pages/index.astro:23-24`)
4. "Every order is one key, one colour, one job: the same on desktop and phone. Tap one to lock it
   in, tap again to release. Go on, they are the real keys." (`site/src/pages/index.astro:134`)
5. "Every square on the board is a real element. It is a web page, fighting back."
   (`site/src/pages/index.astro:31`)
6. In game, comms: "White flag raised. Pick your next operation." (`src/client.ts:1985`);
   on the page: "COMMS · Pick an order. The squad is listening." (`site/src/pages/index.astro:154`)

Patterns that recur:

- **Two-beat headline, second beat in the accent:** "Plan it frozen. / *Fight it live.*", "One
  board UI. / *Every game.*" (`site/src/pages/style-guide/index.astro:70`).
- **Eyebrows in mono caps with an index:** `01 HOW A BATTLE PLAYS`, `02 THE RADIO`,
  `03 FOUR FRONTS · THREE TANKS`, `04 DESK OR POCKET`, `05 A DOM VIRUS CARTRIDGE`.
- **Radio talk in the game:**
  - Order pills: ROGER · GRID 0412, ATTACKING HQ, FOLLOWING YOU, PLOTTING, HOLDING, REPAIRING
    (README changelog 0.18.7–0.18.12).
  - The comms line prefix: `COMMS ·`.
- **Arcade stickers:** BATTLE PAUSED / GIVE UP?, INSERT COIN / GAME OVER, STAGE CLEAR / MISSION
  COMPLETE (`board-ui/BOARD-UI.md` §9.2).
- **Labels:** `FIRST WORD · detail` (RADIO · EACH TANK, AIM · AUTO / LOCK); keys are one or two
  words (`BOARD-UI.md` §6).

---

## Words we use

| Use | Because the copy does |
|---|---|
| squad, platoon, tanks, command tank, wingman | the unit of play (`index.astro:11`, README "The game") |
| radio, orders, comms, ROGER | how you command (`index.astro:133-154`) |
| freeze time, plan, route, flag | the planning stage (`index.astro:23`) |
| fronts, operations, the ground | the maps (`index.astro:22`, `:163`) |
| scout / medium / heavy, loadout, 12-point budget | the roles (README "The game") |
| cockpit, rails, stick | the phone controls (`index.astro:27`) |
| key (never "button" in player copy) | the 3D key (`index.astro:134`, `BOARD-UI.md`) |
| board, the grid, the page is the board | the DOM angle (`Base.astro:74`, `index.astro:31`) |
| cartridge, the arcade, DOM VIRUS | family framing (`index.astro:224-226`) |
| white flag, surrender, rematch | ending a battle (`BOARD-UI.md` §9) |

## Words we avoid

| Avoid | Use instead / why |
|---|---|
| install, npm, script tag, embed, "put it on your site", "use it in your project" | Boards are played on our site, never installed (rulebook §3, §9). See open question 1 for Blitz. |
| "Get the code & setup instructions" | Reserved for embedded games (rulebook §6–7). Battlefield links to "Source on GitHub" only. |
| button, widget, component (player copy) | key |
| real armies, real units, "accurate", "authentic" | The presets are "fictional arcade exercises, not accurate reconstructions or authentic opposing armies" (README "Historical inspiration"). |
| "multiplayer" as a present feature, co-op, invite a friend | Single-player today; multiplayer is "future work … not implemented or implied" (README "Boundaries"). The only allowed form is the existing "MULTIPLAYER SOON" tag (see Limits). |
| "instant", "fastest", "zero load time" | Not measured. Use the measured size. |
| gore, death counts, real-war framing | Tanks are "wrecked", "flattened", "blown up"; it's an arcade (`arena.ts:27`). |

---

## CTA labels (exact)

Play first, everywhere. "Play" goes to a game; "Source on GitHub" goes to the repo. Keep them
visibly different (rulebook §7).

| Label | Goes to | Where today |
|---|---|---|
| **START BATTLE** (two lines, sticker key) | `/play/` | landing hero and final call (`index.astro:54`, `:245`) |
| **Play** (header key) | `/play/` (`/blitz/play/` on Blitz pages) | every page (`Base.astro:60`) |
| **Play now** | `/play/` | footer (`Base.astro:79`) |
| **How it plays** | `#how` | hero (`index.astro:56`), nav |
| **Play it inside DOM VIRUS ↗** | the hub's Battlefield page | hero (`index.astro:57`) |
| **Visit DOM VIRUS** | the hub | cartridge card (`index.astro:227`) |
| **Open the style guide** | `/style-guide/` | `index.astro:235` |
| **Play Blitz** / **About Blitz** | `/blitz/play/`, `/blitz/` | Blitz promo (`index.astro:92-93`) |
| **Explore the original Sherman Bytes** | Sherman Bytes' demo page (`family.json` → `games[sherman-bytes].urls`) | **required by the rulebook (§7) on the landing page and the play screen; missing today** |
| **Source on GitHub** · **Release notes** | the repo, its README | footer, final call (`index.astro:246`) |

In-game keys (locked, for reference): QUICK START, PLAN BATTLE, START BATTLE, PRESS START,
KEEP FIGHTING, SURRENDER, REMATCH, NEW CAMPAIGN, REFRESH BROWSER.

**Never** write install or reuse CTAs for the board: no "Install", "Get the code", "Add to your
site", "npm". The phone's home-screen feature is a play feature. Describe it as the landing page
does: "Add it to your home screen and it opens straight into the cockpit." (`index.astro:29`).

---

## Avoid

- Install, embed or reuse directions for the board (rulebook §3).
- Inventing numbers: map counts, tank counts and sizes come from the model, the size script or
  the changelog.
- Claiming multiplayer, accounts, leaderboards, rankings or online play.
- Historical accuracy, real armies, real places as "recreated".
- Long help on keys or overlays. Explanations are one sentence in the comms line (`BOARD-UI.md`
  §6.2).
- Talking tech first. The engine story is 10–20%, after play.
- Hype words with nothing behind them ("revolutionary", "next-gen", "AAA").
- Hard-coding another site's host: links come from `family.json` (rulebook §4).

---

## Limits: claims we may and may not make

**May (with the source):**

| Claim | Source |
|---|---|
| Up to twelve tanks a side (squads of 4, 8 or 12); "12 v 12" | README "The game"; `index.astro:11`, `:75` |
| Four fronts: Hedgerow breach, Desert spearhead, Winter crossroads, Twin bridges | README "The game"; `src/model.ts` (`MISSIONS`) |
| Three tank roles (scout / medium / heavy), a 12-point loadout | README "The game"; `src/model.ts` (`ROLES`) |
| Three stages: Setup, Plan (time frozen), Battle | README "The game" |
| No install, no account; runs in a browser tab; no runtime framework or server | `index.astro:11`, `:52`; README "Local development" |
| Plays on desktop and phones; light and dark; full screen; home-screen app | README "The game"; `index.astro:26-33` |
| Single-player | README "Boundaries" |
| The whole game is ~68 KB gzip (measured, see below) | `scripts/size.mjs`; `index.astro:30`, `:78` |
| Zero runtime dependencies; adds zero bytes to the Sherman Bytes bundle | README intro, "Local development" |
| Every square on the board is a real DOM element | `index.astro:31`; README "Boundaries" (`src/view.ts`) |
| Open source, MIT | README footer, `LICENSE` |

**May not:**

- Multiplayer as available. Only "MULTIPLAYER SOON" / "SOON · BATTLEFIELD MULTIPLAYER", as the
  landing page has it today (`index.astro:45`, `:80`), and never with a date.
- Any size, speed, frame-rate or load-time number that is not measured and cited.
- "Built on Fizlet" for Battlefield. It ships its own copy of the board rules today and ports to
  the engine later (`BOARD-UI.md` §2.1). Blitz *is* built on Fizlet.
- That the board is installable, embeddable or reusable code.
- Historical accuracy (README "Historical inspiration").

---

## Content mix

Per the rulebook (§1, game level): **80–90% gameplay** (what you do, why it's fun, play now),
**10–20% engine and tech** (size, speed, how it touches the page). The landing page follows it
today:

- **Gameplay:** hero, how a battle plays, the radio, fronts and tanks, the phone cockpit.
- **Tech:** one row of "Tiny on purpose" and "The grid is the DOM", the size stat and the style
  guide card.

The deep tech story lives on Fizlet's site and the DOM VIRUS Under the Hood page, not here.

---

## Size and speed

The rulebook's recurring theme (§2): every game landing page states the delivered, compressed size
(gzip, game + engine), its target and always a smaller next target, never at the cost of
playability.

- **Measured today.** `npm run size` on the committed `dist/` (0.18.12), 2026-10-28: **67,632
  bytes gzip** (9,504 HTML + 35,916 JS + 22,212 CSS). The budget in `scripts/size.mjs` is
  **68,000 bytes** ("68KB compressed app budget"; changelog 0.18.3: "Size budget 68 KB").
- **How the page says it:** "The whole game is about 68 KB gzipped. No engine download, no assets
  to wait for." (`index.astro:30`) and the stat "~68 KB · THE WHOLE GAME" (`index.astro:78`).
  Battlefield has no separate engine, so "game + engine" is the whole game: HTML, JS and CSS.
- **Say it as:** the measured number, rounded down only to the KB the size script reports, plus
  "gzip", plus what it includes ("the whole game"). Pair it with a play benefit ("no assets to
  wait for"), never a bare brag.
- **The smaller target:** the rulebook needs one, and no copy states it yet (open question 4).
- Speed: no measured speed claim exists in the copy yet. The README's facts, a fixed 60Hz
  simulation and bounded maps (48×30 cells, 24 tanks, 200 projectiles, 96 effects, README
  "Boundaries"), are engineering facts, not marketing claims. Use them only in tech posts, as
  stated.

---

## Credit line

Visible on every page: **By Chris Cooley · [coded.design](https://coded.design)**, with
coded.design linked to <https://coded.design> (rulebook §2, `family.json` → `credit`). Today the
footer reads "© 2026 coded.design · MIT" and "Created by Chris Cooley" (`Base.astro:96`), and the
game page has no credit. See open question 6.

---

## How we refer to each other

| Name | How Battlefield copy refers to it |
|---|---|
| **DOM Battlefield** | Full name on first mention; "Battlefield" after. The original: "The original. Squad tactics: plan with time frozen, radio your platoon, take the HQ." (`blitz/index.astro:94`). `dom-virus/GAMES.md:21` calls it the "OG" internally. Use "the original" in public copy. Wordmark: DOM / BATTLEFIELD. |
| **Battlefield Blitz** | "Battlefield Blitz" on first mention, then "Blitz". Introduced as "NEW · BATTLEFIELD BLITZ", "The hero, as a game. *Free for all.*" (`index.astro:88-89`); "the arcade version" (Blitz `README.md:3`, `blitz/index.astro:39`). |
| **Sherman Bytes** | The embedded game Battlefield is built from (`family.json` `builtFrom`). Existing copy: "Sherman Bytes, a whole platoon." (cartridge tagline, `index.astro:218`) and the eyebrow "SHERMAN OPERATIONS" (`index.astro:44`). Back-link label, exact: **Explore the original Sherman Bytes** (rulebook §7). Say Sherman Bytes "owns the tank artwork" (README:3); never call it a dependency players install. |
| **Fizlet** | The engine behind the DOM VIRUS arcade. Battlefield does not run on it yet; don't say it does. Blitz copy: "Built on Fizlet, the tiny engine behind the DOM VIRUS arcade." (`blitz/index.astro:99`). |
| **DOM VIRUS** | The parent arcade: "Born in the arcade." "Battlefield started life on the DOM VIRUS shelf: tiny games that turn your page into the game board." (`index.astro:225-226`); footer: "A DOM VIRUS cartridge by coded.design: the page is the board." (`Base.astro:74`). |
| **Board UI** | "its own board design system … Only the palette changes from game to game." (`index.astro:232-233`). |

---

## Open questions

Listed for the owner (rulebook: "Ask before changing anything marked Decision or Open question").
Nothing here is resolved by this file.

1. **Blitz drop-in vs "boards are not installable".** The rulebook (§3, §9) says no install
   directions for board games anywhere. Today's Battlefield landing page has a **Put it on your
   site** key (`index.astro:94`) and "it drops onto any website with one line" (`index.astro:90`).
   The Blitz page has a whole "DROP-IN · ANY WEBSITE / Put Blitz on your page" section with script
   snippets (`blitz/index.astro:80-90`), the Blitz README has drop-in snippets, and the Blitz play page links "Put it on your site"
   (`blitz/play/index.astro:13`). Is Blitz's drop-in an exception (it behaves like an embedded game), or does the copy go?
2. **Classic / Modern.** The rulebook (§3) lists Battlefield as Classic and Blitz as Modern
   (working names), and flags that the original brief had them swapped. Existing copy never says
   "Classic" or "Modern":
   - Battlefield is "squad tactics" and "the full tactics game" (`dom-virus/GAMES.md:21`).
   - Blitz is "the arcade version" and "its arcade sibling" (`dom-virus/GAMES.md:21`, Blitz `README.md:3`).

   This matches the rulebook's table (Classic = strategy, Modern = arcade). The copy's own word
   for Modern is **arcade**.
3. **Domain.** The rulebook and `family.json` target `battlefield.domvirus.com`. This repo's README
   (lines 36–38) and the Blitz `CLAUDE.md` say `dombattlefield.com`. Which wins?
4. **Smaller next target.** The rulebook wants a measured size, its target and a smaller next
   target. The copy has the measured size (~68 KB) and the budget (68,000 bytes), and the
   measured 67,632 bytes leaves 368 bytes of headroom. No smaller target is stated anywhere. What
   is it?
5. **README size paragraph is stale.** "Local development" still says the budget is 61,500 bytes
   and that 0.17.0 measures 60,672 bytes; the script and changelog 0.18.3 say 68 KB. Cite the
   script and changelog until it is updated.
6. **Credit line.** Required: "By Chris Cooley · coded.design" (linked) on every page. The footer
   has "© 2026 coded.design · MIT" + "Created by Chris Cooley", unlinked (`Base.astro:96`). The
   game page (`/play/`) has no credit, and Phase 2 locks the game.
7. **Missing back-link.** "Explore the original Sherman Bytes" is required on the landing page and
   the play screen (rulebook §7). It appears nowhere. The play screen is the locked game, so where
   does it go?
8. **"No install" vs "Install it like an app".** The hero says "No install. No account."
   (`index.astro:52`), and the feature list says "Install it like an app" (`index.astro:29`). The
   in-game card says Install on Android (README "The game"). Both refer to playing, not code, but
   the word collides with the rulebook's no-install rule. Proposed: keep "No install" and phrase
   the feature as "Add it to your home screen". This needs a decision.
9. **"MULTIPLAYER SOON".** It is on the hero and in the stats (`index.astro:45`, `:80`). The README
   says multiplayer is "not implemented or implied". `dom-virus/GAMES.md` ("Next phase") puts
   multiplayer Battlefield in engine phase E4. Keep the "soon" tag?
10. **Size claim scope.** The rulebook says "gzip, game + engine". Battlefield has no separate
    engine, so its number is the whole game. Confirm that wording.
11. **Glows.** The rulebook says no glows unless measured; the kit's dark-theme key glow and the
    site's lit panels glow (see [`style-guide.md`](style-guide.md) §11).
12. **`--shadow-angle`.** It is named in the rulebook but not implemented. Battlefield's value is
    straight down ([`style-guide.md`](style-guide.md) §4).
