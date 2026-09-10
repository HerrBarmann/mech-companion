/* Weapon maths for Classic BattleTech: range bands, cluster hits, damage per
   shot. Pure functions over the values a 'Mech carries and the tables in
   data/classic-rules.json - no DOM, no storage, no state. They sit in their
   own module because they are rules, not interface: the record sheet in
   battle uses them, and they can be tested on their own (tests/). */
(function () {
    "use strict";

    /* The ranges sit as text in the 'Mech ("min 6 · 7/14/21"), the way the
       database and the hangar write them. */
    function parseRange(text) {
        if (!text) { return null; }
        var m = /(\d+)\/(\d+)\/(\d+)/.exec(text);
        if (!m) { return String(text).indexOf("point blank") !== -1 ? { min: 0, short: 1, medium: 1, long: 1 } : null; }
        var mn = /min (\d+)/.exec(text);
        return { min: mn ? parseInt(mn[1], 10) : 0, short: +m[1], medium: +m[2], long: +m[3] };
    }

    /* Which band a distance falls into, with its to-hit modifier. The band
       identifier is the display text as well (T() translates it) - it is
       stored nowhere, so it may be English. Beyond long range: null. */
    function bandFor(r, d) {
        if (!r || d > r.long) { return null; }
        var band = d <= r.short ? "short" : (d <= r.medium ? "medium" : "long");
        return { band: band, mod: band === "short" ? 0 : (band === "medium" ? 2 : 4),
                 minPenalty: (r.min && d <= r.min) ? (r.min - d + 1) : 0 };
    }

    /* The damage text of the database is English: "1/missile", "Cluster 5×2",
       "10 / cluster", "20". The rack size hangs off it - and with it the
       explosion damage. "Cluster" with a rack number is a spread weapon;
       "10 / cluster" (LB-X) names the damage per shot instead. */
    function clusterSize(w) {
        var s = String(w.damage || "");
        var c = /Cluster (\d+)/.exec(s);
        if (c) { return parseInt(c[1], 10); }
        if (/\/missile/.test(s)) {
            var n = /(\d+)(?!.*\d)/.exec(String(w.name || "").replace(/\(.*?\)/g, ""));
            return n ? parseInt(n[1], 10) : null;
        }
        return null;
    }

    function damagePerHit(w) {
        var s = String(w.damage || "");
        var r = /^(\d+)\/missile/.exec(s);
        if (r) { return parseInt(r[1], 10); }
        var c = /Cluster \d+×(\d+)/.exec(s);
        return c ? parseInt(c[1], 10) : 1;
    }

    /* Damage per shot for the ammo explosion: direct fire = the number,
       missiles/cluster = rack × damage per hit. */
    function damagePerShot(w) {
        var s = String(w.damage || "");
        if (/\/missile|Cluster \d/.test(s)) { return (clusterSize(w) || 1) * damagePerHit(w); }
        var n = parseInt(s, 10);
        return isNaN(n) ? 0 : n;
    }

    /* Cluster Hits Table: how many of a salvo hit on a 2D6 roll. The table
       only lists the common rack sizes; a size in between is scaled from the
       next smaller one and never exceeds the rack. */
    function clusterHits(table, size, roll) {
        table = table || {};
        var nearest = null;
        Object.keys(table).forEach(function (k) {
            if (k[0] !== "_" && Number(k) <= size && (nearest === null || Number(k) > nearest)) { nearest = Number(k); }
        });
        if (nearest === null) { return size; }
        var hits = table[String(nearest)][Math.min(10, Math.max(0, roll - 2))];
        return nearest === size ? hits : Math.min(size, Math.round(hits * size / nearest));
    }

    /* Spreading the hits over locations: LRM & co. in groups of five, SRM per
       missile, slugs one by one. rollFor() supplies the location - that is
       the caller's dice. */
    function spreadHits(w, hits, rollFor) {
        var per = damagePerHit(w);
        var groups = [];
        if (/LRM|MML|MRM|ATM|Rocket|LRT|HAG|Thunderbolt/i.test(String(w.name || ""))) {
            for (var left = hits; left > 0; left -= 5) { groups.push(Math.min(5, left) * per); }
        } else {
            for (var i = 0; i < hits; i++) { groups.push(per); }
        }
        return groups.map(function (dmg) {
            var z = rollFor();
            z.damage = dmg;
            return z;
        });
    }

    window.MechsWeaponMath = {
        parseRange: parseRange,
        bandFor: bandFor,
        clusterSize: clusterSize,
        damagePerHit: damagePerHit,
        damagePerShot: damagePerShot,
        clusterHits: clusterHits,
        spreadHits: spreadHits
    };
})();
