# Plan: Open Source auf GitHub, Englisch als Basis

Stand: 09.09.2026. Ziel: das Projekt als Open-Source-Software veröffentlichen,
mit **Englisch als Sprache der Codebasis und der Quelltexte** und **Deutsch als
erstem Sprachpaket** – so, dass weitere Sprachpakete nur noch eine
Wörterbuchdatei sind. Die Live-Instanz die Live-Instanz läuft danach
weiter auf Deutsch, aus demselben Repository.

---

## 0. Ausgangslage in Zahlen

| Was | Stand |
|---|---|
| Versionskontrolle | **kein Git-Repo**, `.gitignore` mit zwei Zeilen |
| Seiten | 24 deutsche Quellseiten, 24 generierte englische Spiegel (`website/en/`) |
| Code | 25 JS-Dateien (8 380 Zeilen), 5 CSS, 217 Funktionsnamen – fast alle deutsch |
| Übersetzung | 1 861 Wörterbucheinträge DE→EN, 291 `T("…")`-Aufrufe, 0 offene Lücken |
| Daten | 9 Regel-/Datendateien, 7 364 Einheiten-Shards (29 MB), 4 793 Icons (22 MB), `website/` gesamt 53 MB |
| Intern deutsche Werte | Krit-Slot-Namen („Triebwerk“, „Munition (LRM 20)“), Reichweiten-/Schadenstexte („1/Rakete“, „(nur Wasser)“), JSON-Schlüssel (`panzerung`, `waermetauscher`, `bewegung.gehen` …), Speicherschlüssel (`mechs-gefecht-…`, `mechs-sprache`) |
| Personenbezogen | Impressum/Datenschutz (DE + EN) mit echten Betreiberdaten; Domain 29× im Code |
| Nur lokal | `mm-data/` (130 MB), `mekbay-units.json` (27 MB), `mekbay-equipment.json` (4 MB), `.env` |

Was das bedeutet: Die Übersetzung ist technisch schon vollständig, sie zeigt nur
in die falsche Richtung. Die eigentliche Arbeit steckt in den **Bezeichnern**
(Code, Schlüssel, Dateinamen) und in der **Migration gespeicherter Daten**,
weil die Hangars der Gruppe deutsche Schlüssel und Werte enthalten.

---

## 1. Grundsatzentscheidungen

> **Nachtrag vom 10.09.2026 – Lizenz geändert.** Kurz vor der
> Veröffentlichung wurde die dreiteilige Lösung fallengelassen: das ganze
> Repository steht jetzt unter **CC BY-NC-SA 4.0**, Code eingeschlossen, mit
> „Mech Companion von Dennis Bormann“ in der Fußzeile jeder Seite. Begründung:
> MIT für den Code hätte eine kommerzielle Nutzung versprochen, die die Daten
> (MegaMek/MekBay, CC BY-NC-SA) und die Regelzusammenfassungen ohnehin nicht
> hergeben. Eine Lizenz statt zwei sagt das ehrlich. Der Absatz darunter ist
> der Stand vom 09.09.2026 und bleibt zur Nachvollziehbarkeit stehen.

**Entschieden am 09.09.2026:** Code **MIT** (mit Namensnennung im
Copyright-Vermerk, siehe `LICENSE`), Daten und Inhalte **CC BY-NC-SA 4.0**
(`LICENSE-DATA.md`), Repository **`mech-companion`**, **URLs englisch** mit
Weiterleitungs-Stubs, **generierte Daten ins Repo**, alles Personalisierte
(Impressum, Datenschutz, Design, Marke) bleibt privat in `site/` und wird
per `build.py` in `dist/` eingesetzt – das Repo ist neutral. Damit ändert
sich das Upload-Artefakt: `dist/` statt `website/`. Die Abarbeitung steht
in `TASKS-OPENSOURCE.md`. Die ursprünglichen Fragen zur Nachvollziehbarkeit:


1. **Lizenzmodell, dreiteilig**
   - Code (`website/js`, `website/css`, `tools/`): Vorschlag **MIT**. Wir nutzen
     keinen MegaMek-*Code*, nur Daten – also frei wählbar.
   - Abgeleitete Daten (`website/data/mechs/*`, Indizes, `img/mechs/*`):
     zwingend **CC BY-NC-SA 4.0** (Bedingung der Quelle mm-data/MekBay).
   - Eigene Inhalte (Regelzusammenfassungen, Bemalhandbuch, Fraktionsfarben,
     Glossar): Vorschlag ebenfalls **CC BY-NC-SA 4.0**, dann gilt für alles
     unter `data/` und für die Texte dieselbe Regel. Regelzusammenfassungen
     bleiben als „Fan-Inhalt, keine offiziellen Regeln“ gekennzeichnet.
2. **Repository-Name**: kein „BattleTech“ im Namen (Marke). Vorschläge:
   `mech-companion`, `lance-companion`, `mechs`.
3. **Was wird öffentlich?**
   - Ja: `website/`, `tools/` (heute `tools/`), Doku, Design-System
     des Projekts (`design-system-mechs/`), Deploy-Skript.
   - Nein: `inhalte/` (veraltete Quell-HTMLs), das Design-System, aus dem
     dieses abgeleitet ist (privat, anderes Projekt), `LOGO-PROMPT.md`,
     Rohdaten, `.env`, Betreiberdaten.
   - `CLAUDE.md` und `KONZEPT.md`: auf Englisch neu fassen und behalten
     (siehe Phase 4) – nichts darin ist geheim, beides hilft Mitwirkenden.
4. **Generierte Daten ins Repo?** Vorschlag **ja** (≈ 51 MB). Statisches
   Hosting ist das Kernversprechen; GitHub Pages funktioniert dann ohne
   Build-Schritt, und die Weitergabe unter CC BY-NC-SA ist erlaubt. Git LFS
   scheidet aus (Pages liefert LFS-Dateien nicht aus). Die Konverter bleiben
   im Repo, damit jeder die Daten selbst neu erzeugen kann.
5. **URLs umbenennen?** (`gefecht.html` → `battle.html`, `bemalen/` →
   `painting/` …) Vorschlag **ja, einmalig**, mit kleinen Weiterleitungs-Stubs
   unter den alten deutschen Pfaden für eine Übergangszeit – die Gruppe hat
   installierte PWAs und Lesezeichen.
6. **Standardsprache der Live-Instanz**: Deutsch. Technisch: Wurzel = Englisch,
   `de/` = generiert; eine Konfiguration (`site.json`) legt die Startsprache
   fest, die `i18n.js` ohne gespeicherte Wahl anspringt. Die GitHub-Pages-Demo
   startet englisch.

---

## 2. Zielarchitektur der Mehrsprachigkeit

**Prinzip bleibt, Richtung dreht sich.** Vorher: deutsche Quelle, englischer
Spiegel per `uebersetzen.py`. Seit Phase 2: englische Quelle in `website/`, je
Sprache ein generierter Spiegel `website/<lang>/` plus `js/i18n-<lang>.js`.

- **Sprachpaket** = Ordner `i18n/<lang>/` mit denselben Dateikategorien wie
  heute (Seiten, JS-Strings, Datentexte, Eigennamen) und einer
  `languages.json` (Code, Name, Eigenname, Schreibrichtung). Ein neues Paket
  anlegen heißt: Ordner kopieren, übersetzen, Generator laufen lassen. Der
  Generator meldet fehlende Schlüssel je Paket (`translate.py --check`).
- **Schlüssel = englischer Quelltext** (gettext-Stil), wie heute mit deutschem
  Quelltext. Deshalb lassen sich die 1 861 vorhandenen Paare **mechanisch
  invertieren** – die deutsche Übersetzung entsteht ohne neue
  Übersetzungsarbeit. Kollisionen (mehrere deutsche Schlüssel mit demselben
  englischen Text) meldet das Invertierungsskript; erwartet werden wenige.
- **Datenwerte intern englisch.** Krit-Slots („Engine“, „Ammo (LRM 20)“),
  Reichweiten („min 6 · 7/14/21 (water only)“), Schaden („1/missile“).
  Die Konverter erzeugen dann englisch (mm-data *ist* englisch – die heutige
  Übersetzung ins Deutsche im Konverter entfällt, das vereinfacht ihn). Die
  Sonderfunktionen `MechsI18n.slot/slotIntern/reichweite/schaden` verschwinden;
  Anzeige läuft überall über `T()`.
- **Sprachwahl**: statt des DE/EN-Knopfs ein Menü aus `languages.json`;
  `<link rel="alternate" hreflang>` für alle Sprachen; Manifest je Sprache
  (Name, `lang`) vom Generator erzeugt.
- **Service-Worker-Precache wird generiert** (Dateiliste aus dem Dateibaum
  beim Build) statt von Hand gepflegt – neue Sprachen und Seiten landen
  automatisch darin, die Prüfskripte von heute werden Teil des Builds.
- **Glossar** ist ein Sonderfall: es ist selbst zweisprachig (Begriff
  Deutsch ↔ Englisch). Es bleibt als Datendatei mit Spalte je Sprache; weitere
  Sprachen ergänzen eine Spalte.

---

## 3. Umstellung des Codes auf Englisch

- **Bezeichner**: Funktions- und Variablennamen, CSS-Klassen (`.blatt`,
  `.kaestchen`, `.werkstatt-dialog` …), HTML-IDs (`#auswahl-liste`,
  `#ende-btn` …), JSON-Schlüssel der Datendateien und Hangar-Objekte,
  `localStorage`-Schlüssel, Dateinamen (`c-datenbogen.js` →
  `classic-battle.js`, `kampagne.js` → `campaign.js`), Ordner (`werkzeuge-lokal` → `tools`, `daten` → `data`,
  `bemalen` → `painting`, `wissen` → `knowledge`).
- **Vorgehen**: eine Umbenennungstabelle als Datei (alt → neu, je Kategorie),
  ein Skript wendet sie mit Wortgrenzen an; nach jeder Kategorie Syntaxprüfung
  und der bekannte Browser-Durchlauf. Keine Umstellung in einem Rutsch.
- **Gespeicherte Daten**: Hangar-Objekte tragen deutsche Schlüssel
  (`panzerung`, `struktur`, `waffen`, `kritSlots`, `waermetauscher` …) und
  deutsche Werte (Slot-Namen). Eine **Migration v1 → v2** beim Laden mappt
  Schlüssel und Werte, idempotent und versioniert (Versionsfeld existiert
  bereits in jeder Struktur). Der Backup-Import migriert alte Dateien
  ebenfalls. Betroffen: Hangar (beide Systeme), Gefechtsstände, Kampagnen,
  Farbschemata.
- **Waffen-/Slot-Abgleich** (`kanon()`, Alias-Tabelle, Munitionsexplosion,
  „Heck“-Erkennung) arbeitet teils auf deutschen Namen – nach der Umstellung
  gezielt nachtesten.
- **Kommentare**: deutsch → englisch, Datei für Datei beim Umbenennen,
  werkzeuggestützt übersetzt und dann gelesen.
- **Inhaltsdaten** (`as-faehigkeiten.json`, `fraktionen.json`, Glossar):
  Texte werden englische Quelle mit deutschem Paket – die vorhandenen
  Wörterbücher `daten-*.json` werden invertiert wie die Seiten.

---

## 4. Repository, Datenschutz, Doku, Community

- **Repo anlegen**: `git init`, `.gitignore` (`.env`, `.DS_Store`, `mm-data/`,
  `mekbay-*.json`, `site.json`, persönliche `.claude/`-Einstellungen;
  `.claude/launch.json` bleibt, es hilft Mitwirkenden). Frischer Start ohne
  Historie – es gibt keine, also auch nichts zu bereinigen. **Erster Commit
  erst nach dem Entfernen der Betreiberdaten.** Zuerst privat, öffentlich nach
  Phase 4.
- **Betreiberdaten raus**: Impressum, Datenschutz, Domain, Markenname des
  Betreibers (29 Stellen) werden Platzhalter; `tools/build.py` füllt sie beim
  Deploy aus einer nicht committeten `site.json` (Name, Domain, Betreiber,
  Startsprache). Die Live-Instanz bleibt vollständig, das Repo ist neutral.
- **Lizenzdateien**: `LICENSE` (MIT), `LICENSE-DATA.md` (CC BY-NC-SA mit
  Attribution MegaMek/MekBay), `THIRD-PARTY.md` (qrcode-generator MIT).
  Markenhinweis (Topps/Catalyst) im README und in jeder Fußzeile.
- **Doku auf Englisch**: `README.md` (Was, Screenshots, Live-Demo, Offline,
  lokal starten mit `python3 -m http.server`, Datenpipeline, Lizenzen,
  Sprachen), `docs/ARCHITECTURE.md` (aus KONZEPT §3–5), `docs/DATA.md`
  (Konverter, Quellen, Cache-Versionen), `docs/I18N.md` (Sprachpaket anlegen),
  `docs/RULES-SOURCES.md` (welche Regelwerte woher stammen, Hinweis „gegen das
  eigene Buch prüfen“), `CONTRIBUTING.md`. Die Fahrplan-Punkte aus KONZEPT §10
  werden GitHub-Issues mit Meilensteinen. `CLAUDE.md` wird englisch und an die
  neue Sprachregel angepasst.
- **GitHub Actions**: `check.yml` (JSON gültig, Precache vollständig,
  `translate.py --check` ohne Lücken, `node --check` für alle Skripte,
  Grep auf Betreiberdaten/Secrets); `pages.yml` (GitHub Pages aus `website/`,
  englische Startsprache). Issue-Vorlagen: Fehler, Regelabweichung,
  Sprachpaket.
- **Tests**: bisher keine automatisierten. Kernlogik wird mit `node:test`
  (ohne Abhängigkeiten) testbar gemacht: Zielzahl-Rechner, Cluster-Tabelle,
  Kampagnenspeicher inkl. Migration, Modifikatoren, Wörterbuch-Invertierung.
  Dafür bekommen die Module einen kleinen Export-Schalter für Node; im
  Browser ändert sich nichts. Browser-Smoke-Tests bleiben manuell (die
  vorhandene Routine), Playwright später optional.

---

## 5. Phasen, Reihenfolge, Aufwand

| Phase | Inhalt | Aufwand | Ergebnis |
|---|---|---|---|
| **0 Entscheidungen** | Abschnitt 1 beantworten | ½ Tag (Betreiber) | Klarheit über Lizenzen, Name, URLs, Daten |
| **1 Repo & Datenschutz** | `git init`, `.gitignore`, `site.json` + Vorlagen, Lizenzdateien, README-Skelett, privates GitHub-Repo, erster Commit | 1 Tag | Versionierung und Backup ab sofort; Repo ist neutral |
| **2 i18n-Inversion** | Wörterbücher invertieren (Skript, Kollisionsbericht) → `website/en/` wird Wurzel, Generator erzeugt `de/` → JS-Strings `T("deutsch")` → `T("english")` per Skript → Datenwerte intern englisch (Konverter, DB neu erzeugen, `EINHEITEN_CACHE` hoch) → Migration v1→v2 → Sprachmenü, `languages.json`, generierter Precache, Manifest je Sprache → voller Browser-Durchlauf DE + EN, Migration eines echten Backups | 2–3 Tage | Englische Quelle, Deutsch als Paket, lauffähig |
| **3 Bezeichner & Dateinamen** | Umbenennungstabelle → JS/CSS/IDs → JSON-Schlüssel mit Speicher-Migration → Dateinamen, Ordner, URLs mit Weiterleitungs-Stubs → Kommentare → Tests nach jeder Kategorie | 2–3 Tage | Code, den Fremde lesen können |
| **4 Doku, CI, Tests** | README, `docs/`, Workflows, `node:test`, GitHub Pages, Issue-Vorlagen, Roadmap → Issues | 1–2 Tage | Beitragsfähiges Projekt |
| **5 Veröffentlichen** | Grep auf Betreiberdaten/Secrets, Lizenzköpfe, Repo public, Release v1.0.0 mit Changelog und Migrationshinweis, Live-Deploy mit `site.json`, Gruppe informieren (vorher Backup exportieren) | ½ Tag | Öffentlich, Live-Instanz umgestellt |

Gesamt etwa **7–10 Arbeitstage**. Jede Phase endet lauffähig, kein Big Bang.

**Zeitliche Einordnung zum Core Rulebook (16.09.):** Phase 1 sofort. Phase 2
möglichst vor der Regelrevision – dann werden die Regeltexte einmal (englisch)
revidiert und das deutsche Paket zieht nach. Falls die Regelrevision drängt,
ist auch die umgekehrte Reihenfolge unschädlich: die Invertierung ist
mechanisch, solange das Wörterbuch vollständig bleibt (heute: 0 Lücken).
Phase 3 berührt keine Regelinhalte und kann davor oder danach laufen.

---

## 6. Risiken und Gegenmittel

| Risiko | Gegenmittel |
|---|---|
| Migration der Hangars (deutsche Schlüssel und Werte im `localStorage`) | Backup-Export vor dem Update, Migration idempotent und versioniert, Import alter Backups unterstützt, Test mit dem echten Hangar der Gruppe |
| Kollisionen beim Invertieren des Wörterbuchs | Skript listet sie, manuelle Entscheidung, Zahl voraussichtlich klein |
| Waffen-/Slot-Abgleich auf deutschen Namen | gezielte Nachtests: Slot↔Waffe, Munitionsexplosion, Heckwaffen |
| URL-Umbenennung bricht Links | SW-Scope und Startseite bleiben; alte Pfade bekommen Weiterleitungs-Stubs |
| Umfang der Umbenennung | Tabelle + Skript, kategorienweise, nach jeder Kategorie Syntax- und Browserprüfung |
| Rechtliches | Markenhinweis überall, keine Fluff-Artworks aus mm-data (schon beachtet), CC BY-NC-SA korrekt attribuiert, keine Betreiberdaten im Repo |

---

## 7. Was sich nicht ändert

Vanilla-Stack ohne Framework, statisches `website/`, Offline-PWA, die
Datenpipeline aus mm-data und MekBay, Deployment per FTP durch den Betreiber,
Deutsch als Standard der Live-Instanz, unsere Arbeitssprache. Commit-Messages
und Code werden englisch.
