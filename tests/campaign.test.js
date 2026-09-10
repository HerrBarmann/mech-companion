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
    /* Seit #14 steht der Zustand im Eintrag und der Satz entsteht erst
       beim Anzeigen - geprüft wird also die Zahl, nicht die Sprache. */
    assert.ok(protokoll[0].units[0].state, "der Zustand liegt im Eintrag");
    assert.match(K.summary("classic", protokoll[0].units[0].state), /Armor/);
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

/* --- Bilanz (CONCEPT §10, F9): Gefechte und Abschüsse je Einheit -------- */

test("Eine frische Bilanz steht auf null", () => {
    const { K } = kampagne();
    assert.deepEqual(K.recordOf("classic", "m1"), { battles: 0, kills: 0 });
    assert.deepEqual(K.records("classic"), []);
});

test("Das Gefechtsende zählt für jede Einheit ein Gefecht", () => {
    const { K } = kampagne();
    K.carryOver({ system: "classic", units: [einheit()], round: 4 });
    assert.equal(K.recordOf("classic", "m1").battles, 1);
    K.carryOver({ system: "classic", units: [einheit()], round: 6 });
    assert.equal(K.recordOf("classic", "m1").battles, 2);
});

test("Auch eine heil zurückgekehrte Einheit zählt", () => {
    /* Gezählt wird die Teilnahme, nicht der Schaden. */
    const { K } = kampagne();
    const heil = { gid: "g", mechId: "m9", copy: { name: "Locust" },
                   armorDamage: {}, structureDamage: {}, crits: [] };
    K.carryOver({ system: "classic", units: [heil] });
    assert.equal(K.stateOf("classic", "m9"), null, "kein Schaden");
    assert.equal(K.recordOf("classic", "m9").battles, 1, "aber ein Gefecht");
});

test("Eine Ad-hoc-Einheit ohne Hangar-Eintrag zählt nicht mit", () => {
    const { K } = kampagne();
    K.carryOver({ system: "classic", units: [{ gid: "g", mechId: null, copy: {} }] });
    assert.deepEqual(K.records("classic"), []);
});

test("Abschüsse werden von Hand gesetzt und nicht negativ", () => {
    /* Die App kennt nur die eigene Lanze - wer abgeschossen wurde, weiß
       nur der Tisch. Deshalb ein Zähler und keine Automatik. */
    const { K } = kampagne();
    K.setRecord("classic", "m1", { kills: 2 });
    assert.equal(K.recordOf("classic", "m1").kills, 2);
    K.setRecord("classic", "m1", { kills: -5 });
    assert.equal(K.recordOf("classic", "m1").kills, 0, "unter null geht nicht");
});

test("Die Bilanz übersteht die Werkstatt", () => {
    /* Das ist der Grund, warum sie neben states liegt und nicht darin:
       Reparieren löscht den Zustand, die Geschichte bleibt. */
    const { K } = kampagne();
    K.carryOver({ system: "classic", units: [einheit()] });
    K.setRecord("classic", "m1", { kills: 3 });
    K.setState("classic", "m1", null);            /* vollständig repariert */
    assert.equal(K.stateOf("classic", "m1"), null);
    assert.deepEqual(K.recordOf("classic", "m1"), { battles: 1, kills: 3 });
});

test("Jede Kampagne führt ihre eigene Bilanz", () => {
    const { K } = kampagne();
    K.carryOver({ system: "classic", units: [einheit()] });
    assert.equal(K.recordOf("classic", "m1").battles, 1);
    const zweite = K.create("classic", "Zweiter Feldzug");
    assert.equal(K.activeId("classic"), zweite.id);
    assert.equal(K.recordOf("classic", "m1").battles, 0, "neue Kampagne, neue Bilanz");
    K.activate("classic", K.campaigns("classic")[0].id);
    assert.equal(K.recordOf("classic", "m1").battles, 1, "die alte steht noch");
});

test("records() listet auf, was geflogen ist", () => {
    const { K } = kampagne();
    K.carryOver({ system: "classic", units: [einheit()] });
    K.setRecord("classic", "m1", { kills: 1 });
    assert.deepEqual(K.records("classic"), [{ mechId: "m1", battles: 1, kills: 1 }]);
});

test("Eine Bilanz auf null verschwindet wieder", () => {
    const { K } = kampagne();
    K.setRecord("classic", "m1", { kills: 1 });
    assert.equal(K.records("classic").length, 1);
    K.setRecord("classic", "m1", { kills: 0 });
    assert.deepEqual(K.records("classic"), [], "kein leerer Eintrag im Speicher");
});

/* --- Protokoll: Daten statt fertiger Sätze (#14) ------------------------ */

test("Der Protokolleintrag trägt den Zustand, nicht den Satz", () => {
    /* Ein gespeicherter Satz stünde für immer in der Sprache des Abends,
       an dem er entstand - CLAUDE.md Arbeitsregel 6. */
    const { K } = kampagne();
    K.carryOver({ system: "classic", units: [einheit()], round: 4, note: "Sieg bei Hesperus" });
    const eintrag = K.log("classic")[0];
    const u = eintrag.units[0];
    assert.equal(u.summary, undefined, "kein fertiger Satz im Speicher");
    assert.ok(u.state, "dafür der Zustand");
    assert.deepEqual(u.state.armorDamage, { ct: 12, ll: 4 });
    assert.equal(u.name, "Griffin GRF-1N");
    assert.equal(eintrag.note, "Sieg bei Hesperus");
});

test("Aus dem gespeicherten Zustand entsteht derselbe Satz wie vorher", () => {
    const { K } = kampagne();
    K.carryOver({ system: "classic", units: [einheit()] });
    const u = K.log("classic")[0].units[0];
    const satz = K.summary("classic", u.state);
    assert.match(satz, /Armor −16/);
    assert.match(satz, /Structure −2/);
    assert.match(satz, /Pilot 1/);
});

test("Eine heile Einheit steht ohne Zustand im Protokoll", () => {
    const { K } = kampagne();
    const heil = { gid: "g", mechId: "m9", copy: { name: "Locust" },
                   armorDamage: {}, structureDamage: {}, crits: [] };
    K.carryOver({ system: "classic", units: [heil] });
    const u = K.log("classic")[0].units[0];
    assert.equal(u.state, null, "nichts zu erzählen");
    assert.equal(u.summary, undefined);
    /* Die Seite schreibt daraus "unbeschädigt" - hier steht nur die Lücke. */
});

test("Alte Einträge mit fertigem Satz bleiben lesbar", () => {
    /* Die Seite fällt auf u.summary zurück, wenn kein Zustand dabei ist.
       Ohne die Zahlen lässt sich der Satz nicht neu bauen, und Geschichte
       wegwerfen wäre der schlechtere Tausch. */
    const { K } = kampagne();
    K.carryOver({ system: "classic", units: [einheit()] });
    const d = K.data("classic");
    const c = d.campaigns.filter((x) => x.id === d.active)[0];
    c.log[0].units[0] = { mechId: "m1", name: "Griffin GRF-1N",
                          destroyed: false, summary: "Panzerung −16 · Struktur −2" };
    K.saveData("classic", d);
    const u = K.log("classic")[0].units[0];
    assert.equal(u.state, undefined);
    assert.equal(u.summary, "Panzerung −16 · Struktur −2");
});
