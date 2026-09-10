# Third-party components

| Component | Where | License | Source |
|---|---|---|---|
| qrcode-generator 1.4.4 by Kazuhiko Arase | `website/js/vendor/qrcode.js` (unmodified, bundled so QR codes work offline) | MIT | https://github.com/kazuhikoarase/qrcode-generator |
| MegaMek mm-data (MTF unit files, unit icons) | converted into `website/data/units/`, `website/data/mechs-index.json`, `website/img/units/` | CC BY-NC-SA 4.0 | https://github.com/MegaMek/mm-data |
| MekBay unit and equipment database | merged into the unit files by the converters | CC BY-NC-SA 4.0 (generated from MegaMek data) | https://github.com/MegaMek/mekbay |

No external services are called at runtime: no CDN scripts, no web fonts,
no analytics. The app uses system fonts and ships every asset it needs.

See `LICENSE` (code) and `LICENSE-DATA.md` (data and content) for the
project's own licensing.
