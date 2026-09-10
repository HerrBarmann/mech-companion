# Changelog

## v1.0.0 — 10 September 2026

First public release. The app itself has been in use at a table for months;
what happened in the run-up to this tag is that it was turned inside out to be
publishable — English as the source language, nothing personal left in the
repository, and one licence over the whole thing.

### Before you update

**Export a backup first, then update.** The hangar page has the button
("Export backup"), and the battle screen has one too.

Your stored data — hangar, battles, campaigns, paint schemes — is migrated
automatically on the first page view after the update, in four steps that run
in order and each check a version field:

| Step | What moves |
|---|---|
| v2 | stored **values** become English: crit slot names (`Triebwerk` → `Engine`, `Munition (LRM 20)` → `Ammo (LRM 20)`), range and damage texts |
| v3 | stored **keys** become English: object fields, location codes (`ZT` → `CT`, `RB` → `RL`), category ids, and the `localStorage` names themselves |
| v4 | crit slots of older 'Mechs are run through the slot-name table again — a display text had been written back into storage |
| v5 | icon paths move from `img/mechs/` to `img/units/` |

The migration is one-way: it brings old data forward, it does not put it back.
Each step is wrapped on its own, so a single failure cannot take the app down
with it. If something looks wrong afterwards, the backup file is the way back —
import it into the previous version.

Bookmarks keep working. All 66 old addresses answer with a redirect stub that
carries any `?query` and `#hash` across.

Nothing was taken away and no feature was added: at the table this plays
exactly as the last German build did, except that the bugs listed under
*Correctness* are gone.

### Language

- **English is the source now.** The pages under `website/`, the strings in the
  JavaScript and the display values in the data files are English. German is
  the first **language pack**: a set of JSON dictionaries under
  `tools/i18n/de/`, from which `tools/translate.py` generates a complete mirror
  at `website/de/` plus a runtime dictionary.
- Adding a language is five steps and no code — see
  [`docs/I18N.md`](docs/I18N.md).
- English game terms stay in the German pack wherever the game material uses
  them, and weapon and equipment names from the database are never translated:
  they are product names.
- Both mirrors are in the precache, so switching languages works offline. A
  shared link keeps its language; the redirect only fires at the entrance.

### Names, files and addresses

- Every identifier that crosses a file boundary, gets stored, or appears in a
  URL is English: modules and their methods, JSON keys, HTML ids, CSS classes,
  `data-` attributes, `localStorage` names.
- Pages were renamed with them — `gefecht.html` → `battle.html`,
  `bemalen/` → `painting/`, `wissen/` → `knowledge/`, and so on — with a
  redirect stub for each old address.
- The unit database moved from `data/mechs/` to `data/units/`, its icons from
  `img/mechs/` to `img/units/`.

### The instance is separate from the project

- The repository is neutral: no operator, no imprint details, no branding. A
  private overlay in `site/` (git-ignored) carries all of that, and
  `tools/opensource/build.py` lays it over `website/` into `dist/`, filling the
  `{{site.…}}` placeholders on the way. `dist/` is what gets uploaded.
- The look is split the same way. `css/tokens.local.css` (palette) and
  `css/style.local.css` (everything else) are **empty** in the repository and
  are the last stylesheets every page loads. Anything eye-catching — wordmark,
  background shapes, shadows — belongs to an instance and lives in the overlay.
- `python3 tools/opensource/check.py` guards the line, with a pattern list the
  operator keeps privately.

### Correctness

Renaming that much found real bugs, all fixed here. The ones that mattered:

- The Classic paper doll was reading `dataset.location` while the markup wrote
  `data-zone` — the whole diagram was dead.
- The record sheet's own to-hit calculation still compared category types
  against the German words and silently dropped 5 of the 12 GATOR categories.
- Recorded crits were stored under a key no reader looked at, so they never
  showed up.
- Destroyed units still looked healthy: the JavaScript set German class names
  the stylesheet no longer knew.
- A stunned crew could still attack.
- Repairing several items in the workshop left some behind — the crit array was
  being cleared by position while it shifted underneath.
- Selects built from translated labels wrote German codes into storage.
- The chance display had a hard-coded decimal comma, so the English side read
  "83.3" as "83,3 %".

### Documentation, tests, CI

- [`README.md`](README.md), [`CONTRIBUTING.md`](CONTRIBUTING.md) and
  [`docs/`](docs/): architecture, the data pipeline, how a language pack works,
  and which rule value comes from which book
  ([`docs/RULES-SOURCES.md`](docs/RULES-SOURCES.md)).
- 61 tests (`node --test tests/*.test.js`) over the to-hit maths, the cluster
  table, range bands, campaign state, the language mechanism and every
  migration. They load the browser modules as they ship — no export switches
  added to production code for the tests' benefit.
- GitHub Actions on every push and pull request: the project checks, the tests,
  and a guard that the generated German mirror and the precache list are up to
  date. A second workflow publishes the neutral build to GitHub Pages.
- How the conversion was done, decision by decision, is in
  [`docs/history/`](docs/history/).

### Licence

The whole repository is **CC BY-NC-SA 4.0** — code, data and written content
alike. See [`LICENSE`](LICENSE), [`NOTICE.md`](NOTICE.md) and
[`LICENSE-DATA.md`](LICENSE-DATA.md).

### Note on the history

This repository starts at one commit. The German development history stayed
behind: those commits carried the operator's address and domain in files that
are placeholders here.
