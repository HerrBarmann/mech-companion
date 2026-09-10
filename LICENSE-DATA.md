# Where the material comes from

The whole repository is licensed under **CC BY-NC-SA 4.0** — the legal text is
in [`LICENSE`](LICENSE), the short version and the reasoning in
[`NOTICE.md`](NOTICE.md). This file records *why*: which parts are original, which are derived from
someone else's work, and who has to be named when you pass any of it on.

Bundled third-party code is the one exception; it keeps its own terms, listed
in [`THIRD-PARTY.md`](THIRD-PARTY.md).

## Derived game data

The unit database and its icons are derived works. Their source is CC BY-NC-SA
4.0, which is where this project's license comes from — it is inherited, not
chosen.

| Files | Derived from | Tool |
|---|---|---|
| `website/data/mechs-index.json`, `website/data/units/mul-*.json`, `website/data/units/slug-*.json` (BattleMechs) | MTF files from [MegaMek mm-data](https://github.com/MegaMek/mm-data) | `tools/convert-mtf.py` |
| Alpha Strike values and Battle Value in the `as` / `bv` fields | [MekBay](https://github.com/MegaMek/mekbay) generated database (`db.mekbay.com/units.json`) | `tools/convert-mtf.py` |
| Weapon values (damage, heat, range, ammo) filled from the MekBay equipment database | `db.mekbay.com/equipment2.json` | `tools/convert-mtf.py` |
| `website/data/units-index.json` and the non-'Mech unit files (vehicles, infantry, battle armor, ProtoMechs) | MekBay `units.json` | `tools/convert-as-units.py` |
| `website/img/units/*.png` | mm-data `data/images/units/` | both converters |

> MegaMek Data © The MegaMek Team, licensed under
> [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/).

Every generated file carries the notice in its `_license` field. Regenerate the
data with the converters and the same license applies to the result.

## Original content

Written and compiled for this project, under the same license so that one rule
covers the repository end to end:

- the application itself — everything under `website/js/`, `website/css/`,
  the page structure of `website/**/*.html`, and the toolchain in `tools/`,
- rule summaries and quick references (`website/classic/rules.html`,
  `website/alpha-strike/rules.html`, `website/knowledge/*`),
- the painting guide, techniques and faction color schemes
  (`website/painting/*`, `website/data/factions.json`),
- the glossary (`website/data/glossary.json`),
- curated rule values (`website/data/classic-rules.json`,
  `website/data/calculator-*.json`, `website/data/weapons.json`,
  `website/data/as-abilities.json`),
- all language packs under `tools/i18n/`.

## How to attribute

Name the author and point back to where you got it:

> Mech Companion by Dennis Bormann, CC BY-NC-SA 4.0 — <link to the repository
> this copy came from>

If you also carry the unit data, name the MegaMek Team alongside, as the table
above does. Keep the `_license` fields in the data files intact; that is the
notice travelling with the material.

The app does this for itself: every page footer credits the project and its
license, in both the neutral build and a private instance. Leave that line in
place when you fork, and add your own name to it rather than replacing.

## Rules are fan summaries

The rule summaries paraphrase the published BattleTech rulebooks (Total
Warfare, BattleMech Manual, Alpha Strike: Commander's Edition and successors)
for private play. They are not official rules and replace neither the books
nor the errata. Where a value came from a secondary source, the rules page
says so; check against your own book.

## Trademarks

MechWarrior, BattleMech, 'Mech and BattleTech are registered trademarks of
The Topps Company, Inc. Catalyst Game Labs is the licensee. This is an
unofficial fan project and is not affiliated with The Topps Company, Catalyst
Game Labs or the MegaMek Team. The license does not grant any trademark
rights.
