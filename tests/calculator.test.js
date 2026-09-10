/* Die Zielzahl-Rechnung (GATOR und SATOR) gegen die echten Konfigurationen
   aus website/data/. Der Rechner ist die eine Stelle, an der aus einer
   Auswahl eine Zahl wird - der Datenbogen rechnet die Zielzahl je Waffe mit
   derselben Funktion, damit es keine zweite Fassung gibt, die abdriftet. */
const test = require("node:test");
const assert = require("node:assert");
const { lade, daten } = require("./helpers");

const CALC = lade("calculator").MechsCalculator;
const GATOR = daten("calculator-classic.json");
const SATOR = daten("calculator-alpha-strike.json");

test("Grundzustand kommt aus den Vorgaben der Konfiguration", () => {
    const zustand = CALC.defaultState(GATOR);
    GATOR.categories.forEach((c) => {
        if (c.type === "chips") { assert.equal(zustand[c.id], c.default || 0, c.id); }
        if (c.type === "toggle") { assert.equal(zustand[c.id], false, c.id); }
        if (c.type === "counter") { assert.equal(zustand[c.id], 0, c.id); }
    });
});

test("Gespeicherte Auswahl wird übernommen, Unsinn nicht", () => {
    const zustand = CALC.defaultState(GATOR, {
        state: { "attacker-movement": 2, "heavy-woods": 3, "target-jumped": true,
                 "target-movement": 99 }
    });
    assert.equal(zustand["attacker-movement"], 2);
    assert.equal(zustand["heavy-woods"], 3);
    assert.equal(zustand["target-jumped"], true);
    /* 99 gibt es als Option nicht - dann gilt die Vorgabe. */
    const kat = GATOR.categories.find((c) => c.id === "target-movement");
    assert.equal(zustand["target-movement"], kat.default || 0);
});

test("GATOR: der leere Zustand ist die Basis", () => {
    /* Alles auf Vorgabe: Gunnery 4 (chips-Vorgabe) und sonst nichts. */
    const zustand = CALC.defaultState(GATOR);
    const gunnery = GATOR.categories.find((c) => c.id === "gunnery");
    assert.equal(CALC.toHit(GATOR, zustand), (GATOR.base || 0) + gunnery.options[gunnery.default || 0].value);
});

test("GATOR: jede Art von Kategorie zählt mit", () => {
    const zustand = CALC.defaultState(GATOR, {
        state: {
            "attacker-movement": 2,      // chips: Gelaufen +2
            "target-jumped": true,       // toggle
            "heavy-woods": 2,            // counter, zweimal
            "other": -1                  // counter, negativ
        }
    });
    const wert = (id, i) => {
        const c = GATOR.categories.find((x) => x.id === id);
        return c.type === "chips" ? c.options[i].value : c.value;
    };
    const erwartet = (GATOR.base || 0)
        + wert("gunnery", GATOR.categories.find((c) => c.id === "gunnery").default || 0)
        + wert("attacker-movement", 2)
        + wert("target-jumped")
        + 2 * wert("heavy-woods")
        + -1 * wert("other")
        + wert("target-movement", GATOR.categories.find((c) => c.id === "target-movement").default || 0)
        + wert("secondary-target", GATOR.categories.find((c) => c.id === "secondary-target").default || 0)
        + wert("heat", GATOR.categories.find((c) => c.id === "heat").default || 0)
        + wert("range", GATOR.categories.find((c) => c.id === "range").default || 0);
    assert.equal(CALC.toHit(GATOR, zustand), erwartet);
});

test("baseExtra kommt aus dem Datenbogen dazu", () => {
    const zustand = CALC.defaultState(GATOR);
    const ohne = CALC.toHit(GATOR, zustand);
    assert.equal(CALC.toHit(GATOR, zustand, { baseExtra: 5 }), ohne + 5);
});

test("Der Datenbogen blendet seine eigenen Quellen und die Reichweite aus", () => {
    /* So ruft classic-battle.js: Gunnery und Hitze kommen als baseExtra
       herein, die Reichweite kommt je Waffe dazu. */
    const optionen = { withoutMechSources: true, skip: ["range", "minimum-range"] };
    const zustand = CALC.defaultState(GATOR, optionen);
    const mechQuellen = GATOR.categories.filter((c) => c.source === "mech").map((c) => c.id);
    assert.ok(mechQuellen.length > 0, "die Konfiguration kennt Mech-Quellen");
    mechQuellen.forEach((id) => assert.equal(zustand[id], undefined, id + " gehört dem Datenbogen"));
    assert.equal(zustand.range, undefined);
    assert.equal(zustand["minimum-range"], undefined);

    /* Und sie zählen auch nicht in die Summe. */
    const mitAllem = CALC.toHit(GATOR, CALC.defaultState(GATOR));
    const ohneMech = CALC.toHit(GATOR, zustand, optionen);
    assert.ok(ohneMech <= mitAllem);
});

test("Eine Schalter- oder Zähler-Kategorie darf nicht durchrutschen", () => {
    /* Genau hier lag ein Fehler: der Datenbogen verglich die Art noch mit
       den deutschen Wörtern und ließ fünf von zwölf Kategorien weg. */
    const optionen = { withoutMechSources: true, skip: ["range", "minimum-range"] };
    const leer = CALC.defaultState(GATOR, optionen);
    const basis = CALC.toHit(GATOR, leer, optionen);
    GATOR.categories.forEach((c) => {
        if (c.source === "mech" || c.id === "range" || c.id === "minimum-range") { return; }
        if (c.type === "toggle") {
            const zustand = Object.assign({}, leer, { [c.id]: true });
            assert.equal(CALC.toHit(GATOR, zustand, optionen), basis + c.value, c.id);
        }
        if (c.type === "counter") {
            const zustand = Object.assign({}, leer, { [c.id]: 3 });
            assert.equal(CALC.toHit(GATOR, zustand, optionen), basis + 3 * c.value, c.id);
        }
    });
});

test("SATOR läuft durch dieselbe Rechnung", () => {
    const zustand = CALC.defaultState(SATOR, { state: { "target-jumped": true } });
    const jumped = SATOR.categories.find((c) => c.id === "target-jumped");
    const ohne = CALC.toHit(SATOR, CALC.defaultState(SATOR));
    assert.equal(CALC.toHit(SATOR, zustand), ohne + jumped.value);
});

test("Die Wahrscheinlichkeit stimmt mit 2W6 überein", () => {
    /* Alle 36 Würfe auszählen und mit der Tabelle vergleichen. */
    for (let ziel = 2; ziel <= 12; ziel++) {
        let treffer = 0;
        for (let a = 1; a <= 6; a++) {
            for (let b = 1; b <= 6; b++) { if (a + b >= ziel) { treffer++; } }
        }
        const erwartet = (treffer / 36) * 100;
        assert.ok(Math.abs(CALC.chance(ziel) - erwartet) < 0.06,
            `Zielzahl ${ziel}: Tabelle ${CALC.chance(ziel)}, gezählt ${erwartet.toFixed(1)}`);
    }
    /* Außerhalb wird geklemmt - der Rechner zeigt nie etwas unter 2+. */
    assert.equal(CALC.chance(1), CALC.chance(2));
    assert.equal(CALC.chance(13), CALC.chance(12));
});

test("Das Dezimalzeichen folgt der Anzeigesprache", () => {
    /* Es stand als Komma fest im Programm - auf der englischen Seite las
       sich die Wahrscheinlichkeit dann als "83,3 %". */
    const { lade } = require("./helpers");
    const en = lade("calculator");
    en.MechsI18n = { lang: "en" };
    assert.equal(en.MechsCalculator.format(83.3), "83.3");
    const de = lade("calculator");
    de.MechsI18n = { lang: "de" };
    assert.equal(de.MechsCalculator.format(83.3), "83,3");
    /* Ohne Sprachmodul bleibt es beim Punkt. */
    assert.equal(lade("calculator").MechsCalculator.format(58.3), "58.3");
});

test("Beide Konfigurationen sind in sich stimmig", () => {
    [["GATOR", GATOR], ["SATOR", SATOR]].forEach(([name, config]) => {
        assert.ok(config.categories.length > 0, name);
        const ids = new Set();
        config.categories.forEach((c) => {
            assert.ok(!ids.has(c.id), `${name}: ${c.id} kommt doppelt vor`);
            ids.add(c.id);
            assert.ok(["chips", "toggle", "counter"].includes(c.type),
                `${name}: ${c.id} hat die Art "${c.type}"`);
            if (c.type === "chips") {
                assert.ok(Array.isArray(c.options) && c.options.length, `${name}: ${c.id} ohne Optionen`);
                c.options.forEach((o) => assert.equal(typeof o.value, "number", `${name}: ${c.id}`));
                assert.ok(c.options[c.default || 0], `${name}: ${c.id} hat keine gültige Vorgabe`);
            } else {
                assert.equal(typeof c.value, "number", `${name}: ${c.id} ohne Wert`);
            }
        });
    });
});
