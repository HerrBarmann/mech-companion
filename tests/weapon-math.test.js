/* Reichweitenbänder, Cluster-Tabelle und Schaden je Schuss. Das sind
   Regelwerte in Textform, wie sie aus der Datenbank kommen ("min 6 ·
   7/14/21", "1/missile", "Cluster 5×2") - jede dieser Zeichenketten ist
   eine Fehlerquelle, solange niemand sie durchrechnet. */
const test = require("node:test");
const assert = require("node:assert");
const { lade, daten } = require("./helpers");

const WM = lade("weapon-math").MechsWeaponMath;
const REGELN = daten("classic-rules.json");

test("Reichweiten aus dem Text lesen", () => {
    assert.deepEqual(WM.parseRange("3/6/9"), { min: 0, short: 3, medium: 6, long: 9 });
    assert.deepEqual(WM.parseRange("min 6 · 7/14/21"), { min: 6, short: 7, medium: 14, long: 21 });
    assert.deepEqual(WM.parseRange("point blank"), { min: 0, short: 1, medium: 1, long: 1 });
    assert.equal(WM.parseRange(""), null);
    assert.equal(WM.parseRange(null), null);
    assert.equal(WM.parseRange("Nahkampf"), null, "unbekannter Text ergibt keine Reichweite");
});

test("Das Band folgt der Entfernung", () => {
    const r = WM.parseRange("3/6/9");
    assert.equal(WM.bandFor(r, 1).band, "short");
    assert.equal(WM.bandFor(r, 3).band, "short");
    assert.equal(WM.bandFor(r, 4).band, "medium");
    assert.equal(WM.bandFor(r, 6).band, "medium");
    assert.equal(WM.bandFor(r, 7).band, "long");
    assert.equal(WM.bandFor(r, 9).band, "long");
    assert.equal(WM.bandFor(r, 10), null, "jenseits der weiten Reichweite: kein Schuss");
});

test("Die Bandzuschläge sind 0/+2/+4", () => {
    const r = WM.parseRange("3/6/9");
    assert.equal(WM.bandFor(r, 2).mod, 0);
    assert.equal(WM.bandFor(r, 5).mod, 2);
    assert.equal(WM.bandFor(r, 8).mod, 4);
});

test("Mindestreichweite: je Feld darunter ein Zuschlag", () => {
    const r = WM.parseRange("min 6 · 7/14/21");
    assert.equal(WM.bandFor(r, 6).minPenalty, 1, "am Rand der Mindestreichweite");
    assert.equal(WM.bandFor(r, 5).minPenalty, 2);
    assert.equal(WM.bandFor(r, 1).minPenalty, 6);
    assert.equal(WM.bandFor(r, 7).minPenalty, 0, "darüber kein Zuschlag");
});

test("Rackgröße aus Name und Schadenstext", () => {
    assert.equal(WM.clusterSize({ name: "LRM 20", damage: "1/missile" }), 20);
    assert.equal(WM.clusterSize({ name: "SRM 6", damage: "2/missile" }), 6);
    assert.equal(WM.clusterSize({ name: "LRM 10 (Artemis IV)", damage: "1/missile" }), 10,
        "Klammern zählen nicht mit");
    assert.equal(WM.clusterSize({ name: "LB 10-X AC", damage: "Cluster 10×1" }), 10);
    assert.equal(WM.clusterSize({ name: "PPC", damage: "10" }), null);
    assert.equal(WM.clusterSize({ name: "LB 10-X AC", damage: "10 / cluster" }), null,
        "LB-X mit Einzelschuss nennt den Schaden, nicht die Rackgröße");
});

test("Schaden je Treffer und je Schuss", () => {
    assert.equal(WM.damagePerHit({ name: "LRM 20", damage: "1/missile" }), 1);
    assert.equal(WM.damagePerHit({ name: "SRM 6", damage: "2/missile" }), 2);
    assert.equal(WM.damagePerHit({ name: "PPC", damage: "10" }), 1, "ohne Rack: ein Treffer");

    /* Für die Munitionsexplosion zählt der Schaden JE SCHUSS. */
    assert.equal(WM.damagePerShot({ name: "AC/20", damage: "20" }), 20);
    assert.equal(WM.damagePerShot({ name: "LRM 20", damage: "1/missile" }), 20, "20 Raketen × 1");
    assert.equal(WM.damagePerShot({ name: "SRM 6", damage: "2/missile" }), 12, "6 Raketen × 2");
    assert.equal(WM.damagePerShot({ name: "Medium Laser", damage: "5" }), 5);
    assert.equal(WM.damagePerShot({ name: "Unbekannt", damage: "" }), 0);
});

test("Cluster-Tabelle: die Tabellenwerte selbst", () => {
    const t = REGELN.clusterTable;
    /* Ein Wurf von 2 ist das Minimum, 12 das Maximum, und nie mehr als das Rack. */
    Object.keys(t).forEach((k) => {
        if (k[0] === "_") { return; }
        const groesse = Number(k);
        const zeile = t[k];
        assert.equal(zeile.length, 11, `Rack ${k}: 2..12 sind elf Werte`);
        zeile.forEach((n, i) => {
            assert.ok(n >= 1 && n <= groesse, `Rack ${k}, Wurf ${i + 2}: ${n}`);
        });
        for (let i = 1; i < zeile.length; i++) {
            assert.ok(zeile[i] >= zeile[i - 1], `Rack ${k}: ein höherer Wurf trifft nie schlechter`);
        }
        assert.equal(zeile[10], groesse, `Rack ${k}: die 12 trifft alles`);
    });
});

test("Cluster-Treffer für gelistete Rackgrößen", () => {
    const t = REGELN.clusterTable;
    Object.keys(t).forEach((k) => {
        if (k[0] === "_") { return; }
        const groesse = Number(k);
        for (let wurf = 2; wurf <= 12; wurf++) {
            assert.equal(WM.clusterHits(t, groesse, wurf), t[k][wurf - 2],
                `Rack ${groesse}, Wurf ${wurf}`);
        }
    });
});

test("Eine Rackgröße zwischen den Zeilen wird hochgerechnet", () => {
    const t = REGELN.clusterTable;
    const groessen = Object.keys(t).filter((k) => k[0] !== "_").map(Number).sort((a, b) => a - b);
    /* Eine Größe, die es nicht gibt: die nächstkleinere Zeile wird skaliert. */
    const zwischen = groessen.find((g) => !groessen.includes(g + 1)) + 1;
    for (let wurf = 2; wurf <= 12; wurf++) {
        const n = WM.clusterHits(t, zwischen, wurf);
        assert.ok(n >= 1 && n <= zwischen, `Rack ${zwischen}, Wurf ${wurf}: ${n}`);
    }
    assert.equal(WM.clusterHits(t, zwischen, 12), zwischen, "die 12 trifft auch hier alles");
    /* Kleiner als die kleinste Zeile: alles trifft. */
    assert.equal(WM.clusterHits(t, 1, 2), 1);
});

test("Ohne Tabelle trifft das ganze Rack", () => {
    assert.equal(WM.clusterHits(null, 6, 7), 6);
    assert.equal(WM.clusterHits({}, 6, 2), 6);
});

test("Treffer verteilen: LRM in Fünfergruppen, SRM einzeln", () => {
    const zone = () => ({ location: "ct" });
    const lrm = WM.spreadHits({ name: "LRM 20", damage: "1/missile" }, 12, zone);
    assert.deepEqual(lrm.map((z) => z.damage), [5, 5, 2], "12 Raketen à 1 = 5+5+2");

    const srm = WM.spreadHits({ name: "SRM 6", damage: "2/missile" }, 3, zone);
    assert.deepEqual(srm.map((z) => z.damage), [2, 2, 2], "SRM je Rakete einzeln");

    const lbx = WM.spreadHits({ name: "LB 10-X AC", damage: "Cluster 10×1" }, 4, zone);
    assert.deepEqual(lbx.map((z) => z.damage), [1, 1, 1, 1], "Kugeln einzeln");

    /* Für jede Gruppe wird einmal gewürfelt. */
    let wuerfe = 0;
    WM.spreadHits({ name: "LRM 20", damage: "1/missile" }, 20, () => { wuerfe++; return {}; });
    assert.equal(wuerfe, 4, "20 Raketen = vier Gruppen = vier Trefferzonen");
});
