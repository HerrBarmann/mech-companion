# Migration gespeicherter Daten (v1 → v2 → v3)

Gilt für alles, was im Browser der Spieler liegt: `localStorage`, die
Foto-Datenbank (IndexedDB), Backup-Dateien und Teil-Links. Die Umstellung auf
Englisch kommt in **zwei Stufen**, weil Phase 2 (Datenwerte) und Phase 3
(Schlüssel) getrennt ausgeliefert werden:

| Stufe | Phase | Was ändert sich | Versionsfeld danach |
|---|---|---|---|
| **v2** | 2 (i18n-Inversion) | nur **Werte**: Slot-Namen, Reichweiten-/Schadenstexte, Techbase | `version: 2` |
| **v3** | 3 (Bezeichner) | **Schlüssel** von Objekten, Zonen, Speicherschlüssel, Kategorie-IDs | `version: 3` |

Modul: `website/js/migrate.js` (`window.MechsMigrate`), geladen direkt nach
`storage.js` auf jeder Seite, die Zustand liest. `MechsStorage.load()` und
`loadHangar()` rufen `MechsMigrate.run()` einmal je Seitenaufruf; danach
lesen alle Skripte nur noch das aktuelle Format. Jede Stufe ist idempotent
(prüft das Versionsfeld) und läuft in Reihenfolge v2, dann v3.

---

## 1. Speicherschlüssel (v3)

Präfix `mechs-` bleibt. Alte Schlüssel werden gelesen, unter dem neuen
Schlüssel gespeichert, dann gelöscht.

| alt | neu |
|---|---|
| `mechs-hangar-classic`, `mechs-hangar-alpha-strike` | unverändert |
| `mechs-gefecht-<system>` | `mechs-battle-<system>` |
| `mechs-kampagnen-<system>` | `mechs-campaigns-<system>` |
| `mechs-schemata` | `mechs-schemes` |
| `mechs-anleitung` | `mechs-guide` |
| `mechs-sprache` (Werte `de`/`en`) | `mechs-lang` (Werte unverändert) |
| `mechs-theme`, `mechs-backup-<system>` | unverändert |

**IndexedDB (Fotos):** Datenbank- und Store-Name bleiben, wie sie in
`speicher.js` stehen. Nur die JS-Bezeichner werden englisch. Eine binäre
Migration bringt Risiko ohne Nutzen – der Name ist nirgends sichtbar.

---

## 2. Werte (v2) – gilt für Hangar-Mechs, ihre Kopien im Gefecht und in Kampagnen

Quelle der Tabellen: `rename-map.json` → `dataValues`.

- **Krit-Slot-Namen** in `kritSlots[zone][i]`: `slotNames` (exakte Treffer)
  und `slotPatterns` („Munition (LRM 20)“ → „Ammo (LRM 20)“, „ (Heck)“ →
  „ (Rear)“). Unbekannte Namen (Waffen, Ausrüstung) bleiben – sie sind schon
  englisch.
- **Waffen** (`waffen[i]`): `reichweite` und `schaden` per `weaponStrings`
  („1/Rakete“ → „1/missile“, „(nur Wasser)“ → „(water only)“, „Nahbereich“ →
  „point blank“).
- **Techbase** `Mix` → `Mixed`.
- `version` 1 → 2 am Mech; Hangar-Container `version` 1 → 2.
- Gefechtsstände und Kampagnen: dieselbe Wert-Migration auf jede `kopie`
  (Gefecht) – Kampagnen-Zustände enthalten keine Namen, nur Indizes.

Prüfung nach v2: `komponenteVonName()` erkennt alle Slots jedes gespeicherten
Mechs (kein Slot fällt auf „unbekannt“ zurück), Munitionsexplosion findet die
Waffe zum Slot, Heckwaffen werden erkannt.

---

## 3. Schlüssel (v3)

Quelle: `rename-map.json` → `dataKeys`, `zones`.

### 3.1 Hangar-Mech Classic
`notizen→notes`, `bewegung{gehen,springen}→movement{walk,jump}`,
`waermetauscher{anzahl,doppelt}→heatSinks{count,double}`,
`panzerung→armor`, `struktur→structure`, `waffen→weapons`,
`kritSlots→critSlots`, `modifikatoren[].wert→modifiers[].value`,
`quelleId→sourceId`, `typ→type`, `techbase→techBase`, `rolle→role`,
`quelle→source`, `bewegungsart→moveType`.
Zonenschlüssel in `armor`, `structure`, `critSlots`: `zones`-Tabelle
(`kopf→head`, `zt→ct`, `zth→ctr`, `rth→rtr`, `lth→ltr`, `rb→rl`, `lb→ll`).
Waffen: `zone→location` und Wert nach `weaponLocationCodes`
(`KO→HD`, `ZT→CT`, `RB→RL`, `LB→LL`); `schaden→damage`, `hitze→heat`,
`reichweite→range`, `munition→ammo`.

### 3.2 Hangar-Mech Alpha Strike
`panzerung→armor`, `struktur→structure`, `notizen→notes`, `typ→type`,
`modifikatoren[].wert→modifiers[].value`, `quelleId→sourceId`.

### 3.3 Gefechtsstand Classic (`mechs-battle-classic`)
Container: `einheiten→units`, `runde→round`, `rundenLimit→roundLimit`,
`initiative{runde,wir,gegner,wirN,gegnerN}→{round,us,enemy,usCount,enemyCount}`.
Einheit: `kopie→copy` (Inhalt wie 3.1 migrieren), `pSchaden→armorDamage`,
`sSchaden→structureDamage` (Zonenschlüssel!), `hitze→heat`,
`munition→ammoUsed`, `waffenHin→weaponsOut`, `pilotTreffer→pilotHits`,
`zerstoert→destroyed`, `notiz→note`, `krits[].k→crits[].component`
(Werte per `critComponentIds`), `slotKrits→slotCrits` (Zonenschlüssel!),
`abgefeuert→fired` (Einträge: `summe→total`, `treffer→hit`,
`cluster{wurf,n,groesse}→{roll,hits,size}`, `zonen→locations`, je Eintrag
`zone→location` mit Zonenwert, `heck→rear`, `krit→crit`, `dmg→damage`),
`hitzeRunde{waffen,bewegung}→roundHeat{weapons,movement}`,
`entfernung→distance`, `angriff→attack` (Schlüssel = Kategorie-IDs, per
`calculatorCategoryIds`), `modAktiv→activeMods`.

### 3.4 Gefechtsstand Alpha Strike
`dPanzer→armorDamage`, `dStruktur→structureDamage`, `hitze→heat`,
`ovAngesagt→ovDeclared`, `hitzeExtern→externalHeat`,
`krits{tw,fc,waffe,mp,mpN,crew,motive}→crits{engine,fireControl,weapon,mpHalved,mpHits,crewStunned,motive}`,
`motiveWurf{a,b,mod,stufe}→motiveRoll{a,b,mod,level}`, `zerstoert→destroyed`,
`angriff→attack` (Kategorie-IDs), `modAktiv→activeMods`, `kopie→copy` (3.2).

### 3.5 Kampagnen (`mechs-campaigns-<system>`)
`aktiv→active`, `kampagnen→campaigns`, je Kampagne `angelegt→created`,
`zustaende→states` (jeder Zustand: Felder wie 3.3/3.4 ohne `kopie`, plus
`stand→asOf`), `protokoll→log` (`datum→date`, `runden→rounds`,
`notiz→note`, `einheiten→units`, je Einheit `zerstoert→destroyed`,
`kurz→summary`).

### 3.6 Farbschemata (`mechs-schemes`), Anleitung (`mechs-guide`)
Schemata: `liste→list`, je Eintrag `basis→base`, `akzent→accent`.
Anleitung: Struktur beim Umsetzen aus `bemalen/anleitung.html` ablesen
(Inline-Skript) und hier nachtragen.

### 3.7 Kampagne: Kurztexte im Protokoll
`kurz`/`summary` ist gespeicherter Anzeigetext in der Sprache, in der das
Gefecht beendet wurde. Bleibt so (kein Umbau nötig, war schon bei der
Würfelspeicherung die bewusste Ausnahme: kurzlebig, sprachgebunden).

---

## 4. Backup-Dateien (Export/Import)

Paket: `typ→type` (Wert `mechs-hangar` bleibt, damit alte Dateien erkannt
werden), `exportiert→exported`, `kampagnen→campaigns`, `version: 3`.
Import: `version` fehlt oder < 3 → jede Einheit und das Kampagnenobjekt
durch v2 und v3 schicken, dann speichern. Fotos (`foto→photo`) unverändert
als Data-URL.

## 5. Teil-Links

- `?mech=<b64url JSON>`: Objekt beim Import migrieren (v2, v3).
- `?lanze=` → `?lance=`; der Empfänger akzeptiert beide Parameter noch.
  Einträge `{q,n,g,p,s}` bleiben.
- Farbschema `?name=&basis=&trim=&akzent=` → `?name=&base=&trim=&accent=`;
  alte Parameter werden weiter angenommen.

## 6. Reihenfolge und Auslieferung

- v2 wird **mit** der i18n-Inversion ausgeliefert (gleicher Service-Worker-
  Stand), sonst zeigen englische Seiten deutsche Slot-Namen und
  `komponenteVonName()` findet nichts mehr.
- v3 wird **mit** den Bezeichner-Umbenennungen ausgeliefert. Nie eine
  Schlüssel-Umbenennung im Code ohne den passenden Migrationsschritt.
- Vor jedem der beiden Releases: Hinweis an die Gruppe, Backup exportieren.

## 7. Testplan

1. **Fixtures**: vor Phase 2 je System ein Backup exportieren und als
   `tools/opensource/fixtures/hangar-v1-classic.json` und
   `hangar-v1-alpha-strike.json` ablegen; dazu je einen
   `localStorage`-Schnappschuss (`JSON.stringify(localStorage)`) mit
   laufendem Gefecht und zwei Kampagnen als `state-v1-<system>.json`.
2. **node:test** (`tests/migrate.test.js`): Fixtures durch `migrate` schicken →
   Versionsfeld stimmt, keine deutschen Schlüssel/Werte mehr (Regex-Liste
   aus `rename-map.json`), zweiter Lauf ändert nichts (Idempotenz), Summen
   bleiben gleich (Panzerung, Struktur, Anzahl Krits, Protokolleinträge).
3. **Browser**: Schnappschuss in `localStorage` laden, jede Seite öffnen,
   Konsole leer; Hangar zeigt alle Mechs mit englischen Slot-Namen; Gefecht
   läuft weiter (Krits, Waffenliste, Munition, Kampagnen-Badges);
   Werkstatt listet Slots mit Bauteilnamen; Backup-Import einer v1-Datei
   ergibt denselben Stand wie die Migration.
