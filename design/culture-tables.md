# Culture tables

Demographic generation tables approximating the Victorian-era world, used for flavour: worlds have cultural inspirations, and people have names that come from somewhere. Our own tables; not derived from any third-party source.

**The data lives in `src/sim/data/names/`** — one file per culture (given names by sex, family or second names, places, a naming pattern and notes on the record's thin spots) and `index.ts`, which holds the two weighting tables as `CORE` and `WORLD`. That directory is the single home for the names and the weights; this page is the design intent. `names.test.ts` enforces pool sizes (80 given names per sex, 80 family, 60 places), uniqueness, and that every culture file is in a table.

## The two populations

- **Core** (`CORE`) — the imperial core, modelled on the British Isles: English 65, Irish 25, Scottish 8, Welsh 2.
- **World** (`WORLD`) — the wider population, 27 cultures in nine heritage groups: East Asian 40 (Han 14, Japanese 13, Korean 13), South Asian 21 (Gangetic, Bengali, Deccani at 7), European 18 (Great Russian, French, North German at 6), Middle Eastern 6 (Turkish, Persian, Egyptian at 2), and Southeast Asian, African, Indigenous American, Central Asian and Pacific at 1 each per culture (Javanese, Vietnamese, Siamese; Yoruba, Igbo, Afro-American; Quechua, Nahuatl, Maya; Uzbek, Kazakh, Uyghur; Aborigine, Maori, Hawaiian).

## Use

1. **Worlds:** each world rolls 1d3 cultures from `WORLD`. Its name, settlements and features draw from those cultures' place pools.
2. **Officers:** each officer's name comes from one culture — 60% `CORE`, 40% `WORLD` — assembled by that culture's `pattern` (which handles family-first order, patronymics, and the Vietnamese Văn/Thị element).
3. Rolling goes through `src/sim/rng.ts` like everything else. Wiring these pools into `src/sim/names.ts` in place of the syllable generator is a separate code task.

## Period

Roughly 1837–1901 in each tradition's own terms — late Qing, Meiji, late Joseon, the Raj, Romanov Russia, the Second Empire, Prussia, late Ottoman, Qajar, the Khedivate, the Dutch Indies, the Nguyễn court, the fifth reign of Siam, the Lagos Colony and Igboland's first missions, Reconstruction, the Andean and Mexican republics, Russian Turkestan and the Qing Tarim, and the colonial Pacific. Where a culture had no hereditary surnames (Ottoman, Qajar, Central Asian, Siamese, Javanese commoners), the file says what stood in their place and the pattern uses it.
