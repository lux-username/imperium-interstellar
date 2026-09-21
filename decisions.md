# Decisions — append-only

"Chose X over Y because Z." Dated, newest at the bottom. Rationale lives here so it stops hiding in changelog bullets and commit messages.

<!-- Format:

## YYYY-MM-DD — Chose X over Y

Because Z. (Link the journal entry or issue if the context helps.)

-->

## 2026-09-19 — Chose clean-room mechanics over licensed or copied text

Because game mechanics and procedures are not copyrightable but their expression is, and because the project must be shareable without infringing anyone. We implement 1977-era 2d6 SF RPG mechanics (as analysed by the *Tales to Astound!* "Out of the Box" essays) in our own words, with our own setting, and no third-party trademarks or setting names. The Mongoose-era SRD/OGL text and the Cepheus Engine exist as a licensed fallback if we ever want a textual base, but we are not using them now.

## 2026-09-19 — Chose a TypeScript web app over a Python TUI or Godot

Because the game's soul is an inbox and a last-known map, which a browser renders well; a pure-TS sim with a seeded PRNG is easy to test deterministically; and a static build is the simplest way to share with friends. Godot's engine weight buys nothing for a text-first design; a TUI cramps the hex map and is hard to hand to non-technical players.

## 2026-09-19 — Chose one-week turns over real-time-with-pause

Because one jump = one week is native to the setting, the loop is "read inbox → write dispatches → advance", and real-time scheduling would be a large engineering cost that adds nothing to a game about delayed information.

## 2026-09-19 — Chose a location-addressed information model, player fixed at the capital for Phase 1

Because dispatches and reports are delivered to *places*, not to "the player". Keeping the player at the desk keeps Phase 1 simple, while modelling the capital as the delivery address (with an `acting_governor` slot) means Phase 2 mobility — the player leaving with the fleet while a deputy holds the seal — is an addition rather than a rewrite. Unrestricted mobility was rejected because it quietly reintroduces the omniscient general.

## 2026-09-19 — Chose subsector scale and the governor-general as the default player role

Because a single 8×10 subsector is the natural unit of the source material and is crossable in months at J-2, which is the right timescale for the delay mechanic. Playing a governor-general rather than a sovereign means the same delay applies upward: the Empire judges and orders the player on months-old information. Pocket polities and rogue admirals come later as alternative seats.

## 2026-09-19 — Chose Vitest 5 over Vitest 3

Because Vitest 3's config types do not recognise Vite 8, so `tsc -b` failed on `vite.config.ts`. Vitest 5 pairs with Vite 8.

## 2026-09-19 — Chose a two-file truth/view split over a lint rule or a single types file

Because the belief model is meant to be enforced by structure: `src/sim/types.ts` holds ground truth and `src/sim/view.ts` holds everything the player may see (reports, snapshots, dispatches, `PlayerView`), re-exporting the few shared primitives so the UI never has a reason to import `types.ts`. A report carries its own `WorldSnapshot`/`ShipSnapshot`, never the `World`/`Ship` record, so stale or coloured reports are real objects rather than copies of the truth. The split is visible in the import graph and greppable; a lint rule was rejected because it would fight the one sanctioned exception (the dev-only god view, #9) and is enforcement of a habit the code layout already makes obvious. Mail in transit is one ground-truth `Mail` wrapper around either a report or a dispatch, so issue #4 propagates both directions with one mechanism. The player's view is derived from `GameState.beliefs[player]` rather than stored, so it cannot drift from the reports that justify it (issue #1).

## 2026-09-19 — Chose "The Governor's Term" as the first campaign, with a loyal and a rogue ending

Because a single fixed seat with a fixed term gives Phase 1 a clear win/lose loop (serve out the term vs. be recalled), and the rogue ending — stack the seats with loyalists, declare, survive the Empire's expedition — makes appointments matter from the first week rather than being a Phase 2 afterthought. Five threat sources (Warlord, pirates, planetary governors, unrest, the Council) were chosen because each is answered only by sending hulls and people, never by direct control. See `spec.md` → *First campaign*.

## 2026-09-20 — Chose independence as a loyalty switch over a loyalist threshold

Because a threshold ("N seats held by loyalists") would give the player a number to read that the world would never give them, and would make the rogue path a bar to clear rather than a gamble. With a switch, the declaration is simply news, and each seat reacts on receipt by loyalty and temperament — so the rogue path is won or lost by appointments made months earlier, judged only through conversations and reports. Self-loyal seats sitting out until a winner is evident adds a neutral allegiance state to the model.

## 2026-09-20 — Chose recall as a same-tick arrival over a warning letter

Because a letter saying "you are recalled" is faster-than-ship information about the Empire's intent: the Council's decision would reach the player before the Council's ship could. Making the successor's arrival the recall itself, resolved in the tick it happens, keeps Pillar 1 intact and makes rumour of Council mood the only early-warning system — which in turn makes rumour fidelity the rogue path's difficulty dial.

## 2026-09-20 — Chose written impressions over direct trait reads for officer conversations

Because a direct read ("loyalty: self") is omniscience about a person, which Pillar 2 forbids; an impression — a boast, an evasion, a slip — has to be interpreted, and a self-loyal officer has every reason to present as loyal. Direct reads are kept as a fallback if the cast grows too large for impressions to be tractable.

## 2026-09-20 — Chose a B-heavy starport table over the rules-default spread

Because the default spread (about 8% A, 19% B) gave a 39-world subsector three real ports and a capital with one reachable neighbour: no chart, no packets, no game. The table in `generate.ts` now yields roughly 42% A/B, which produces 15–25 lanes and a capital cluster of ~20 worlds while still leaving a third of worlds off-lane. Tune, don't revert.

## 2026-09-20 — Chose to sail between-week dispatches with the following week, and to pre-run week 0's sailings

Because the player acts *after* seeing a week's events, by which time that week's packets have gone. A dispatch posted at week W is postmarked W+1 and its ETA is computed from there. `newGame()` ends week 0 with that week's sailings made so every packet is where its timetable says; otherwise the first leg of every lane broke its own promise. The alternative — letting the player's mail catch the current week — would quietly make the desk faster than the ships.

## 2026-09-20 — Chose to carry names inside snapshots rather than expose a character roster

Because a public `Record<CharacterId, name>` built from truth leaks a governor's replacement the moment it happens. `WorldSnapshot.governorName` and `Report.observerName` are what the observer knew when they wrote; the desk learns a new name only when a report says so. Same principle as the rest of the view: nothing reaches the UI that didn't travel by hull.

## 2026-09-20 — Chose office delivery for letters to governors

Because the player addresses "the governor of X" by the name they believe holds the seat, and that belief can be months stale. A letter to a world's governor is opened by whoever holds the seal there now, and the office replies. The stricter alternative (hold the letter until the named person turns up — forever, if they're gone) is more literal but leaves the player with silence and no way to learn why.

## 2026-09-20 — Chose to split chart arithmetic into `chart.ts` and export it through `view.ts`

Because routing and packet timetables are public knowledge — a printed schedule — and the UI should show the player the *same* ETA sums the sim uses, so a promise in the dossier is the sim's own promise. Keeping it in `lanes.ts` would have dragged generation code into the UI's import graph.

## 2026-09-20 — Chose one report per governor letter, with hulls in port inside the world snapshot

Because a governor writing home sends one letter, and the playtest showed the alternative for what it was: three "Packet 85 in port" messages riding alongside every status report, tripling the inbox with news nobody wanted. `WorldSnapshot.ships` carries the hulls seen in port at the time of observation; `Belief.ships` is a *sighting* (ship, week, source report) derived from those. Reports *about* a ship (a commander's own after-action report, Phase 1) remain possible as a separate snapshot kind — they are a different thing, written by a different person. The opening survey lists no ships: a survey describes worlds, not traffic.

## 2026-09-20 — Chose to make every belief traceable to a specific report, and to link it in the UI

Because the player's picture is a stack of claims made by particular people at particular times, and "who told me that, and when?" is the question the whole design turns on once reports can be late, wrong or self-serving. A sighting stores the id of the report that made it; the dossier links each hull and its own "as of" line to that report, which opens and scrolls into view in the inbox. Sightings the desk made directly have no message and say so. This cost nothing in the model — the id was already there — and sets the pattern for Phase 1, where a report's *observer* will matter as much as its content.

## 2026-09-20 — Chose three Phase 1 milestones (1a/1b/1c) over one

Because Phase 0 showed the playtest, not the plan, deciding the design — half its commits were feedback — and a single milestone of twenty issues hides where the work is. Each cut ends in a playable build with one question to answer: 1a *does a subordinate feel like a person through letters alone?*, 1b *can you tell what is going wrong from the inbox, and does sending hulls feel like an answer?*, 1c *is the loyal path a game?* Officer conversation stays in Phase 2 unless 1b shows appointments feel blind.

## 2026-09-20 — Chose events as the unit of news over per-schedule snapshots

Because governors who write "when something matters" need a *something*: an `Event` (where, when, kind, subject, valence, severity) that a letter mentions or withholds, that a rumour degrades, and that the Council folds into its rumoured truth. Phase 0's unit was the snapshot; it stays, riding inside the letter, but the decision of *whether to write* is made per event. One primitive serves governors, rumour, and the Council, which are the same selective-reporting shape at three levels (#20).

## 2026-09-20 — Chose `Report.channel` over `Report.fidelity`

Because a fidelity number is a reliability score computed from ground truth, and putting it on a report the UI renders is a leak — "60% true" is knowledge nobody in the fiction has. What the player legitimately knows is *who said it and how it came*: `official`, `agent`, `merchant`, `docks`. Distortion is applied when the report is written and never recorded on it. Rumours get their own section of the inbox so the two piles are never confused; reverses the fidelity suggestion recorded on #11.

## 2026-09-20 — Chose standing moved by the player's own words and tribute, never by rumour directly

Because standing is the loyal path's win/lose dial and the user wants its balance legible: rumour only moves the Council's *rumoured truth*, and the cost comes from being *caught* contradicting it (liar check, −5 and a three-visit memory) against a +1 for each topic reported fine and −1 for each reported a disaster. The invariants — caught is worse than three honest failures, a lie has negative expected value whenever the rumours are against you, honesty never raises standing — are recorded in spec.md with the placeholder numbers so tuning can move the numbers without breaking the shape.

## 2026-09-20 — Chose to give the Warlord a tracked belief state and scouts

Because an antagonist who sees truth and picks the weakest world is an omniscient general on the other side of the board, which Pillar 1 forbids as much for him as for the player. His belief is `beliefs[warlord]`, built from what his governors, captains, and scouts deliver to his capital; he can be wrong, he can be deceived by what he is allowed to see, and his scouts are hulls the player's people can spot. Same machinery as the player, pointed the other way.

## 2026-09-20 — Chose agents as accurate on-site observers, not rumour verifiers

Because the user has other plans for agents: an agent sent to a world for N weeks writes the one fully truthful report in the game — the world's state, every hull that called, when it arrived and left and whether it refuelled, and any scout that came to look. That makes agents scarce truth against a sea of coloured letters, and it means ground truth needs a per-world traffic log. Scout ships (tiny two-person hulls, J-2, a large bonus to escape) are the cheap complement for everyone, the Warlord included. Neither sharpens rumour; the earlier open question is closed as "no".

## 2026-09-20 — Chose the imperial capital as an off-map node on a border lane

Because the delegation, the successor, the expedition, aid, and rumour in both directions all need a transit time to and from the Empire, and one lane with a fixed transit gives them all the same timetable with the existing mail machinery. An abstract "weeks until the Council reacts" timer would have been a second clock the sim did not otherwise have.

## 2026-09-20 — Chose colour for allegiance and the badge for age on the map

Because Phase 1 needs colour for who holds a world and the user did not want age as marker opacity: age stays exactly the coloured "as of N weeks ago" badge above each marker and nothing else. Lane line style is dropped as a channel; the schedule reads in the dossier and on hover (#21).

## 2026-09-20 — Chose to make a letter from the desk an event the governor answers, not a direct call

Because `mail.ts` delivering a letter and then calling into `governors.ts` for the reply would have made the two modules import each other, and because "the desk wrote to me" is exactly the kind of thing the event model exists for. A `dispatch_received` event is recorded on delivery; `governorsWrite()` sees it that week and forces a letter with everything since the last one the governor will admit to — same timing as before, one mechanism, and the forced report is coloured like any other.

## 2026-09-20 — Chose to have sent hulls carry stranded off-lane mail and re-route it at the next charted port

Because the spec already says an observation leaves on "whatever ship happens to go", and a warship calling at an off-lane world and leaving its governor's letters on the dock would be absurd. A packet takes only mail whose next leg is its jump; any other hull also takes what has no way home. On landing, mail that is off its planned route is given a new route from there, or stays aboard if there is still no lane home. This also answers #19 for off-lane worlds: their mail now has a way out, and ports keep only the newest six letters nobody has collected.

## 2026-09-20 — Chose commander letters at the ordered world and at patrol end, not at every port

Because the playtest that produced #20 was about inbox noise, and a hull transiting three worlds would otherwise write three letters saying nothing. A commander writes on reaching the world their order was about, and again when a patrol there ends. Waypoints are silent. The hull's arrival is still an event at each port, so a governor there may mention it and the docks may talk.

## 2026-09-20 — Chose unrest thresholds over per-step events, with extremes reported once per visit

Because the 1a preview showed governors and the docks narrating every point of drift, which the user called too many letters. Unrest is news when a world changes mood (content 0–1, neutral 2–5, hostile 6–10) or reaches 0 or 10; since most worlds flicker between 0 and 1, "reached the bottom" fires only if the last unrest event at that world did not already say so — derived from the event log, not new state. Twenty weeks of a fresh game now bring about one letter a week from ~20 connected governors instead of two or three.

## 2026-09-20 — Chose commander letters from every friendly port over only at the ordered world

Supersedes the earlier same-day decision to write only at the destination. Because the user wants to follow a hull port to port, and a letter by the next packet costs the hull nothing; the noise concern is answered by the unrest threshold rule instead. Off the lanes the old rule stands: write where the order was taking them, carry it to a port with a lane home.

## 2026-09-20 — Chose to keep rumour out of belief entirely

Because a rumour that placed a hull on the map was knowledge the player had not earned. Talk goes in the rumours pile, the dossier shows it beneath the official reports, and nothing on the map rests on it. `learn()` ignores event snapshots.

## 2026-09-20 — Chose one orders dialog over per-world forms

Because orders have the same six parts whichever way you arrive at them — hull, address, destination, task, disposition, afterwards — and a form on each dossier could not offer the address or the rendezvous. The dialog opens from a world with the destination filled in, or from a ship with the hull filled in; disposition and rally point ride with the dispatch as standing orders so the desk's intent and the hull's standing orders cannot disagree.

## 2026-09-20 — Chose "the courier is the mail" over nested orders

Because the Royal Navy never needed nested orders: the Admiralty wrote to a station, the station to a port, and a sloop sent "with orders for Captain X" was simply carrying a letter to a place where it would wait. So orders stay dispatches; where no packet goes, or a hull would land sooner, the dialog dispatches a hull in port to carry the letter and return, and the letter's envelope is routed along that hull's run so the ordinary loading and delivery rules apply. The dialog also offers the addresses the history used — last known port, destination, rendezvous — since a cruising hull is reached by writing to where she is due. A nested `carry` payload would have been a second delivery mechanism and a first step toward a scripting language (Pillar 3).

## 2026-09-20 — Chose to load stranded mail only where the hull's run reaches its destination

Because a hull leaving the capital taking every stranded letter regardless of direction sent orders for off-lane worlds off the wrong way, to ride around forever. A hull now takes stranded mail, and copies of waiting reports, only when its planned run calls at the destination or at a port on a lane network that reaches it. "Going to" is read as the whole run, not the next jump, so a hull that will pass a connected port later still takes the letters.

## 2026-09-20 — Chose that captured couriers and packets destroy their mail

Supersedes the same-day note that a captured packet would feed its dispatches to the captor's belief state. Because it is simpler, and because it is what a packet crew would do — the Post Office packets carried their mail in weighted bags to be sunk if taken. So capture is pure loss: nothing is read, nothing arrives, and the desk hears of it only through a report of the capture. Reading captured dispatches can return if the Warlord's belief state ever needs the feed.

## 2026-09-20 — Chose revolt as a week-by-week contest, not a switch

Because a revolt that takes the world in the tick unrest crosses its threshold gives the desk nothing to answer: by the time the letter arrives the world is already lost, and sending troops is never a decision. So a world in revolt is *contested*: a garrison fights the rising each week with a chance of losing a detachment to ambushes and assaults, taxes fall or stop meanwhile, and only when the garrison reaches zero does the governor flee to a ship in orbit — or die without one — and the world become independent. An ungarrisoned world still falls at once, so garrisons placed ahead of need are what buy the weeks a relief force takes. The same attrition model is reused for the Warlord's troops against the player's and vice versa, and landings on a hostile world cost guaranteed casualties unless enough marines form a beachhead — so troops are one system, not three, and marines have a job beyond escorting appointments.

## 2026-09-20 — Chose to tax trade routes, not planets

Because a polity whose ships are a few hundred tons cannot occupy a planet, and the fiction should not pretend it does. The Empire holds spaceports and the fees on interstellar trade, through a guild monopoly; worlds are run by client rulers with an imperial resident at court and a garrison sized to hold the port and the palace — the client-king model of the old empires. In game terms revenue is a flow along trade routes to the capital, travelling as specie at a merchant's pace and lost to whoever blocks the lane; a governor's per-world tax yield from population goes. This makes the map the economy: worlds off the routes cost garrisons and return nothing, and are held only to deny them to pirates and the Warlord, while extractive taxation of a world's own people is an emergency order that buys money with unrest. Independent worlds project no power but regrow a garrison, so neglect has a price that compounds. Supersedes the per-world tax yield in issue #35.

## 2026-09-20 — Chose scouts as the agents

Supersedes the same-day note that agents are characters carried by transport. Because a separate agent character needs a pool, a transport run out, a stay, and a ride home, and every one of those already exists for a scout ship — which is also the thing a governor can see off the port and a warship can chase away. So the *scout* order takes a stay in weeks: one week is a look and an ordinary letter; several is a watch, at the end of which the scout writes the one fully accurate report in the game, on the `agent` channel, with the world's traffic log for the stay. Fewer moving parts, and the scarce truth is now tied to a scarce hull the player can lose.

## 2026-09-20 — Building 1b: the calls made to get a prototype running

Recorded so the 1b playtest can overturn them knowingly (each is also an open question in `spec.md`). A marine detachment is one point of strength like army, distinguished only by the beachhead and by enforcing appointments. Cryo loss is one in ten detachments, rolled per detachment, not a fraction of strength. A faction's seat cannot fall in 1b; a rising there breaks on the palace guard. A hull docked at its own faction's port cannot be forced to fight, but a hull that came out of jump this week is in the open — that is how raiders make a living without making ports unusable. Pirates rob unarmed hulls and let them go; everyone else takes them as prizes, which lie where taken until an officer is sent. Nobody carries the enemy's dispatches: a port hands its bag only to hulls of its own side, and a hull does not hand a letter to a port at war with the letter's destination. The event record is the per-world traffic log. The desk's inbox shows only mail addressed to the desk — the Warlord's seat reads its own — which became necessary the moment two seats existed. Raiders avoid faction seats, since that is where the fleet lies, and are seized only where they stop, not where they pass through.

## 2026-09-20 — Settling the 1b questions

The user's rulings on the twelve questions raised while building the prototype (supersedes the same-day *Building 1b* entry where they differ). Starting garrisons keep their dice, but a world that rolls none gets one detachment unless a second low roll (2d6 ≤ 3) leaves it truly empty — zero becomes rare, not impossible. Packets need no officer, for anyone: a nameless junior takes her, so an impounded or captured packet runs for her new holder wherever her whole lane is theirs. The Warlord takes prizes and recruits officers at his seat to crew them. Pirate spawn drops to 1% per haven per week; raiders refit and go out again; pirates who take an armed hull make her a pirate at once with the captor's havens, and only rob the unarmed. A fallen capital is an ending — captured, for ransom or a show trial — and the Warlord keeps a reserve of four at his seat against the same. A closed port cuts the lane beyond it, but hulls do not know: packets sail in and are impounded until the desk has *heard* the world is closed. Marines stay one point of strength; cryo loss stays one detachment in ten, now recorded as its own event that a self-serving commander omits; every surviving commander still writes; a prize sails under a prize crew to the captor's rendezvous. There is no escort order and no blockade order — the ideas are struck, not deferred. Valence stays the desk's for now, with a note to make it relative before the Warlord weighs news. Extractive taxation waits for the economy.

## 2026-09-20 — Chose the docks' talk, not the desk's belief, to close a packet lane

Corrects the same-day ruling's first implementation, in which a packet at a remote port stopped sailing once the *desk* believed the far port hostile — information moving faster than any hull, which Pillar 1 forbids. A port now knows a world has fallen only when the rumour of it has reached that port's own docks along the lanes (or, for a packet leaving a faction's seat, when the seat's own reports say so — the desk reading its own mail). Rumour already travels at merchant pace, so the rule costs nothing and the silence spreads outward from the fallen world exactly as slowly as it should.

## 2026-09-20 — Chose port guns as a bonus, not a wall

Supersedes the same-day *Building 1b* rule that a hull docked at its own port cannot be forced to fight. Because an absolute defence is both unrealistic and un-gameable: no fleet could ever be brought to action at its base, and no port could ever be raided. A port now has guns by class (A 3, B 2, C 1) that count for whoever is docked, in the odds and in the exchange; docked hulls stand under them instead of breaking off. The odds are split between the approaches and the port — a hunter weighs what is in the open, and adds the docked hulls and the guns only if they would sortie — and then decides separately whether to try the port itself. Two consequences worth watching in the playtest: a lone raider cannot touch a B port's packet, so pirates prey on arrivals and on C-port worlds; and a big enough force can now attack a fleet in harbour.

## 2026-09-20 — Gave the Warlord priorities, and took treason away until there is money

Because a rival who only ever lands on the lowest garrison number is correct but not a person: he never defends what he holds, never notices a squadron off his border, never chooses a target for what it would cost the desk, and courts captains with a dice roll. He now acts monthly in a fixed order — reinforce his own worlds (revolt, landing, climbing unrest, warships seen nearby), land where his picture says he can win and where it hurts the desk most (lane count, port class, and how many of the desk's worlds route to their capital through it — all chart facts he knows), take independents when the desk's worlds are beyond him or now and then for the port, hunt enemy hulls he can take at favourable odds, and scout a silent governor before an enemy world. He weighs warships his people *saw* — hull class as his estimate of strength, port guns if they were docked — never the truth. Defection is removed outright rather than left as a stub: bribes and fear need money and a system of their own, and a half-built one would teach the playtest the wrong lessons.

## 2026-09-20 — Chose events that know their sides over a single valence

Because "bad news" was being judged from the desk's side for everyone, so the Warlord's governors confessed his victories as disasters and his docks talked up the desk's wins. An event now records whom it went *against* and whom it *favoured*; a reader's valence is derived from that relative to their own faction (bad if it went against them or favoured an enemy, good the other way round, the bystander's reading otherwise). Disclosure rolls and rumour spawning use the reader's valence. The stored bystander valence stays for events with no sides — routine traffic, a new governor, an action nearby.

## 2026-09-21 — Chose fuel by jumps, scouts as the only small hull, and a warship's spare berths

Per the user's rulings. Fuel is a count of jumps per hull class (warships four, scouts six), spent only on jumps and filled only at a B-or-better port open to the hull — a pirate at a haven of that class — with repair at C or better; a hull on her last jump turns for fuel, rendezvous first, and one with none sits. Packets carry none on the books, because a packet stranded by fuel would mean building port fuelling arrangements the lanes already stand for. Couriers are folded into scouts — both were the small fast unarmed hull that looks, watches and carries — so the fleet starts with six scouts; packets stay a separate role because they are timetable infrastructure (crewless, lane-bound, no orders) rather than hulls anyone commands. A transport lifts three detachments and a warship one in her spare berths, so a patrol craft can put a marine down with an appointment. The Warlord gets an officer pool of his own (loyal to him or to themselves, never to the Empire), which crews his prizes and lets him replace a governor whose port breeds pirates. A captured or seized pirate is questioned: each haven she knew is named on 2d6 ≥ 7, and on a 12 the crew names a world that is no haven, so the player's list of havens is good but not gospel.

## 2026-09-21 — Chose forward bases over a seat-bound Warlord

Because his targets were chosen within two jumps of his *border* but his ships all launched from and returned to his seat with no check on the distance, so a landing on the far side of his territory would arrive on its last tank at a world that would not fill it — marooned by his own orders. He now plans each mission against the tank (a jump at a time, refilled at any B-or-better port of his, with enough left on arrival to reach the nearest such port), and every such port is a base: missions launch from the nearest base with the ships and troops to spare, and rally afterwards at the base nearest the target, so his strength drifts toward his frontier as the user asked. Prizes still sail home to the seat, because that is where his officer pool is.

## 2026-09-20 — Chose to exclude named individuals, real or fictional, from the name pools

Because a pool entry must read as a generic period name, and a name that is chiefly known as one person's — a famous historical figure, or a named character in a well-known novel — reads instead as that person, which is either a borrowing (the project rule on third-party works) or, for the recently dead in a culture that avoids their names, a discourtesy. Ordinary period names that happen to coincide with someone famous stay; names distinctive to one individual go. Applied to the Aborigine and Han women's pools this session; `#51` applies it to the Aborigine men's pool.

## 2026-09-21 — Chose communities inside a culture over splitting cultures into new rows

Because the defect in `#54` was pairing, not proportion: the South Asian files already hold the right share of Muslim names, they just let a Hindu given name take a Muslim surname. An optional `communities` list on the `Culture` schema keeps one row per culture in `WORLD`, keeps each file's stated proportions as weights, and lets the flat pools stay as the union so the 80/80/80 rule still applies to the file. Splitting into new cultures would have meant growing each Muslim pool from about sixteen names to eighty and reweighting the table for a distinction the world table does not make. The same shape is available to Egyptian (Copt / Muslim) if it ever needs it; Yoruba, where Lagos names genuinely mixed, is left flat.

## 2026-09-21 — Chose one name pool for every side, sex at even odds, and merchants named from the port

Per the user's instruction that the Governor and the Warlord draw from the same pool. `newCharacter` is the one door every rolled person comes through — the desk's governors and officers, the Warlord's officers, pirate captains — so the 60/40 core/world rule is applied there and nowhere else, and a Warlord captain is as likely to be Irish as one of ours. Sex is an even split because `spec.md` says nothing and the women's pools were built to be used; it is a guess, flagged in STATUS. A merchant who brings a rumour to a port is named from that world's own cultures rather than the officer rule, because a trader at a Han port is a local, not a posting.

## 2026-09-21 — Chose ship names by hull class from pools in the naval tradition, disjoint, with numbered reuse

Per the user's ask for names in the vein of a blue-water navy's, at least a hundred per class, carried into space. One pool per class rather than one pool for all, because a navy's naming *is* by class — battleships for qualities, destroyers for weapons and beasts, auxiliaries for rivers, survey vessels for birds — and a player who knows that reads the class off the name; the pools are kept disjoint so that reading is never wrong. The same pools serve the Warlord (his hulls were this navy's) and the pirates (their pool is what pirates call ships, in the same spirit of our own writing), so a name is unique across the whole game. A spent pool numbers the reuse (*Vigilant II*) instead of falling back to a generator, because that is what navies do and because the syllable generator, which the user disliked, is now gone for good. Packets get names like any hull; "Packet 37" told the player nothing the role label beside it did not. The people-pool rule against famous individuals applies to ships: a name chiefly known as one vessel's goes, a name reused down the centuries stays.

## 2026-09-21 — Chose to compose letter subjects and ledes in the sim, not at the desk

Per the playtest's first finding (#34): letters read as unsorted information. Every report now carries a subject and a one-sentence lede, and they are composed when the letter is written — in `src/sim/letters.ts`, from the writer's side, the occasion and the events they chose to mention — rather than derived by the inbox from the report's contents. The UI could have computed both, but the phrasing is meant to vary with the writer's character next (#59), and traits are ground truth the UI may not read; deciding the wording where the writer is known keeps that door open without a second copy of the event tables. The event wording moved into the sim for the same reason, so the inbox never says anything a letter did not. Sides decide the reading: the same landing is *Reinforcements landed* to one faction and *Enemy landing!* to the other, and a battle's outcome is read off the hulls the letter admits were lost, so a self-serving captain's omissions colour her subject line as they already coloured her body.

## 2026-09-21 — Chose captains' quick updates and a general report at the rendezvous

Per the user's ruling, clarified mid-session: after a battle, a sighting or another event a captain sends a quick one-event update; the general report — everything since she last received orders — is sent only on making the rendezvous. Updates on a fight of her own are unconditional and are carried aboard if there is no port to post from, because losses are what the desk most needs and the existing carry rule already covered them; sightings and other trouble go only from a port on the lanes and only on a personality check (2d6 vs 7, cautious +3, bold −3), so a bold captain's silence is itself a signal. The rendezvous is read off the order — the run ends where the order is done and what follows it is here or nowhere — rather than tracked as a flag, so a diversion for fuel or a flight to a refuge never counts. The log resets when orders are read, as asked; the known gap (sightings off the network before mid-run orders arrive) is accepted, since fights are always written and the desk's dispatches usually find a hull at rest. Routine arrival letters at friendly ports are kept for now: the general report is an addition, not a substitute, and thinning them is a question for #59.

## 2026-09-21 — Renamed the player's seat from "the desk" to "the Home Office"

Per the user, who turned against "desk". The name is the player's seat in every sense — the place mail reaches, the office whose hulls and books they are, what the capital is seen from — so it is used everywhere: the spec, every comment, the letter wording and the panes. All of it now says *the Home Office*; the append-only history (this file, the journal) keeps the old word as written. The report-id prefix for the Home Office's own observations changed with it (`r-home-`), and the old `r-desk-` prefix is still recognised so a save from the same format version reads unchanged. Where the spec said "the desk's people" it now says "the Home Office's people"; the mechanic is the same.
