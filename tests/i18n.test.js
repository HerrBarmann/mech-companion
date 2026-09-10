/* Sprache: T() übersetzt, back() findet zurück. Der Rückweg ist die
   heiklere Richtung - im Slot-Editor ist ein Feld Anzeige und Eingabe
   zugleich, und was dort steht, landet im gespeicherten 'Mech. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { lade, WURZEL } = require("./helpers");

function sprache(woerter, muster) {
    const fenster = lade("i18n");
    fenster.MechsI18n.setWords(woerter || {}, muster || []);
    return fenster;
}

test("Ohne Wörterbuch ist T die Identität", () => {
    const { T } = lade("i18n");
    assert.equal(T("Heat Sink"), "Heat Sink");
    assert.equal(T(""), "");
    assert.equal(T(undefined), undefined);
    assert.equal(T(42), 42, "was kein Text ist, bleibt");
});

test("T übersetzt und lässt Unbekanntes stehen", () => {
    const { T } = sprache({ "Heat Sink": "Wärmetauscher", "Engine": "Triebwerk" });
    assert.equal(T("Heat Sink"), "Wärmetauscher");
    assert.equal(T("Gyro"), "Gyro", "ohne Eintrag bleibt der Quelltext");
});

test("Umschließende Leerzeichen überleben", () => {
    const { T } = sprache({ "Engine": "Triebwerk" });
    assert.equal(T(" Engine "), " Triebwerk ");
});

test("Muster greifen erst, wenn kein Eintrag passt", () => {
    const { T } = sprache(
        { "1/missile": "1/Sonderfall" },
        [["(\\d+)/missile", "$1/Rakete", "g"]]
    );
    assert.equal(T("1/missile"), "1/Sonderfall", "der Eintrag gewinnt");
    assert.equal(T("2/missile"), "2/Rakete", "sonst das Muster");
});

test("Ein Muster ohne Ersatz heißt: bleibt gleich", () => {
    const { T } = sprache({}, [["^min \\d+ · [\\d/]+$"]]);
    assert.equal(T("min 6 · 7/14/21"), "min 6 · 7/14/21");
});

test("back() findet den Quelltext zurück", () => {
    const { MechsI18n } = sprache({
        "Heat Sink": "Wärmetauscher", "Engine": "Triebwerk", "Jump Jet": "Sprungdüse"
    });
    assert.equal(MechsI18n.back("Wärmetauscher"), "Heat Sink");
    assert.equal(MechsI18n.back("Triebwerk"), "Engine");
    assert.equal(MechsI18n.back("PPC"), "PPC", "Unbekanntes bleibt, wie es getippt wurde");
    assert.equal(MechsI18n.back(""), "");
});

test("Bei zwei Quelltexten mit derselben Übersetzung gewinnt der erste", () => {
    const { MechsI18n } = sprache({ "Life Support": "Lebenserhaltung",
                                    "Life support": "Lebenserhaltung" });
    assert.equal(MechsI18n.back("Lebenserhaltung"), "Life Support");
});

test("back() kann ein Muster NICHT umkehren", () => {
    /* Genau deshalb merkt sich der Slot-Editor den Quelltext eines
       unveränderten Feldes (siehe docs/I18N.md). */
    const { MechsI18n } = sprache({}, [["^Ammo \\((.+)\\)$", "Munition ($1)"]]);
    assert.equal(MechsI18n.back("Munition (LRM 20)"), "Munition (LRM 20)");
});

test("Anführungszeichen kommen aus dem Wörterbuch", () => {
    const { Z } = sprache({ "“": "„", "”": "“" });
    assert.equal(Z("Atlas"), "„Atlas“", "deutsche Anführungszeichen");
    const roh = lade("i18n");
    assert.equal(roh.Z("Atlas"), "“Atlas”", "ohne Paket die englischen");
});

test("Das deutsche Paket kommt ohne Doppeldeutigkeiten zurück", () => {
    /* Jede Übersetzung, die für zwei verschiedene Quelltexte steht, macht
       back() zum Ratespiel. Für Slot-Namen ist das nicht hinnehmbar - sie
       gehen durch den Editor in den gespeicherten 'Mech. */
    const slots = JSON.parse(fs.readFileSync(
        path.join(WURZEL, "tools/i18n/de/data-slots.json"), "utf8"));
    const rueck = {};
    Object.keys(slots).forEach((quelle) => {
        const ziel = slots[quelle];
        assert.equal(rueck[ziel], undefined,
            `"${ziel}" steht für "${rueck[ziel]}" UND "${quelle}"`);
        rueck[ziel] = quelle;
    });
});

test("Alle Wörterbuchdateien des deutschen Pakets sind gültig", () => {
    const ordner = path.join(WURZEL, "tools/i18n/de");
    const dateien = fs.readdirSync(ordner).filter((n) => n.endsWith(".json") && !n.startsWith("_"));
    assert.ok(dateien.length > 5, "das Paket hat mehrere Dateien");
    dateien.forEach((name) => {
        const d = JSON.parse(fs.readFileSync(path.join(ordner, name), "utf8"));
        if (name === "identical.json") {
            assert.ok(Array.isArray(d), "identical.json ist eine Liste");
            d.forEach((x) => assert.equal(typeof x, "string", name));
            return;
        }
        if (name === "patterns.json") {
            assert.ok(Array.isArray(d), "patterns.json ist eine Liste");
            d.forEach((p) => {
                assert.ok(Array.isArray(p) && p.length >= 1, "je Eintrag [Regex, Ersatz?, Flags?]");
                assert.doesNotThrow(() => new RegExp(p[0], p[2] || ""), `ungültiger Regex: ${p[0]}`);
            });
            return;
        }
        assert.equal(typeof d, "object", name);
        Object.keys(d).forEach((k) => {
            assert.equal(typeof d[k], "string", `${name}: ${k}`);
            assert.notEqual(d[k].trim(), "", `${name}: ${k} ist leer`);
        });
    });
});
