# Aufgabenliste: Open Source, Englisch als Basis

> **Nachtrag vom 10.09.2026:** Die Lizenz wurde vor der Veröffentlichung auf
> **CC BY-NC-SA 4.0 für das gesamte Repository** vereinheitlicht, siehe den
> Nachtrag in `PLAN-OPENSOURCE.md`. Der Satz unten ist der Stand vom 09.09.

Abarbeitbare Fassung von `PLAN-OPENSOURCE.md`. Entscheidungen des Betreibers
(09.09.2026): **MIT** für Code mit Namensnennung, **CC BY-NC-SA 4.0** für
Daten und Inhalte, Repo **`mech-companion`**, **URLs englisch**, **Daten ins
Repo**, alles Personalisierte (Impressum, Datenschutz, Design) bleibt privat
in einem Overlay. Vorbereitet sind: `tools/opensource/` mit
`rename-map.json`, `check.py`, `build.py`, `MIGRATION-V2.md`, `fixtures/`;
`LICENSE`, `LICENSE-DATA.md`, `THIRD-PARTY.md`, `site.json.example`,
`.gitignore`.

Regeln für die Abarbeitung:

- Reihenfolge einhalten, jede Phase endet mit `check.py` ohne Fehler, dem
  bekannten Browser-Durchlauf (beide Systeme, DE und EN, 375 px) und einem
  Commit. Commit-Messages englisch.
- Nach jeder Änderung an `website/js`, `website/css` oder Seiten die
  `VERSION` in `sw.js` hochzählen, sonst testet man alten Code aus dem Cache.
- Keine Schlüssel-Umbenennung ohne den passenden Migrationsschritt
  (`MIGRATION-V2.md` §6).
- Wörterbuch bei 0 Lücken halten; der Generator meldet den Stand.
- Wo dieses Dokument „prüfen und nachtragen“ sagt, den Fund in
  `rename-map.json` bzw. `MIGRATION-V2.md` eintragen, damit die Tabellen
  vollständig bleiben.

---

## Phase 1 – Repo und Datenschutz ✓ erledigt 09.09.2026

**Ziel:** ein neutrales, privates Repository ohne Betreiberdaten; die
Live-Instanz entsteht durch `build.py` aus Repo + Overlay.

**Abweichungen vom ursprünglichen Plan (bewusst):**

1. **`website/` trägt Platzhalter, gebaut wird immer.** Statt generischer
   Werte im Quellordner stehen dort `{{site.…}}`; `build.py` füllt sie aus
   `site/site.json` (privat) oder `site.default.json` (im Repo). So gibt es
   genau einen Weg zur fertigen Seite und nie Platzhalter im Browser. Lokal
   starten heißt deshalb: `build.py` und dann `dist/` ausliefern. Der Build
   gleicht nur Geändertes ab, Wiederholungen dauern Sekundenbruchteile.
2. **Titel-Suffix „· Mechs" blieb literal.** Es ist in beiden Fassungen
   gleich und damit keine Betreiberangabe - 24 Wörterbuchänderungen ohne
   Nutzen gespart. Ebenso die Manifest-Beschreibung (Phase 2 macht Manifeste
   je Sprache).
3. **Zusätzlich `<meta name="site-name">`.** Die Druckbögen setzen den Namen
   der Instanz in die Fußzeile; JavaScript kann `site.json` nicht lesen.
4. **Startsprachen-Umleitung nur am Eingang.** Sie greift auf der Startseite
   und nur in der Sprache an der Wurzel (erkannt am eigenen
   `alternate`-Link). Sonst würde ein geteilter Link in der anderen Sprache
   beim Empfänger umgebogen.
5. **Mehr entpersonalisiert als geplant:** neutrales Logo (Sechseck mit
   Cockpit) samt PNG-Icons, der Textmarker im Hero und das dunkle Band in
   `schraeg.css` hingen an fest verdrahteten Rotwerten - beide folgen jetzt
   `var(--accent)`. Nach `site/privat/` gewandert: das Ursprungs-Design-System,
   `inhalte/`, das Logo-Rohmaterial, `LIZENZEN.md` (ersetzt durch
   `LICENSE-DATA.md`) und das doppelte `daten/`. `check.py` kennt jetzt
   Ausnahmen (`!Pfad`), weil `LICENSE` den Namen absichtlich trägt.

- [x] **1.1 Overlay anlegen** (`site/`, gitignored):
  `site/site.json` aus `site.json.example` mit den echten Werten
  (Name der Live-Instanz, `brand` = Präfix / Kern / Suffix der Wortmarke,
  `defaultLang: "de"`, Betreiber aus `website/impressum.html`).
  `site/overlay/` mit: `impressum.html` + `datenschutz.html` (die heutigen
  Dateien, später umbenannt), `img/logo-badge.svg`, `img/favicon.svg`,
  `img/icon-192.png`, `img/icon-512.png`, `img/apple-touch-icon.png`,
  `css/tokens.local.css` (die heutige rote Palette aus `tokens.css` als
  Override), das private Logo-Rohmaterial dorthin verschieben.
  `site/private-patterns.txt` mit je einer Regex: Nachname des Betreibers,
  Straße, E-Mail, Domain (auch in Teilen, wie die Wortmarke sie zerlegt).
- [x] **1.2 Seiten generisch machen:** In allen 24 Seiten, `manifest.webmanifest`
  und `sw.js`-Kommentaren die Marke ersetzen: Wortmarke im Kopf →
  `<span class="brand-tld">{{site.brand.prefix}}</span>{{site.brand.core}}<span class="brand-tld">{{site.brand.suffix}}</span>`,
  Fußzeile → `{{site.name}}`, Manifest `name`/`short_name`/`description` →
  Platzhalter, `<title>`-Suffix „· Mechs“ → `· {{site.shortName}}`.
  Neue Zeile in jedem `<head>`: `<meta name="site-default-lang" content="{{site.defaultLang}}">`.
  `impressum.html`/`datenschutz.html` werden Vorlagen mit
  `{{site.operator.name}}` usw.; die Datenschutzerklärung nennt den Hoster
  über `{{site.hosting.provider}}`/`{{site.hosting.privacyUrl}}`.
  Der Generator (`uebersetzen.py`) muss Platzhalter unverändert durchreichen
  (sie dürfen nicht im Wörterbuch landen: als `identisch` behandeln oder per
  Regex ausnehmen).
- [x] **1.3 Neutrales Design als Standard:** `website/css/tokens.css` bekommt
  eine neutrale Akzentfarbe (Vorschlag dunkel `--accent: #2F6FED`,
  `--accent-deep: #5A8DF5`, `--accent-tint: #14203A`; hell `--accent: #1F4FB8`,
  `--accent-deep: #1A44A0`, `--accent-tint: #E4ECFB`; Kontrast ≥ 4,5:1 gegen
  `--paper` prüfen, Formel steht im Kopf von `tokens.css`). Jede Seite lädt
  nach `tokens.css` optional `css/tokens.local.css` (im Repo: leere Datei mit
  Kommentar; im Overlay: die rote Palette). Generisches Logo: einfacher
  Sechseck-Badge mit „MC“ als `img/logo-badge.svg` + `favicon.svg`,
  PNG-Icons daraus (`qlmanage -t -s 512 -o . logo-badge.svg` auf macOS,
  dann `sips` auf 192/180). `design-system-mechs/` → `design-system/` mit
  denselben neutralen Tokens; das README dort beschreibt das Overlay.
- [x] **1.4 i18n.js: Startsprache aus `<meta name="site-default-lang">`**
  (Wert beginnt mit `{{` → `en`). Reihenfolge: gespeicherte Wahl →
  Startsprache → `navigator.language`, wenn dafür ein `hreflang` existiert.
- [x] **1.5 `deploy.sh` auf `dist/` umstellen** (vorher `build.py` laufen
  lassen, Abbruch ohne `site/site.json`); Kommentar im Skript anpassen.
- [x] **1.6 Prüfen:** `python3 tools/opensource/check.py` → alles
  grün (Schritt 5 findet keine privaten Muster, Schritt 6 sieht Platzhalter).
  `python3 tools/opensource/build.py` → `dist/` ohne offene
  Platzhalter; `dist/` im Browser öffnen: Marke, Logo, rote Palette,
  Impressum vollständig. `website/` im Browser: neutrale Marke und Palette.
- [x] **1.7 README-Skelett (englisch)** an der Stelle des heutigen `README.md`
  (Inhalt: Was, Screenshots später, lokal starten mit
  `python3 -m http.server 8337`, Build mit Overlay, Lizenzen, Marken, Status
  „under restructuring“).
- [x] **1.8 Erster Commit** – lokal erledigt (`Initial import: static PWA with
  generic branding`, 12 295 Dateien). **Offen und bewusst nicht ohne
  Rückfrage ausgeführt:** das Anlegen des GitHub-Repositories
  (`gh repo create mech-companion --private --source . --push`) – das ist
  der erste Schritt, der Code aus der Hand gibt.

- [x] **1.9 Gestaltung wirklich neutral** (nachgezogen 10.09.2026, Nachtrag
  zu 1.3): 1.3 hatte nur die FARBE getauscht. Die Gestaltungssprache selbst
  war weiterhin die der Live-Instanz – die Wortmarke als Domain in Mono mit
  Akzent-TLD und blinkendem Cursor, die angeschnittenen Bänder aus
  `schraeg.css` („Schräg", Adaption des eigenen Systems „Terminal trifft
  Frucht"), der Textmarker im Hero, der harte Aufkleber-Versatz an
  Hauptschaltfläche, Karten und Dialogen und Mono als Stimme aller
  Bedienelemente. Das ist jetzt getrennt:

  - `website/css/style.local.css` – zweiter Instanz-Haken neben
    `tokens.local.css`, im Repository leer, wird von allen 24 Seiten als
    letztes geladen (Reihenfolge: `tokens` → `components` → `app` →
    `tokens.local` → `style.local`).
  - `website/css/schraeg.css` **gelöscht**, `body class="slanted"` entfernt;
    der ganze Bänder-Layer liegt jetzt in `site/overlay/css/style.local.css`
    (dort ohne `body.slanted`, weil er nur eine Instanz betrifft).
  - Im Repository steht der schlichte Satz: Radius 6 px, gefüllter
    Akzent-Knopf ohne Versatz, Wortmarke in der Systemschrift mit gedämpften
    Rändern, Warnstreifen als Haarlinie, `.stage` mit Trennlinie statt
    Fläche, `.hero .accent` einfach in der Signalfarbe. Mono bleibt, wo
    Zahlen stehen (Readout, Tabellen, Werte, Krit-Slots, Würfel); für
    Bedienelemente und ganze Sätze (`.btn`, `label`, `th`, `.chip`,
    `.bottom-nav`, `.tab-row`, `.jump-bar`, Aufklapp-Titel, `.hint`,
    `.formula-note`, `.rules-version`) gilt die Systemschrift.
  - `design-system/` trägt keine eigenen Stylesheets mehr (waren Kopien) und
    keine Herkunftsgeschichte: `preview.html` lädt die echten Dateien aus
    `../website/css/`, das README ist englisch und beschreibt die beiden
    Haken. `schraeg.css`, `tokens.css`, `components.css`, `logo/` und
    `beispiel.html` dort gelöscht.

  **Abgleich:** `dist/` (mit Overlay) ist Pixel für Pixel die heutige Seite.
  Nachgewiesen mit einem zweiten Build aus `git worktree` auf `42fa1e88` und
  einem Vergleich der berechneten Stile ALLER Elemente (20 Eigenschaften plus
  `::before`/`::after`) über 15 Seiten in beiden Sprachen: identische Prüfsumme
  und identische Dokumenthöhe, einziger Unterschied der entfallene
  Klassenname `slanted`. Drei Fallen dabei gefunden: `body.slanted .hero h1`
  hatte `.hero h1.loud` aus `app.css` überstimmt (der Hero war nie
  „plakativ"), der Overlay lädt nach `app.css` und hätte sonst `.brand`s
  Verkleinerung auf 375 px und die Kante der Hitze-Karten (`.hazard-edge`)
  überschrieben.

## Phase 2 – i18n-Inversion ✓ erledigt 09.09.2026

**Ziel:** `website/` ist englisch, `website/de/` wird generiert, Datenwerte
intern englisch, gespeicherte Daten per v2 migriert.

**Abweichungen vom ursprünglichen Plan (bewusst):**

1. **Sprachpakete bekommen Muster (`patterns.json`).** Datenwerte treten in
   Kombinationen auf – `1/missile`, `2/missile`, `Ammo (LRM 20)`,
   `Medium Laser (Rear)`, `7/14/21 (water only)`, `min 6 · 7/14/21`. Jede
   Kombination als Wörterbucheintrag zu führen wäre aussichtslos, und die
   alten Sonderhelfer (`MechsI18n.slot/reichweite/schaden`) hätten Deutsch
   wieder in den Code geholt. Ein Paket darf deshalb Regeln mitliefern:
   `[Regex, Ersatz, Flags]` übersetzt, ein Eintrag **nur mit Regex** heißt
   „bleibt gleich“ (die Muster-Fassung von `identical.json`). `T()` greift
   erst darauf zurück, wenn kein Eintrag passt.
2. **Anführungszeichen sind Sprachsache.** `„…“` stand 28-mal fest im Code
   und erschien so auch auf englischen Seiten. Neu: `Z(name)` aus `i18n.js`,
   die Zeichen `“`/`”` stehen im Wörterbuch.
3. **Der Prüflauf liest jetzt JEDE Zeichenkette der JS-Dateien.** Die alte
   Musterliste (`el(…)` einzeilig, `T("…")`) hat mehrzeilige Aufrufe und
   Verkettungen übersehen und deshalb „0 offen“ gemeldet, obwohl mehrere
   Absätze deutsch geblieben waren. `js_literale()` liest Kommentare,
   reguläre Ausdrücke und Zeichenketten in EINEM Durchlauf und zieht
   `"a " + "b"` zusammen – zur Laufzeit ist das ein Text und muss als ganzer
   Satz im Wörterbuch stehen. Was sicher keine Anzeige ist (Selektoren,
   Pfade, CSS-Werte), sieben drei Regeln in `JS_KEIN_TEXT` aus.
4. **Zusätzlich geprüft:** Slotnamen aus `classic-werte.json`, die
   Schadenstexte aus `waffen.json` und alle Waffenwerte der 4065
   Einheitendateien. Waffen- und Ausrüstungsnamen selbst bleiben
   unangetastet – das sind Produktnamen.
5. **Sachfehler nebenbei gefunden und behoben:** `waffen.json` und der
   MTF-Konverter trugen noch deutsche Schadenstexte (`5 je Schuss`,
   `s. Regeln`, `1/Rak (LRM) · 2/Rak (SRM)`); die Farbstoppwörter in
   `fraktionen.js` waren nach der Datenumstellung wirkungslos, wodurch
   „Like Steiner“ in der Einkaufsliste stand; `schadenJeSchuss()` hielt
   `10 / cluster` (LB-X) für eine Streuwaffe und rechnete 1 statt 10 Schaden
   je Schuss; die Werkstatt zeigte Slotnamen über den entfernten Helfer
   `MechsI18n.slot` und damit unübersetzt. Die Farbrollen (`basis`/`akzent`)
   zeigten ihre deutschen Schlüssel als Beschriftung – die Schlüssel bleiben
   bis Phase 3, angezeigt wird jetzt `base`/`accent`.
6. **Nicht gemacht:** Das Glossar bleibt eine EN↔DE-Begriffsliste; auf der
   englischen Seite steht damit die deutsche Spalte. Das ist eine
   Inhaltsfrage, kein Übersetzungsfehler – gehört zu Phase 4 (Sprachpakete
   dürfen eigene Glossareinträge mitbringen).
7. **Gelöscht:** die alten DE→EN-Wörterbücher, `uebersetzen.py` und die
   Einmalskripte (`flip-*.py`, `invert-i18n.py`). Sie stehen in der
   Git-Historie des Phase-1-Commits.

- [x] **2.1 Wörterbücher invertieren:**
  `python3 tools/opensource/invert-i18n.py` → `tools/i18n/de/*.json`
  + `identical.json`; Bericht lesen (9 Kollisionen, alle in `RESOLUTION`
  entschieden). Die alten DE→EN-Dateien nach `tools/i18n/_alt-de-en/`
  verschieben (bleiben bis Phase 2.9 als Referenz).
- [x] **2.2 Generator umbauen** (`uebersetzen.py`, später `translate.py`):
  Quelle = `website/` (Englisch), Ziele aus `tools/i18n/languages.json`
  (`[{"code":"en","name":"English","native":"English","source":true},{"code":"de","name":"German","native":"Deutsch"}]`),
  Wörterbuch je Sprache aus `i18n/<code>/*.json`, `identical.json` je Sprache,
  Ausgabe `website/<code>/` + `website/js/i18n-<code>.js`, Bericht
  `i18n/<code>/_missing.json`, Schalter `--check` (nur prüfen, Exit 1 bei
  Lücken). Pfad-Umschreibung, `hreflang`-Links für ALLE Sprachen, Manifest
  je Sprache (`<code>/manifest.webmanifest` mit übersetztem Namen und `lang`),
  Sprachmenü statt Einzelknopf (siehe 2.6). JS-Scan der `T("…")`-Literale
  bleibt (englische Literale).
- [x] **2.3 Englische Seiten werden Quelle:** `website/en/*.html` nach
  `website/` kopieren (über die deutschen), Pfade zurückdrehen (`../` →
  wie zuvor), `<html lang="en">`, Sprachknopf/`alternate` vom Generator.
  Dann `website/en/` löschen. Manifest-Sprache `en`.
- [x] **2.4 JS-Strings englisch:** Skript (einmalig, in `opensource/`):
  jedes `T("<deutsch>")`, `el(…, "<deutsch>")`, `.title = "…"`,
  `confirm("…")`, `zeigeMeldung("…")`, `.placeholder = "…"`,
  `setAttribute("aria-label", "…")` über das ALTE Wörterbuch DE→EN ersetzen;
  Literale ohne Treffer auflisten und von Hand übersetzen (ins Wörterbuch
  `i18n/de/js.json` als EN→DE nachtragen). `T()` wird generisch:
  übersetzt, wenn ein Wörterbuch geladen ist, sonst Identität.
  Datenanzeige-Helfer `MechsI18n.slot/slotIntern/reichweite/schaden` entfernen,
  Aufrufer auf `T()` umstellen.
- [x] **2.5 Datenwerte intern englisch:**
  `convert-mtf.py`: `SLOT_UEBERSETZUNG`/`slot_uebersetzen` entfernen,
  Slot-Namen wie in mm-data (nur Normalisierung: `(R)` → ` (Rear)`,
  `Ammo (…)` per `norm_munition`), Reichweitentext englisch
  (`(water only)`, `point blank`), Schaden `N/missile`; `classic-werte.json`:
  `kritSlots.standard` und `namenZuordnung` englisch, `kritKomponenten[].name`
  englisch (deutsche Namen wandern ins Sprachpaket). Beide Konverter laufen
  lassen, `EINHEITEN_CACHE` → `mechs-units-v6`. `komponenteVonName()`,
  `kanon()`, Alias-Tabelle, Heck-Erkennung (`(Rear)`), Munitionsexplosion
  (`^Ammo`) auf englische Namen umstellen. Datentexte in `rechner-*.json`,
  `as-faehigkeiten.json`, `glossar.json`, `fraktionen.json` englisch
  (Quelle: alte EN-Wörterbücher `daten-*.json`), deutsche Fassung im Paket.
- [x] **2.6 Sprachmenü:** `#sprache-btn` wird ein `<details>`/Menü aus den
  `alternate`-Links (Eigennamen aus `languages.json`, vom Generator in die
  Seite geschrieben), speichert `mechs-sprache`; bei zwei Sprachen sieht es
  aus wie heute (ein Knopf).
- [x] **2.7 Precache generieren:** `tools/build-sw.py` schreibt die
  `DATEIEN`-Liste in `sw.js` aus dem Dateibaum (alle HTML inkl. Sprachordner,
  `js/**`, `css/*`, `daten/*.json` ohne Shards, `img/*` ohne Einheiten-Icons,
  Manifeste) und zählt mit `--bump` die `VERSION` hoch. Generator ruft ihn
  am Ende auf. `check.py` bleibt die Gegenprobe.
- [x] **2.8 Migration v2** (`website/js/migrate.js`, siehe `MIGRATION-V2.md`
  §2, §4, §5): Werte-Migration für Hangar, Gefechtskopien, Import, Teil-Links.
  Fixtures nach §7.1 anlegen (Backup der Gruppe exportieren!), Tests §7.2
  vorbereiten (laufen ab Phase 4.4 in CI, jetzt manuell mit `node --test`).
- [x] **2.9 Abnahme:** Generator → 0 Lücken für `de`; `check.py` grün;
  Browser: alle Seiten DE und EN, Hangar mit migriertem v1-Backup (Slots
  englisch, Werkstatt zeigt Bauteilnamen), Gefecht mit Krits/Munition/
  Explosion, Kampagne, Druckbögen, Teil-Link alt (`?lanze=`) und neu; 375 px.
  Alte Wörterbücher `_alt-de-en/` löschen. `CLAUDE.md` Regel 6 auf die neue
  Sprachregel umschreiben. Commit `Invert i18n: English source, German language pack`.
  **Release an die Gruppe** (vorher Backup-Hinweis).
  Geprüft wurde: Hangar mit v1-Fixture (Migration meldet `migrated 1 stored
  unit(s) to data version 2`, Slots englisch gespeichert), Gefecht Classic
  (Waffenliste, Krit-Slots, Munitionsexplosion LRM 20 → 6 × 20 = 120), AS
  (Krits, Overheat, Abschaltung, Krit-Tabelle), Kampagne mit Werkstatt und
  Protokoll, beide Druckbögen, Fraktionen mit Einkaufsliste, Datenbanksuche,
  Teil-Link über die Sprachgrenze, 48 erzeugte Seiten ohne Sprachreste,
  375 px ohne Querlauf. **Offen:** Release an die Gruppe – das macht der
  Betreiber per FTP.

## Phase 3 – Bezeichner, Dateinamen, URLs ✓ erledigt 10.09.2026

**Ziel:** Code, Schlüssel und Adressen englisch; gespeicherte Daten per v3
migriert; alte URLs leiten weiter.

**Stand 10.09.2026: Phase 3 ist vollständig erledigt** (3.1 bis 3.5,
achtzehn Commits). Jeder mit Syntaxprüfung, Browser-Durchlauf in beiden
Sprachen und grünem `check.py`; am Ende ein Abnahmelauf mit einem
v1-Schnappschuss.

Die Umbenennungen selbst waren die kleinere Hälfte der Arbeit. Beim Lesen
Zeile für Zeile kamen **fünfzehn tote oder falsch rechnende Stellen** ans
Licht, fast alle aus früheren Schritten derselben Phase: eine Umbenennung
hatte die Leseseite erwischt und die Schreibseite nicht. Sie stehen bei
den Schritten, in denen sie gefunden wurden.

**Abweichungen (bewusst):**

1. **Kein globales Ersetzen mit Wortgrenzen.** Die Tabellen sind dafür zu
   kurz: `k` ist eine CSS-Klasse, `wert` eine Klasse UND ein Datenfeld mit
   anderem Ziel, `.summe()` eine Methode und `erg.summe` ein Datenfeld.
   `rename.py` kennt deshalb je Kategorie die STELLEN, an denen ein Name
   stehen darf (Selektoren, `class=`-Attribute, `getElementById`,
   Empfängerlisten je Modul), und lässt alles andere in Ruhe. Mehrdeutige
   Schlüssel stehen in `dataKeyRules.byReceiver`.
2. **Die Sprachpakete werden mitbenannt.** Ihre Schlüssel sind
   HTML-Schnipsel; eine Klasse in `<span class="…">` gehört zum Schlüssel.
3. **Inline-Skripte in HTML** spielen nach denselben Regeln wie eine
   `.js`-Datei - sonst bleibt die Bemalanleitung zurück.
4. **Schritt 4 und 5 sind zusammengefallen**: die Speicherschlüssel hängen
   an derselben Migration und wären einzeln nicht lauffähig gewesen.
5. **Tests kamen vor**: `tests/migrate.test.js` (Phase 4.4) entstand schon
   hier, weil die Migration sonst nur im Browser prüfbar wäre.
6. **Datendateien je Datei umgeschrieben**, nicht über eine Tabelle - `typ`
   und `standard` heißen je nach Datei anders. Die Einheitendateien kommen
   aus den Konvertern und werden neu erzeugt.

**Gefundene Fehler** (Einzelheiten in den Commits): der AS-Konverter war
nicht wiederholbar (zweiter Lauf schrieb 511 statt 3299 Einheiten);
Backup-Export und -Import benutzten verschiedene Schlüssel, ein
zurückgespieltes Backup verlor die Kampagnen; `feld("…")` stand nicht auf
der Liste der Stellen, an denen ein Feldname stehen darf, wodurch der
Eigenbau-Editor beim Öffnen abbrach; zehn `aria-label` der Bemalanleitung
waren noch deutsch, weil der Generator Elemente ohne eigenen Text übersprang,
statt zu ihren Kindern abzusteigen; neue Strukturen trugen `version: 1`.

- [x] **3.1 Umbenennungsskript** (`opensource/rename.py`): liest
  `rename-map.json`, wendet je Kategorie an und meldet die Trefferzahl je
  Eintrag (0 Treffer = Tabelle prüfen). Nach jeder Kategorie: `node --check`,
  Browser-Durchlauf, Commit:
  1. [x] `cssClasses` (CSS, `class=`, `el()`/`className`/`classList`/
     Selektoren; 46 fehlende Klassen nachgetragen)
  2. [x] `ids` + `ids.formFields` (+ `idPrefixes`, `dataAttributes`,
     Sprungmarken; die `f-`/`a-`-Beschriftungs-Ids leiten sich aus den
     Feldnamen ab)
  3. [x] `modules` + `modules.methods` + Options-Schlüssel (JS)
  4. [x] `dataKeys` + `zones` + `dataValues` in Datendateien, Konvertern UND
     Code – zusammen mit **Migration v3**
  5. [x] `storageKeys` (Code + Migration §1; `mechs-sprache` → `mechs-lang`
     macht `i18n.js` selbst, es läuft vor `migrate.js`)
  6. [x] lokale Bezeichner und Kommentare je Datei nach `vocabulary`.
     **Alle 20 Dateien erledigt** (10.09.2026): app, farben, wuerfel,
     faehigkeiten, regeln, silhouette, glossar, teilen, modifikatoren,
     trefferzonen, initiative, rechner, speicher, kampagne-seite, schema,
     fraktionen, as-karten, c-bogen, migrate, kampagne, i18n, as-hangar,
     c-hangar, as-datenbogen, c-datenbogen. Datei für Datei mit
     `node --check`, Browser-Durchlauf in beiden Sprachen und Commit -
     „rein kosmetisch" war es nie: in den letzten vier Dateien steckten
     acht tote Stellen aus der Umbenennung (siehe unten).

     Beim Übersetzen gefunden und behoben - alles Folgen der Umbenennungen,
     die nur beim Lesen Zeile für Zeile auffallen:
     - Der Rechner verglich die Art eines Bedienelements noch mit den
       deutschen Werten, während die Datendateien schon `toggle` und
       `counter` sagen: sechs von sechzehn Kategorien fehlten im
       Angriffsdialog (Teildeckung, Ziel gesprungen, der freie Zähler).
     - Sein Zurücksetzen-Knopf übergab `{ asOf: null }` statt
       `{ state: null }` und hieß als einziger Text noch „Zurücksetzen" -
       der Prüflauf hielt das Wort für einen Bezeichner, weil es nur aus
       Wortzeichen besteht. Die Regel nimmt einzelne großgeschriebene
       Wörter jetzt aus.
     - Der Initiative-Dialog schrieb den eigenen Wurf unter einem anderen
       Schlüssel, als er ihn las - Eintippen für die eigene Seite war seit
       der Sprachumkehr wirkungslos.
     - Options-Schlüssel werden jetzt auch hinter den Abkürzungen ersetzt
       (`MOD.chips`, `K.workshop`, `I18N.back`), nicht nur hinter dem
       vollen Modulnamen; vier Aufrufstellen hatten deutsche Schlüssel
       behalten, und der Slot-Editor speicherte den Anzeigetext.
     - Export und Import des Backups tauschten `{ neu, ersetzt }` aus -
       das letzte deutsche Feld zwischen zwei Dateien.
     - `classic-werte.json` schrieb dasselbe Bauteil zweimal anders
       („Life Support" in der Slot-Liste, „Life support" bei den
       Krit-Komponenten); beides zeigte auf dasselbe deutsche Wort, also
       konnte der Rückweg nur raten.

     In den vier großen Dateien am Ende (Hangar und Datenbogen beider
     Systeme) kam noch einmal dasselbe Muster zutage - eine Umbenennung hat
     die Leseseite erwischt und die Schreibseite nicht, oder umgekehrt.
     Nichts davon fällt beim Benutzen sofort auf, alles davon rechnet
     falsch:
     - **Der Papier-Doll war tot.** Das Polygon trägt `data-zone`, gelesen
       wurde `dataset.location`: Antippen einer Zone wählte `undefined`,
       das Zonen-Panel ging nie auf. Im Classic-Datenbogen ist das der
       einzige Weg, Schaden einzutragen.
     - **Krits ohne Krit-Tabelle** wurden als `{k: id}` abgelegt, gelesen
       wird `{component: id}`: der Treffer verschwand von der Karte,
       `critCount()` zählte null, drei Triebwerkstreffer zerstörten nichts.
     - **Die Zonenauswahl** dieses Reglers hatte übersetzte Beschriftungen
       ohne eigenen `value` - die deutsche Seite schrieb ZT/KO/RB/LB in den
       Gefechtsstand. Dasselbe in der Waffenzeile des Classic-Hangars.
     - **Fünf von zwölf GATOR-Kategorien** fehlten in der Zielzahl je Waffe:
       `zielzahlOhneReichweite()` verglich `type` noch mit `schalter` und
       `zaehler`.
     - **Die Bewegungshitze** kam nie an: gelesen wurde die
       Rechner-Kategorie `eigene-bewegung`, die längst `attacker-movement`
       heißt.
     - **Zerstörte Einheiten sahen aus wie heile:** beide Datenbögen setzten
       die Klasse `zerstoert`, das Stylesheet kennt `destroyed`. Ebenso
       `hin` statt `gone` an den System-Pips, `gestoert` statt `impaired`
       am Wertband und `abgefeuert` statt `fired` an der Waffenzeile.
     - **Die betäubte Crew** durfte im Alpha-Strike-Angriffsdialog weiter
       schießen: gefragt wurde `crits.crew`, das Feld heißt `crewStunned`.
     - **Die Werkstatt verlor Krits:** sie räumte die Liste nach Position
       und wandte die Löschungen der Reihe nach an - der erste Krit
       verschob die Liste, jeder weitere ging daneben.
     - **Der Rückweg aus dem Sprachpaket hat eine Lücke:** Namen, die ein
       Muster baut („Ammo (LRM 10)" → „Munition (LRM 10)"), stehen nicht im
       Wörterbuch, also fand `MechsI18n.back()` sie nicht und der Slot-
       Editor speicherte den deutschen Text. Damit blieb die
       Munitionsexplosion aus. Der Editor merkt sich jetzt den Quelltext
       eines unveränderten Feldes; **Migration v4** holt die schon
       gespeicherten Namen zurück (`slotName()` aus v2, jetzt auch für
       Stände, die bereits auf 3 stehen).
- [x] **3.2 Dateien und Ordner** nach `files`/`directories` umbenannt
  (10.09.2026, drei Commits): `werkzeuge-lokal/` → `tools/` samt Konvertern,
  20 Skript- und Stylesheet-Namen, `website/daten` → `website/data`,
  `daten/mechs` → `data/units`, `img/mechs` → `img/units` und die acht
  Datendateien. Mitgezogen: Skript- und Link-Tags aller 24 Seiten, alle
  `fetch`-Pfade, beide Konverter, `translate.py`, `build-sw.py`,
  `check.py`, `build.py`, `deploy.sh`, `.gitignore`, `KONZEPT.md`,
  `CLAUDE.md` und der Regelstand-Satz auf zwei Seiten (samt
  Wörterbucheintrag).

  Dabei mehr als geplant:
  - **`sw.js` ist jetzt englisch.** Er stand nicht auf der Liste der
    zwanzig Dateien aus Schritt 6, weil er nicht in `website/js/` liegt.
    `DATEIEN` → `FILES`, `EINHEITEN_CACHE` → `UNITS_CACHE` mit NEUEM Wert
    (`mechs-units-v1`) - hinter den alten Einträgen liegt kein Pfad mehr.
  - **Der Icon-Pfad steckte in 4036 Einheitendateien** und in jedem
    gespeicherten Mech: die Datendateien sind umgeschrieben,
    **Migration v5** zieht `img/mechs/…` → `img/units/…` in den
    Hangar-Beständen nach.
  - `img/mechs` → `img/units` und `daten/mechs` → `data/units` sind keine
    Übersetzung, sondern eine Korrektur: seit dem Alpha-Strike-Konverter
    liegen dort auch Fahrzeuge, Infanterie, BA und ProtoMechs.

  **Nicht hier, sondern in Phase 4:** `KONZEPT.md` → `docs/CONCEPT.md`
  (Aufgabe 4.2 legt `docs/` als Ganzes an; ein halb gefüllter Ordner
  hilft niemandem). **Nicht hier, sondern in 3.3:** `website/bemalen` →
  `website/painting` und `website/wissen` → `website/knowledge` - das
  sind URLs.
- [x] **3.3 URLs** nach `pages` umbenannt (10.09.2026): 24 Seiten, dazu die
  beiden Seitenordner `bemalen` → `painting` und `wissen` → `knowledge`.
  Das Umschreiben löst jeden `href` gegen SEINE Seite auf, schlägt das Ziel
  in der Tabelle nach und schreibt den relativen Pfad vom neuen Ort aus
  zurück - so stimmen auch Links über Ordnergrenzen und mit `#fragment`.
  Mitgezogen: die vier Seitenlinks im Code, beide Manifeste, und **31
  Wörterbucheinträge**, die HTML-Schnipsel mit Links sind (Schlüssel und
  Wert, sonst findet der Spiegel sie nicht mehr).

  Dabei gefunden: der Spiegel-Generator stellt relativen Pfaden `../`
  voran, damit sie aus `de/` heraus stimmen - und tat das auch mit
  `{{site.authority.url}}`. Die deutsche Datenschutzseite verlinkte seither
  auf `../https://…` statt auf die Aufsichtsbehörde. Ein Platzhalter ist
  kein Pfad.

- [x] **3.4 Weiterleitungs-Stubs** (10.09.2026): `tools/build-redirects.py`
  schreibt 66 Stück aus der `pages`-Tabelle, mit drei Herkünften und drei
  Zielen - deutsche Wurzel → `/de/<neu>`, alter `en/`-Spiegel → `/<neu>`,
  `de/<alt>` → `/de/<neu>`. Die Sprache bleibt also, wo sie war; Adressen
  ohne Namensänderung behalten die echte Seite. Der Stub trägt
  `<meta name="mechs-redirect">`, und Generator, Precache-Bauer und
  Prüfung erkennen ihn daran und lassen ihn aus.

  Zwei Feinheiten, ohne die Teil-Links den Umzug nicht überleben:
  - Das Skript steht **vor** dem `<meta refresh>` und gewinnt damit das
    Rennen - nur es nimmt `?query#hash` mit. Der Refresh wartet eine
    Sekunde und ist der Weg für abgeschaltetes JavaScript.
  - `i18n.js` warf Query und Fragment weg, wenn es auf die gemerkte
    Sprache umleitete (es nahm den nackten `href` des `alternate`-Links).
    Ein geteilter Link kam beim Empfänger mit anderer Sprache also im
    leeren Hangar an. Jetzt hängt es `location.search + location.hash` an.
- [x] **3.5 Tests und Abnahme** (10.09.2026): `node --test tests/` (12 Tests),
  `check.py` grün, Browser-Durchlauf mit einem vollständigen
  v1-Schnappschuss (Hangar aus der Fixture, Gefecht mit Würfen und Krits,
  Kampagne mit Protokoll, Schema, Anleitung, `mechs-sprache`).

  Ergebnis: alle sechs Speicherschlüssel umbenannt, Zonencodes, Feldnamen,
  Krit-Ids, `1/Rakete` → `1/missile`, Slot-Namen, Initiative, Kampagnen-
  Protokoll und der Icon-Pfad auf Stand 5; die deutsche Gefechtsseite
  zeigt den Stand vollständig an. Alte Deep-Links leiten um und nehmen
  `?query#hash` mit, `UNITS_CACHE` heißt so und trägt den neuen Wert, der
  Scope der PWA ist unverändert (`./`), Precache 98 Einträge plus ein
  eigener Einheiten-Cache.

  **Zwei Fehler, die genau dieser Durchlauf gefunden hat** - beide hätten
  jeden getroffen, der ein altes Gefecht offen hatte:
  - `unitV3` lief über `e.fired` als Liste. Der Datenbogen legt die Würfe
    aber als OBJEKT unter dem Waffenindex ab; die Migration warf also
    `forEach is not a function`, sobald in einem alten Gefecht einmal
    geschossen worden war. Der alte Test benutzte eine Liste und sah es
    nicht. Jetzt werden beide Formen über ihre Werte gelaufen, und ein
    Test prüft die Objektform.
  - Ein solcher Fehler riss die ganze App mit: `MechsStorage` ruft `run()`
    beim Aufbau auf, die Ausnahme kam vor `window.MechsStorage = api` an -
    danach lief auf der Seite nichts mehr. Jeder Schritt der Migration
    läuft jetzt für sich; misslingt einer, bleiben seine Daten liegen, die
    übrigen Schritte laufen weiter und die Konsole nennt den Schritt.

  Offen: **Release an die Gruppe** (Backup-Hinweis, Migration läuft beim
  ersten Start) - der Upload ist Sache des Betreibers.

## Phase 4 – Doku, CI, Tests ✓ erledigt 10.09.2026

- [x] **4.1 `README.md`** (10.09.2026): Statusbanner raus, Sprachabschnitt
  auf die Umkehr umgeschrieben, „Try it" (Pages-Demo), „Offline" (was im
  Precache liegt, was nicht, wo Gespeichertes liegt – und der eine Satz, der
  daraus folgt: ab und zu ein Backup exportieren), Doku-Tabelle, Prüfungen
  mit beiden Befehlen und dem, was CI zusätzlich prüft.
  **Offen: Screenshots** (DE und EN, Telefonbreite) nach `docs/img/`. Die
  müssen von Hand entstehen – eine Sitzung kann die App ansehen, aber kein
  PNG ins Repository schreiben. Vorschlag: Startseite, Classic-Gefecht mit
  Paper Doll, Angriffsdialog, Fraktionsbrowser.
- [x] **4.2 `docs/`** (10.09.2026): `ARCHITECTURE.md` (aus `KONZEPT.md` §3–5, englisch,
  ohne Review-Historie), `DATA.md` (Konverter, Quellen, Cache-Versionen),
  `I18N.md` (Sprachpaket anlegen in fünf Schritten, `--check`, Eigennamen),
  `RULES-SOURCES.md` (Herkunft der Regelwerte je Datei, Sekundärquellen
  markiert), `CONTRIBUTING.md` (Ablauf, Prüfungen, Sprache der Beiträge),
  `CLAUDE.md` englisch mit den harten Randbedingungen und der Sprachregel.
  `KONZEPT.md` → `docs/CONCEPT.md`; `PLAN-OPENSOURCE.md`,
  `TASKS-OPENSOURCE.md` und `MIGRATION-V2.md` nach `docs/history/`.

  Beim Schreiben fiel das letzte Deutsch auf, das sich in Daten und
  Werkzeugen versteckt hatte: die `_note`-Felder aller sieben kuratierten
  Datendateien beschrieben ihr Schema auf Deutsch UND mit den alten
  Schlüsselnamen; die Glossar-Kategorien trugen deutsche Ids bei englischen
  Beschriftungen; die Dateien eines Sprachpakets hießen `daten-*` /
  `seiten-*` / `gemeinsam`. Alles englisch, und `docs/I18N.md` beschreibt
  jetzt die Namen, die jemand beim Anlegen eines Pakets vorfindet.

  **Erledigt am 10.09.2026:** `docs/CONCEPT.md` ist übersetzt (Prosa
  englisch, Datei- und Bezeichnernamen auf den heutigen Stand gezogen,
  datierte Einträge unverändert). Ein Kasten am Kopf sagt, dass es ein
  historisches Entwurfsdokument ist und `ARCHITECTURE.md` den Code beschreibt.
  **Erledigt am 10.09.2026:** §10-Fahrplan als Issues #1–#9 angelegt (Label
  `roadmap`), dazu #10 als Aufruf für ein spanisches Sprachpaket (Label
  `i18n`). Neue Labels: `roadmap`, `rules`, `i18n`. Beim Durchgehen bestätigt:
  Piloting-Referenz und Cluster-Tabelle sind in den Regelseiten gebaut, die
  Waffen-Schnellreferenz (§3.2) und der Sturzschaden-Rechner fehlen wirklich.
- [x] **4.3 GitHub Actions** (10.09.2026): `.github/workflows/check.yml` (auf push/PR:
  `python3 tools/opensource/check.py`, `node --test tests/`),
  `.github/workflows/pages.yml` (deploy `website/` nach GitHub Pages; ohne
  Overlay = neutrale Marke, Startsprache `en`). Issue-Vorlagen: Fehler,
  Regelabweichung (mit Feld „Quelle/Seite im Buch“), Sprachpaket.
- [x] **4.4 Tests** (10.09.2026): 60 Tests in fünf Dateien.
  **Abweichung:** kein Export-Schalter im Produktionscode. `tests/helpers.js`
  lädt ein Browsermodul in einer `vm` mit einem Fenster aus einfachen
  Objekten – dieselbe Oberfläche, die der Browser bietet, nur so viel davon
  wie die reinen Funktionen brauchen. Der Produktionscode bleibt unberührt.

  Zwei Umbauten, die der Code ohnehin wollte:
  - Die GATOR/SATOR-Summe gab es **zweimal** (Closure im Rechner, Kopie im
    Classic-Datenbogen) – genau dort saß der `toggle`/`counter`-Fehler. Der
    reine Teil ist jetzt die API des Rechners (`toHit`, `defaultState`,
    `chance`), der Datenbogen ruft sie auf.
  - Reichweitenbänder, Cluster-Treffer und Schaden je Schuss sind aus dem
    1500-Zeilen-Modul in `js/weapon-math.js` gewandert.

  Abgedeckt: Zielzahl gegen die echten Konfigurationen (inklusive „keine
  Kategorie darf durchrutschen"), die 2W6-Tabelle über alle 36 Würfe
  ausgezählt, Cluster-Tabelle (jede Zeile monoton, nie mehr als das Rack) und
  die Hochrechnung einer nicht gelisteten Rackgröße, Mindestreichweite,
  Trefferverteilung, `readState`/`applyState` beider Systeme samt dem, was
  NICHT mitwandern darf, `carryOver` mit Protokoll, getrennte Kampagnen,
  `T()`, Musterrangfolge, `back()` und der Beweis, dass es ein Muster nicht
  umkehren kann, sowie alle Migrationen.
- [x] **4.5 Commits** (10.09.2026): fünf statt einem, je Aufgabe einer –
  `4.2 docs/`, `4.4 tests`, `4.3 CI`, `4.1 README`, plus dieser Eintrag.

## Phase 5 – Veröffentlichen

- [x] **5.1 Letzte Prüfung** (10.09.2026): `check.py` grün (9 Muster, keine
  Treffer), `node --test` 60/60, Build läuft, Übersetzung ohne Lücken.

  **Historie neu geschrieben.** Entscheidung des Betreibers: ein frischer
  Initial-Commit statt eines Filters über 43 Commits. Vorher liegt die
  vollständige alte Historie als `git bundle` in
  `site/history-backup/` (gitignored, 24 MB, `git bundle verify` sagt
  „records a complete history"); danach Reflog abgelaufen und `git gc
  --prune=now`, die alten Objekte sind aus diesem Klon verschwunden.
  `git log -p --all` findet jetzt nur noch, was bewusst dasteht: den
  Autor der Commits und die Copyright-Zeile in `LICENSE`.

  Dabei gefunden: `LICENSE-DATA.md` nannte in der Attributionszeile eine
  **geratene** GitHub-Adresse. Jetzt ohne Adresse, mit dem Hinweis, auf
  das Repository zu verlinken, aus dem die Kopie stammt.

  **Zu entscheiden vor dem Push:** die Commit-Identität ist
  `HerrBarmann <dbormann92@gmail.com>` - wer die Mail-Adresse nicht
  öffentlich haben will, stellt GitHubs `@users.noreply.github.com` ein
  und schreibt den einen Commit mit `git commit --amend --reset-author`
  neu.
- [x] **5.2 Repo öffentlich** (10.09.2026): `HerrBarmann/mech-companion`,
  Beschreibung, Topics (`battletech`, `alpha-strike`, `pwa`, `tabletop`,
  `offline-first`, `vanilla-js`, `wargaming`), Homepage auf die Demo,
  GitHub Pages über Actions aktiv:
  <https://herrbarmann.github.io/mech-companion/>. Commit-Identität auf
  `83811409+HerrBarmann@users.noreply.github.com` umgestellt, `CLAUDE.md`
  und `.claude/` aus dem Commit genommen und gitignored.

  **Lizenz doch geändert** (Nutzerwunsch am 10.09., s. Nachtrag oben): das
  ganze Repo steht unter CC BY-NC-SA 4.0, `LICENSE` trägt nur Copyright-Zeile
  und Legalcode, `NOTICE.md` die Kurzfassung. Jede Fußzeile nennt „Mech
  Companion by Dennis Bormann · CC BY-NC-SA 4.0". GitHub zeigt die Lizenz als
  „Other" – dessen Erkennung kennt nur 13 Lizenzen und keine CC-NC-Variante,
  daran ist nichts zu machen.

  **In der CI gefunden:** `node --test 'tests/*.test.js'` mit Anführungszeichen
  braucht Nodes eigenes Glob (ab Node 21); der Runner hatte Node 20. Ohne
  Anführungszeichen expandiert die Shell und es läuft überall. Runner jetzt
  Node 22. Der erste Pages-Lauf schlug fehl, weil Pages noch nicht aktiviert
  war – `configure-pages` legt die Site nicht selbst an.
- [x] **5.3 Release `v1.0.0`** (10.09.2026): `CHANGELOG.md` mit der
  Kurzfassung der Phasen 1–4, der Migrationstabelle (v2 Werte, v3 Schlüssel,
  v4 Slot-Namen, v5 Icon-Pfade) und dem Hinweis „Backup exportieren, dann
  aktualisieren“. Tag `v1.0.0` und GitHub-Release daraus.
- [ ] **5.4 Live-Deploy:** `build.py` → `dist/` → FTP (Betreiber). Gruppe
  informieren.
