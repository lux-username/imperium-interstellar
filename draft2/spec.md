# Imperium Interstellar — Draft 2 spec (design of record, begun 2026-10-30)

Changes only by deliberate decision, recorded in `decisions.md`. `vision.md`
is the argument; this is the result. Draft 1's spec at the repository root
remains the record for what alpha draft 1 built.

## Goal

A solo, week-per-turn career game set in a borderland subsector shared by
three rival empires, where information travels only as fast as ships. The
player begins as a free trader aboard one hull and plays that hull directly.
Over a career they may join a merchant guild or a navy, rise through its
ranks, and command it, at which point command becomes delegation by courier
to people weeks away, people the player has spent a career getting to know.

Touchstones: Sid Meier's Pirates! for the captain's loop; Crusader Kings for
the people; the 1977 science-fiction spaceship role-playing tradition for the
physics and texture of the setting.

## Design pillars

Draft 1's pillars 1, 3, 4 and 5 stand. Pillar 2 and 6 are revised; 7 to 9 are
new.

1. **Information travels at the speed of ships.** No signal faster than a
   jump. Everything anyone knows is a report carried by a hull. The map is a
   belief, and so is every NPC's map.
2. **Everyone is playing the same game.** Every hull has a captain who decides
   what she does; every organisation has a head who makes appointments and
   assignments. The player is one captain, and later perhaps one head. The
   sim does not know which seat is the player's.
3. **Orders are postures, not programs** (unchanged), and now **heads give few
   of them**. A head's levers are appointments, assignments, the purse,
   shares and honours. Ships act on standing instructions.
4. **The inbox is the game** at the commander layer (unchanged). At the
   captain layer, **the port is the game**: a week in port is a list of places
   and a few choices.
5. **Isolation by mechanics** (unchanged): low jump numbers, port classes,
   charted lanes, fuel risk.
6. **The player is a body with a location.** Reports are delivered to where
   the player's body is, which is usually a ship. Draft 1's fixed address was
   the special case.
7. **Profit lives on the frontier.** Any route that is safe and known gets
   industrialised by a guild bulk freighter, so a player's margin is always
   where the map is uncertain or recently changed.
8. **Failure is captivity, not death.** A struck captain is taken, not
   killed. Ransom, peace, bribery, sympathy and exchange bring them back.
9. **People are the save file.** What the player carries from seat to seat is
   the Book: who they know, who owes whom, who remembers what.

## Setting

- **Subsector**: 8×10 hexes, 16–28 worlds, generated as draft 1 does but
  rolled for **three governor's seats**, one per empire, each in its own
  region, with lanes charted between them. Imperial capitals lie off-map,
  12–16 weeks round trip. No free ports for now.
- **Three empires.** Each has a governor at its seat, a navy, and a merchant
  guild as its mercantile arm. Each world belongs to one empire. Each pair of
  empires is at **war or peace**; the three states change independently over
  a career.
- **Jump, ports, fuel, lanes, packets**: as draft 1, except that the packet
  and courier roles merge into the **scout**.
- **Ship types** (no customisable parts; a type is a stat line of jump, tanks,
  hold, guns, crew, and price):

| Type | Role |
|---|---|
| Scout | couriers, packets, watching; fuel scoops; never fights |
| Free trader | J-1, modest hold, light guns; the default start |
| Far trader | J-2, smaller hold; reaches off-lane worlds |
| Bulk freighter | large hold, slow, unarmed; the guild's route workhorse |
| Patrol corvette | the navy's cruiser of the lanes; the privateer's rival |
| Frigate | the navy's heavy hull; flagships |

- **Ownership.** A hull is **personal** (owned by a character, may be sold or
  given, and the recipient owes a large obligation) or **organisational**
  (owned by a guild or navy, assigned and reassigned by its head).
- **Crew**: a morale number plus a few named officers, who are characters.

## The captain's three loops

A turn is one week. A week is spent **in jump**, **in port**, or **in the
approaches**.

### In port

The port shows a **list of places**, Pirates!-style; the player clicks one.
Which places exist depends on port class and on whether the world is a seat:

- **The docks**: your hull, crew, cargo, repair, fuel.
- **The brokers**: buy and sell goods; freight and passenger offers.
- **The guild factor**: contracts, charters, membership, route reports,
  tariffs.
- **The port captain**: clearance, inspection, licences, naval business.
- **The bar**: rumour, faces, officers for hire, jobs that are not on the
  books.
- **The prize court** (seats only): claim prizes, see the status of prizes in
  your name.
- **Government House** (seats only): audiences, letters of marque, the
  governor's business.

Each place is a short scene with a face attached. Visiting a few places is a
week.

### In the approaches

Arriving from jump, a hull is **in the open** for the week before she docks.
Whoever is lying off the port may hail, chase, or let her pass; she may run
in under the guns, fight, or lie off herself and hunt the next arrival.
Leaving, the same in reverse. This is draft 1's open-versus-docked geometry
with the choices handed to the captain.

### In jump

A week with nothing to do but read what mail came aboard before departure.
Fast turns.

## Economy

- **Goods** with per-world supply, demand and price driven by the world
  profile (tech level, population, trade codes derived from the profile).
  Prices drift and respond to deliveries.
- **Freight** (paid per ton, low risk), **speculation** (buy and sell on
  own account), **passengers** (including characters, who then are in your
  Book).
- **Tariffs**: trading at a foreign empire's port is dearer than trading
  within one's own. Guild members get the guild's rate; outsiders pay more.
- **Smuggling**, in order of arrival: (1) trading with an enemy empire's
  worlds during war; (2) regular goods carried around guild monopolies and
  taxes; later (3) weapons and forbidden pharmaceuticals against law level.
  Inspection is a port-captain scene; a corrupt port captain is a known face.
- **Industrialised routes.** When a guild learns a route is safe, stable and
  profitable, it assigns a bulk freighter that takes nearly all its capacity
  and flattens its margin. The captain who reports the route to the factor
  earns a finder's fee and standing; the factor and the territory head take a
  cut of the route for as long as it runs.
- **The guild's knowledge** is a belief like anyone else's: it industrialises
  what it has heard of, not what is true.

## Encounters and combat

When hulls meet in the approaches (or two hostile hulls share a system):

1. **Hail**: identify, bluff colours, demand to heave to.
2. **One or two rounds** of choice each: close, run, fire, board, strike.
   Resolved by strength, posture, captain traits, port guns if under them,
   and dice. The other captain's agent chooses with the same menu.
3. **Outcome**: escape, damage, capture, surrender.

A struck hull is a **prize**. Her captain and officers are **prisoners**. Her
crew may be pressed, landed or kept.

## Prize court

- Sits **only at a governor's seat**. One court per empire.
- A prize must be **sailed there** by a prize crew taken from the captor's
  own, which thins the captor and exposes the prize on the way.
- The court **condemns** a prize only if the capture was lawful: a **letter
  of marque** held by a privateer against an empire at war, or a naval hull
  against an enemy or a proven outlaw. Unlawful capture is piracy, and the
  court says so.
- **Shares**: the organisation, the flag officer, the captain, the officers,
  the crew. Any friendly hull **in sight** at the capture claims a share.
  Heads of navies and guilds therefore want captains who take prizes, and
  collect when they are the flag.
- The captain must **return in person** to claim. The court's board shows
  each prize in the captain's name: *condemned, awaiting claim*; *in
  arbitration since week N*; *contested by [name]*; *no record of her*
  (she never arrived). This board is a report like any other.

## Captivity

A captain who strikes is taken. Captivity is a **scene series** at the
captor's port or hull: the player meets the captor and other prisoners,
learns them, and may be released by:

- **ransom**, paid by the player's organisation, their friends (the Book
  matters most when you have lost), or their own purse;
- **peace** between the two empires, which releases prisoners;
- **bribery** of a corrupt captor;
- a **sympathetic captor's** favour, which creates an obligation;
- **exchange** under a cartel;
- a small chance of **escape**.

Languishing until peace is a **timeskip**.

## Organisations

One `Organisation` type with ranks, posts, a head, a treasury, assets
(hulls, offices), rules (what a member may do and must not), and a
**promotion function** (competence, seniority, patronage, fit with the head's
temperament, vacancies). Per empire:

- **Merchant guild** (built first). Posts: member captain, factor at a port,
  territory head. Levers: charters, routes, contracts, tariff rates, bulk
  freighter assignments, finder's fees. Monopoly on carriage between stars
  within its empire; outsiders pay.
- **Navy** (built second). Posts: lieutenant, captain, commodore, admiral.
  Levers: station, cruise and convoy assignments, hull assignments, prize
  shares, honours. At war it moves; at peace it lies in port and its captains
  grow restless.
- **The governorship** is a post in the empire itself, not an organisation
  the player joins. Later: a minigame of becoming the next governor through
  favourable rumour and bribes sent to allies at the capital.
- **Pirates** are not an organisation. An outlaw is a captain who has burned
  standing with every empire; they live off havens and fences, as draft 1's
  pirates do.

A character holds one post at a time. The player's career is a sequence of
posts; the hull they command is personal or the organisation's.

## Agents

Every named character is an agent with **drives** (wealth, standing, safety,
loyalty-to-someone, curiosity, vengeance, comfort) weighted by personality
(draft 1's initiative, competence, loyalty, ambition, plus a few quirks).
Each week an agent at a seat picks the best available action **from the same
menu the player has at that seat**, scored against **their own belief**.
Every NPC has a belief; NPCs store the fold (newest per subject), not an
inbox.

A head-agent runs the organisation's levers. A captain-agent trades, hunts,
patrols, obeys or shirks. Pirates are captain-agents with no organisation.

## Relationships and the Book

- A **relationship** is a per-pair record: regard, trust, obligation (who owes
  whom and how much), and a shared history of events both were present for.
  NPCs have them with each other. Factions and feuds exist before the player
  arrives.
- **The Book** is the player's belief about people: everything learned about
  each character and where it came from. Entries accumulate from service,
  trade, fights, captivity, letters, rumour, and conversation (a cheap probe
  returning a written impression, as draft 1). Entries can be wrong. No
  authored dialogue trees.
- **Reputation**: per world and per organisation, built from events the
  player was part of as others reported them. The player is talked about in
  rumour and in letters.

## War and peace

Each pair of empires is at war or at peace. **War** opens the prize courts
against that enemy, issues letters of marque, moves the navies, closes the
enemy's ports to lawful trade (and so opens smuggling), and holds prisoners.
**Peace** releases prisoners, revokes letters of marque (a privateer at peace
is a pirate), opens routes, and moves the merchant fleets to industrialise
them. Wars last roughly 1–3 years; peaces 2–5; the three pairs are
independent. The player learns of a declaration when the news reaches them.

## Time, career and timeskips

- One week per turn. A career runs from the player's early twenties to death
  or retirement, up to about thirty years.
- **Target: 400–600 played turns** over a career of 12–20 game years, with
  the rest in timeskips. A turn in jump is seconds; a port week a minute or
  two. That is the length of a Pirates! career.
- **Timeskips** advance many weeks with the sim running: a season at the
  capital building connections; training for skills (later); captivity until
  peace; a long charter with a flunky's route. The player returns to a
  changed map and a pile of mail.
- **Ending**: a Pirates!-style reckoning of the career: wealth, rank, the
  Book, the enemies still alive.
- **No skills yet.** Later: a lifepath at character generation; training.

## UI

Map pane as draft 1 (SVG hex, belief with age badges, now centred on the
player's hull). A **port pane** with the place list and the current scene. A
**ship pane**: hull, crew, cargo, officers. **The Book**. **Inbox** and
**Ledger** as draft 1. The commander layer's panes return when the player
holds a post that uses them.

## Phasing

1. **Keel** — the new package. RNG, hex, names, worldgen (three seats),
   lanes, chart, mail, belief fold with the player as a body; save.
2. **The free trader** — ship types, the economy, ports as place lists,
   brokers and docks, NPC traders and patrols as captain-agents, the
   approaches and encounters with choices, prizes and prisoners (the player
   can be taken). **First fun test: buy, jump, sell, fight, survive.**
3. **People** — officers, port faces, relationships, reputation, the Book,
   captivity scenes, rumour about the player. **Second fun test: do you care
   who anyone is?**
4. **The guild** — organisation type, membership, factors, charters, route
   reports and industrialisation, promotion. War and peace between empires;
   smuggling in war; prize court for privateers under letters of marque.
5. **The navy** — assignments, naval prize law, commodores and admirals.
   Draft 1's commander layer re-entered.
6. **The flag** — heading a guild or navy; the governor minigame.

## Out of scope

Real-time, a tactical layer, customisable hulls, skills (deferred), a dynasty,
free ports, ground war (draft 1's troops and ground model wait), multiplayer,
any copied rules text or third-party names, commercial release.
