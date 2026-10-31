# Draft 2 — decisions (append-only)

## 2026-10-30 — first round of answers to the vision questions

- **Reference points**: Sid Meier's Pirates! for the captain loop, Crusader Kings for the people. Other sources welcome where they are fun. The bedrock stays "1977 sci-fi spaceship RPG". The week tick is kept, so port-week fun must be drawn from elsewhere than Pirates!' real-time sailing.
- **Prize court**: both privateering and navies must reward captains for captures through a prize court. First-class, not flavour.
- **One life**, no dynasty for now. Captivity and ransom are the common failure, death the rare one, so failure is recoverable.
- **Combat**: choices, but no more than a round or two.
- **Organisation order**: merchant guild first (ties to the economy), navy second. Pirate brotherhood is probably not a separate organisation: pirates are loosely attached privateer-smugglers who capture ships and trade. Model as outlaw status plus havens plus fences, not as a ladder.
- **Fewer direct orders**: an organisation head commands ships less directly than in draft 1. Ships are independent; the head's levers are assignments, appointments, the purse, shares and honours.
- **Governor is no longer a start.** May return later as a minigame: getting in the running for the next governor's term through reputation in favourable rumour and bribes sent to allies at the imperial capital.
- **Two rival empires**, symmetric, share the subsector as a borderland. Each has its own governor and its own mercantile arm. This replaces draft 1's governor-versus-warlord asymmetry.
- **Per-NPC belief**: wanted unless too expensive. Assessment: cheap if each NPC stores only a folded belief (latest per subject) rather than an inbox; see vision.md "Cost of per-NPC belief".

## 2026-10-30 — second round

- **Three loops for the captain**: the port week (Pirates!-style list of places, click one to go there), the jump, and the approaches: space around the dock, where you raid arriving enemy captains or are raided by them. Draft 1's open-versus-docked geometry carries over.
- **Prize court sits only at the seat of each empire's governor.** Prizes must be sailed there and the captain must return there to claim. The court shows the status of every prize in the captain's name: condemned and awaiting claim, in arbitration since week N, contested by another claimant, or no record of her (she never arrived).
- **Captivity** is a social scene: learn enemy captains. Release by ransom, by peace between the two empires, by bribing a corrupt captor, by a sympathetic captor's favour, or by exchange.
- **Three empires**, not two, so one can be at war with one and at peace with another. War moves the navies; peace moves the merchant fleets into newly opened routes. Trade at a foreign port carries a tariff over trade within one's own empire.
- **No skills yet.** Must be fun without them. Later: a lifepath at character generation and training.
- **Ownership**: personal hulls (free trader, privateer) can be sold or given, and the recipient owes a large obligation. Organisation hulls belong to the organisation and are reassigned at the head's order.
- **Crew**: abstract morale plus a few named officers.
- **No customisable parts.** A few standard ship types.
- **First playable is trade plus encounters.** Trade alone is not fun.
- **Routes get industrialised.** Once a guild learns of a safe, stable, profitable route it assigns a bulk freighter that takes nearly all the capacity. The finder is rewarded for reporting it; the local factor and the territory head take a cut. Plain back-and-forth trade belongs to flunkies, so the player's profit lives on the frontier and in routes war has broken.

## 2026-10-30 — third round

- **Seats**: each of the three empires has a governor's seat at a world in the subsector; imperial capitals stay off-map. No free ports for now.
- **Default start**: free trader with own hull.
- **Smuggling** is chiefly trading with an enemy empire's worlds during war, and trading regular goods around guild monopolies and taxes. Weapons and forbidden pharmaceuticals come later.
- **Career length**: Claude's call, judged by how long the game stays fun. Add **timeskips**: a season at the capital building political connections; a stretch in training for skills (later); languishing in prison until a war ends.
- **Ship types**: courier and packet merge into the scout. Types: scout, free trader, far trader, bulk freighter, patrol corvette, frigate.

## 2026-10-30 — fourth round

- **Empire flavour**: English-like, Spanish-like, French-like. Names: the Wessmere Crown, the Castellar Throne, the Vauclair Concord. See `design/empires.md`. A Spanish name pool was added; seats are named from their empire's core.

## 2026-10-31 — jump ratings and the timetable

- **Free trader is J-2, far trader J-3.** With ~22 worlds in 80 hexes a J-1 hull often has no world within reach at all (seed 23's seat had none). J-2 follows the lanes; J-3 leaves them. Scouts are J-3 so one can run any charted lane.
- **Scouts lie over a week.** A scout lands, lies over, sails: a four-week round. A busy lane gets two scouts, staggered, for a sailing every two weeks. Without the lie-over a scout on a busy lane landed and sailed within one tick and nobody could ever board her.

## 2026-10-31 — running costs

- **No weekly upkeep.** A hull costs fuel, and a month in a dockyard twice a year at a tenth of her price. Overdue, her drive is a risk on every jump: a fault costs the jump, a tank and a point of damage, and the odds climb with every eight weeks overdue. (User's call, replacing the weekly upkeep tried first.)

## 2026-10-31 — duty, smuggling, and what a dock sells

- **All trade is taxed.** Duty on every purchase and sale goes to the port's empire's treasury: 8% at an A port to 15% at D or E, plus 5% where law is 7 or more, less 2% where it is 2 or less, plus 10% for a foreigner. At war there is no lawful trade with an enemy port. (User's call.)
- **Smuggling** is a trade off the books: no duty, and the customs house looks into a share of such trades that rises with law level, with an A port's staff, with being foreign, and with war. Caught: the goods are seized and a fine of three times the duty dodged is due; a purse that cannot pay means arrest and a term held by that empire. NPC captains do not smuggle yet; that waits for the drives layer.
- **A dock sells what came through it, not only what the world makes.** Goods sold at a world that does not itself want them go on the dock for resale at half the tonnage; goods it wants are consumed. Price pressure and duty stop the sell-and-rebuy loop. Chosen over "only what a port produces" so hub ports can become entrepôts and NPC trade can make secondary markets. (Claude's call, as asked.)

## 2026-10-31 — who tells whom

- **Cliques tried and dropped.** Two arbitrary cliques showed that a network's fortune is its members' geography and that a small circle on a good corner out-earns a big one that shares its finds with rivals. Replaced by a sharing model with reasons.
- **Guild membership** is a captain's flag for their own empire's guild; about half of traders start with the ticket. **Willingness** to tell another captain what one knows: guild-fellows 0.8, countrymen outside the guild 0.65, free traders across a border 0.5, guild to outsider 0.25, rival guilds 0.1, outlaws 0.1. Between 0.3 and 0.7 is on the fence, and a round (500 Cr) adds 0.3. **Every captain asks**, since more known is better than less; only one whose prices for more than two fifths of the worlds within two jumps are unknown or older than eight weeks pays for a round, and only where the round would tip the answer. The same rule governs the player: a round is offered only after a refusal it would have tipped. **Leaks**: about two captains in five let one world's prices slip into the port's gossip each week; everyone present picks gossip up as hearsay; gossip fades after sixteen weeks. **The guild's book** at each seat takes what members know and gives back what is newer, keeping provenance. The player is in none of it and works the bar: listen, ask, stand a round.

## 2026-10-31 — pressure, gems, and the guilds' lines

- **The mortgage bites**: 5,000 every four weeks on the starting hull, 6,000 from the lender afterwards; two payments behind and the lender takes the hull at a home dockyard. (User's call.)
- **Milk runs pay less, gems pay more.** Price pressure eases at 0.88 a week instead of 0.8, so a route run every month stays depressed. A world's isolation (0 on two or more lanes, 1 on a spur, 2 dark) sets how hard its supply and demand bear on price, 0.15 to 0.35 a level, and how long its dock holds stock, 8 to 16 weeks of production: nobody comes, so the surplus piles up cheap and the wants go dear.
- **Bulk lines.** Each guild has two bulk freighters and a purse. Every eight weeks it ranks the routes its book knows, both prices within 26 weeks, the loading end a world that makes the good, neither end dangerous by members' report, neither at war, by profit a week with the load sized to what the smaller market absorbs, and puts its haulers on the best; a running line stays while it reckons positive, and is dropped once it has run sixteen weeks and made nothing. Deposits reach the seat from any guild office of the empire at mail speed. Haulers route over the chart, fuel anywhere, wait at the loading end rather than sail empty, and are maintained at the guild's yards at half cost. Known: in a thin economy the lines barely cover the haulers; tune after play.

## 2026-10-31 — making the haulers saturate

- **A line is a pair of worlds with a manifest each way**: every good with a margin, each lot sized at the steady state of a standing line, dearest margin a ton first, until the hold is full. The guild carries on past where its profit would peak, to where the margin on the last five tons is a sliver: saturation, not monopoly pricing.
- **Market depth by isolation**: a hub absorbs two and a half holds where a dark world absorbs one; a hub shrugs off a week's trade by a fifth, a dark world by a fourteenth. Buying moves a price up at most a quarter, selling down at most forty percent. Hub spreads narrowed to 0.15 a code level, dark worlds widened to 0.4. So a hub is the guild's to saturate and a gem is the free trader's to crash and leave.
- **The guild's edge is the duty**: its haulers pay half, since it collects it for the governor. Its factors at every dockyard port post their own dock's prices to the seat weekly at mail speed, so the book always knows the empire's ports; members fill in the rest.
- **Haulers go where value remains**, a line's value halving per hauler on it; a guild buys another hauler, up to eight, when a line has work for one; a lost hauler is replaced as soon as the purse allows. A running line is judged on what it earns a week per hauler, never on a book its own loads have depressed, and dropped after sixteen weeks below half the bar. The factor has first claim on the dock: haulers load before the free traders act.
- Three-year runs: lines run most of the time where the book has pairs, guilds with lines make one to two million, free traders' medians flatten or fall on saturated maps, and unarmed haulers are lost to outlaws often enough that a guild can be left with none. Escorts are the navy phase's problem.

## 2026-10-31 — a physical market

- **Guild duty edge dropped** (user's call): haulers pay full duty. Lines must stand on economics.
- **Stock, production and consumption replace pressure.** Every world holds a stock of every good. Production adds what the world makes; consumption draws down what it wants (six tons a week per demand level, scaled by size and value) and a trickle of anything; what nobody makes slowly goes off. Price is the base, the codes (now a small 0.1 to 0.2 by isolation), the mood, and the square root of target stock over stock, bounded 0.7 to 1.4, where the target is a month of what the world makes and eats. A lot is priced at the midpoint of the stock it moves, so a big sale earns less a ton than the board says and a big purchase costs more. Depth is now consumption: a hive world that eats a hundred tons a week can take a line forever; a backwater cannot. Isolation is only a nudge.
- **Lines are dropped only for a better one.** A running line stands on what it earns; a known route that beats the least profitable running line by half again replaces it, when every hauler is spoken for. War closes a line. A line that earns nothing stays until something beats it, which anything does.
- **Guild offices** are the seat, where the book is, and a factor at every A or B port of the empire; factors post their own dock's prices to the seat weekly at mail speed.
- Three-year runs: lines run most weeks, guilds with lines make half a million to two million, free traders' medians flatten or fall where the lines are and rise where they are not, and unarmed haulers are still lost to outlaws until the navy escorts them. Ship holds and maintenance were left as they were: the market, not the hulls, was what needed changing.

## 2026-10-31 — the port register

- **Every port keeps a register for a year**: each hull's week there, where she came in from, where she declared for, what she sold and bought on the books. Smuggling is not in it. What a reader knows of it depends on how they came by it: this week's page with their own eyes (a morning look and an evening one, so the day's trades are seen), the notable sales by dock gossip a few weeks stale, the whole year from the administrator for a fee of a few hundred credits. Captains learn it the same ways and tell each other along with prices. The dossier shows comings and goings newest first, each stamped seen, register or heard.
- **Follow the sale, symmetrically.** A sale seen or heard is price evidence like any other, so a captain who sees another unload at a good price has that price; and a captain who sees hulls load for the same port with the same goods this fortnight discounts the leg by three tenths each. The player's own trades are in the register and the gossip like anyone's; nobody singles the player out.
- **Outlaws** lie off any port with fuel, not only A and B, and there are three.

## 2026-10-31 — people: traits, relationships, the Book

- **Traits**: five dials from 0 to 1 rolled on 2d6 at birth: greed, caution, openness, pride, loyalty. The player's are plain. Each scales a threshold already in use: greed the margin a captain sails for and whether they dodge duty at a dear port (greed ≥ 0.7, caution ≤ 0.4); caution when they strike (two to one careful, four to one bold), how early they lay up, how hard danger weighs; openness the willingness to tell; pride how long a slight is held and whether a rival's crowded leg is contested or yielded; loyalty how warm guild-fellows and countrymen start.
- **Relationships**: one record per ordered pair who have dealt, with regard (−3 enemy to 3 friend), trust in their word (moved when a told price proves good or bad against the dock), dealings, and the last eight lines of what passed. Moved by telling (+0.2), refusing (−0.1), a round stood (+0.3), an undercut seen in the register (−0.4), a capture (−3 for the victim), a parole (+0.5). Regard feeds willingness (0.15 a point) and the crowd rule. The same code runs between NPCs.
- **The Book**: the player's page on everyone they have dealt with, been told of, or watched trade: hull, last seen, standing in a word, trust, the lines between you, trades of theirs you know of, and an impression of their character that reveals one trait word at two dealings, two at five, all at nine.
