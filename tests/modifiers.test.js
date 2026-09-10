/* Fähigkeiten und Quirks: eine Liste am 'Mech, im Gefecht einzeln
   an- und abschaltbar. Die Summe geht in die Zielzahl ein - hier wird
   gerechnet, nicht gezeichnet. */
const test = require("node:test");
const assert = require("node:assert");
const { lade } = require("./helpers");

const MOD = lade("modifiers").MechsModifiers;

const MECH = {
    name: "Griffin GRF-1N",
    modifiers: [
        { name: "Sniper", value: -1 },
        { name: "Poor Targeting Systems", value: 2 },
        { name: "Battle Computer", value: -1 }
    ]
};

test("Ohne aktive Auswahl zählt nichts", () => {
    assert.equal(MOD.sum(MECH, undefined), 0);
    assert.equal(MOD.sum(MECH, {}), 0);
});

test("Nur was angehakt ist, zählt", () => {
    assert.equal(MOD.sum(MECH, { 0: true }), -1);
    assert.equal(MOD.sum(MECH, { 1: true }), 2);
    assert.equal(MOD.sum(MECH, { 0: true, 1: true }), 1, "−1 und +2");
    assert.equal(MOD.sum(MECH, { 0: true, 1: true, 2: true }), 0, "−1 +2 −1");
});

test("Ein 'Mech ohne Modifikatoren rechnet auch", () => {
    assert.equal(MOD.sum({ name: "X" }, { 0: true }), 0);
    assert.equal(MOD.sum(null, { 0: true }), 0);
});

test("Ein Index, den es nicht gibt, wird ignoriert", () => {
    assert.equal(MOD.sum(MECH, { 7: true }), 0);
    assert.equal(MOD.sum(MECH, { 0: true, 7: true }), -1);
});

test("Die Texte nennen Namen und Vorzeichen", () => {
    const texte = MOD.texts(MECH, { 0: true, 1: true });
    assert.equal(texte.length, 2);
    assert.match(texte[0], /Sniper/);
    assert.match(texte[0], /−1/, "Minus als Zeichen, nicht als Bindestrich");
    assert.match(texte[1], /Poor Targeting Systems/);
    assert.match(texte[1], /\+2/);
    assert.deepEqual(MOD.texts(MECH, {}), []);
});

test("Ein Wert von 0 bekommt ein ±", () => {
    const m = { modifiers: [{ name: "Neutral", value: 0 }] };
    assert.equal(MOD.sum(m, { 0: true }), 0);
    assert.match(MOD.texts(m, { 0: true })[0], /±0/);
});
