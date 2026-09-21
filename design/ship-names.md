# Ship names

Hulls are named the way a nineteenth-century blue-water navy named them, carried into space: one pool per hull class, each in the tradition that navy kept for that kind of ship, plus the names the same Admiralty would reach for once its hulls left the water. Our own lists; no ship famous in its own right, no borrowing from any setting.

**The data lives in `src/sim/data/ships.ts`** — six pools of at least a hundred names, one per class, with the themes explained in the file's header. `src/sim/fleet.ts` → `shipName` draws from them; `ships.test.ts` enforces the sizes, uniqueness within a pool, and that no two classes share a name.

## The pools

| Class | Tradition | In space |
|---|---|---|
| Patrol craft | The line of battle: qualities (*Indefatigable*, *Resolute*), classical figures (*Ajax*, *Bellerophon*) | The same grandeur in the sky: *Meridian*, *Perihelion*, *Antares* |
| Escorts | Destroyers and sloops: weapons (*Scimitar*, *Culverin*), hunting beasts (*Greyhound*, *Wyvern*), weather (*Tempest*, *Sirocco*), brisk adjectives (*Alert*, *Fervent*) | *Meteor*, *Bolide*, *Solar Wind*, *Sunspot* |
| Transports | Auxiliaries: home rivers (*Severn*, *Liffey*), bays and reaches | The "Empire X" names a ministry gives hulls built in a hurry: *Empire Hope*, *Empire Haulier*, *Empire Beacon* |
| Scouts | Survey and despatch vessels: birds (*Kestrel*, *Whimbrel*), instruments of navigation (*Sextant*, *Chronometer*), messengers and winds (*Mercury*, *Zephyr*), the exploring verbs (*Discovery*, *Investigator*) | *Parallax*, *Ephemeris*, *Occultation* |
| Raiders | What pirates call their ships: bravado (*No Quarter*, *Sweet Revenge*), the old freebooters' names (*Fancy*, *Happy Delivery*) | Bad jokes about money (*Unpaid Tax*, *Second Mortgage*, *Salvage Right*), *Void Wolf*, *Dark Tide* |
| Packets | The mail steamers: old regions in their Latin form (*Britannia*, *Hibernia*, *Phoenicia*) | The virtues of a timetable: *Punctual*, *Celerity*, *Promptitude* |

## Rules

1. A name is used once per game across every side — the Warlord's hulls and the pirates' draw from the same pools as the desk's, since they were the same navy's ships or are named in the same spirit. Once a pool is spent the name is reused with a number (*Vigilant II*), as navies do.
2. Pools are disjoint, so a name tells the player the class as well as the ship.
3. Packets are named like any other hull now; "Packet 37" is gone. The role still shows beside the name in the UI.
4. Drawing goes through `src/sim/rng.ts`. The syllable generator that used to name ships is removed.
