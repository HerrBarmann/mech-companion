# Concept: Mech Companion

A BattleTech companion for our gaming group — rules reference, play aids and a
painting guide in a web app that lies next to the phone or tablet at the gaming
table and at the painting desk.

As of: August 2026

> **About this document.** This is the original design document, written in
> German while the app was being built and translated for release. It is kept
> as a record of *why* things are the way they are, so it still speaks in the
> future tense about work that is long finished, and it still carries decisions
> that were later revised. File and identifier names were updated to the English
> ones the code uses today; everything else is left as written, dated entries
> included. For the state of the code, read [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 1. Goal and context of use

The site is used in two situations, and both drive the design:

**At the gaming table.** A quick glance between two rolls. The device lies next
to the map, often in dim light, and the hands are busy with dice, tape measure
and miniatures. What is needed: fast answers (to-hit number, hit location, heat
effect) in at most two taps, large tap targets, tables readable at arm's length.

**At the painting desk.** The device is propped up beside the work, the fingers
are covered in paint. What is needed: paint recipes and hex codes to read off,
the step-by-step guide to follow along, a preview of color schemes before the
first brush stroke.

A public community platform is explicitly not the goal. The site is our tool;
that others can use it too is a pleasant side effect.

## 2. Guiding principles

1. **Mobile first.** The layout is designed for ~380 px width and grows from
   there. The tablet view gets two-column layouts where they help (rules on the
   left, calculator on the right, say).
2. **Installable PWA, fully offline.** Web app manifest plus service worker.
   After the first visit everything works without a network — basements and
   game stores without Wi-Fi are the normal case, not the exception.
3. **Dark mode by default**, light mode as an option. Evening sessions, battery
   life.
4. **Table mode:** a switch that keeps the display awake via the Screen Wake
   Lock API for as long as the page is open.
5. **No backend, no accounts.** Everything personal (painting progress, own
   schemes, tracker state) lives in `localStorage`. Sharing works over URL
   parameters.
6. **Touch targets at least 44 × 44 px**, bottom navigation within thumb reach.
7. **English as the source language, every further language a pack** (see 5.7);
   English game terms stay in the translations wherever the game material uses
   them (record sheet, TMM, skill …) — the glossary bridges the gap.

## 3. Information architecture

Five main areas; the tools belong to their game system — whoever plays Classic
finds everything for Classic in one place and never has to jump between areas.

**The bottom navigation is contextual** (as of 30 August 2026): outside the game
systems it shows the five main areas; "Classic" and "Alpha Strike" lead into the
**hangar** — that is the home of a system. INSIDE it shows **Home · Hangar ·
Battle · Rules** (Classic additionally **Hit locations**): the hangar holds your
own 'Mechs, and from there you go "into battle" (the digital record sheet,
`battle.html`); the rules are the reference work and also take in interactive
references (for Alpha Strike the special abilities glossary; future ones such as
a weapons quick reference, piloting or cluster tables go there too). There is no
"Tools" menu entry any more — tracking belongs in the battle, reference in the
rules; GATOR/SATOR exist only embedded in the battle cards. "Home" is the stable
anchor back to everything else.

```
Mech Companion
├── Home           Quick access, recently used tools, rules baseline
├── Classic        Rules ∙ tools (for Classic BattleTech)
├── Alpha Strike   Rules ∙ tools (for Alpha Strike)
├── Painting       Factions ∙ guide ∙ own schemes
└── Knowledge      Glossary ∙ system comparison ∙ eras ∙ scenarios ∙ links
```

### 3.1 Home

- Four large tiles for the main areas.
- Direct access to the two or three most recently used tools ("Continue with:
  GATOR calculator").
- A line about the rules baseline (see 5.6).

### 3.2 Classic BattleTech

Two sub-tabs: **Rules** and **Tools**.

**Rules** = the existing quick reference, reworked:
- Sections as collapsible cards (turn sequence, movement, GATOR, hit locations,
  heat, physical attacks, beginner mistakes).
- A sticky jump bar along the top: one tap goes straight to the crit table or
  the heat scale.
- Full-text search across all rule content (client-side, e.g. a prepared search
  index).

**Tools** (Classic-specific):
- **Hangar & 'Mech configurator** — create and manage your own 'Mechs, see 4.6.
- **Digital record sheet (battle tracker)** — track the whole lance live, see 4.7.
- ~~GATOR calculator (standalone page)~~ — lives embedded in the battle (see 4.1).
- ~~Heat tracker~~ — integrated into the battle (a heat scale per 'Mech, see 4.7).
- **Hit location helper** — see 4.3.
- **Print sheets** ✓ — `classic/record-sheet.html`: record sheets of your own
  'Mechs as a printable page (see §10, F4).
- **Campaign** ✓ — `classic/campaign.html`: named campaigns, unit condition,
  workshop and battle log (see §10, F9).
- **Cluster hit counts** — table plus an optional dice roll for LRM/SRM (new,
  missing from the source content so far).
- **Piloting roll reference** — every trigger and modifier collected, plus a
  falling-damage calculator (height → damage).
- **Weapons quick reference** — the common weapons with range brackets, damage
  and heat; filterable.
- ~~BV budget~~ — integrated into battle setup (budget field plus a live total).

### 3.3 Alpha Strike

The same split: **Rules** and **Tools**.

**Rules** = the existing Alpha Strike quick reference, reworked exactly like
Classic (collapsible cards, jump bar, search). Additionally: the unit card
explanation as an interactive graphic — tapping a field on the card reveals the
explanation.

**Tools** (Alpha Strike-specific):
- **Hangar & card editor** — record and manage unit cards, see 4.6.
- **Digital record sheet (battle tracker)** — track a lance/star live, see 4.7.
- ~~SATOR calculator (standalone page)~~ — lives embedded in the battle (see 4.1).
- ~~Heat level tracker~~ — integrated into the battle (levels, overheat
  declaration, external heat, end phase).
- ~~Interactive crit table~~ — integrated into the battle (crit entry per 'Mech).
- **Special abilities glossary** — the abbreviations (ENE, CASE, OVL …) as a
  searchable list; extensible through a JSON file.
- **Print cards** ✓ — `alpha-strike/unit-cards.html`: four unit cards per A4 page
  from the hangar (see §10, F4).
- **Campaign** ✓ — `alpha-strike/campaign.html`: named campaigns, unit condition,
  workshop and battle log (see §10, F9).
- ~~PV budget~~ — integrated into battle setup (budget field plus a live total).

**Shared machinery:** GATOR and SATOR are one calculator engine with two
configurations (modifier lists as data, not as code). Trackers share building
blocks too. The split is a question of navigation, not of code.

### 3.4 Painting ✓ (every piece built)

- **Faction browser** ✓ — see 4.4. Filters: Inner Sphere / Clans / mercenaries /
  Periphery, plus free-text search.
- **Faction detail** ✓ — color swatches with hex codes, description, deviating
  formations, color sequence (recipe), a pitfall tip, a shopping list (generated
  from the recipe, linked to the paint conversion), silhouette preview in the
  scheme.
- **Own scheme** ✓ — `painting/scheme.html`, see 4.5.
- **Painting guide** ✓ — the ten steps as a guided view; each step tickable.
- **Lance checklist** ✓ — progress per lance across the ten steps, stored in
  `localStorage`.
- **Paint conversion** ✓ — `painting/paints.html`: all 26 recipe colors
  Citadel ↔ Vallejo ↔ Army Painter (approximations, filterable; "—" where no
  reliable equivalent exists).

### 3.5 Knowledge ✓ (every sub-page built)

- **Glossary German ↔ English** ✓ — `knowledge/glossary.html`, 134 entries from
  `data/glossary.json`, full-text search in both directions plus category chips.
- **System comparison Classic ↔ Alpha Strike** ✓ — `knowledge/comparison.html`,
  a mechanic-by-mechanic table plus an assessment of when each system shines.
- **Era overview** ✓ — `knowledge/eras.html`, seven eras (Star League → IlClan)
  with years, factions, tech level and a pointer to the faction browser.
- **Scenarios** ✓ — `knowledge/scenarios.html`, four scenarios (stand-up fight,
  hold the ground, breakthrough, fighting withdrawal) with setup, victory
  conditions and a recommendation for both a point AND a round limit (which
  picks up the round counter in the battle).
- **Links** ✓ — Sarna.net, Master Unit List, Flechs Sheets, Unit Color
  Compendium and others.
- **Rules baseline & changes** ✓ — see 5.6.

## 4. The interactive parts in detail

### 4.1 GATOR/SATOR calculator (the heart of it)

One engine, two presets. The flow:

1. The user taps through the modifiers — each category is a row of selection
   chips (attacker movement, say: stood still / walked / ran / jumped).
2. The to-hit number is summed live and shown large.
3. Below it: **the chance on 2D6** ("8+ → 41.7 %") — the actual decision aid: is
   the shot worth it?
4. A to-hit number above 12 is clearly marked "impossible" (Classic), or
   explained with the Alpha Strike special case (a rolled 12 = crit roll).

The configuration is data (`data/calculator-classic.json`,
`data/calculator-alpha-strike.json`): per category a label, options, the modifier
and optional notes. That way a rules change (the new Core Rulebook!) stays data
maintenance rather than a code rewrite.

**Embedded in the record sheet (built 30 August 2026):** categories with
`source: "mech"` (skill/gunnery, heat, fire control or sensor crits) disappear
from the input there and flow in automatically from the tracked 'Mech state as a
fixed base — at the table you only tap the situational parts (own movement,
target, range, terrain). The chosen modifiers are kept per 'Mech across a reload.
The standalone pages use the same engine with every category.

### 4.2 Heat tracker

- **Classic:** a 0–30 scale as a vertical bar to tap. The selected value
  highlights every threshold currently in effect and summarises them in plain
  language ("−2 MP · +1 to attacks · avoid shutdown on 4+"). Entry aid: movement
  heat + weapon heat − heat sinks.
- **Alpha Strike:** four levels as large buttons, effects below them; committing
  to overheat and cooling down in the end phase as guided steps.
- Both: several 'Mechs side by side (enter a name, tracker next to it), state
  survives a reload.

### 4.3 Hit location helper (Classic)

- Choose: attack from front / left / right / rear.
- Show the matching 2D6 table.
- An optional "roll" button: the result is rolled and the location hit is
  highlighted on a 'Mech silhouette (SVG) — faster than reading a table.
- Badges for the special cases (2 = crit in the center torso, 12 = head).

### 4.4 Faction browser with silhouette preview ✓

- A card grid: per faction the abbreviation, name and three color swatches
  (base/trim/accent).
- The hex codes from the painting guide are the data (`data/factions.json`,
  already part of this package).
- **Silhouette preview:** a generic 'Mech silhouette as SVG with three area
  classes (`base`, `trim`, `accent`). Opening a faction colors the silhouette
  live — you see the scheme before you pick up the brush.
- **Shopping list:** generated from each faction's color sequence text ("For Jade
  Falcon you need: Caliban Green, Warpstone Glow, Averland Sunset, Yriel Yellow
  + primer, wash").
- Factions without a complete scheme (short profiles of the further Clans and
  the Periphery) appear as plain text cards and can be filled in later.

### 4.5 Own scheme (mercenary workshop) ✓

Built as specified below: `js/silhouette.js` supplies the shared silhouette (area
roles base/trim/accent) for BOTH the browser and the workshop.

- The same silhouette, three color pickers (base/trim/accent), the formation's
  name.
- Saved in `localStorage`; shared as a link with URL parameters
  (`?base=2A2D31&trim=5A6069&accent=8E1B1B&name=…`) — that is how the group
  agrees on a scheme, with no backend at all.

### 4.6 Hangar & configurator (per game system)

The hangar is the personal 'Mech collection: create once, play again and again.
The most important scoping decision: the configurator is a **digital copy of the
record sheet or unit card you already have**, not a construction-rules tool along
TechManual lines — what is validated is plausibility (number ranges), not build
rules. That keeps the tool small and robust against rules changes.

**The Classic configurator** records: name/variant, tonnage, movement
(walk/run/jump), armor and internal structure per location, weapons with their
line (location, damage, heat, ranges, ammo), heat sinks, pilot (name, gunnery,
piloting), and optionally BV and notes.

**The Alpha Strike editor** records the unit card: name, PV, size, MV, TMM,
skill, damage S/M/L, OV, armor, structure, special ability abbreviations.

**Photo:** optionally a photo of your own model per 'Mech (camera/gallery),
scaled down client-side to ~1024 px, stored in IndexedDB. Photos are decoration:
they travel in the file export, but never in share links.

**Storage — the decision:** no login, no server at this stage. `localStorage`
(values) plus IndexedDB (photos) are **permanent per device** — the
"browser-session only" misconception does not apply, what you create stays. What
localStorage cannot do is covered by two mechanisms:
- **File export/import** (JSON): backup and moving between devices, for the whole
  hangar at once as well.
- **Share link:** one 'Mech as a compressed URL parameter — that is how a card
  travels to a fellow player without a backend.

Every access goes through a storage module (`js/storage.js`) with a narrow
interface (load/save/export), so that a PHP/MySQL sync (see 5.5) can later sit
behind it as a second adapter without touching the tools. Accounts only come if
localStorage plus sharing genuinely stop being enough in practice.

### 4.7 Digital record sheet (battle tracker, per game system)

The counterpart to the hangar for game night: a **battle** is opened, 'Mechs from
the hangar (or created ad hoc) join it, and from then on the screen replaces the
paper sheet and pencil. Several 'Mechs at once — a lance (Classic) or lance/star
(Alpha Strike) — as tabs or a stack of cards.

**Classic, per 'Mech:** armor/structure per location as tappable pips (silhouette
plus rows of numbers), a 0–30 heat scale with plain-language effects (using the
heat tracker from 4.2 as a building block), an ammo counter per weapon, a crit
list, pilot hits with the consciousness number, and destroyed locations marked
together with their consequences (weapon gone).

**Alpha Strike, per 'Mech:** armor/structure as rows of pips, heat level 0–4
(overheat logic from 4.2), crits assignable straight from the interactive crit
table — fire control and weapon crits are folded into the values shown.

**Flow of play:** every card is ordered along the real turn sequence — acting at
the top (a prominent **attack button**, in Classic followed immediately by
weapons and ammo), taking hits below it (armor/structure, crits), managing at the
bottom (heat, pilot). The attack runs entirely in a popup: GATOR/SATOR chips, for
Alpha Strike the overheat declaration, and a **2D6 roll button** that holds the
result against the to-hit number (hit/miss); in Classic the same window also
rolls the hit location for the target (direction selectable, as on the hit
location page). With more than one 'Mech a name bar under the round bar jumps
straight to the right card.

**Round mechanics:** a round bar (at the top and bottom of the page) counts the
rounds, optionally against a **round limit** ("Round 3/8", set during setup and
afterwards through "+ units"; when it is reached, "+1 round" appears for an
extension). The **end phase** button walks through every 'Mech that is not
destroyed as a checklist and settles the heat directly: Alpha Strike prefilled
from the overheat declaration and external heat (freely correctable, plus "did
not fire → 0" and "in water −1"), Classic with a stepper for heat generated minus
effective dissipation (heat sink crits accounted for) along with threshold
warnings. Then the next round starts. Cancelling (button, Escape or a tap next to
the dialog) discards every entry of that pass — including steps already
committed — and leaves the round where it was. The crit table (2D6) sits in the
Alpha Strike battle as a popup next to the crit chips.

The battle state lives in `localStorage` (it survives a reload and a browser
crash at the table), separate from the hangar: "end battle" resets the trackers,
and the 'Mechs in the hangar stay untouched.

### 4.8 Small things with a large effect

- A 2D6 probability table as a mini reference everywhere a to-hit number appears.
- A "back to top" button and jump bars on every long rules page.
- A print stylesheet: every rules page printed out gives a usable handout.

## 5. Technology

### 5.1 Hosting constraints (plain FTP web space)

- PHP web space with FTP access, **no SSH**, optionally MySQL.
- The consequence: **nothing runs on the server except file serving.** The site
  is built (locally) as a purely static bundle and uploaded by FTP.
- No Node, no build and no cron job needed on the server — and for this project
  not desirable either.
- **HTTPS is mandatory for a PWA/service worker.** Enable the SSL certificate for
  the (sub)domain at the host before testing the PWA.
- PHP and MySQL are deliberately left unused, in reserve (see 5.5).

### 5.2 Stack recommendation

- **Vanilla HTML/CSS/JS, no framework.** The feature set (calculators, trackers,
  filtered lists) does not need React; without a framework the bundle stays
  small, the service worker simple, and the site maintainable in five years.
- If templating is wanted: a static generator such as **Eleventy** that runs
  locally and spits out an uploadable `website/` folder. That decision belongs to
  the implementation — the opening recommendation is vanilla first, and to retro-
  fit a generator only when the page count justifies it.
- ES modules, no runtime dependencies. Few and small libraries, and only where
  there is a real need (a search index, say).

### 5.3 Project structure (proposal)

```
project/
├── website/                   ← what gets uploaded by FTP
│   ├── index.html             Home
│   ├── classic/
│   │   ├── rules.html
│   │   └── tools.html
│   ├── alpha-strike/
│   │   ├── rules.html
│   │   └── tools.html
│   ├── painting/
│   │   ├── index.html         Faction browser
│   │   ├── guide.html
│   │   └── scheme.html        Own scheme
│   ├── knowledge/…
│   ├── data/
│   │   ├── factions.json
│   │   ├── calculator-classic.json
│   │   ├── calculator-alpha-strike.json
│   │   ├── glossary.json
│   │   └── weapons.json
│   ├── js/  css/  img/
│   ├── manifest.webmanifest
│   └── sw.js                  Service worker
├── source/                    Source material (the three original HTML files)
└── CONCEPT.md / CLAUDE.md / README.md
```

### 5.4 PWA & offline

- Manifest: name, icons (at least 192 px and 512 px), `display: standalone`, a
  theme color matching dark mode.
- Service worker: **cache-first with a versioned cache** (`mechs-v1`, `mechs-v2`
  …). On deploy the version constant is counted up; the worker clears the old
  caches. An update hint in the UI ("New version available — reload").
- Every data JSON is cached along with it; after that the site is fully usable
  offline.

### 5.5 What MySQL/PHP could do later (deliberately not in v1)

- A shared scheme gallery for the group (instead of URL sharing).
- A shared collection and painting-status list.
- **Hangar sync across devices** (your own 'Mechs on phone and tablet): the
  storage module from 4.6 is laid out as an adapter interface, so that a small
  PHP API can fit behind it later without changing the tools.
- If it ever comes to that: a small PHP API with MySQL behind it is plenty. Until
  then: `localStorage` plus share links cover everything and keep maintenance at
  zero.

### 5.6 Rules baseline & upkeep

- Catalyst replaces Total Warfare with the new **BattleTech Core Rulebook** in
  September 2026 (the Classic overview already says so). Therefore:
  - Every rules page carries a visible footer line "Rules baseline: …".
  - A changes page under "Knowledge" records what was adjusted and when.
  - Rule values that might change live in the JSON files, not in the markup.
- Carry the trademark footnote (The Topps Company / Catalyst Game Labs) over from
  the source material.
- **Do not forget the legal notice and the privacy policy** — a German website on
  a German domain. Without tracking and without cookies the privacy policy stays
  short; the use of localStorage is mentioned.

### 5.7 Language (English as the source, further languages as packs)

**English is the only source** — the pages under `website/`, the strings in the
JavaScript and the display values in the data files are English. Every further
language is a **pack** under `tools/i18n/<code>/`, registered in
`languages.json`; `tools/translate.py` generates a complete mirror
`website/<code>/…` from it, with its own manifest and `js/i18n-<code>.js` — the
dictionary for everything JavaScript writes at runtime. A new language means:
create the folder, register it, translate the JSON files, run the script.

A pack knows three kinds of entry:

- the dictionaries (`js.json`, `pages-*.json`, `data-*.json`): source text →
  translation, where the key is the English text itself;
- `identical.json`: texts that stay the same in this language (abbreviations such
  as `· TMM`, proper names such as `Fire Control`);
- `patterns.json`: rules for values that appear in combinations —
  `[regex, replacement, flags]` translates (`(\d+)/missile` → `$1/Rakete`), and an
  entry with only a regex means "stays the same". Patterns only take effect when
  no dictionary entry matches.

At runtime (`js/i18n.js`, in the `<head>` of every page): `T(text)` translates
through the dictionary and the patterns (on the source pages there is no
dictionary, so `T` is the identity there), and the `el()` helpers of every module
run through it automatically; `Z(name)` applies the language's quotation marks.
The language button in the header remembers the choice in `localStorage`
(`mechs-lang`); every page carries `<link rel="alternate" hreflang>` to its
counterparts, which `i18n.js` uses to redirect when the remembered language
differs — at the entrance, so that a shared link keeps its language. Every mirror
is in the precache, so switching works offline too.

Stored data is always in the source language; `js/migrate.js` lifts older states
(see `docs/history/MIGRATION-V2.md`). Weapon and equipment names from the
database are never translated — those are product names.

**The upkeep rule:** after every content change run `python3
tools/translate.py`, then `tools/build-sw.py --bump`. Whatever is still missing
is listed in `tools/i18n/<code>/_missing.json` and stays in the source language
until it is filled in — nothing breaks, it just shows.

## 6. Design

- **Dark first:** a very dark neutral grey as the ground (not pure black), light
  type, ONE accent color for the interface.
- **The project stays plain, the instance becomes recognisable.** The repository
  holds a restrained set: cards, clear tables, one accent, mono only where
  numbers have to line up. Everything eye-catching (wordmark, background shapes,
  shadows, animation) belongs to an instance and lives in two files that every
  page loads last and that are **empty** in the repository:
  `css/tokens.local.css` (colors and measurements) and `css/style.local.css`
  (everything else). The deploy build lays the versions from the overlay
  (`site/overlay/css/`) on top; `website/css/` is never touched for it.
- Faction colors appear **only** as content (swatches, silhouette), never as
  interface colors — otherwise it gets restless.
- Typography: a readable system font or a single self-hosted font (no Google
  Fonts embed from a foreign server — privacy). Table numbers in tabular figures.
- The design language of the three source documents (cards, clear tables, mnemonic
  boxes for GATOR/SATOR) is unified into a shared design system.

## 7. Stages

**Stage 1 — the skeleton (the foundation):**
The PWA shell with bottom navigation, dark/light mode, table mode, service worker
and manifest. The three existing content sets ported into the new structure
(Classic rules, Alpha Strike rules, painting including the faction browser from
`factions.json` — without the silhouette at first). Search across the rules
pages. Legal notice/privacy. Deployable by FTP.

**Stage 2 — tools:**
First the storage module (4.6), and on top of it the **hangar + configurator +
digital record sheets** for both systems — Alpha Strike first (smaller data
model, playable sooner), then Classic. Alongside them the calculator engine with
the GATOR and SATOR presets including the probability display, and the heat
trackers for both systems (the record sheets use them as building blocks). After
that: the hit location helper with the silhouette, the cluster table, the
silhouette preview in the faction browser, the special abilities glossary.

**Stage 3 — expansion:**
Own schemes with share links. Lance checklists. BV/PV budget. Glossary, system
comparison, eras, scenarios, paint conversion, weapons quick reference, piloting
reference.

## 8. Taking data from the MegaMek ecosystem (as of 30 August 2026)

Reviewing [MekBay](https://github.com/MegaMek/mekbay) (GPLv3, an Angular app,
live at mekbay.com) and its data source
[mm-data](https://github.com/MegaMek/mm-data) (**CC BY-NC-SA 4.0**) found:

**What is there and what we take from it:**

- **`data/mekfiles/meks/**/*.mtf`** — 3000–4000 BattleMech variants in a
  trivially parseable text format that maps 1:1 onto our hangar model: armor for
  all 11 locations (rear included), tonnage, walk/jump MP, heat sinks (count and
  type), weapons **with their location** and the **complete crit slot layout per
  location**. Plus era, source, role, MUL ID and quirks.
- **`data/images/recordsheets/`** — the official record sheet SVGs:
  `templates_us/mek_biped_default.svg` (the blueprint template) and
  `biped_pips/Armor_*_Humanoid.svg` (armor diagram pips per location and value) —
  the basis for a real armor diagram in the record sheet.
- **`data/images/units/`** — top-down icons of the units (list images, for as
  long as there is no photo of your own); **`data/images/camo/`** — camouflage
  textures (a chance for the painting area).
- **Fluff artwork is NOT in the repository** (gitignored, rights) — we are not
  planning on it.
- **Weapon VALUES** (damage/heat/range) are not in the MTFs (only names plus
  slots); they live in MegaMek Java code. The consequence: our own curated
  `data/weapons.json` for the common weapons (which was planned anyway for the
  weapons quick reference), joined on the weapon name; exotic gear falls back to
  "name without values" and stays editable.
- We adopt MekBay's **architectural pattern** (a build pipeline: raw data →
  compressed static assets), not its Angular stack. Our architecture (a static
  bundle on the PHP web space, FTP deploy) stays.

**Decisions taken (agreed with the operator):**

1. Take **every BattleMech** (not a curated subset); vehicles and battle armor
   only when needed.
2. **Search index offline, units on demand:** a compact index
   (`data/mechs-index.json`, roughly 400 KB) is cached along with everything else;
   the complete individual file per variant (`data/units/<id>.json`) loads on
   first access and then stays in the SW cache. Your own hangar is therefore
   always fully offline.
3. **Diagrams recolored into our design** (token colors, dark first), no paper
   look.

**Pipeline (runs locally, never on the server):**
`tools/` gets a conversion script (Python) that reads an mm-data checkout and
produces `mechs-index.json` plus the shards, and rewrites the SVGs we need onto
our color tokens. The output lands in `website/data/` and `website/img/` and is
deployed by FTP like everything else. Regeneration = run the script when mm-data
updates.

**What this changes about the concept:**

- **4.6 configurator:** "copy the record sheet" becomes **"pick from the
  database"** (search → variant → everything prefilled, crit slots and weapons
  included); creating one by hand stays as the fallback for custom builds. The
  scoping decision "not a construction tool" still holds.
- **The Classic record sheet:** armor/structure entry additionally as a
  **tappable diagram** (silhouette plus pips from the record sheet SVGs); the
  location table stays as the precise alternative.
- **Share links** can point at the variant ID for database 'Mechs instead of
  carrying the full data (shorter links); custom builds keep carrying full data.
- **License upkeep:** derived data files carry the CC BY-NC-SA notice in their
  header; a license file in the repository and a note in the legal notice name
  MegaMek/mm-data as the source. The site stays non-commercial — the license
  fits.

**Order of implementation:** M1 converter + hangar database search → M2 armor
diagram and blueprint look in the record sheet, unit icons → then back to the
regular roadmap (the GATOR/SATOR engine, which benefits from `weapons.json`
straight away).

**Addendum 2 September 2026 — non-'Mech units (F2, Alpha Strike):** MekBay's
`units.json` supplies finished Alpha Strike cards for vehicles, VTOLs, support
vehicles, infantry, battle armor and ProtoMechs. A second converter
(`tools/convert-as-units.py`) puts them as shards next to the 'Mechs
(`data/units/`; the MUL ID namespace is unique across types) and writes its own
index `data/units-index.json` with a type column; the Classic hangar does not see
them, the Alpha Strike hangar searches both indexes. Aerospace units stay out
(threshold, their own crit table).

## 9. Open decisions

- Subdomain layout: everything under one host (recommended) — no further
  subdomains needed.
- Silhouette: draw a generic SVG silhouette ourselves (recommended, no trademark
  questions) rather than using official artwork.
- Eleventy yes/no — decide only once stage 1 shows how many pages there will be.
- Deploy comfort: a local FTP upload script (`deploy.sh`, an lftp mirror) as part
  of the repository, credentials outside it.

## 10. Review of 2 September 2026 → roadmap

An external review of the live state (checked statically, the tools were not
operated). Reconciled against the code on 2 September 2026 — what the review
could not see:

**Already done / does not apply**
- U4 (theme button without text): it has `aria-label` and `title` — done.
- F1 (force building with a point total): battle setup sums BV/PV live against
  the budget, including the skill adjustment (the TW factor table and the AS:CE
  scale) — done since 31 August.
- F3 (sharing): a share link per 'Mech and per color scheme exists; only "the
  whole lance" plus QR remains (see stage B).
- Secondary text contrast: `--muted` on `--paper` = 6.9:1 (dark) and 5.7:1
  (light) — meets 4.5:1.
- Confirmed missing: F7 initiative tracker, F8 cluster automation, F10 weapon
  ranges in the attack dialog, U7 backup reminder, `<noscript>`.
- Found while reconciling: the Alpha Strike pips (`.pip`) are 38 px, not 44 px.

**Stage A — immediately, before the Core Rulebook (hours) ✓ done 2 September 2026**
R4 settled (AS:CE): light woods +1, line of sight blocked from 6″; heavy woods
+2, from 3″; ultra-heavy +3, from 2″ — the rules page and the SATOR calculator
(woods now as chips none/light/heavy) adjusted accordingly.
1. Correct rules R1–R3 (line of sight through woods as a sum, light 1 / heavy
   2 ≥ 3; when prone, torso and head fire normally, only one arm; AS light woods
   +1 / heavy woods +2 — the text AND `calculator-alpha-strike.json`). Check R4
   (AS line of sight "beyond 6″ of woods") against AS:CE — suspicion: it is
   considerably shorter.
2. Typo "Rauhes" → "Raues" (twice), and a duplication in the system comparison
   hero.
3. U3 "Glossary (soon)" on the home page; U6 a `<noscript>` note on every page
   plus a placeholder for `#fx-status` instead of empty brackets.
4. U2: do not delete the hero CTAs, repurpose them — "Into battle (Classic)" /
   "Into battle (Alpha Strike)" as quick access; the tiles stay the entry to each
   area. U5: "Export / import backup" instead of "Save/load".
5. U1 decision: remove `maximum-scale=1` (WCAG 1.4.4, pinch zoom on tables); the
   Safari focus zoom stays away anyway thanks to the 16 px input fields and
   `touch-action: manipulation`. `.pip` to 44 px.
6. After all of it: `translate.py`, catch the translations up, bump the SW
   version.

**Stage B — next iteration (usefulness at the table) ✓ done 2 September 2026**
- F7 initiative tracker (`js/initiative.js`): a button in both round bars, a
  dialog with "roll both" or manual entry per side, the result as a badge
  ("Initiative: us (9:7) · the enemy moves first"); Alpha Strike additionally
  with unit counts and the move distribution of the larger side (6 against 4 →
  2·2·1·1). The result hangs off the round and expires with the end phase.
- F10 weapon ranges: the Classic attack dialog has a distance stepper (1–40
  hexes); every weapon shows its bracket (short/medium/long, out of range), the
  minimum range penalty and its own to-hit number.
- F8 cluster automation: `clusterTable` and `damageTransfer` in
  `classic-rules.json`; a ⚁ button per weapon rolls 2D6 against the to-hit
  number, on a hit the cluster roll, missiles (LRM/MML/MRM/ATM/Rocket/LRT/HAG/
  Thunderbolt) in groups of five onto rolled locations, everything else per hit
  individually. Ammo and heat are carried along, which prefills the end phase.
  An ammo explosion when an ammo slot is marked — the assumptions: shots per slot
  = ⌈remaining ammo ÷ slot count⌉, damage = shots × damage per shot straight to
  the structure, the excess travels on via `damageTransfer`, CASE (by slot name)
  stops the transfer, always 2 pilot hits.
- U7 backup reminder: the hangar remembers the export date
  (`mechs-backup-<system>`) and shows a notice if there has never been a backup
  or the last one was ≥ 14 days ago; a "hangar backup" button in the battle too.
- F3 share a lance (`js/share.js` plus the bundled `js/vendor/qrcode.js`, MIT):
  a link `hangar.html?lance=…` with a database reference and the pilot per unit,
  a QR code up to 2300 characters; the recipient resolves it against their own
  database (fallback: matching by name). Custom builds still go by individual
  link only. For this both hangars now store `sourceId` on a database import;
  older hangar entries do not have it.

**Stage C — rules revision from 16 September 2026 (Core Rulebook)**
Read the rules pages, `classic-rules.json`, `calculator-*.json` and the glossary
notes against the book; record every change under Knowledge › Rules baseline;
catch the language packs up through `translate.py`. Put R1–R3 in beforehand so
they do not get lost in the change list.

**Stage D — larger expansions (the group's decision)**
- F5 pilot abilities/quirks ✓ **done 3 September 2026**: a shared module
  `js/modifiers.js`. In the hangar (both systems) a section "Abilities & quirks"
  with rows of a name and a value (a selection from −6 to +6, touch-friendly
  rather than a number field); stored as `mech.modifiers = [{name, value}]`, and
  a missing field means "none". In the attack dialog they sit as chips above the
  calculator: the ones switched on count into the base like the 'Mech sources,
  appear in the calculation line ("Gunnery 4 · Sniper −1") and therefore also
  shift the to-hit numbers of the individual weapons. The state lives in
  `unit.modActive` and survives a reload; the dialog is redrawn when one is
  toggled, and the scroll position is kept. The entries appear on the printed
  sheet and the unit card, and individual share links take them along.
  **Deliberately free-form rather than a rules table:** the group's own sheet is
  the source, we only do the arithmetic — so there is nothing here to maintain
  when the new Core Rulebook lands either.
- F6 Alpha Strike formations with lance/star bonuses during setup (medium).
- F4 print/PDF ✓ **done 3 September 2026**: `classic/record-sheet.html` renders a
  record sheet per 'Mech (armor and structure as boxes to cross off, a weapon
  table, crit slots in two columns, the heat scale from `classic-rules.json`),
  and `alpha-strike/unit-cards.html` four unit cards per A4 page (values, the
  damage band, boxes for armor/structure/heat, a crit row per unit type,
  specials). A shared stylesheet `css/print.css`: the sheets sit on white paper
  on screen as well, so that the preview matches the printout; in print the
  header, navigation and selection fall away (`@page A4`, 12 mm margin). A PDF
  comes from "save as PDF" in the print dialog — no PDF library needed, all
  offline. Reachable through a button each in the hangar's button group.
- F2 non-'Mech units — **Alpha Strike ✓ done 2 September 2026**: its own converter
  `tools/convert-as-units.py` (MekBay `units.json`, 3299 canonical vehicles,
  VTOLs, support vehicles, infantry, battle armor and ProtoMechs → shards in
  `data/units/`, the index `data/units-index.json` in the precache, icons from
  mm-data). The Alpha Strike hangar searches both indexes with a type filter, and
  every unit carries `type` (BM/IM/CV/SV/BA/CI/PM; old entries without the field
  count as BattleMechs). The Alpha Strike battle: heat only for 'Mechs (the end
  phase skips the others), crit chips and 2D6 tables per type — a vehicle with
  "crew stunned" and a motive roll (the modifier from the MV suffix: wheeled/
  hover +1, VTOL/WiGE +2, ARS −1), a ProtoMech with a stackable MP crit,
  infantry/BA without crits; a rules page section "Vehicles, infantry &
  ProtoMechs". Rule sources: the AS:CE reference tables for the crit tables; the
  motive table, vehicle engine hits (MV and damage halved, a second destroys) and
  the duration of "crew stunned" (until the end of the following round) come from
  secondary sources — check them against the book in stage C. **Open:** aerospace
  units (their own crit table, threshold) and Classic vehicles with motive hits
  (high).
- F9 campaign light ✓ **done 3 September 2026**: damage survives the end of a
  battle. "End battle" now asks (instead of a plain `confirm`): **keep damage &
  end** writes each unit's state into its hangar entry (`mech.state`), **end
  without damage** deletes it. The hangar shows damaged units with a line ("Armor
  −18 · structure −3 · 1 crit · 1 weapon out · pilot 1 hit") and has a **repair**
  button; the battle selection shows the same line, and whoever fields a damaged
  unit starts with it. The module `js/campaign.js` with a field list per system —
  Classic: armor and structure damage, crits, disabled weapons, ammo used, pilot
  hits, "destroyed"; Alpha Strike: armor damage, structure damage, crits,
  "destroyed". What gets reset is everything that only holds for one round or one
  battle: heat, the overheat declaration, rolls, notes, a stunned crew.
  **No rule values:** pure bookkeeping over our own tracker fields, and repairing
  is a button press rather than a refit calculation.
  **Workshop (3 September 2026):** "repair" no longer opens an all-or-nothing
  dialog but a list of every item to tick off — armor and structure per location,
  each crit individually (with the slot and the component name, e.g. "Right arm
  slot 2 (upper arm actuator)"), disabled weapons, ammo to refill, pilot hits,
  "destroyed — rebuild". What is not ticked stays for the next battle.
  **Fixed afterwards:** `slotCrits` (the crits from the slot table, which is the
  normal case for database 'Mechs) were missing from the field list in the first
  version and would have been lost between two battles.
  **Named campaigns + log (3 September 2026):** campaigns are now containers of
  their own (`mechs-campaigns-<system>`, a page `campaign.html` per system): a
  name, a creation date, the state per unit and a battle log. Several run
  alongside each other and one is active; switching changes both the damage AND
  the log. The hangar therefore only describes the unit, while the campaign holds
  its condition (old `mech.state` entries move into the active campaign
  automatically on first load). The end of a battle additionally asks for a note
  ("Victory at Hesperus"); the log entry holds the date, the round count, the
  note and each unit's state afterwards. The hangar backup takes the campaigns
  along (a `campaigns` field in the export package; older files without the field
  can still be read).
  Left for later: pilot experience, a campaign as a share link of its own.

**The review's click-test points:** attack → damage → crit → heat → end phase was
played through in browser tests (as of 31 August); tap targets other than `.pip`
≥ 44 px; the offline first start was checked on 2 September 2026 — every page and
both database indexes are in the precache (cache contents inspected in the
browser), and the install prompt is the browser's native one (no
`beforeinstallprompt` handler of our own). What remains: a pass on a real iPhone
after the next deploy.
