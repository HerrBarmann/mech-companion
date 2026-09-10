# Local tools

Scripts that run **on a development machine** and produce static files for
`website/`. None of this is uploaded, and none of it runs on the server.

## convert-mtf.py – build the 'Mech database

Converts the BattleMech files from
[MegaMek mm-data](https://github.com/MegaMek/mm-data) (CC BY-NC-SA 4.0, see
`../LICENSE-DATA.md`) into our hangar format.

```bash
# a slim checkout of mm-data (the mek files only, ~50 MB)
git clone --depth 1 --filter=blob:none --sparse https://github.com/MegaMek/mm-data.git
cd mm-data && git sparse-checkout set data/mekfiles/meks && cd ..

# convert (writes website/data/mechs-index.json + website/data/units/)
python3 tools/convert-mtf.py ./mm-data
```

Produces ~4000 single files (~16 MB together, loaded on demand) and a search
index (~230 KB, cached offline). Skipped: non-biped configurations (quad,
LAM, tripod …) and unusual tonnages.

When mm-data updates: `git pull` in the checkout, run the script again, count
**both** constants in `website/sw.js` up (`VERSION` and `UNITS_CACHE` – the
latter holds the unit files that were loaded on demand and has to change
after every regeneration), then deploy.

MekBay enrichment (BV and Alpha Strike card values):

```bash
curl -sH "Accept-Encoding: gzip" https://db.mekbay.com/units.json | gunzip > mekbay-units.json
curl -sH "Accept-Encoding: gzip" https://db.mekbay.com/equipment2.json | gunzip > mekbay-equipment.json
python3 tools/convert-mtf.py ./mm-data ./mekbay-units.json
```

If `mekbay-equipment.json` sits in the project folder, the converter fills in
every weapon that is not in the curated `website/data/weapons.json` from it
(damage, heat, range, ammo per ton out of the MegaMek-derived equipment
database; the curated file keeps precedence).

## convert-as-units.py – vehicles, infantry, BA, ProtoMechs (Alpha Strike)

Takes the ground units other than 'Mechs wholesale out of MekBay's
`units.json` (Alpha Strike card values, BV, role, era) and the top-down icons
out of mm-data. These units only have an `as` block, no Classic values.

```bash
# mm-data needs the images for this
cd mm-data && git sparse-checkout add data/images/units && cd ..

python3 tools/convert-as-units.py ./mm-data ./mekbay-units.json          # canon only
python3 tools/convert-as-units.py ./mm-data ./mekbay-units.json --alle   # including unofficial
```

Produces `website/data/units-index.json` (~275 KB, in the precache) and about
3300 files in `website/data/units/` (MUL ids are unique across every unit
type, hence the shared folder; duplicates get a name slug), plus ~1700 icons
`website/img/units/<folder>_<file>.png`. After a run the same applies as
above: count `VERSION` and `UNITS_CACHE` in `website/sw.js` up. The unit type
sits in `type` (CV, SV, BA, CI, PM) – the Alpha Strike hangar writes it into
the hangar entry, and the battle picks heat and crit rules by it.

## translate.py – the translated mirrors

English is the source: the pages under `website/`, the strings in the
JavaScript, the display values of the data files. The script builds a
complete mirror `website/<code>/` per language pack, with a manifest of its
own and the runtime dictionary `website/js/i18n-<code>.js`
(docs/CONCEPT.md §5.7), and writes the `alternate` links and the language
switch into EVERY page. Needs `beautifulsoup4`
(`pip3 install --user beautifulsoup4`).

```bash
python3 tools/translate.py           # generate + report
python3 tools/translate.py --check   # check only, exit 1 on gaps
```

How a language pack is put together, and how to add one, is in
[`../docs/I18N.md`](../docs/I18N.md).

After every run `python3 tools/build-sw.py --bump` (rewrites the precache
list and counts `VERSION` up), then `python3 tools/opensource/build.py` and
deploy `dist/`.

## build-sw.py – precache and version

Writes the `FILES` list in `website/sw.js` from the file tree (every page
including the language folders, `js/**`, `css/*`, `data/*.json` without the
unit files, `img/*` without the unit icons, every manifest). Redirect stubs
are left out – they carry `<meta name="mechs-redirect">`.

```bash
python3 tools/build-sw.py          # rewrite the list
python3 tools/build-sw.py --bump   # and count VERSION up
```

The unit data is deliberately NOT in the precache – it comes on demand into
its own lasting `UNITS_CACHE`. Whoever runs the data converters again counts
that version up by hand.

## build-redirects.py – the old addresses

Writes one small HTML file per address the site used to have (German at the
root, the old `en/` mirror, German names under `de/`), pointing at where the
page lives now. Query and fragment travel along, so a share link survives.

```bash
python3 tools/build-redirects.py           # write
python3 tools/build-redirects.py --check   # check only, exit 1 if one is missing
```

## opensource/ – repository, overlay, checks

- `build.py` – mirrors `website/` into `dist/`, lays the private overlay
  `site/overlay/**` over it and fills the `{{site.…}}` placeholders from
  `site/site.json` (otherwise `site.default.json`). `dist/` is what gets
  uploaded; `website/` on its own shows placeholders.
- `check.py` – six checks before every commit: JSON valid, precache complete
  (and without unit data), translations without gaps, `node --check` over
  every script, no private pattern from `site/private-patterns.txt`,
  placeholders in the imprint and the privacy page.
- `rename-map.json`, `fixtures/` – the table and the test data of the
  German-to-English move (see `../docs/history/TASKS-OPENSOURCE.md`).
