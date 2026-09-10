# Design system

The look of **Mech Companion** in one place. There are no stylesheets of its
own in this folder – the app's real ones are the system:

```html
<link rel="stylesheet" href="css/tokens.css">        <!-- colours, type, shape -->
<link rel="stylesheet" href="css/components.css">    <!-- parts -->
<link rel="stylesheet" href="css/app.css">           <!-- page layout -->
<link rel="stylesheet" href="css/tokens.local.css">  <!-- instance: colours -->
<link rel="stylesheet" href="css/style.local.css">   <!-- instance: everything else -->
```

Runnable preview: **[preview.html](preview.html)** – open it through a local
server (`python3 -m http.server`), then the logo and the theme switch work
too. It loads the files above from `../website/css/`, so what you see is what
ships.

## The rules

1. **Dark first.** The concept asks for dark mode as the default. The dark set
   sits on `:root`, light is the deviation via `:root[data-theme="light"]`
   (switch + `localStorage`). There is **no** `prefers-color-scheme` – without
   the attribute dark applies, even without JavaScript.
2. **One accent, and it is dark.** Filled accent areas (`.btn-primary`) carry
   **light** type. Whoever adds a part has to think of that. Selected chips
   therefore only carry the tint: **one filled accent area per field of view**,
   and it belongs to the main action.
3. **Faction colours are content, never interface** (swatches, silhouette) –
   otherwise the page turns restless.
4. **Mono only where numbers have to line up.** Target numbers, values, hex
   codes, table figures. Running text and controls use the system sans.
5. **Touch targets:** `.btn` and `.chip` keep a minimum height of 44 px
   (`.btn-small` on purpose does not – only for headers and table rows).
6. **`.hazard-warn` is reserved for real warnings** (heat threshold, shutdown),
   otherwise signal turns into wallpaper.

Every palette has to hold: `--accent-deep` must reach at least 4.5:1 on
`--paper` (text), `--accent` only carries areas.

## The parts

| Part | Purpose |
|---|---|
| `.card` / `.card.highlight` | Content block; the bar of the emphasised one sits on top |
| `.stage` | Header and hero as one block |
| `.chips` / `.chip` | Selection chips of the calculators; state via `aria-pressed` |
| `.readout` | Big target number with its 2D6 probability; `.impossible` for > 12 |
| `.hazard` | Section divider; `.hazard-warn` (accent) only for real warnings |
| `.bottom-nav` | Five areas, fixed, safe-area aware; active item via `aria-current="page"` |
| `.hat-bottom-nav` | On `<body>`: room for the fixed navigation |
| `.tag` / `.badge` | State markers; `.tag-off` dashed instead of coloured |
| `.flash` | Message; `-ok` carries the accent, `-err` simply lacks it |

## Wordmark and logo

```html
<a class="brand" href="/">
    <img src="img/logo-badge.svg" width="34" height="34" alt="">
    <span class="brand-name"><span class="brand-tld">sub.</span>NAME<span class="brand-tld">.tld</span></span>
</a>
```

The build fills the three pieces from `site.json` (`brand.prefix` /
`brand.core` / `brand.suffix`), so an instance can spell its own name –
a domain, a club name, a single word. `website/img/logo-badge.svg` holds the
project's hexagon badge (the board is made of hexes, inside it a cockpit head);
an instance replaces it through the overlay.

## Own look

Two files carry everything an instance changes, and both are **empty in the
repository**:

| File | For |
|---|---|
| `website/css/tokens.local.css` | colours and measurements – overwrite variables |
| `website/css/style.local.css` | everything else – own rules, own parts, background shapes, wordmark treatment, animation |

Every page loads them last, in that order. An instance puts its versions into
its private overlay:

```
site/overlay/css/tokens.local.css
site/overlay/css/style.local.css
```

The deploy build (`tools/opensource/build.py`) copies the overlay
over `website/` into `dist/`, so the two files replace the empty ones without
a single line of the project changing. That is the whole mechanism: the
project stays plain, and how far an instance moves away from it is its own
business.
