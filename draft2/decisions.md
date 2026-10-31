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

## 2026-10-31 — ways to make friends

- **No familiarity, no decay** (user's call): regard moves only on a dealing; a friend not seen for years is a friend still. A friend's word of someone may move it, which is by design.
- **A good tip weighs most**: a lot bought on someone's word (a heard price with a teller) is settled by its sale: +0.4 to +1.5 by the money made, −0.5 if it lost. **Standing together** in the approaches: a hull at the port this week may stand with the hailed one; a friend will, a bold stranger will at fair odds, nobody with an outlaw; her guns fire beside the defender's, and both remember it (+1, +0.7) while those who saw it esteem her. **Route requests**: one ask per asker at a time, "leave the metals at Londinium to me", as a favour if friends or a warning if not; honoured by a friend, by the careful when warned, ignored by the bold; a breach seen in the register makes an enemy (−1.5), twelve weeks kept makes a friend (+0.8). The player can ask one who thinks well of them, and the Book lists what has been asked of the player. **Ransom paid for another** is the strongest gesture (+3) and raises the payer's esteem with everyone who saw it. **A round for its own sake** (+0.15, once a month a person). **Greetings**: a captain meeting the player says a line from the last notable thing between them.
- **Esteem**, the second number: how much a person is worth knowing, built only from what has been seen of them: a sale worth twenty thousand, standing with someone, paying a ransom. It never falls. It feeds willingness to tell and is shown in the Book in a word.
- Two-year runs: friends now outnumber enemies, tips paid are the commonest friendship, route asks run to fifty a map and are nearly all kept.

## 2026-10-31 — robbery as a decision

- **No outlaws are born.** A trader turns robber when desperate (in arrears, or under twelve thousand with nothing worth carrying from where she stands) and brave enough (caution ≤ 0.4, greed ≥ 0.4): she lies off the port she is at, sells what she takes at the nearest slack-law port, and goes back to trade once her purse is mended or after three months with nothing taken. **Whom she robs**: never a friend, an enemy gladly, a countryman only if her loyalty is slight, nobody with more guns than hers, never a patrol. **The first hull taken burns her standing**: she is an outlaw thereafter, named in the port's news and hunted by the navies. (User's call.)
- **Refusal** to talk costs 0.05 regard; **an undercut** costs a full point and is now the chief cause of enmity between captains, as intended.

## 2026-10-31 — armed traders, danger, and boats on station

- **Hulls**: an **armed trader** (two guns, sixty tons, ninety thousand) that a quarter of traders start with; a **patrol boat** (two guns) that the navies sail for now, the corvette (three) kept for later.
- **Danger** is a number each captain holds per world, 0 to 1: word of a taking there within the month adds 0.6; every line of safe trade on the page eases it 0.05; a patrol seen in port eases it 0.25 and marks the world patrolled. Passed on in talk where newer. It weighs on a leg by the captain's caution (0.3 to 0.9 of it), by their guns (two guns fear half what none does), and halved if the place was seen patrolled within eight weeks.
- **The navy, as a placeholder**: a boat at the seat is sent to the most dangerous world of the empire by what its captains hold and what the guild's factors have reported, lies off it twelve weeks, and comes home for a new assignment; with nothing dangerous known she cruises as before. The seat's news says where she was sent.
- **Degrees**: nine words of standing, from sworn enemy to fast friend.

## 2026-10-31 — turning the vise on piracy

- **More captains**: three at an A port, one or two at a B, often one at a C.
- **A robber chooses her ground**: among worlds within two jumps, by the pages of their registers she holds, an enemy's hull counting three, a foreigner's two, a countryman's one if her loyalty is slight else a third, a hull with more guns than hers nothing, a world she believes patrolled lately a third of all that; where she knows nothing of a port she judges it by its class and prefers a foreign one. She sails there and lies off, buying fuel on the way like the trader she was.
- **Who turns**: the desperate and brave as before; and the greedy (≥ 0.7) and bold (≤ 0.3) when a ground rates well and trade does not; and one whose standing is already burned, at a lower bar.
- **Whom she will rob**: a countryman only if her loyalty is at most half, and never a guild-fellow.
- Two-year runs now show one to three captains turning robber on every map, three to seventeen hails, one to three hulls taken, and the navy's boats sent to the trouble. A vise turned slightly, as asked; the next turn is a playtest matter.

## 2026-10-31 — patrols with teeth, four boats, clean holds, far traders

- **Deterrence**: a patrol lying off a port goes for any robber lying off the same port; a patrol at a port stands with whoever a robber hails there; a robber lying off a port a patrol comes to moves on; a navy hull takes a hull lying off on the raid whether or not her standing is burned yet. **Four patrol boats** a navy, not two.
- **A navy hull takes no cargo**: what a prize carried stays on the prize, which is the navy's; patrols' holds stay empty, and a test says so.
- **Far traders** are a fifth of merchants (was a twelfth). Their planner rates a leg longer than two parsecs, which a free trader cannot run, at 1.3, and when looking for somewhere to go they prefer worlds off the lanes and beyond a free trader's reach. About half their legs are now over two parsecs.
- Two-year runs: with four boats a navy, piracy fell on the two richer maps to nothing and held on the poorer two. Deterrence works; whether it works too well is a playtest matter.

## 2026-10-31 — smarter captains, and nine patrols

- **Nine patrol boats**, three a navy (user's call: deterrence was too strong at twelve).
- **A captain remembers her legs**: what each pair of worlds earned her lately, a third new and two thirds old; a pair that has paid under the bar on its last runs is rated at half whatever the board promises, one that has paid well a tenth over.
- **Two legs beyond**: a destination is scored on this leg, the best next, and the best beyond from the two best nexts, each half the weight of the one before. A circuit, which is what a far trader's long legs need.
- **Home before overdue**: with maintenance due within two weeks a hop plus a fortnight of the nearest dockyard of her empire, a captain not at one heads there, carrying whatever pays on the way.
- **Buying the register**: a captain with twenty thousand and no page of this port's register under twelve weeks old buys it, at the player's price. Everyone does within a year, and the treasuries notice.
- **No loans against cargo** (user's call): interstellar banking is not ready to lend to someone who may never be seen again.
- One-year review after: idle weeks one to three percent, overdue six to ten, stranded for fuel none, ping-pong between a pair a third of legs, medians up a fifth.

## 2026-10-31 — consequential worlds and the imperial trade

- **Famous worlds**: after the map is laid, two great makers and two great markets, each of a different good, chosen where the sector has the fewest other makers or eaters of it, on worlds big enough (population 5 or more) and, for a maker, advanced enough. A specialty triples the world's weight in that good (supply or demand level 3: production, consumption and price pull) and sits on the chart as public knowledge: "famous for its ore", "a great market for medicines".
- **Seats on the edge**, required where the map allows.
- **The imperial trade**: each empire's home market beyond the map prices every good as a multiple of base: one or two exports at 0.5 to 0.7, one or two wants at 1.3 to 1.7, the rest 0.85 to 1.15, all drifting a little each call. Two imperial freighters an empire shuttle seat to capital, a round trip of twice the capital distance. On a call a freighter lands the exports (three quarters of a month's target stock) and whatever is dear at the seat against home (over 1.3 times), takes the wants and whatever is cheap (under 0.7), pays duty, and sails. Exports and wants are common knowledge, shown at the port captain's.
- Two-year runs: seats hold their empire's exports at 57 to 72 percent of base and its wants at 130 to 170 percent, famous makers sell at 40 to 67 percent and famous markets pay 160 to 260 percent, and the guilds run more lines for it.

## 2026-10-31 — guild dues and the fleet they buy

- **Dues**: a guild member sets aside four percent of every sale, out of the proceeds, and pays it over the next time she calls at the seat. A member a year unpaid is struck off: the guild's book and fellows' free talk are closed to her, and the seat's news carries it. A member whose year is running out heads for the seat with whatever pays on the way. The guild's own officers owe nothing.
- **The fleet**: the guild buys another hauler when it can pay for her and keep a hundred thousand by, and a running line has work for one; the yards charge thirty percent more for each hull beyond the first two, so the eighth costs nearly three times the first; ten at most. Three-year runs: fleets of three to five by the first year's end, three to ten by the third, two to five members struck off a map.

## 2026-10-31 — the guild's money walks home

- **Strongboxes**: a hauler's takings go into a strongbox aboard and her loads, fuel and yard bills come out of it; she draws a float (80,000) from the purse when she leaves the seat and banks the surplus over it when she calls there. Elsewhere she banks the surplus with the factor and makes up a short box from what the factor holds. Sailing toward the seat along the lines she takes the factor's cash with her, so cash walks home node by node and is never wired. A hauler taken loses her strongbox to the captor.
- **Lines are a tree rooted at the seat**: a line is run only where one end is the seat or sits on a line already connected to it; a line cut off from the seat, by war, by a swap, or by its carrier being stood down, is dropped and the seat's news says why. Only a leaf may be given up for a better line.
- **Growth**: the guild buys a hauler when it can pay the climbing price, keep sixty thousand by, and either a running line has value to spare or a worthwhile line joining the tree goes unrun. Three-year runs: fleets of three to six, trees one to four lines deep. (User's call on the carried cash and the tree it implies.)

## 2026-10-31 — what becomes of a hull taken

- **A robber and a bulk freighter**: she takes the strongbox and all the cargo her hold can carry and lets the freighter go, captain and all, since she cannot use her. Regard −2, standing burned.
- **A robber and a lesser hull**: she takes it whole, cargo included, and puts a promoted crewman in command: a new person of her culture and empire, an outlaw with her, loyal to her (regard 2.5), on the raid with her haven. If the prize is the better hull, more guns or the same guns and more hold, she shifts her flag into it, cargo, prisoners and purse with her, and the crewman has her old one. The prize's captain is her prisoner as before.
- **A navy (and later a privateer with a letter of marque)**: the prize is sailed by a prize crew to the captor's seat, fuelling at the empire's ports, and condemned and sold there for half her price new, to the treasury: a bulk freighter to the empire's guild if its purse can bear the price and a float, any other hull to a new captain of the empire who sets up in trade. Shares for flag, captain and crew wait for the prize court proper.

## 2026-10-31 — papers: the yard, the court, the letter of marque, the guild's ticket; captains from the core; wars most of the time

- **The yard**: an A port builds any hull to order, the price down at once and the hull ready in the yard's time (free trader 12 weeks, armed trader and far trader 14, bulk freighter and patrol boat 20, corvette 24, frigate 40); one order at a time. On delivery the old hull goes to the yard for half her price. Warships (patrol boat, corvette, frigate) are sold only to a holder of this empire's letter of marque; an armed trader is anyone's to buy (user's call).
- **The court**: a condemned prize lies at the seat eight weeks for sale at half her price new, then is sold off as before (a freighter to the guild, any hull to a new captain). A player can buy her at once, warships again only under the marque.
- **A letter of marque**: from the player's own empire only, at its seat, for 10,000 and a clean record (no outlaw, no arrears). Under it a capture of an outlaw or of an enemy the empire is at war with is lawful: the prize goes in to the seat, standing is not burned, and the court owes the captor a third of her value, claimed at Government House. Politics later.
- **The guild's ticket**: from the player's own empire's guild only, at its seat, for 5,000. The player then owes dues like anyone (four percent set aside, paid at the seat, struck off after a year unpaid) and can consult the guild's book there. The sidebar carries the dues and their deadline, and turns to a warning in the last eight weeks.
- **Captains from the core**: when an imperial freighter calls, if eight weeks have passed since the last, a new captain comes out with a one in ten chance, rising to seven in ten when the seat sees room. Room is judged from what the seat knows: the empire's captains on the guild's rolls or in the seat's register this past year against two a world of the empire's, tempered by how wide the price spreads in the guild's book are. Ten-year run: 46 people to 102, arrivals nine a year at first and two to four once the trade fills.
- **Esteem spreads**: a friend's good opinion of a third captain carries in talk, to half its strength.
- **Wars most of the time**: peace terms are now 40 to 110 weeks (opening 10 to 50) against war terms of 52 to 156, so an empire is at war with someone more than half the time and the whole map is at peace now and then.
- Ship naming no longer loops forever once a pool's name is on its tenth reuse (it went on counting); relation lookups in talk run over the people, not over every pair, which was the cost that grew with the square of the population.
