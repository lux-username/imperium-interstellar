# Carryover from alpha draft 1

What to take from the root (tagged `alpha-draft-1`) into `draft2/`, judged
module by module on 2026-10-30. "Take" means copy and keep the design;
"adapt" means the design holds but the code changes; "rewrite" means only the
idea survives; "retire" means it has no place in draft 2 for now.

| Module | Lines | Verdict | Why |
|---|---|---|---|
| `rng.ts` | 41 | take | the determinism contract |
| `hex.ts` | 53 | take | grid and geometry |
| `names.ts` + `data/names/` | 110 + 31 cultures | take | culture pools; add the three empires' flavours |
| `data/ships.ts` | — | take | name pools; re-key to the six types |
| `generate.ts` | 287 | adapt | roll for three seats and three regions, not one capital and a chokepoint |
| `lanes.ts`, `chart.ts` | 152, 113 | take | charting and the public timetable; packets become scouts |
| `mail.ts` | 406 | adapt | the carrier model is right; the recipient becomes a body (usually on a hull), and `learn()` becomes the per-NPC fold |
| `belief.ts` | 104 | adapt | the fold is the keystone; add prices, people, and prize status as subjects |
| `rumours.ts` | 137 | take | talk hopping with traffic; add talk about the player |
| `events.ts` | 143 | adapt | the unit of news; new kinds for captures, condemnations, declarations |
| `letters.ts` | 460 | adapt | headings and ledes; new writers (factors, port captains, courts) |
| `view.ts`, `player.ts` | 389, 75 | adapt | the projection stays strict; the player's view adds hull, port, Book |
| `save.ts` | 33 | take | JSON with a format tag |
| `types.ts` | 308 | rewrite | the ground-truth schema changes everywhere: organisations, ownership, prizes, relationships |
| `characters.ts` | 63 | adapt | trait rolls stay; add drives, quirks, relationships |
| `ships.ts` | 425 | rewrite | movement and arrival letters survive as ideas; types, the approaches and ownership are new |
| `combat.ts` | 382 | adapt | odds, port guns, posture and the after-action letter stay; wrap in one or two rounds of choices |
| `scouts.ts` | 37 | take | the watch; merge with packet duty |
| `orders.ts` | 45 | adapt | fewer and higher: assignments, not hull orders |
| `factions.ts` | 46 | rewrite | three empires, each with navy and guild; outlaw status instead of a pirate faction |
| `pirates.ts` | 333 | rewrite | havens and pooled haven lists survive; pirates become captain-agents with no organisation |
| `governors.ts` | 129 | adapt | what a seat-holder chooses to tell; one of several letter-writers now |
| `game.ts` | 278 | rewrite | the tick loop gains the agent pass and the player's seat |
| `fleet.ts` | 132 | retire | Government House's starting fleet; the start is a free trader |
| `warlord.ts` | 517 | retire | replaced by the third empire; the secession idea may return |
| `world.ts` | 188 | retire for now | revolt and change of hands return with the governor layer |
| `troops.ts`, `ground.ts` | 152, 61 | retire for now | ground war is out of scope until the governor layer |
| `src/ui/` | ~3400 | adapt | map, inbox, dossier, scrubber stay; port, ship and Book panes are new |

Structure: `draft2/` becomes its own package beside the root, so alpha draft 1
stays runnable while it is quarried.
