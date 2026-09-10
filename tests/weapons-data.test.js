/* data/weapons.json ist von Hand gepflegt und wird an zwei Stellen gelesen:
   von der Waffen-Schnellreferenz auf der Regelseite und vom Konverter, der
   die Datenbank füllt (die kuratierte Tabelle hat dort Vorrang). Ein
   Zahlendreher hier wandert also in 24 000 Einheiten weiter - deshalb die
   langweiligen Invarianten. */
const test = require("node:test");
const assert = require("node:assert");
const { daten } = require("./helpers");

const W = daten("weapons.json");
const BASES = Object.keys(W.weapons);

function jedeWaffe(f) {
    BASES.forEach((base) => {
        Object.keys(W.weapons[base]).forEach((name) => {
            f(W.weapons[base][name], `${base} ${name}`, base, name);
        });
    });
}

test("Es gibt beide Techbasen und Waffen in beiden", () => {
    assert.deepEqual(BASES.sort(), ["Clan", "IS"]);
    BASES.forEach((b) => assert.ok(Object.keys(W.weapons[b]).length > 10, b));
});

test("Jede Waffe hat Schaden, Hitze und drei Reichweiten", () => {
    jedeWaffe((w, wo) => {
        assert.ok(w.damage !== undefined && String(w.damage).length, wo + ": Schaden");
        assert.equal(typeof w.heat, "number", wo + ": Hitze");
        assert.ok(w.heat >= 0, wo + ": Hitze nicht negativ");
        ["short", "medium", "long"].forEach((k) => {
            assert.equal(typeof w.range[k], "number", `${wo}: Reichweite ${k}`);
        });
    });
});

test("Die Reichweitenbänder steigen an", () => {
    /* kurz < mittel < lang - ein vertauschtes Paar würde im Gefecht das
       falsche Band und damit die falsche Zielzahl liefern. */
    jedeWaffe((w, wo) => {
        assert.ok(w.range.short < w.range.medium, wo + ": kurz < mittel");
        assert.ok(w.range.medium < w.range.long, wo + ": mittel < lang");
    });
});

test("Die Mindestreichweite liegt unter der kurzen Reichweite", () => {
    jedeWaffe((w, wo) => {
        assert.equal(typeof w.range.min, "number", wo + ": min gesetzt");
        assert.ok(w.range.min >= 0, wo + ": min nicht negativ");
        assert.ok(w.range.min < w.range.short, wo + ": min < kurz");
    });
});

test("Munition ist entweder eine Zahl oder ausdrücklich keine", () => {
    /* null heißt Energiewaffe - undefined wäre ein vergessenes Feld, und die
       Referenz würde die Zeile stillschweigend weglassen. */
    jedeWaffe((w, wo) => {
        assert.ok(w.ammoPerTon === null || typeof w.ammoPerTon === "number", wo);
        if (typeof w.ammoPerTon === "number") { assert.ok(w.ammoPerTon > 0, wo); }
    });
});

test("Clan-LRMs haben keine Mindestreichweite, die der Inneren Sphäre schon", () => {
    /* Der eine Unterschied, den die Referenz nebeneinander sichtbar macht -
       und der Grund, warum die Tabelle nach Techbasis getrennt ist. */
    ["LRM 5", "LRM 10", "LRM 15", "LRM 20"].forEach((name) => {
        assert.equal(W.weapons.IS[name].range.min, 6, "IS " + name);
        assert.equal(W.weapons.Clan[name].range.min, 0, "Clan " + name);
    });
});

test("Energiewaffen führen keine Munition", () => {
    ["Small Laser", "Medium Laser", "Large Laser", "PPC", "ER PPC", "Flamer"].forEach((name) => {
        const w = W.weapons.IS[name];
        assert.ok(w, "IS " + name + " existiert");
        assert.equal(w.ammoPerTon, null, "IS " + name);
    });
});

test("Der Stand ist vermerkt", () => {
    assert.match(W.asOf, /Total Warfare|Core Rulebook/);
});
