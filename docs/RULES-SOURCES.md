# Where the rule values come from

This app is a **fan summary**, not a rulebook and not a licensed product. It
exists so a group can look something up at the table quickly. Where it and a
book disagree, the book is right — and we would like to hear about it, see
[Reporting a deviation](#reporting-a-deviation).

Every curated data file carries an `asOf` field naming the printing its
values were read from. Every rules page carries the same statement in its
footer, so a reader sees it without opening a JSON file.

## Primary sources

| File | Source | State |
|---|---|---|
| `data/classic-rules.json` | *Total Warfare*, *BattleMech Manual* | 2026-08 |
| `data/calculator-classic.json` | *Total Warfare* (GATOR) | 2026-08 |
| `data/weapons.json` | *Total Warfare* (weapon tables) | 2026-08 |
| `data/calculator-alpha-strike.json` | *Alpha Strike: Commander's Edition* (SATOR, PV by skill) | 2026-08 |
| `data/as-abilities.json` | *Alpha Strike: Commander's Edition* (special abilities) | 2026-08 |
| `data/glossary.json` | all three of the above | 2026-08 |

What sits in `classic-rules.json` in detail: internal structure by tonnage,
the heat scale with its effects, the consciousness roll, the 2D6 hit location
tables for all four directions, crit slot counts and default filling, the
crit components with their levels, the BV skill factor table, the Cluster
Hits Table and the damage transfer chain.

## Alpha Strike tables — checked 10 September 2026

The crit and motive tables used to sit in `website/js/as-battle.js` with a
note that they came from "AS:CE reference tables". They are now
`website/data/alpha-strike-rules.json`, and they were read against two
official free downloads from [battletech.com/downloads](https://battletech.com/downloads/):
the **Alpha Strike CE 7th printing tables** PDF and **errata v7.02**.

**Confirmed, unchanged:**

| What | Against |
|---|---|
| Determining Critical Hits Table — the 'Mech, ProtoMech and Vehicle columns, all eleven results each | AS:CE p. 50, tables PDF |
| Motive Systems Damage Table — the four result bands | AS:CE p. 51, tables PDF |
| Motive roll modifiers: tracked/naval +0, wheeled/hover +1, VTOL/WiGE +2 | AS:CE p. 51, tables PDF |

**Confirmed, and our wording was out of date.** Errata v7.02 rewrote three
effects; the texts in the app now follow the errata:

- **Engine hit ('Mech)**: heat is generated in the end phase *if the unit made
  any weapon attack that turn* — we said "when firing", which was close but
  did not name the phase.
- **MP hit**: the errata replaced "rounding normally" with **rounding down**,
  and added a floor of 0. We had neither.
- **Weapon hit**: damage values drop by 1, and the errata spells out the last
  two steps — **1 becomes 0\*, and 0\* becomes no attack at that range**. We
  stopped at "−1".

**Still not confirmed — needs the book:**

| What | Why it is open |
|---|---|
| **ARS (Armored Motive System) gives −1** on the motive roll | ARS is described in the special abilities section (AS:CE p. 77). That section is not in the free tables PDF and the errata does not touch it. The app applies −1; treat it as unverified until someone reads p. 77. |
| **Crew stunned lasts until the end of the following turn** | The duration is in the crit effect prose (AS:CE p. 50–51), which the tables PDF does not reproduce. The app now expires the flag after one further turn — before this it never expired at all. |
| The footnote *"a unit reduced to 0″ Move is immobilized"* | On the official table. The app annotates movement rather than computing it, so it cannot notice this by itself. |

One thing the app deliberately does not do: it shows crit effects as
annotations ("MV 8″ ·½", "S/M/L 2/2/1 each −1") rather than computing the
result. The errata's rounding and floor rules therefore change the text a
player reads, not a number the app produces.

## Secondary and derived

| File | Source | Note |
|---|---|---|
| `data/units/*.json`, `data/mechs-index.json` | MegaMek **mm-data** (`.mtf`) | community data, derived from the published record sheets |
| `data/units-index.json`, the Alpha Strike block of non-'Mech units | **MekBay** (MegaMek-derived) | card values, BV, role, era |
| weapons not in `weapons.json` | MekBay `equipment2.json` | filled in automatically; the curated file keeps precedence |
| `data/factions.json` | the painting guide of this project | colours, recipes and tips are **taste**, not rules |

Community data is careful but it is not the book. Two things follow, and both
are visible in the app: a 'Mech taken out of the database stays **editable in
every field**, and the record sheet is the authority when the two disagree.
The BV of a 'Mech in particular is calculated by MegaMek and can differ
slightly from the official Master Unit List for some variants — the selection
list says so.

## Rule changes

The BattleTech **Core Rulebook** (16 September 2026) replaces *Total
Warfare*. The core mechanics stay; roughly 170 rules change in detail. When
those values are known, they are maintained here — the app has no rule value
in its code, only in these files, which is exactly why.

The knowledge area of the app carries a page on the rules baseline and what
changes, in both languages.

## Reporting a deviation

Please open an issue with:

- **which value**, and where you saw it in the app (page, calculator, unit),
- **the book and the page** it should come from,
- what the book says.

That last part is what makes it actionable — with a book and a page number a
value can be corrected in one commit; without one it turns into an argument.

## Trademarks

MechWarrior, BattleMech, 'Mech and BattleTech are registered trademarks of
The Topps Company, Inc. Catalyst Game Labs publishes the game under licence.
This project is not affiliated with either, is not endorsed by either, and
sells nothing.
