# Contributing

Thanks for looking. This is a small, static app that a gaming group actually
plays with — the bar for a change is "does it help at the table", not "is it
clever".

Most welcome, roughly in order:

1. **Rule corrections.** A wrong value is worse than a missing feature.
   Please cite the book and the page — see
   [`docs/RULES-SOURCES.md`](docs/RULES-SOURCES.md).
2. **Language packs.** Five steps, no code:
   [`docs/I18N.md`](docs/I18N.md).
3. **Bugs**, especially anything that loses stored data.
4. **Unit data problems** — a variant that converts wrong, a missing icon.

## Before you start

- Read [`docs/CONCEPT.md`](docs/CONCEPT.md) for what the app is trying to be,
  and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it is put
  together.
- For anything bigger than a fix, open an issue first. It is a small project
  with a clear scope, and a pull request that does not fit it is a waste of
  your evening.

## What gets closed unread

There is **no bounty, no payment and no tip** for contributing here, and a
pull request that asks for one is closed as spam.

A pull request has to change the project. Specifically, it is closed unmerged
if it:

- adds a summary, plan or "solution" document instead of changing the code it
  describes,
- describes an implementation without implementing it,
- claims `Closes #N` for an issue it does not resolve,
- or does not pass the checks below.

Use whatever tools you like, including an AI, to write a change — but run it,
read it, and make sure it fits *this* codebase. Text generated from the issue
alone tends to invent things this project does not have: there is no
`data-i18n` attribute system (display text goes through `T()` at runtime), no
`css/style.css`, and no build step for the app itself. That is the tell, and
it is why such pull requests get closed rather than reviewed.

## The rules that are not negotiable

They come out of where this thing runs — a plain FTP webspace, on phones, at
a table, often offline:

- **Static output.** No server-side logic, no build step needed to *run* it.
- **No runtime dependency on another server.** No CDN fonts, no external
  scripts, no analytics. Everything ships with the app.
- **Vanilla HTML/CSS/JS.** No framework without a very good reason.
- **Mobile first**, ~380 px reference width, touch targets ≥ 44 px.
- **English is the source language.** No new German identifiers, no German
  strings. Text a script builds goes through `T("…")`.
- **Rule values are data**, never code.
- **Nothing personal in the repository.** Operator data and an instance's own
  look live in `site/`, which is git-ignored.

## Running it

```bash
python3 -m http.server 8000 --directory website
```

`localhost` counts as a secure origin, so the service worker and installing
the app both work. The pages show `{{site.…}}` placeholders — that is
correct; the deploy build fills them.

## Before you open a pull request

```bash
node --check website/js/<the file you changed>.js
python3 tools/translate.py          # has to end in "offen gesamt: 0"
python3 tools/build-sw.py --bump    # precache list + cache version
python3 tools/opensource/check.py   # six checks, has to be green
node --test tests/*.test.js
```

And open it in the browser in **both** languages at 375 px. The tools do not
see a dead click handler; a click does.

If you touched a layout, check for horizontal overflow while you are there:

```js
document.documentElement.scrollWidth   // has to equal the viewport width
```

`html` carries `overflow-x: clip` as a safety net, so an overflow does not
show up as a scrollbar — it silently cuts content off at the edge. German
text is a third longer than English and finds these first.

If you changed anything that is stored, say so in the pull request. Stored
structures carry a version and are migrated in `website/js/migrate.js`; a
migration is written once and never rewritten.

## Style

- Comments explain **why**, not what. The code says what.
- Names say what a thing is, in English, in full — `structureDamage`, not
  `sd`.
- Keep the diff to the change. Reformatting a file you touched buries the
  part that matters.
- Commit messages: a short line saying what changed, then a paragraph on why,
  in plain sentences.

## Licence

One licence covers the whole repository: **CC BY-NC-SA 4.0** (see
[`LICENSE`](LICENSE)). By opening a pull request you agree that your
contribution goes in under those terms — attribution, non-commercial,
share-alike — and that you have the right to give it. Contributors keep their
copyright; the git history is the record of who wrote what.

That licence is not a preference, it is inherited: the unit database comes from
MegaMek and MekBay under CC BY-NC-SA, and the rule pages paraphrase published
rulebooks for private play. [`LICENSE-DATA.md`](LICENSE-DATA.md) records what
came from where.
