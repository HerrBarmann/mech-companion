/* Migration gespeicherter Daten (docs/history/MIGRATION-V2.md §7).

   Läuft mit `node --test tests/`. website/js/migrate.js ist ein Browser-Skript
   ohne Modulsystem; hier bekommt es ein Fenster und einen Speicher aus
   einfachen Objekten - dieselbe Oberfläche, die MechsStorage bietet. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const WURZEL = path.join(__dirname, "..");

function ladeMigrate() {
    const quelle = fs.readFileSync(path.join(WURZEL, "website/js/migrate.js"), "utf8");
    const fenster = {};
    vm.runInNewContext(quelle, { window: fenster });
    return fenster.MechsMigrate;
}

/* Speicher wie MechsStorage, aber im Arbeitsspeicher. */
function speicher(anfang) {
    const daten = JSON.parse(JSON.stringify(anfang || {}));
    return {
        daten,
        load: (k, ersatz) => (k in daten ? JSON.parse(JSON.stringify(daten[k])) : ersatz),
        save: (k, v) => { daten[k] = JSON.parse(JSON.stringify(v)); return true; },
        remove: (k) => { delete daten[k]; },
        loadHangar: (system) => (`hangar-${system}` in daten
            ? JSON.parse(JSON.stringify(daten[`hangar-${system}`]))
            : { version: 1, mechs: [] }),
        saveHangar: (system, h) => { daten[`hangar-${system}`] = JSON.parse(JSON.stringify(h)); }
    };
}

const fixture = () => JSON.parse(fs.readFileSync(
    path.join(WURZEL, "tools/opensource/fixtures/hangar-v1-classic.json"), "utf8"));

/* Deutsche Schlüssel und Werte, die nach der Migration nirgends mehr
   auftauchen dürfen. Bewusst als Wortliste und nicht als Tabelle: der Test
   soll auch anschlagen, wenn jemand eine neue Stelle vergisst. */
const DEUTSCH = /"(panzerung|struktur|waffen|kritSlots|bewegung|gehen|springen|waermetauscher|anzahl|doppelt|notizen|typ|techbase|rolle|quelle|quelleId|modifikatoren|wert|zone|schaden|hitze|reichweite|munition|kopf|zt|zth|rth|lth|rb|lb|einheiten|runde|kopie|pSchaden|sSchaden|slotKrits|waffenHin|pilotTreffer|zerstoert|abgefeuert|hitzeRunde|angriff|modAktiv|aktiv|kampagnen|angelegt|zustaende|protokoll|datum|runden|notiz|kurz|liste|basis|akzent|erledigt)"/;

test("Hangar: v1 wird auf Stand 3 gehoben", () => {
    const M = ladeMigrate();
    const S = speicher({ "hangar-classic": fixture() });
    M.run(S);
    const h = S.load("hangar-classic");
    const m = h.mechs[0];
    assert.equal(h.version, M.VERSION);
    assert.equal(m.version, M.VERSION);
    assert.equal(m.armor.head, 9);
    assert.equal(m.armor.ct, 47);
    assert.equal(m.armor.ll, 41);
    assert.equal(m.structure.rl, 21);
    assert.equal(m.movement.walk, 3);
    assert.equal(m.heatSinks.count, 20);
    assert.equal(m.techBase, "IS");
    assert.equal(m.weapons[0].location, "LA");
    assert.equal(m.weapons[2].location, "LT");
    assert.equal(m.weapons[2].damage, "1/missile");
    assert.equal(m.weapons[2].range, "min 6 · 7/14/21");
    assert.equal(m.weapons[2].ammo, 12);
    assert.equal(m.critSlots.ct[0], "Engine");
    assert.equal(m.critSlots.head[0], "Life Support");
    assert.equal(m.critSlots.lt[8], "Ammo (LRM 20)");
    assert.equal(m.critSlots.ct[10], "Medium Laser (Rear)");
    assert.match(JSON.stringify(h).replace(DEUTSCH, ""), /./);
    assert.equal(DEUTSCH.test(JSON.stringify(h)), false,
        "deutscher Schlüssel übrig: " + (JSON.stringify(h).match(DEUTSCH) || [])[0]);
});

test("Zonencodes der Waffen wandern mit", () => {
    const M = ladeMigrate();
    const m = M.mech({
        version: 1, name: "T", waffen: [
            { name: "AC/20", zone: "KO" }, { name: "ML", zone: "ZT" },
            { name: "ML", zone: "RB" }, { name: "ML", zone: "LB" },
            { name: "ML", zone: "RT" }
        ]
    });
    assert.deepEqual(m.weapons.map((w) => w.location), ["HD", "CT", "RL", "LL", "RT"]);
});

test("Gefecht und Kampagne: Schlüssel, Zonen und Krit-Ids", () => {
    const M = ladeMigrate();
    const S = speicher({
        "gefecht-classic": {
            version: 1, runde: 3, rundenLimit: 8,
            initiative: { runde: 3, wir: 9, gegner: 7 },
            einheiten: [{
                gid: "a", mechId: "x", kopie: { version: 2, name: "T", panzerung: { kopf: 9, rb: 41 } },
                pSchaden: { zt: 12, lb: 4 }, sSchaden: { lb: 21 }, hitze: 6,
                munition: { 0: 2 }, waffenHin: { 1: true }, pilotTreffer: 1,
                zerstoert: false, slotKrits: { lt: [8] },
                krits: [{ k: "waermetauscher", zone: "ZT" }, { k: "triebwerk", zone: "KO" }],
                abgefeuert: [{ summe: 8, treffer: true, cluster: { wurf: 7, n: 12, groesse: 20 },
                               zonen: [{ zone: "zt", heck: false, krit: false, dmg: 5 }] }],
                hitzeRunde: { waffen: 6, bewegung: 2 },
                angriff: { "eigene-bewegung": 1, "ziel-lahm": 0, gunnery: 4 },
                modAktiv: {}
            }]
        },
        "kampagnen-classic": {
            version: 1, aktiv: "k1",
            kampagnen: [{
                id: "k1", name: "Erste", angelegt: "2026-09-01",
                zustaende: { x: { version: 1, stand: "2026-09-02", pSchaden: { zt: 12 }, zerstoert: false } },
                protokoll: [{ datum: "2026-09-02", runden: 4, notiz: "",
                              einheiten: [{ name: "T", zerstoert: false, kurz: "Panzerung −12" }] }]
            }]
        }
    });
    M.run(S);

    const g = S.load("battle-classic");
    assert.equal(S.load("gefecht-classic", null), null, "alter Schlüssel bleibt liegen");
    assert.equal(g.round, 3);
    assert.equal(g.roundLimit, 8);
    assert.equal(g.initiative.us, 9);
    const e = g.units[0];
    assert.equal(e.copy.armor.head, 9);
    assert.equal(e.copy.armor.rl, 41);
    assert.equal(e.armorDamage.ct, 12);
    assert.equal(e.armorDamage.ll, 4);
    assert.equal(e.structureDamage.ll, 21);
    assert.equal(e.ammoUsed[0], 2);
    assert.equal(e.weaponsOut[1], true);
    assert.equal(e.pilotHits, 1);
    assert.deepEqual(e.slotCrits.lt, [8]);
    assert.deepEqual(e.crits.map((k) => k.component), ["heat-sink", "engine"]);
    /* Die Zone kam aus einer Auswahlliste mit übersetzten Beschriftungen. */
    assert.deepEqual(e.crits.map((k) => k.location), ["CT", "HD"]);
    assert.equal(e.fired[0].total, 8);
    assert.equal(e.fired[0].hit, true);
    assert.equal(e.fired[0].cluster.hits, 12);
    assert.equal(e.fired[0].cluster.size, 20);
    assert.equal(e.fired[0].locations[0].location, "ct");
    assert.equal(e.fired[0].locations[0].damage, 5);
    assert.equal(e.roundHeat.weapons, 6);
    assert.equal(e.attack["attacker-movement"], 1);
    assert.equal(e.attack["target-immobile"], 0);
    assert.equal(e.attack.gunnery, 4);

    const k = S.load("campaigns-classic");
    assert.equal(k.active, "k1");
    assert.equal(k.campaigns[0].created, "2026-09-01");
    assert.equal(k.campaigns[0].states.x.armorDamage.ct, 12);
    assert.equal(k.campaigns[0].states.x.asOf, "2026-09-02");
    assert.equal(k.campaigns[0].log[0].date, "2026-09-02");
    assert.equal(k.campaigns[0].log[0].rounds, 4);
    assert.equal(k.campaigns[0].log[0].units[0].summary, "Panzerung −12");
});

test("Alpha Strike: eigene Felder und Krit-Schlüssel", () => {
    const M = ladeMigrate();
    const S = speicher({
        "gefecht-alpha-strike": {
            version: 1, runde: 1,
            einheiten: [{
                gid: "b", kopie: { version: 2, name: "V", panzerung: 4, struktur: 3, typ: "CV" },
                dPanzer: 2, dStruktur: 1, hitze: 2, ovAngesagt: 1, hitzeExtern: 0,
                krits: { tw: 1, fc: 2, waffe: 0, mp: false, crew: true, motive: 1 },
                motiveWurf: { a: 3, b: 4, mod: 1, stufe: 2 }, zerstoert: false
            }]
        }
    });
    M.run(S);
    const e = S.load("battle-alpha-strike").units[0];
    assert.equal(e.armorDamage, 2);
    assert.equal(e.structureDamage, 1);
    assert.equal(e.ovDeclared, 1);
    assert.equal(e.externalHeat, 0);
    assert.equal(e.crits.engine, 1);
    assert.equal(e.crits.fireControl, 2);
    assert.equal(e.crits.crewStunned, true);
    assert.equal(e.crits.motive, 1);
    assert.equal(e.motiveRoll.level, 2);
    assert.equal(e.copy.type, "CV");
});

test("Schemata und Anleitung", () => {
    const M = ladeMigrate();
    const S = speicher({
        schemata: { version: 1, liste: [{ id: "s1", name: "X", basis: "#111", trim: "#222", akzent: "#333" }] },
        anleitung: { version: 1, erledigt: ["1", "3"] }
    });
    M.run(S);
    const s = S.load("schemes");
    assert.equal(s.list[0].base, "#111");
    assert.equal(s.list[0].accent, "#333");
    assert.deepEqual(S.load("guide").done, ["1", "3"]);
    assert.equal(S.load("schemata", null), null);
});

test("v4: deutsche Slot-Namen aus dem Muster kommen zurück", () => {
    const M = ladeMigrate();
    const S = speicher({
        "hangar-classic": {
            version: 3,
            mechs: [{
                version: 3, id: "x", name: "Griffin GRF-1N", tonnage: 55,
                movement: { walk: 5, jump: 5 }, pilot: { gunnery: 4, piloting: 5 },
                heatSinks: { count: 12, double: false },
                armor: { head: 9 }, structure: { head: 3 }, weapons: [],
                critSlots: {
                    rt: ["Sprungdüse", "LRM 10", "Munition (LRM 10)", "PPC (Heck)", "", "Heat Sink"],
                    ct: ["Engine", "Ammo (LRM 10)"]
                }
            }]
        }
    });
    M.run(S);
    const m = S.load("hangar-classic").mechs[0];
    assert.equal(m.version, M.VERSION);
    assert.deepEqual(m.critSlots.rt,
        ["Jump Jet", "LRM 10", "Ammo (LRM 10)", "PPC (Rear)", "", "Heat Sink"]);
    /* Englische Namen bleiben, wie sie sind. */
    assert.deepEqual(m.critSlots.ct, ["Engine", "Ammo (LRM 10)"]);
});

test("v5: der Icon-Pfad folgt dem Ordner", () => {
    const M = ladeMigrate();
    const S = speicher({
        "hangar-classic": {
            version: 4,
            mechs: [
                { version: 4, id: "a", name: "Griffin", icon: "img/mechs/Griffin.png", critSlots: {} },
                { version: 4, id: "b", name: "Eigenbau", critSlots: {} },
                { version: 5, id: "c", name: "Schon fertig", icon: "img/units/Atlas.png", critSlots: {} }
            ]
        }
    });
    M.run(S);
    const h = S.load("hangar-classic");
    assert.equal(h.version, M.VERSION);
    assert.equal(h.mechs[0].icon, "img/units/Griffin.png");
    assert.equal(h.mechs[1].icon, undefined, "ohne Icon bleibt ohne Icon");
    assert.equal(h.mechs[2].icon, "img/units/Atlas.png");
});

test("Gefecht: abgefeuerte Würfe stehen als Objekt, nicht als Liste", () => {
    /* Der Datenbogen legt sie unter dem Waffenindex ab (e.fired[i]) - die
       Migration lief bis v5 nur über Arrays und warf bei echten Ständen. */
    const M = ladeMigrate();
    const S = speicher({
        "gefecht-classic": {
            version: 1, runde: 2,
            einheiten: [{
                gid: "a", kopie: { version: 3, name: "T" },
                abgefeuert: {
                    "0": { summe: 8, treffer: true, cluster: { wurf: 7, n: 6, groesse: 10 },
                           zonen: [{ zone: "zt", heck: false, krit: false, dmg: 5 },
                                   { zone: "rb", heck: false, krit: true, dmg: 1 }] },
                    "2": { summe: 5, treffer: false, cluster: null, zonen: [] }
                }
            }]
        }
    });
    M.run(S);
    const e = S.load("battle-classic").units[0];
    assert.equal(e.fired["0"].total, 8);
    assert.equal(e.fired["0"].hit, true);
    assert.equal(e.fired["0"].cluster.hits, 6);
    assert.equal(e.fired["0"].cluster.size, 10);
    assert.deepEqual(e.fired["0"].locations.map((z) => z.location), ["ct", "rl"]);
    assert.equal(e.fired["0"].locations[0].damage, 5);
    assert.equal(e.fired["2"].hit, false);
});

test("Ein kaputter Teilstand legt die übrigen nicht lahm", () => {
    const M = ladeMigrate();
    const S = speicher({
        "gefecht-classic": { version: 1, einheiten: [{ gid: "a", kopie: null, abgefeuert: 42 }] },
        "hangar-classic": fixture()
    });
    const warnungen = [];
    const alt = console.warn;
    console.warn = (...a) => warnungen.push(a[0]);
    try {
        M.run(S);
    } finally {
        console.warn = alt;
    }
    /* Der Hangar ist trotzdem migriert. */
    assert.equal(S.load("hangar-classic").mechs[0].armor.head, 9);
});

test("Zweiter Lauf ändert nichts (Idempotenz)", () => {
    const M1 = ladeMigrate();
    const S = speicher({ "hangar-classic": fixture() });
    M1.run(S);
    const einmal = JSON.stringify(S.daten);
    ladeMigrate().run(S);          /* frisches Modul: der Lauf-Riegel greift nicht */
    assert.equal(JSON.stringify(S.daten), einmal);
});

test("Summen bleiben gleich", () => {
    const M = ladeMigrate();
    const vorher = fixture().mechs[0];
    const summe = (o) => Object.keys(o).reduce((a, k) => a + o[k], 0);
    const pSumme = summe(vorher.panzerung);
    const sSumme = summe(vorher.struktur);
    const slots = Object.keys(vorher.kritSlots).reduce((a, z) => a + vorher.kritSlots[z].length, 0);
    const nachher = M.mech(JSON.parse(JSON.stringify(vorher)));
    assert.equal(summe(nachher.armor), pSumme);
    assert.equal(summe(nachher.structure), sSumme);
    assert.equal(Object.keys(nachher.critSlots).reduce((a, z) => a + nachher.critSlots[z].length, 0), slots);
    assert.equal(nachher.weapons.length, vorher.waffen.length);
});

test("Backup-Paket kommt aus jeder Version auf Stand 3", () => {
    const M = ladeMigrate();
    const p = M.package({
        typ: "mechs-hangar", system: "classic", exportiert: "2026-09-01",
        mechs: [fixture().mechs[0]],
        kampagnen: { version: 1, aktiv: "k1", kampagnen: [{ id: "k1", name: "A", angelegt: "x", zustaende: {}, protokoll: [] }] }
    });
    assert.equal(p.type, "mechs-hangar");
    assert.equal(p.exported, "2026-09-01");
    assert.equal(p.version, M.VERSION);
    assert.equal(p.mechs[0].armor.head, 9);
    assert.equal(p.campaigns.active, "k1");
    assert.equal(p.campaigns.campaigns[0].created, "x");
});
