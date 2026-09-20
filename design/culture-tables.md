# Culture tables

Weighting tables for the cultural heritage of generated people (governors, commanders, agents, merchants, envoys) and, by extension, of the name pools they draw from. Our own tables; not derived from any third-party source.

Two tables exist because two populations exist. Which population a character is drawn from is a design choice still to be made (see *Use* below). Both are d100 tables: roll once, read the row.

## Table A — the wide mix

| Roll | % | Culture | Heritage group |
|---|---|---|---|
| 01–14 | 14 | Han | East Asian |
| 15–27 | 13 | Japanese | East Asian |
| 28–40 | 13 | Korean | East Asian |
| 41–47 | 7 | Gangetic | South Asian |
| 48–54 | 7 | Bengali | South Asian |
| 55–61 | 7 | Deccani | South Asian |
| 62–67 | 6 | Great Russian | European |
| 68–73 | 6 | French | European |
| 74–79 | 6 | North German | European |
| 80–81 | 2 | Turkish | Middle Eastern |
| 82–83 | 2 | Persian | Middle Eastern |
| 84–85 | 2 | Egyptian | Middle Eastern |
| 86 | 1 | Javanese | Southeast Asian |
| 87 | 1 | Vietnamese | Southeast Asian |
| 88 | 1 | Siamese | Southeast Asian |
| 89 | 1 | Yoruba | African |
| 90 | 1 | Igbo | African |
| 91 | 1 | Afro-American | African |
| 92 | 1 | Quechua | Indigenous American |
| 93 | 1 | Nahuatl | Indigenous American |
| 94 | 1 | Maya | Indigenous American |
| 95 | 1 | Uzbek | Central Asian |
| 96 | 1 | Kazakh | Central Asian |
| 97 | 1 | Uyghur | Central Asian |
| 98 | 1 | Aborigine | Pacific / misc. |
| 99 | 1 | Maori | Pacific / misc. |
| 100 | 1 | Hawaiian | Pacific / misc. |

Group totals: East Asian 40, South Asian 21, European 18, Middle Eastern 6, Southeast Asian 3, African 3, Indigenous American 3, Central Asian 3, Pacific/misc. 3.

## Table B — the Anglo-Celtic mix

| Roll | % | Culture | Heritage group |
|---|---|---|---|
| 01–65 | 65 | English | European |
| 66–90 | 25 | Irish | European |
| 91–98 | 8 | Scottish | European |
| 99–100 | 2 | Welsh | European |

## Use

- Each culture row will eventually point at a name pool (given names, family names, naming order and honorifics). The pools do not exist yet; this file is the weighting, not the names.
- Open: which population each kind of character draws from — e.g. Table B for one founding stratum or one world's colonists, Table A for the subsector at large — and whether a world has its own mix. Decide in `spec.md` when characters are generated (`#11`); once a data file under `src/` implements these tables, that file becomes the home and this one becomes a pointer.
- Rolling goes through `src/sim/rng.ts` like everything else.
