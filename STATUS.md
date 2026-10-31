> Generated 2026-10-31 by /end-session at commit 4484153.

# STATUS

## Where things stand

**The project forked.** The root is **alpha draft 1** (tag `alpha-draft-1`, PR #60 merged, untouched since): the Government House game, kept runnable as a quarry. **Draft 2** lives in `draft2/` as its own package with its own `spec.md`, `decisions.md`, `vision.md` and `carryover.md`: a captain's career on a borderland subsector shared by three empires (Wessmere Crown, Castellar Throne, Vauclair Concord), Pirates-and-Crusader-Kings-shaped, one life, week-per-turn, information only as fast as ships. Forty-seven commits since the last STATUS, all draft 2, all on `main`.

**What draft 2 has now.** The keel (worldgen, lanes, chart, mail with the addressee as a body, belief fold per reader, scouts on packets, stance clock, save/load, a map that reads belief). The free trader (a physical market of stock, production and consumption; duty, smuggling, inspection and arrest; ports as place lists: docks, brokers, factor, port captain, bar, yard, Government House; the mortgage, fuel, twice-yearly maintenance; whole tons; sliders and quotes). NPC captains as agents trading on their own beliefs (expected prices, leg memory, two legs beyond, reserves, the register, danger belief), dock talk, the guild's book, bribes and leaks. People: traits, regard, trust, esteem, notes, greetings, route requests, standing together, ransoming another, nine degrees of standing, the Book. Robbery as a decision, armed traders and patrol boats, nine navy patrols on station by danger, outlaw raiders and havens, encounters with a round or two of choices, captivity and the lender, prizes sailed to the seat and condemned. Guilds: membership, dues, bulk lines as a tree rooted at the seat, strongboxes and cash walking home, fleets bought from the purse. Famous worlds, seats on the edge, the imperial trade. This session's last commit: the yard, the court's prizes for sale, the letter of marque and the guild's ticket for the player, captains arriving from the core, esteem spreading, wars most of the time.

**Current thinking.** The next batch the user named was built; what is left in the free trader / guild / navy milestones is politics around the marque and the guild, patrols and raids on the guilds' lines (`#83`), two small captain-AI gaps (`#84`), and the sim's slowdown over a long run (`#82`), which should be profiled before more population is added. The first fun test (`#73`) is still the real question.

## Derived facts

| Fact | Draft 1 (root) | Draft 2 (`draft2/`) |
|---|---|---|
| Test status | 364 passed (364) | 305 passed (305) |
| Typecheck | ok | ok |
| Version | 0.0.1 | 0.1.0 |
| Sim modules | 29 | `agents`, `belief`, `captivity`, `chart`, `combat`, `economy`, `game`, `generate`, `guild`, `hex`, `imperial`, `lanes`, `mail`, `names`, `navy`, `news`, `people`, `player`, `prizes`, `register`, `rng`, `save`, `scouts`, `ships`, `types`, `view` (26) |
| Order types implemented | 6 | n/a (no order system; the player acts in port) |
| Culture files | 31 | n/a (quarried from the root at build time) |
| Ship name pools | patrol 130, escort 150, transport 130, scout 130, raider 130, packet 120 | same pools, same file |
| Save format | 7 | 11 |
| Open issues | 26 (`#11`, `#34`–`#40`, `#44`–`#46`, `#50`, `#51`, `#55`, `#57`, `#59`, `#61`–`#65`, `#73`–`#77`, `#82`–`#84`) | |
| HEAD | 4484153 — Draft 2: yards build hulls to order and the court sells prizes … (`main`, pushed) | |

## Active milestone

[Draft 2 — The free trader](https://github.com/lux-username/imperium-interstellar/milestone/6) — 3 open / 4 closed (`#73`, `#82`, `#84`). Keel is closed (0 / 7). People (`#74`), The guild (`#75`), The navy (`#76`, `#83`), The flag (`#77`) follow.

## Blockers / open questions

- `#82`: a year of sim takes about six times longer by the tenth year of a run than in the first, with only modest population growth. Profile before adding more people.
- Autosaves from before save format 11 do not load (a fresh game starts).
- Draft 1 issues (`#11`–`#65`) are still open against the root; most are moot for draft 2 and should be triaged at the next /weekly-reconciliation.
