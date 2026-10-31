# Draft 2 — vision (working draft, 2026-10-30)

Status: a first reading of the widened scope, written to be argued with. Open
questions are at the end; nothing here is decided.

## The idea in one paragraph

A career game in a subsector where information still travels only as fast as
ships. You begin as one person on one ship — a free trader, smuggler, or
privateer, or a lieutenant in a navy or a guild hull — and you play that ship
directly: where to jump, what to carry, whom to fight, whom to drink with. The
people you meet are agents with their own goals and personalities, playing the
same game you are. Over years you rise: into an organisation, up its ranks, to
its head — and command becomes what draft 1 already is, a courier-borne inbox
and orders to people weeks away. By then the people in those posts are people
you know: friends you can promote, rivals you must manage, enemies with long
memories. The governor's seat of draft 1 becomes the top of one ladder among
several.

Mount & Blade's arc (one rider → a lord's retinue → a lord → a king) on top of
draft 1's information model is the shortest description.

## Three layers, one world

| Layer | The player is | Agency | Draft 1 status |
|---|---|---|---|
| **Captain** | aboard one ship | direct: this hull, this week | absent |
| **Commander** | head (or officer) of an organisation | delegated: orders by courier, appointments | this *is* draft 1 |
| **Governor** | holder of a political seat | delegated plus political: tribute, council, Empire | draft 1's first campaign |

The claim worth testing early: these are not three games but one simulation
viewed from three seats. Every ship has a captain who decides what it does; the
player is one of them. Every organisation has a head who issues orders; the
player may be one of them. The sim does not know which seat is the player's.

## What survives from draft 1 (first guess)

- **Pillar 1, unchanged**: no signal faster than a jump. The map is a belief.
- **The belief fold** (`belief.ts`): belief = fold over reports delivered *to
  where the player is*. Draft 1 pinned that address to Government House and
  said mobility could be added without rewriting it. Draft 2 is that test.
- **Worldgen, lanes, hex, RNG, save, mail/dispatch routing, rumour-by-ship,
  packet schedules, port classes and fuel, letters as the texture.** These are
  the setting's physics and are good.
- **Orders as postures** — for the commander layer. The captain layer does not
  use orders; it uses actions.
- **The sim/UI boundary**: UI reads a view built from the player's belief,
  never ground truth.

What does *not* survive as-is: the assumption that the player's seat has no
traits, that the player cannot be seen or talked about, that characters are
mostly governors and officers, that combat is a one-shot abstract resolution,
and that the economy is a trickle of fees along lanes.

## What has to be new

### 1. Ships as places with parts

A ship is no longer a strength number and a jump rating. It has a drive, a
tank, a hold, guns, a crew, a captain, and a condition for each. A trader's
week is "what is in my hold and where does it sell"; a privateer's is "what
can I catch and what will it cost me"; a navy lieutenant's is "what are my
orders and what has my captain not noticed". Still abstract — no tactical
layer — but enough parts that a damaged drive, a half-empty tank, an
unlicensed cargo and a mutinous bosun are all different problems.

### 2. A real economy

Goods with per-world supply and price driven by the world profile; freight,
speculative cargo, passengers, mail contracts; law level and tariffs making
smuggling a real option with a real risk. This is the free trader's whole
game and the merchant guild's reason to exist. It also feeds the governor's
revenue in a way draft 1 only gestured at.

### 3. Encounters and combat with choices

When hulls meet, the captain layer gets a short exchange of decisions —
hail, close, run, fire, board, strike colours, bluff — resolved in a round or
two against the other captain's agent. Prizes, ransoms, surrenders. The
commander layer sees the same fight as an after-action letter, as now.

### 4. Organisations as first-class things

Navy, merchant guild, pirate brotherhood, the governor's administration, the
Empire itself: all one `Organisation` type with ranks, posts, a head, a
treasury, assets, rules (what a member may do), and a promotion function (who
rises: competence, seniority, patronage, fit with the head's temperament).
Draft 1's "governor" becomes a post in the Empire's organisation. The player's
career is a sequence of posts.

### 5. Agents that play the game

Every named character is an agent: a bundle of **drives** (wealth, standing,
safety, loyalty-to-someone, curiosity, vengeance…) weighted by personality,
which picks the best available action from the *same menu the player has* at
that seat. A captain-agent trades, hunts, patrols, obeys or shirks; a
head-agent writes orders and makes appointments. Two consequences: NPCs are
competent opponents because they use the same tools; and the admiral you serve
under is running the very logic you will run when you replace them.

Depth is uneven on purpose. A handful of **lead characters** reason over
their own beliefs (what they have heard, not what is true); the rest read
ground truth with noise. The player should not be able to tell which is which.

### 6. Relationships and the Book

A relationship is a per-pair record: regard, trust, obligation (who owes
whom), and a shared history of events both were present for. NPCs have them
with each other, not only with the player, so factions form and feuds exist
before you arrive.

The **Book** is the player's belief about people: everything learned about
each character, from where. Entries accumulate from conversation, shared
service, reports, rumour, and watching what they do. Entries can be wrong. The
Book is the dossier mechanism of draft 1 made central: by the time you hold a
flag, it is the Book that tells you whom to put where.

Learning people should come mostly from **doing things with them** — serving
under, trading with, fighting beside, being betrayed by — with conversation
as a cheap probe that returns an impression, not a stat. No authored dialogue
trees.

### 7. The player as a character

The player has a reputation per world and per organisation, is talked about
in rumour, is written about in other people's letters, and has a face others
remember. Being known is both an asset and a cost.

## The clock

Draft 1's tick is one week, and one jump is one week. That still fits the
captain: a week is a jump, or a week in port. The question is what a **week
in port** contains. Proposal: a port week is a *scene* — a handful of offered
things (cargo, passengers, a job, a face in the bar, a summons from the port
captain, a rumour) and the captain picks a few. The sim tick stays a week
across all three layers; only the richness of the player's week changes with
the seat. Days as a tick would triple the turn count and fight the commander
layer.

## Sketch of phasing

1. **Keel** — new package; port RNG, hex, worldgen, lanes, mail routing,
   belief fold from draft 1 with the player's address generalised to "where
   the player's body is".
2. **The free trader** — one ship, parts, fuel, a real economy, ports as
   scenes, a traffic of NPC merchants, patrols and raiders run by captain
   agents. Playable loop: buy, jump, sell, survive. *First fun test.*
3. **People** — crew, port characters, conversation, the Book, relationships,
   reputation. *Second fun test: do you care who anyone is?*
4. **The service** — organisations, ranks, joining one, receiving draft-1
   orders from a superior, promotion. The symmetry becomes visible.
5. **The flag** — commanding an organisation: draft 1's gameplay re-entered
   with the Book in hand.
6. **The seat** — the governor layer rejoined; draft 1's first campaign as one
   possible ending of a career.

## Open questions

See the conversation of 2026-10-30; answers go in `carryover.md` and the
draft 2 spec when it exists.

## Cost of per-NPC belief (assessed 2026-10-30)

Draft 1's `learn(state, reader, report)` already folds a report into a
named reader's belief, so the architecture has the slot. The cost is not the
fold; it is what each reader keeps.

- **Folded belief only** (newest report per world, newest sighting per hull,
  last-known price per world and good): ~300 characters × (22 worlds + ~150
  hulls + 22 × ~15 prices) ≈ 150k small entries. Trivial for a browser tick
  and for a save.
- **A full inbox per NPC** (every report ever delivered, as the player keeps
  for the week scrubber): tens of thousands of report objects after a year of
  play, and growing. This is the thing to avoid. Only the player, and perhaps
  a few lead characters, keep inboxes.
- **Generating reports**: one port snapshot per port per week, shared by
  reference among everyone present; pairwise dock talk among hulls in the same
  port, a few dozen pairs a week. Trivial.
- **Deciding**: ~300 agents scoring a few dozen candidate actions each against
  their own belief, once a week. Well under a million operations a tick.

Verdict: give every NPC their own belief. Make the stored shape the fold,
not the mail.
