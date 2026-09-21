# Culture tables

Demographic generation tables approximating the Victorian-era world, used for flavour: worlds have cultural inspirations, and people have names that come from somewhere. Our own tables; not derived from any third-party source.

**The data lives in `src/sim/data/names/`** — one file per culture (given names by sex, family or second names, places, a naming pattern and notes on the record's thin spots) and `index.ts`, which holds the two weighting tables as `CORE` and `WORLD`. That directory is the single home for the names and the weights; this page is the design intent. `names.test.ts` enforces pool sizes (80 given names per sex, 80 family, 60 places), uniqueness, and that every culture file is in a table.

## The two populations

- **Core** (`CORE`) — the imperial core, modelled on the British Isles: English 65, Irish 25, Scottish 8, Welsh 2.
- **World** (`WORLD`) — the wider population, 27 cultures in nine heritage groups: East Asian 40 (Han 14, Japanese 13, Korean 13), South Asian 21 (Gangetic, Bengali, Deccani at 7), European 18 (Great Russian, French, North German at 6), Middle Eastern 6 (Turkish, Persian, Egyptian at 2), and Southeast Asian, African, Indigenous American, Central Asian and Pacific at 1 each per culture (Javanese, Vietnamese, Siamese; Yoruba, Igbo, Afro-American; Quechua, Nahuatl, Maya; Uzbek, Kazakh, Uyghur; Aborigine, Maori, Hawaiian).

## Use

1. **Worlds:** each world rolls 1d3 cultures from `WORLD` (distinct; a repeat is rerolled) and stores them. Its name draws from those cultures' place pools; a toponym already on the chart is reused as "New X" or "Port X". Settlements and features will draw from the same pools when the game has them.
2. **People:** each person's name comes from one culture — 60% `CORE`, 40% `WORLD` — and a sex, even odds, both stored on the character. The name is assembled by that culture's `pattern` (which handles family-first order, patronymics, and the Vietnamese Văn/Thị element). The same rule serves every side: the desk's governors and officers, the Warlord's, pirate captains. A merchant who brings a rumour to a port is one of that world's own people, drawn from its cultures instead.
3. **Communities:** where a culture's names do not mix (the three South Asian files, split Hindu/Muslim or Marathi/Southern/Muslim), the file lists `communities` and a draw picks one first, so a given name and a family name always come from the same one.
4. Rolling goes through `src/sim/rng.ts` like everything else. The draws live in `src/sim/names.ts`. Ships are named by class from their own pools — see `design/ship-names.md`.

## Period

Roughly 1837–1901 in each tradition's own terms — late Qing, Meiji, late Joseon, the Raj, Romanov Russia, the Second Empire, Prussia, late Ottoman, Qajar, the Khedivate, the Dutch Indies, the Nguyễn court, the fifth reign of Siam, the Lagos Colony and Igboland's first missions, Reconstruction, the Andean and Mexican republics, Russian Turkestan and the Qing Tarim, and the colonial Pacific. Where a culture had no hereditary surnames (Ottoman, Qajar, Central Asian, Siamese, Javanese commoners), the file says what stood in their place and the pattern uses it.
