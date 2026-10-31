# The three empires

Decided 2026-10-30: the powers sharing the borderland are English-like,
Spanish-like and French-like. The names are ours and invented; the culture
tables they draw on are the period name pools in `src/sim/data/names/`.

| Id | Name | Core table | Flavour |
|---|---|---|---|
| `e-wessmere` | The Wessmere Crown | `english` (English 65, Irish 25, Scottish 8, Welsh 2) | a crown and an admiralty; prize law in the blue-water tradition |
| `e-castellar` | The Castellar Throne | `spanish` | a throne and a casa de contratación; the guild as a royal monopoly |
| `e-vauclair` | The Vauclair Concord | `french` | a concord of ministries; the navy as a service of the state |

- A seat is named from its empire's core places (`seatName` in `names.ts`),
  whatever cultures settled the world first; every other world keeps its
  settlers' name.
- An officer, factor or governor is named from their empire's core six
  times in ten and from the wider `WORLD` table the other four
  (`officerCulture(rng, core)`).
- The `WORLD` table carries Spanish at 6 beside French and German, so
  Spanish names turn up anywhere, not only in Castellar's service.
- The flavour column is intent, not mechanics; nothing reads it yet.
