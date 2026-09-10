/* Werte aus data/classic-rules.json, die eine Seite oder ein Rechner
   ausliest. Der Sturzschaden steht hier mit dem Beispiel, das die offizielle
   Errata selbst vorrechnet - so ist die Quelle nicht nur ein Kommentar,
   sondern ein Test, der beim Core Rulebook mitmeckert. */
const test = require("node:test");
const assert = require("node:assert");
const { daten } = require("./helpers");

const RULES = daten("classic-rules.json");

/* Dieselbe Rechnung wie in js/rules.js. Sie steht hier bewusst noch einmal:
   der Rechner hängt am DOM, die Formel soll trotzdem geprüft sein. */
function fallDamage(f, tons, levels) {
    const perLevel = f.roundUp
        ? Math.ceil(tons / f.perTons)
        : Math.round(tons / f.perTons);
    return perLevel * (levels + f.levelsPlus);
}

test("Die Sturzschaden-Werte sind vollständig", () => {
    const f = RULES.falling;
    assert.ok(f, "classic-rules.json kennt einen falling-Block");
    ["perTons", "levelsPlus", "groupSize", "facingDie"].forEach((k) => {
        assert.equal(typeof f[k], "number", k);
    });
    assert.equal(typeof f.roundUp, "boolean");
});

test("Das Beispiel der BMM-Errata geht auf", () => {
    /* BattleMech Manual Errata v7.01, Skidding Diagram 1: "As the Phoenix
       Hawk weighs 45 tons, it suffers 5 points of damage falling into Hex G
       (45 tons divided by 10 is 4.5, rounded up to 5)." Der Sturz bleibt im
       eigenen Hex, also ein Level. */
    assert.equal(fallDamage(RULES.falling, 45, 0), 5);
});

test("Aufgerundet wird, nicht kaufmännisch", () => {
    const f = RULES.falling;
    /* 4,4 wird zu 5, nicht zu 4 - genau daran hängt der Unterschied. */
    assert.equal(fallDamage(f, 44, 0), 5);
    assert.equal(fallDamage(f, 41, 0), 5);
    assert.equal(fallDamage(f, 40, 0), 4);
});

test("Jedes gefallene Level zählt einmal mehr", () => {
    const f = RULES.falling;
    /* Auf ebenem Boden ist es 1×, ein Level tiefer 2×. */
    assert.equal(fallDamage(f, 100, 0), 10);
    assert.equal(fallDamage(f, 100, 1), 20);
    assert.equal(fallDamage(f, 100, 3), 40);
});

test("Der Schaden wird in Fünfergruppen verteilt", () => {
    assert.equal(RULES.falling.groupSize, 5);
    /* 16 Schaden sind drei volle Gruppen und ein Rest von 1 - vier Würfe
       auf die Trefferzone, nicht einer. */
    const total = fallDamage(RULES.falling, 35, 3);
    assert.equal(total, 16);
    assert.equal(Math.floor(total / RULES.falling.groupSize), 3);
    assert.equal(total % RULES.falling.groupSize, 1);
});

test("Die Ausrichtung nach dem Sturz kommt von einem W6", () => {
    assert.equal(RULES.falling.facingDie, 6);
    /* Welche Hexseite eine 1-6 bedeutet, steht im Buch (Facing After Fall
       Table). Die App würfelt nur - der Verweis muss deshalb dastehen. */
    assert.match(RULES.falling.facingTable, /Facing After Fall/);
});
