/* Kampagne: was ein Gefecht an Schaden hinterlässt, wandert in den Zustand
   der Einheit, kommt beim nächsten Gefecht zurück und geht in der Werkstatt
   wieder weg. Dazwischen liegt die einzige Stelle des Projekts, an der Daten
   ein Gefecht überdauern, ohne im Hangar zu stehen. */
const test = require("node:test");
const assert = require("node:assert");
const { lade, speicher } = require("./helpers");

function kampagne(anfang) {
    const S = speicher(anfang);
    const fenster = lade("campaign", { MechsStorage: S });
    return { K: fenster.MechsCampaign, S };
}

/* Eine Classic-Einheit im Gefecht, wie der Datenbogen sie führt. */
function einheit() {
    return {
        gid: "g1", mechId: "m1",
        copy: { name: "Griffin GRF-1N", structure: { head: 3, ct: 18 } },
        armorDamage: { ct: 12, ll: 4 }, structureDamage: { ct: 2 },
        heat: 6, ammoUsed: { 1: 3 }, weaponsOut: { 0: true },
        crits: [{ component: "heat-sink", location: "CT" }],
        slotCrits: { rt: [4] }, pilotHits: 1, destroyed: false,
        /* nichts davon gehört in den Zustand: */
        roundHeat: { weapons: 6, movement: 2 }, fired: { 0: { total: 8 } },
        attack: { gunnery: 4 }, distance: 9, note: "Notiz"
    };
}

test("readState nimmt den Schaden mit, nicht die Runde", () => {
    const { K } = kampagne();
    const z = K.readState("classic", einheit());
    assert.deepEqual(z.armorDamage, { ct: 12, ll: 4 });
    assert.deepEqual(z.structureDamage, { ct: 2 });
    assert.deepEqual(z.crits, [{ component: "heat-sink", location: "CT" }]);
    assert.deepEqual(z.slotCrits, { rt: [4] });
    assert.deepEqual(z.ammoUsed, { 1: 3 });
    assert.deepEqual(z.weaponsOut, { 0: true });
    assert.equal(z.pilotHits, 1);
    /* Rundenzustand bleibt im Gefecht. */
    ["heat", "roundHeat", "fired", "attack", "distance", "note"].forEach((f) => {
        assert.equal(z[f], undefined, f + " gehört nicht in die Kampagne");
    });
    assert.ok(z.asOf, "der Zustand trägt ein Datum");
});

test("Eine heile Einheit hinterlässt keinen Zustand", () => {
    const { K } = kampagne();
    const heil = { gid: "g", mechId: "m", copy: {}, armorDamage: {}, structureDamage: {},
                   ammoUsed: {}, weaponsOut: {}, crits: [], slotCrits: {}, pilotHits: 0,
                   destroyed: false, heat: 4 };
    assert.equal(K.readState("classic", heil), null);
});

test("applyState bringt den Schaden zurück", () => {
    const { K } = kampagne();
    const z = K.readState("classic", einheit());
    const frisch = { gid: "g2", mechId: "m1", copy: {}, armorDamage: {}, structureDamage: {},
                     heat: 0, ammoUsed: {}, weaponsOut: {}, crits: [], slotCrits: {},
                     pilotHits: 0, destroyed: false };
    K.applyState("classic", frisch, z);
    assert.deepEqual(frisch.armorDamage, { ct: 12, ll: 4 });
    assert.equal(frisch.pilotHits, 1);
    assert.deepEqual(frisch.crits, [{ component: "heat-sink", location: "CT" }]);
    assert.equal(frisch.heat, 0, "Hitze fängt jedes Gefecht bei null an");
});

test("Alpha Strike führt eigene Felder", () => {
    const { K } = kampagne();
    const as = { gid: "g", mechId: "m", copy: {}, armorDamage: 3, structureDamage: 1,
                 crits: { engine: 1, fireControl: 0, crewStunned: true, motive: 2 },
                 destroyed: false, heat: 2, ovDeclared: 1 };
    const z = K.readState("alpha-strike", as);
    assert.equal(z.armorDamage, 3);
    assert.equal(z.structureDamage, 1);
    assert.equal(z.crits.engine, 1);
    assert.equal(z.crits.motive, 2);
    assert.equal(z.crits.crewStunned, undefined,
        "eine betäubte Crew ist ein Rundenzustand, kein Schaden");
    assert.equal(z.heat, undefined);
    assert.equal(z.ovDeclared, undefined);
});

test("Zustand speichern, lesen, löschen", () => {
    const { K, S } = kampagne();
    K.create("classic", "Erste Kampagne");
    const z = K.readState("classic", einheit());
    K.setState("classic", "m1", z);
    assert.deepEqual(K.stateOf("classic", "m1").armorDamage, { ct: 12, ll: 4 });
    assert.ok(K.isDamaged("classic", { id: "m1" }));
    assert.ok(!K.isDamaged("classic", { id: "m2" }));
    K.setState("classic", "m1", null);
    assert.equal(K.stateOf("classic", "m1"), null);
    assert.ok(S.daten["campaigns-classic"], "die Kampagne liegt im Speicher");
});

test("Kurzfassung nennt, was kaputt ist", () => {
    const { K } = kampagne();
    const kurz = K.summary("classic", K.readState("classic", einheit()));
    /* Der Panzerungsschaden wird über die Zonen summiert: 12 + 4. */
    assert.match(kurz, /−16/, "der Panzerungsschaden steht darin");
    assert.match(kurz, /Structure −2/);
    assert.match(kurz, /2 crits/, "Krit-Liste und Slot-Krit zusammen");
    assert.match(kurz, /1 weapon out/);
    assert.match(kurz, /Pilot 1/);
    assert.equal(K.summary("classic", null), "");
});

test("carryOver schreibt den Zustand aller Einheiten und schreibt das Protokoll", () => {
    const { K } = kampagne();
    K.create("classic", "Kampagne");
    const zweite = einheit();
    zweite.gid = "g2"; zweite.mechId = "m2"; zweite.destroyed = true;
    const adhoc = einheit();
    adhoc.gid = "g3"; adhoc.mechId = null;   /* aus dem Stegreif, ohne Hangar */

    const n = K.carryOver({ system: "classic", units: [einheit(), zweite, adhoc], round: 5 });
    assert.equal(n, 2, "beide Hangar-Einheiten hinterlassen etwas");
    assert.ok(K.stateOf("classic", "m1"));
    assert.equal(K.stateOf("classic", "m2").destroyed, true);

    const protokoll = K.log("classic");
    assert.equal(protokoll.length, 1, "ein Eintrag je Gefecht");
    assert.equal(protokoll[0].rounds, 5);
    assert.equal(protokoll[0].units.length, 2, "die Stegreif-Einheit steht nicht darin");
    assert.match(protokoll[0].units[0].summary, /Armor/);
});

test("repair räumt einen Zustand ganz weg", () => {
    const { K } = kampagne();
    K.create("classic", "Kampagne");
    K.setState("classic", "m1", K.readState("classic", einheit()));
    K.repair("classic", { id: "m1" });
    assert.equal(K.stateOf("classic", "m1"), null);
});

test("Das Protokoll hängt an der aktiven Kampagne", () => {
    const { K } = kampagne();
    const a = K.create("classic", "Erste");
    K.carryOver({ system: "classic", units: [einheit()], round: 4 });
    assert.equal(K.log("classic").length, 1);
    assert.equal(K.log("classic")[0].rounds, 4);
    assert.ok(K.log("classic")[0].date, "mit Datum");

    /* Eine zweite Kampagne führt ihr eigenes Protokoll. */
    const b = K.create("classic", "Zweite");
    K.activate("classic", b.id);
    assert.equal(K.log("classic").length, 0);
    assert.notEqual(K.activeId("classic"), a.id);
    /* Beim ersten Zugriff legt das Modul selbst eine Kampagne an - dazu
       kommen die beiden hier erzeugten. */
    assert.equal(K.campaigns("classic").length, 3);
});

test("Zustände hängen an der Kampagne, nicht am Hangar", () => {
    const { K } = kampagne();
    const a = K.create("classic", "Erste");
    K.setState("classic", "m1", K.readState("classic", einheit()));
    const b = K.create("classic", "Zweite");
    K.activate("classic", b.id);
    assert.equal(K.stateOf("classic", "m1"), null, "die zweite Kampagne fängt heil an");
    K.activate("classic", a.id);
    assert.ok(K.stateOf("classic", "m1"), "die erste hat ihren Schaden noch");
});
