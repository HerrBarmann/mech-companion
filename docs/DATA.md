# Data

Two kinds of data live in `website/data/`, and they are maintained in
completely different ways.

**Curated** files are written and checked by hand against the rulebooks:
`classic-rules.json`, `calculator-classic.json`,
`calculator-alpha-strike.json`, `weapons.json`, `as-abilities.json`,
`glossary.json`, `factions.json`. Each one carries a `_note` describing its
schema and an `asOf` naming the printing it was taken from. Where each value
comes from is in [`RULES-SOURCES.md`](RULES-SOURCES.md).

**Derived** files are generated and are never edited by hand:
`mechs-index.json`, `units-index.json`, `data/units/*.json` and the icons in
`img/units/`. They come out of the two converters in `tools/`.

## The pipeline in three commands

```bash
# 1. MegaMek unit files (sparse checkout, ~50 MB of MTFs plus unit icons)
git clone --depth 1 --filter=blob:none --sparse https://github.com/MegaMek/mm-data.git
cd mm-data && git sparse-checkout set data/mekfiles/meks data/images/units && cd ..

# 2. MekBay's generated database (Alpha Strike card values, BV, equipment)
curl -sH "Accept-Encoding: gzip" https://db.mekbay.com/units.json | gunzip > mekbay-units.json
curl -sH "Accept-Encoding: gzip" https://db.mekbay.com/equipment2.json | gunzip > mekbay-equipment.json

# 3. Convert
python3 tools/convert-mtf.py ./mm-data ./mekbay-units.json
python3 tools/convert-as-units.py ./mm-data ./mekbay-units.json
```

Neither `mm-data/` nor the two MekBay files are in the repository (they are
in `.gitignore`); the generated result is, so that a clone runs without any
of this.

## Sources and their licences

| Source | What we take | Licence |
|---|---|---|
| [MegaMek mm-data](https://github.com/MegaMek/mm-data) | `.mtf` files: armor per location including rear, tonnage, walk/jump MP, heat sinks, weapons with their location, the complete crit slot layout, era, role, MUL id, quirks. Plus the top-down unit icons. | CC BY-NC-SA 4.0 |
| [MekBay](https://db.mekbay.com) (MegaMek-derived) | Alpha Strike card values, BV, role and era for units other than 'Mechs; the equipment database fills weapons the curated file does not list. | CC BY-NC-SA 4.0 |

Both are attributed in [`../LICENSE-DATA.md`](../LICENSE-DATA.md) and in a
`_license` field inside the generated files. **Non-commercial, share-alike**:
whoever runs an instance of this app inherits that condition. It is also where
the project's own licence comes from — the whole repository, code included, is
CC BY-NC-SA 4.0 rather than something permissive, because this condition was
never ours to drop.

## After a converter run

Two constants in `website/sw.js` have to move:

- `VERSION` – the app cache. `python3 tools/build-sw.py --bump` counts it up.
- `UNITS_CACHE` – the lasting cache for unit files and icons, **by hand**.
  Its whole point is to survive app updates, so nothing else touches it; but
  after a regeneration the files behind the old entries are stale and the
  cache has to be given a new name.

Then `python3 tools/opensource/build.py` and deploy `dist/`.

## Size and loading

| | Files | Size | Cached |
|---|---|---|---|
| Search index 'Mechs | 1 | ~230 KB | precache |
| Search index other units | 1 | ~275 KB | precache |
| Unit files | ~7300 | ~30 MB | on demand, lasting |
| Unit icons | ~4800 | ~22 MB | on demand, lasting |

The app never loads more than the two indexes at startup. A unit file is
fetched when you pick that unit out of the database, and stays cached
afterwards — that is what makes the hangar work in flight mode once you have
looked at your own 'Mechs.

## What the converters skip

- Non-biped configurations (quad, LAM, tripod) and unusual tonnages — the
  Classic record sheet in this app models a biped 'Mech.
- Weapons that neither the curated file nor MekBay's equipment database
  knows: they are taken over by name, without values. The hangar keeps every
  field editable, so a missing value is a blank to fill in, not a wall.
