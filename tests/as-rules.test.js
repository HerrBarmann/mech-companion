/* Die Alpha-Strike-Tabellen aus data/alpha-strike-rules.json. Sie standen
   bis zur Prüfung gegen das Buch fest in as-battle.js; jetzt sind sie Daten
   und damit prüfbar. Der wichtigste Test ist der langweiligste: deckt jede
   2W6-Tabelle die Ergebnisse 2 bis 12 genau einmal ab? Genau da fällt ein
   Tippfehler auf, wenn das Core Rulebook die Werte verschiebt. */
const test = require("node:test");
const assert = require("node:assert");
const { daten } = require("./helpers");

const AS = daten("alpha-strike-rules.json");

/* "3 · 11" -> [3, 11], "2–8" -> [2..8], "12+" -> [12] (auf 2W6 gibt es
   nichts über 12; das Plus steht für Modifikatoren auf den Wurf). */
function results(label) {
    const out = [];
    String(label).split("·").forEach((part) => {
        const text = part.trim();
        const range = /^(\d+)[–-](\d+)$/.exec(text);
        if (range) {
            for (let i = Number(range[1]); i <= Number(range[2]); i++) { out.push(i); }
            return;
        }
        out.push(Number(text.replace("+", "")));
    });
    return out;
}

test("Die Beschriftungen lassen sich in Würfelergebnisse auflösen", () => {
    assert.deepEqual(results("7"), [7]);
    assert.deepEqual(results("3 · 11"), [3, 11]);
    assert.deepEqual(results("2–8"), [2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(results("12+"), [12]);
    assert.deepEqual(results("2 · 3 · 11 · 12"), [2, 3, 11, 12]);
});

test("Jede Krit-Tabelle deckt 2 bis 12 genau einmal ab", () => {
    Object.keys(AS.critTables).forEach((kind) => {
        if (kind.charAt(0) === "_") { return; }
        const seen = [];
        AS.critTables[kind].forEach((row) => {
            assert.equal(row.length, 2, `${kind}: eine Zeile ist [Wurf, Wirkung]`);
            assert.ok(row[1].trim().length, `${kind}: ${row[0]} ohne Text`);
            results(row[0]).forEach((n) => seen.push(n));
        });
        seen.sort((a, b) => a - b);
        assert.deepEqual(seen, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            `${kind}: jedes Ergebnis genau einmal`);
    });
});

test("Die Bewegungsschaden-Tabelle deckt 2 bis 12 ab", () => {
    const seen = [];
    AS.motiveTable.rows.forEach((row) => results(row[0]).forEach((n) => seen.push(n)));
    seen.sort((a, b) => a - b);
    assert.deepEqual(seen, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
});

test("Die vier Bewegungsschaden-Stufen passen zu den Tabellenzeilen", () => {
    /* Die Stufen sind die Chips am Fahrzeug; es muss für jede Tabellenzeile
       eine geben, sonst zeigt der Wurf auf eine Stufe, die es nicht gibt. */
    assert.equal(AS.motiveTable.levels.length, AS.motiveTable.rows.length);
});

test("Die Modifikatoren stimmen mit der offiziellen Tabelle überein", () => {
    /* Motive Systems Damage Table, AS:CE S. 51: Ketten/Marine +0,
       Rad/Luftkissen +1, VTOL/WiGE +2. */
    const m = AS.motiveTable.modifiers;
    assert.equal(m.t, 0, "tracked");
    assert.equal(m.n, 0, "naval");
    assert.equal(m.s, 0, "submersible");
    assert.equal(m.w, 1, "wheeled");
    assert.equal(m.h, 1, "hover");
    assert.equal(m.v, 2, "VTOL");
    assert.equal(m.g, 2, "WiGE");
});

test("Fähigkeits-Modifikatoren sind gesondert geführt", () => {
    /* ARS steht NICHT auf der Tabelle, sondern im Fähigkeitenteil - deshalb
       ein eigener Abschnitt und nicht unter den Bewegungsarten. */
    assert.equal(AS.motiveTable.abilityModifiers.ARS, -1);
    assert.equal(AS.motiveTable.modifiers.ARS, undefined);
});

test("Betäubte Crew hält eine Runde über die laufende hinaus", () => {
    assert.equal(AS.crewStunnedRounds, 1);
});

test("Die Wirkungstexte sind da und nennen die Errata-Fassung", () => {
    ["engineMech", "mpHit", "weaponHit", "crewStunned"].forEach((k) => {
        assert.ok(AS.critEffects[k] && AS.critEffects[k].length > 20, k);
    });
    /* Errata v7.02 hat "rounding normally" zu "rounding down" geändert. */
    assert.match(AS.critEffects.mpHit, /rounding down/);
    /* Und den Waffentreffer um die 0*-Stufe ergänzt. */
    assert.match(AS.critEffects.weaponHit, /0\*/);
    assert.match(AS.asOf, /v7\.02/);
});

test("Krit-Tabelle und Wirkungstexte widersprechen sich nicht", () => {
    const rows = AS.critTables.mech.concat(AS.critTables.vehicle, AS.critTables.proto);
    const mp = rows.filter((r) => /^MP/.test(r[1]));
    assert.ok(mp.length, "es gibt MP-Zeilen");
    mp.forEach((r) => assert.match(r[1], /rounding down/, r[0]));
    const weapon = rows.filter((r) => /^Weapon/.test(r[1]));
    weapon.forEach((r) => assert.match(r[1], /0\*/, r[0]));
});
