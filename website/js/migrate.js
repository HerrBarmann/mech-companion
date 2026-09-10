/* Migration of stored data (docs/history/MIGRATION-V2.md).

   Version 2: the VALUES became English. Since the language inversion the
   database and the rules files deliver English crit slot names ("Engine",
   "Ammo (LRM 20)", "… (Rear)") plus English range and damage texts. What was
   already in a browser is German - without the migration componentByName()
   would no longer find the parts, and the ammo explosion would come up
   empty.

   Version 3: the KEYS became English - object fields, location codes,
   category ids and the names in localStorage. Both run in order and each
   checks the version field, so both are repeatable.

   Runs once per page view, before any script reads storage: MechsStorage
   calls run() on first access.

   This file is deliberately a long collection of tables. It describes a past
   that existed only once; whoever reads it should find the old field names
   here without searching the rest of the project. */
(function () {
    "use strict";

    var VERSION = 5;

    /* ---------------------------------------------------------- version 2 */

    /* Slot names: the German form -> the source text (English). Anything not
       in the list is left alone - weapon and equipment names were always
       English. */
    var SLOTS = {
        "Triebwerk": "Engine", "Gyroskop": "Gyro", "Sensoren": "Sensors",
        "Cockpit": "Cockpit", "Lebenserhaltung": "Life Support",
        "Wärmetauscher": "Heat Sink", "Sprungdüse": "Jump Jet",
        "Schulter": "Shoulder", "Oberarm-Aktuator": "Upper Arm Actuator",
        "Unterarm-Aktuator": "Lower Arm Actuator", "Hand": "Hand Actuator",
        "Hüfte": "Hip", "Oberschenkel": "Upper Leg Actuator",
        "Unterschenkel": "Lower Leg Actuator", "Fuß": "Foot Actuator"
    };

    function slotName(name) {
        if (!name || typeof name !== "string") { return name; }
        var rear = /\s\(Heck\)$/.test(name);
        var core = name.replace(/\s\(Heck\)$/, "");
        if (SLOTS[core]) { core = SLOTS[core]; }
        else if (core.indexOf("Munition (") === 0) { core = "Ammo (" + core.slice(10); }
        else if (core === "Munition") { core = "Ammo"; }
        return core + (rear ? " (Rear)" : "");
    }
    function weaponText(value) {
        if (typeof value !== "string") { return value; }
        return value.replace("/Rakete", "/missile")
                    .replace("(nur Wasser)", "(water only)")
                    .replace("Nahbereich", "point blank");
    }

    /* One mech (a hangar entry or a battle copy) brought to version 2. */
    function mechV2(m) {
        if (!m || m.version >= 2) { return false; }
        if (m.kritSlots) {
            Object.keys(m.kritSlots).forEach(function (location) {
                m.kritSlots[location] = (m.kritSlots[location] || []).map(slotName);
            });
        }
        (m.waffen || []).forEach(function (w) {
            w.name = slotName(w.name);            /* may carry " (Heck)" */
            w.schaden = weaponText(w.schaden);
            w.reichweite = weaponText(w.reichweite);
        });
        if (m.techbase === "Mix") { m.techbase = "Mixed"; }
        m.version = 2;
        return true;
    }

    /* ---------------------------------------------------------- version 3 */

    var LOCATIONS = { kopf: "head", zt: "ct", zth: "ctr", rth: "rtr", lth: "ltr",
                      rb: "rl", lb: "ll" };
    var WEAPON_LOCATIONS = { KO: "HD", ZT: "CT", RB: "RL", LB: "LL" };
    var CRIT_IDS = {
        triebwerk: "engine", gyroskop: "gyro", sensoren: "sensors",
        lebenserhaltung: "life-support", waermetauscher: "heat-sink",
        sprungduese: "jump-jet", schulter: "shoulder",
        armaktuator: "arm-actuator", huefte: "hip", beinaktuator: "leg-actuator",
        munition: "ammo"
    };
    var AS_CRITS = { tw: "engine", fc: "fireControl", waffe: "weapon",
                     mp: "mpHalved", mpN: "mpHits", crew: "crewStunned" };
    var CATEGORIES = {
        "eigene-bewegung": "attacker-movement", "ziel-bewegung": "target-movement",
        "ziel-gesprungen": "target-jumped", "ziel-lahm": "target-immobile",
        "wald": "woods", "wald-leicht": "light-woods", "wald-schwer": "heavy-woods",
        "teildeckung": "partial-cover", "hitze": "heat",
        "zweitziel": "secondary-target", "reichweite": "range",
        "mindestreichweite": "minimum-range", "sonstiges": "other"
    };

    var MECH_CLASSIC = {
        notizen: "notes", bewegung: "movement", waermetauscher: "heatSinks",
        panzerung: "armor", struktur: "structure", waffen: "weapons",
        kritSlots: "critSlots",
        modifikatoren: "modifiers", quelleId: "sourceId", typ: "type",
        techbase: "techBase", rolle: "role", quelle: "source",
        bewegungsart: "moveType"
    };
    var WEAPON = { zone: "location", schaden: "damage", hitze: "heat",
                   reichweite: "range", munition: "ammo" };
    var BATTLE = { einheiten: "units", runde: "round", rundenLimit: "roundLimit" };
    var INITIATIVE = { runde: "round", wir: "us", gegner: "enemy",
                       wirN: "usCount", gegnerN: "enemyCount" };
    var UNIT = {
        kopie: "copy", pSchaden: "armorDamage", sSchaden: "structureDamage",
        hitze: "heat", munition: "ammoUsed", waffenHin: "weaponsOut",
        pilotTreffer: "pilotHits", zerstoert: "destroyed", notiz: "note",
        krits: "crits", slotKrits: "slotCrits", abgefeuert: "fired",
        hitzeRunde: "roundHeat", entfernung: "distance", angriff: "attack",
        modAktiv: "activeMods",
        dPanzer: "armorDamage", dStruktur: "structureDamage",
        ovAngesagt: "ovDeclared", hitzeExtern: "externalHeat",
        motiveWurf: "motiveRoll", stand: "asOf"
    };
    var ROLL = { summe: "total", treffer: "hit", zonen: "locations",
                 zone: "location", heck: "rear", krit: "crit", dmg: "damage" };
    var CLUSTER = { wurf: "roll", n: "hits", groesse: "size" };
    var CAMPAIGNS = { aktiv: "active", kampagnen: "campaigns" };
    var CAMPAIGN = { angelegt: "created", zustaende: "states", protokoll: "log" };
    var LOG = { datum: "date", runden: "rounds", notiz: "note",
                einheiten: "units" };
    var SCHEME = { basis: "base", akzent: "accent" };

    function rename(object, table) {
        if (!object || typeof object !== "object") { return object; }
        Object.keys(table).forEach(function (old) {
            var fresh = table[old];
            if (old !== fresh && Object.prototype.hasOwnProperty.call(object, old)) {
                object[fresh] = object[old];
                delete object[old];
            }
        });
        return object;
    }
    /* The keys of an object whose keys are locations. */
    function locations(object) { return rename(object, LOCATIONS); }

    function mechV3(m) {
        if (!m || m.version >= 3) { return false; }
        rename(m, MECH_CLASSIC);
        rename(m.movement, { gehen: "walk", springen: "jump" });
        rename(m.heatSinks, { anzahl: "count", doppelt: "double" });
        locations(m.armor);
        locations(m.structure);
        locations(m.critSlots);
        (m.weapons || []).forEach(function (w) {
            rename(w, WEAPON);
            if (WEAPON_LOCATIONS[w.location]) { w.location = WEAPON_LOCATIONS[w.location]; }
        });
        (m.modifiers || []).forEach(function (x) { rename(x, { wert: "value" }); });
        if (m.as) { rename(m.as, { panzerung: "armor", struktur: "structure" }); }
        m.version = 3;
        return true;
    }

    function unitV3(e) {
        rename(e, UNIT);
        locations(e.armorDamage);
        locations(e.structureDamage);
        locations(e.slotCrits);
        /* Classic keeps a list of recorded crits, Alpha Strike an object of
           counters - the same field in two shapes. */
        if (Array.isArray(e.crits)) {
            e.crits.forEach(function (c) {
                rename(c, { k: "component", zone: "location" });
                if (CRIT_IDS[c.component]) { c.component = CRIT_IDS[c.component]; }
                /* The location came out of a select whose labels are
                   translated - up to v3 the German page wrote its own
                   abbreviation in here. */
                if (WEAPON_LOCATIONS[c.location]) { c.location = WEAPON_LOCATIONS[c.location]; }
            });
        } else {
            rename(e.crits, AS_CRITS);
        }
        rename(e.motiveRoll, { stufe: "level" });
        rename(e.roundHeat, { waffen: "weapons", bewegung: "movement" });
        rename(e.attack, CATEGORIES);
        /* The rolls of a round sit in an OBJECT keyed by weapon index
           ({0: …, 2: …}) - the record sheet writes them as e.fired[i].
           Older states of a single round could also be an array, so both
           shapes are walked by their values. */
        var fired = e.fired;
        var rolls = Array.isArray(fired) ? fired
            : Object.keys(fired || {}).map(function (k) { return fired[k]; });
        rolls.forEach(function (f) {
            if (!f || typeof f !== "object") { return; }
            rename(f, ROLL);
            rename(f.cluster, CLUSTER);
            (f.locations || []).forEach(function (loc) {
                rename(loc, ROLL);
                /* Here the location code stands as a VALUE. */
                if (LOCATIONS[loc.location]) { loc.location = LOCATIONS[loc.location]; }
            });
        });
        return e;
    }

    function battleV3(state) {
        if (!state || state.version >= 3) { return false; }
        rename(state, BATTLE);
        rename(state.initiative, INITIATIVE);
        (state.units || []).forEach(function (e) { unitV3(e); mechV3(e.copy); });
        state.version = 3;
        return true;
    }

    function campaignsV3(d) {
        if (!d || d.version >= 3) { return false; }
        rename(d, CAMPAIGNS);
        (d.campaigns || []).forEach(function (c) {
            rename(c, CAMPAIGN);
            Object.keys(c.states || {}).forEach(function (id) { unitV3(c.states[id]); });
            (c.log || []).forEach(function (entry) {
                rename(entry, LOG);
                (entry.units || []).forEach(function (u) {
                    rename(u, { zerstoert: "destroyed", kurz: "summary" });
                });
            });
        });
        d.version = 3;
        return true;
    }

    /* ---------------------------------------------------------- version 4 */

    /* Up to version 3 the slot editor of the hangar wrote back what it
       DISPLAYED. Names that a language pack builds from a pattern
       ("Ammo (LRM 10)" -> "Munition (LRM 10)") have no entry of their own in
       the dictionary, so MechsI18n.back() found no way back and the German
       text ended up in the 'Mech. The ammo explosion then never fired
       (slotToggle looks for /^Ammo/) and componentFromName() did not
       recognise the slot. slotName() from version 2 already knows the way
       back; here it runs over 'Mechs that are already at version 3.
       c-hangar.js keeps the source text of an untouched field since then, so
       this closes a gap rather than papering over one. */
    function mechV4(m) {
        if (!m || m.version >= 4) { return false; }
        Object.keys(m.critSlots || {}).forEach(function (location) {
            m.critSlots[location] = (m.critSlots[location] || []).map(slotName);
        });
        m.version = 4;
        return true;
    }

    /* ---------------------------------------------------------- version 5 */

    /* The unit database moved from daten/mechs to data/units and its icons
       from img/mechs to img/units - the folders hold vehicles, infantry and
       ProtoMechs too, so "mechs" had become wrong. A 'Mech taken over from
       the database carries the icon path with it, and that path is now a
       404. Only the prefix changes; a photo of the model lives in IndexedDB
       and is not affected. */
    function mechV5(m) {
        if (!m || m.version >= 5) { return false; }
        if (typeof m.icon === "string" && m.icon.indexOf("img/mechs/") === 0) {
            m.icon = "img/units/" + m.icon.slice(10);
        }
        m.version = 5;
        return true;
    }

    /* --- Storage keys: read, put under the new name, delete ---------------
       The prefix "mechs-" stays; only the part behind it becomes English. */
    var KEYS = [
        ["gefecht-classic", "battle-classic"],
        ["gefecht-alpha-strike", "battle-alpha-strike"],
        ["kampagnen-classic", "campaigns-classic"],
        ["kampagnen-alpha-strike", "campaigns-alpha-strike"],
        ["schemata", "schemes"],
        ["anleitung", "guide"]
        /* "mechs-sprache" -> "mechs-lang" is i18n.js's own job: that script
           runs in the <head>, long before this one is loaded, and the value
           sits in storage as raw text rather than JSON. */
    ];

    function keysV3(S) {
        var n = 0;
        KEYS.forEach(function (pair) {
            var value = S.load(pair[0], null);
            if (value === null || value === undefined) { return; }
            if (S.load(pair[1], null) === null) { S.save(pair[1], value); }
            S.remove(pair[0]);
            n++;
        });
        return n;
    }

    /* ------------------------------------------------------------ the run */

    function hangar(system, S) {
        var h = S.loadHangar(system);
        var n = 0;
        (h.mechs || []).forEach(function (m) {
            if (mechV2(m)) { n++; }
            if (mechV3(m)) { n++; }
            if (mechV4(m)) { n++; }
            if (mechV5(m)) { n++; }
        });
        if (h.version !== VERSION) { h.version = VERSION; n++; }
        if (n) { S.saveHangar(system, h); }
        return n;
    }

    function battle(system, S) {
        var state = S.load("battle-" + system, null);
        if (!state) { return 0; }
        var n = 0;
        (state.einheiten || state.units || []).forEach(function (e) {
            if (mechV2(e.kopie || e.copy)) { n++; }
        });
        if (battleV3(state)) { n++; }
        (state.units || []).forEach(function (e) {
            if (mechV4(e.copy)) { n++; }
            if (mechV5(e.copy)) { n++; }
        });
        if (n) { S.save("battle-" + system, state); }
        return n;
    }

    function campaigns(system, S) {
        var d = S.load("campaigns-" + system, null);
        if (!d) { return 0; }
        var n = campaignsV3(d) ? 1 : 0;
        if (n) { S.save("campaigns-" + system, d); }
        return n;
    }

    function schemes(S) {
        var d = S.load("schemes", null);
        if (!d || d.version >= VERSION) { return 0; }
        rename(d, { liste: "list" });
        (d.list || []).forEach(function (s) { rename(s, SCHEME); });
        d.version = VERSION;
        S.save("schemes", d);
        return 1;
    }

    function guide(S) {
        var d = S.load("guide", null);
        if (!d || d.version >= VERSION) { return 0; }
        rename(d, { erledigt: "done" });
        d.version = VERSION;
        S.save("guide", d);
        return 1;
    }

    /* An imported backup or a shared link: lift everything to today's state,
       whatever version it comes from. */
    function packageV3(p) {
        if (!p) { return p; }
        rename(p, { typ: "type", exportiert: "exported", kampagnen: "campaigns" });
        (p.mechs || []).forEach(function (m) { mechV2(m); mechV3(m); rename(m, { foto: "photo" }); });
        if (p.campaigns) { campaignsV3(p.campaigns); }
        p.version = VERSION;
        return p;
    }

    function mech(m) { mechV2(m); mechV3(m); return m; }

    var hasRun = false;
    /* Every step on its own: a structure that surprises the migration must
       not take the whole app down with it. MechsStorage calls run() while it
       is setting itself up - an exception here would leave every page after
       it without storage. The step is skipped, its old data stays as it is,
       and the console says which one it was. */
    function schritt(name, f) {
        try {
            return f();
        } catch (e) {
            if (window.console && console.warn) {
                console.warn("Mechs: migration step " + name + " failed - data left untouched", e);
            }
            return 0;
        }
    }

    function run(S) {
        if (hasRun || !S) { return; }
        hasRun = true;
        var n = schritt("keys", function () { return keysV3(S); });
        ["classic", "alpha-strike"].forEach(function (system) {
            n += schritt("hangar " + system, function () { return hangar(system, S); });
            n += schritt("battle " + system, function () { return battle(system, S); });
            n += schritt("campaigns " + system, function () { return campaigns(system, S); });
        });
        n += schritt("schemes", function () { return schemes(S); });
        n += schritt("guide", function () { return guide(S); });
        if (n && window.console && console.info) {
            /* Just a note for the console - the user notices nothing. */
            console.info("Mechs: migrated stored data to version " + VERSION + " (" + n + " changes).");
        }
    }

    window.MechsMigrate = {
        run: run,
        mech: mech,                /* for the backup import and the tests */
        package: packageV3,
        battle: battleV3,
        campaigns: campaignsV3,
        slotName: slotName,
        weaponText: weaponText,
        VERSION: VERSION
    };
})();
