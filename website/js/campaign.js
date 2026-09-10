/* Campaign light (CONCEPT §10, F9): damage survives the end of a battle.
   When a battle ends, the state of every unit moves into its campaign, the
   campaign page shows it and repairs it at the push of a button, and the
   next battle starts from there. Pure bookkeeping over our own tracker
   fields - no rules values are added.

   What stays: armor, structure, crits, downed weapons, spent ammo, pilot
   hits, "destroyed".
   What is reset: everything that only holds for one round or one battle -
   heat, the declared overheat, rolls, notes, a stunned crew. */
(function () {
    "use strict";

    /* Freshly created structures carry today's data version right away,
       otherwise migrate.js sends them through again on the next start. */
    var DATA_VERSION = (window.MechsMigrate && MechsMigrate.VERSION) || 3;

    var T = window.T || function (s) { return s; };

    /* The fields that make up a battle state, per system. */
    var FIELDS = {
        classic: ["armorDamage", "structureDamage", "crits", "slotCrits", "weaponsOut", "ammoUsed", "pilotHits", "destroyed"],
        "alpha-strike": ["armorDamage", "structureDamage", "crits", "destroyed"]
    };

    function copy(value) {
        return (value === undefined || value === null) ? value : JSON.parse(JSON.stringify(value));
    }
    function isEmpty(value) {
        if (!value) { return true; }
        if (Array.isArray(value)) { return value.length === 0; }
        if (typeof value === "object") {
            return Object.keys(value).every(function (k) { return !value[k]; });
        }
        return !value;
    }

    /* Battle unit -> state (null when completely unhurt). */
    function readState(system, e) {
        var fields = FIELDS[system] || [];
        var state = { version: DATA_VERSION, asOf: new Date().toISOString().slice(0, 10) };
        var anything = false;
        fields.forEach(function (f) {
            var value = copy(e[f]);
            if (f === "crits" && system === "alpha-strike" && value) {
                /* A stunned crew is a round state, not damage - and so is
                   the turn it wears off in. */
                delete value.crewStunned;
                delete value.crewStunnedUntil;
            }
            if (!isEmpty(value)) { state[f] = value; anything = true; }
        });
        return anything ? state : null;
    }
    /* State -> a fresh battle unit (known fields only). */
    function applyState(system, e, state) {
        if (!state) { return e; }
        (FIELDS[system] || []).forEach(function (f) {
            if (state[f] !== undefined) { e[f] = copy(state[f]); }
        });
        return e;
    }

    /* --- Campaigns: named containers for state and log --------------------
       The hangar describes the unit, the campaign its state. That way
       several campaigns can run side by side without overwriting each
       other. */
    var STORE = "campaigns-";
    var migrated = {};

    function today() { return new Date().toISOString().slice(0, 10); }
    function storage() { return window.MechsStorage; }
    function newCampaign(name) {
        return { id: (storage() ? storage().newId() : "k" + Date.now()), name: name,
                 created: today(), states: {}, log: [] };
    }
    function data(system) {
        var d = storage() ? storage().load(STORE + system, null) : null;
        if (!d || !d.campaigns || !d.campaigns.length) {
            d = { version: DATA_VERSION, campaigns: [newCampaign(T("First campaign"))] };
            d.active = d.campaigns[0].id;
            saveData(system, d);
        }
        return d;
    }
    function saveData(system, d) { if (storage()) { storage().save(STORE + system, d); } }
    function active(system, d) {
        d = d || data(system);
        return d.campaigns.filter(function (c) { return c.id === d.active; })[0] || d.campaigns[0];
    }
    /* Once per page: pull old mech.zustand entries into the active campaign.
       Before named campaigns existed, the state hung on the hangar entry. */
    function migrateOldStates(system) {
        if (migrated[system] || !storage()) { return; }
        migrated[system] = true;
        var mechs = storage().loadHangar(system).mechs;
        var old = mechs.filter(function (m) { return m.zustand; });
        if (!old.length) { return; }
        var d = data(system);
        var c = active(system, d);
        old.forEach(function (m) {
            c.states[m.id] = m.zustand;
            delete m.zustand;
            storage().saveMech(system, m);
        });
        saveData(system, d);
    }
    function stateOf(system, mechId) {
        migrateOldStates(system);
        return active(system).states[mechId] || null;
    }
    function setState(system, mechId, state) {
        migrateOldStates(system);
        var d = data(system);
        var c = active(system, d);
        if (state) { c.states[mechId] = state; } else { delete c.states[mechId]; }
        saveData(system, d);
    }
    function campaigns(system) { return data(system).campaigns; }
    function activeId(system) { return data(system).active; }
    function create(system, name) {
        var d = data(system);
        var c = newCampaign(name || T("New campaign"));
        d.campaigns.push(c);
        d.active = c.id;
        saveData(system, d);
        return c;
    }
    function activate(system, id) {
        var d = data(system);
        if (d.campaigns.some(function (c) { return c.id === id; })) { d.active = id; saveData(system, d); }
    }
    function rename(system, id, name) {
        var d = data(system);
        d.campaigns.forEach(function (c) { if (c.id === id) { c.name = name; } });
        saveData(system, d);
    }
    function remove(system, id) {
        var d = data(system);
        if (d.campaigns.length < 2) { return false; }
        d.campaigns = d.campaigns.filter(function (c) { return c.id !== id; });
        if (d.active === id) { d.active = d.campaigns[0].id; }
        saveData(system, d);
        return true;
    }
    function log(system) { return active(system).log || []; }
    function appendLogEntry(system, entry) {
        var d = data(system);
        var c = active(system, d);
        c.log = c.log || [];
        c.log.unshift(entry);
        if (c.log.length > 100) { c.log.length = 100; }
        saveData(system, d);
    }
    function removeLogEntry(system, index) {
        var d = data(system);
        var c = active(system, d);
        (c.log || []).splice(index, 1);
        saveData(system, d);
    }

    function isDamaged(system, mech) { return !!(mech && stateOf(system, mech.id)); }

    function critText(n) { return n + " " + T(n === 1 ? "crit" : "crits"); }
    function slotCritCount(slotCrits) {
        var n = 0;
        Object.keys(slotCrits || {}).forEach(function (loc) { n += (slotCrits[loc] || []).length; });
        return n;
    }

    /* Short form for the hangar and the selection list. */
    function summary(system, state) {
        if (!state) { return ""; }
        var parts = [];
        function total(object) {
            var s = 0;
            Object.keys(object || {}).forEach(function (k) { s += object[k] || 0; });
            return s;
        }
        if (system === "classic") {
            var armor = total(state.armorDamage), structure = total(state.structureDamage);
            if (armor) { parts.push(T("Armor") + " −" + armor); }
            if (structure) { parts.push(T("Structure") + " −" + structure); }
            var crits = (state.crits || []).length + slotCritCount(state.slotCrits);
            if (crits) { parts.push(critText(crits)); }
            if (state.weaponsOut && Object.keys(state.weaponsOut).length) {
                var out = Object.keys(state.weaponsOut).filter(function (k) { return state.weaponsOut[k]; }).length;
                if (out) { parts.push(out + " " + T(out === 1 ? "weapon out" : "weapons out")); }
            }
            if (state.pilotHits) { parts.push(T("Pilot") + " " + state.pilotHits + " " + T("hit")); }
        } else {
            if (state.armorDamage) { parts.push(T("Armor") + " −" + state.armorDamage); }
            if (state.structureDamage) { parts.push(T("Structure") + " −" + state.structureDamage); }
            var c = state.crits || {};
            var n = (c.engine || 0) + (c.fireControl || 0) + (c.weapon || 0) + (c.mpHits || 0) +
                    (c.motive ? 1 : 0) + (c.mpHalved ? 1 : 0);
            if (n) { parts.push(critText(n)); }
        }
        if (state.destroyed) { parts.unshift(T("destroyed")); }
        if (!parts.length) { parts.push(T("damaged")); }
        return parts.join(" · ");
    }

    /* Badge for lists; null when intact. */
    function badge(system, mech) {
        var state = stateOf(system, mech.id);
        if (!state) { return null; }
        var span = document.createElement("span");
        span.className = "state-badge" + (state.destroyed ? " state-destroyed" : "");
        span.textContent = summary(system, state);
        return span;
    }

    /* Write every unit of a battle back into the campaign. Returns how many
       entries carry damage. */
    function carryOver(options) {
        var system = options.system;
        var n = 0;
        var report = [];
        options.units.forEach(function (e) {
            if (!e.mechId) { return; }          /* ad-hoc unit without a hangar entry */
            var state = readState(system, e);
            setState(system, e.mechId, state);
            if (state) { n++; }
            report.push({
                mechId: e.mechId,
                name: (e.copy && e.copy.name) || "?",
                destroyed: !!e.destroyed,
                summary: state ? summary(system, state) : T("undamaged")
            });
        });
        if (report.length) {
            appendLogEntry(system, {
                date: today(),
                rounds: options.round || null,
                note: options.note || "",
                units: report
            });
        }
        return n;
    }

    function repair(system, mech) {
        setState(system, mech.id, null);
    }

    /* --- Workshop: repair item by item ------------------------------------ */
    var LOCATION_NAME = {
        head: "Head", ct: "Center torso", ctr: "CT rear",
        rt: "Right torso", rtr: "RT rear", lt: "Left torso", ltr: "LT rear",
        ra: "Right arm", la: "Left arm", rl: "Right leg", ll: "Left leg"
    };
    var AS_CRIT_NAME = { engine: "Engine", fireControl: "Fire Control", weapon: "Weapon",
                         mpHits: "MP", mpHalved: "MP halved", motive: "Motive damage" };

    function locationName(key) { return T(LOCATION_NAME[key] || key); }

    /* Every repairable item of a state, each with a function that removes it
       from that state. */
    function items(system, mech, critName) {
        var state = stateOf(system, mech.id);
        var list = [];
        if (!state) { return list; }

        if (system === "classic") {
            Object.keys(state.armorDamage || {}).forEach(function (loc) {
                if (!state.armorDamage[loc]) { return; }
                list.push({ text: T("Armor") + " " + locationName(loc) + " −" + state.armorDamage[loc],
                            clear: function (n) { delete n.armorDamage[loc]; } });
            });
            Object.keys(state.structureDamage || {}).forEach(function (loc) {
                if (!state.structureDamage[loc]) { return; }
                list.push({ text: T("Structure") + " " + locationName(loc) + " −" + state.structureDamage[loc],
                            clear: function (n) { delete n.structureDamage[loc]; } });
            });
            Object.keys(state.slotCrits || {}).forEach(function (loc) {
                (state.slotCrits[loc] || []).forEach(function (index) {
                    var name = ((mech.critSlots || {})[loc] || [])[index] || "";
                    list.push({
                        text: T("Critical hit") + ": " + locationName(loc) + " " + T("slot") + " " + (index + 1) +
                              (name ? " (" + T(name) + ")" : ""),
                        clear: function (n) {
                            n.slotCrits[loc] = (n.slotCrits[loc] || []).filter(function (i) { return i !== index; });
                            if (!n.slotCrits[loc].length) { delete n.slotCrits[loc]; }
                        }
                    });
                });
            });
            /* Cleared by position, and the position has to survive the other
               clears: whoever repairs two crits at once would otherwise
               shorten the list with the first one and miss with the second.
               So the entry is only emptied here; the Repair button drops the
               gaps afterwards. */
            (state.crits || []).forEach(function (c, i) {
                list.push({ text: T("Critical hit") + ": " + (critName ? critName(c.component) : c.component),
                            clear: function (n) { if (Array.isArray(n.crits)) { n.crits[i] = null; } } });
            });
            Object.keys(state.weaponsOut || {}).forEach(function (index) {
                if (!state.weaponsOut[index]) { return; }
                var w = (mech.weapons || [])[index];
                list.push({ text: T("Weapon out") + ": " + (w ? w.name : "#" + index),
                            clear: function (n) { delete n.weaponsOut[index]; } });
            });
            Object.keys(state.ammoUsed || {}).forEach(function (index) {
                if (!state.ammoUsed[index]) { return; }
                var w = (mech.weapons || [])[index];
                list.push({ text: T("Restock ammo") + ": " + (w ? w.name : "#" + index) +
                                  " (" + state.ammoUsed[index] + " " + T("spent") + ")",
                            clear: function (n) { delete n.ammoUsed[index]; } });
            });
            if (state.pilotHits) {
                list.push({ text: T("Pilot") + " " + state.pilotHits + " " + T("hit"),
                            clear: function (n) { delete n.pilotHits; } });
            }
        } else {
            if (state.armorDamage) {
                list.push({ text: T("Armor") + " −" + state.armorDamage,
                            clear: function (n) { delete n.armorDamage; } });
            }
            if (state.structureDamage) {
                list.push({ text: T("Structure") + " −" + state.structureDamage,
                            clear: function (n) { delete n.structureDamage; } });
            }
            Object.keys(state.crits || {}).forEach(function (kind) {
                var value = state.crits[kind];
                if (!value) { return; }
                list.push({ text: T("Critical hit") + ": " + T(AS_CRIT_NAME[kind] || kind) + (value === true ? "" : " ×" + value),
                            clear: function (n) { n.crits[kind] = (value === true) ? false : 0; } });
            });
        }
        if (state.destroyed) {
            list.push({ text: T("destroyed – rebuild"), clear: function (n) { delete n.destroyed; } });
        }
        return list;
    }

    var repairBox = null;
    /* options: { system, mech, storage, critName, onDone } */
    function workshop(options) {
        var mech = options.mech;
        var entries = items(options.system, mech, options.critName);
        if (!repairBox) {
            repairBox = document.createElement("dialog");
            repairBox.className = "dialog-box workshop-dialog";
            repairBox.addEventListener("click", function (ev) { if (ev.target === repairBox) { repairBox.close(); } });
            document.body.appendChild(repairBox);
        }
        repairBox.innerHTML = "";
        var header = document.createElement("div");
        header.className = "pip-label";
        var title = document.createElement("span");
        title.textContent = T("Workshop");
        var name = document.createElement("span");
        name.textContent = mech.name;
        header.appendChild(title); header.appendChild(name);
        repairBox.appendChild(header);

        var note = document.createElement("p");
        note.className = "hint";
        note.textContent = T("Tick what gets repaired. The rest stays for the next battle.");
        repairBox.appendChild(note);

        var listBox = document.createElement("div");
        listBox.className = "workshop-list";
        var checkboxes = entries.map(function (item, i) {
            var row = document.createElement("div");
            row.className = "selection-row";
            var box = document.createElement("input");
            box.type = "checkbox";
            box.id = "repair-" + i;
            box.checked = true;
            var label = document.createElement("label");
            label.htmlFor = box.id;
            label.textContent = item.text;
            row.appendChild(box); row.appendChild(label);
            listBox.appendChild(row);
            return box;
        });
        repairBox.appendChild(listBox);

        var footer = document.createElement("p");
        footer.className = "cta";
        function button(className, label, onClick) {
            var b = document.createElement("button");
            b.type = "button"; b.className = className; b.textContent = T(label);
            b.addEventListener("click", onClick);
            footer.appendChild(b);
        }
        button("btn btn-primary", "Repair", function () {
            var fresh = copy(stateOf(options.system, mech.id));
            entries.forEach(function (item, i) { if (checkboxes[i].checked) { item.clear(fresh); } });
            /* The gaps that the crit entries leave behind (see items()). Only
               this one list: slotCrits holds slot numbers, and 0 is one. */
            if (Array.isArray(fresh.crits)) {
                fresh.crits = fresh.crits.filter(function (c) { return c; });
            }
            /* Tidy up: empty collections and an empty state are dropped. */
            Object.keys(fresh).forEach(function (f) {
                if (f === "version" || f === "asOf") { return; }
                if (isEmpty(fresh[f])) { delete fresh[f]; }
            });
            var rest = Object.keys(fresh).filter(function (f) { return f !== "version" && f !== "asOf"; });
            setState(options.system, mech.id, rest.length ? fresh : null);
            repairBox.close();
            options.onDone(rest.length === 0);
        });
        button("btn btn-small", "Select none", function () {
            checkboxes.forEach(function (b) { b.checked = false; });
        });
        button("btn btn-small", "Cancel", function () { repairBox.close(); });
        repairBox.appendChild(footer);
        repairBox.showModal();
    }

    /* Ending a battle, with a choice: keep the damage or discard it. This
       replaced the earlier confirm() - the button is destructive, and that
       needs more than an "OK". */
    var endBox = null;
    function endDialog(options) {
        var fromHangar = options.units.filter(function (e) { return e.mechId; }).length;
        if (!endBox) {
            endBox = document.createElement("dialog");
            endBox.className = "dialog-box";
            endBox.addEventListener("click", function (ev) { if (ev.target === endBox) { endBox.close(); } });
            document.body.appendChild(endBox);
        }
        endBox.innerHTML = "";
        var header = document.createElement("div");
        header.className = "pip-label";
        var title = document.createElement("span");
        title.textContent = T("End battle");
        header.appendChild(title);
        endBox.appendChild(header);

        var text = document.createElement("p");
        text.className = "hint";
        text.textContent = fromHangar
            ? T("Damage, crits and spent ammo can stay in the hangar – the next battle then starts from that state. You can repair there at any time.")
            : T("No unit comes from the hangar – there is nothing to carry over.");
        endBox.appendChild(text);

        var noteField = null;
        if (fromHangar) {
            var campaignName = active(options.system).name;
            var noteLabel = document.createElement("label");
            noteLabel.setAttribute("for", "battle-note");
            noteLabel.textContent = T("Note for the log") + " (" + campaignName + ")";
            endBox.appendChild(noteLabel);
            noteField = document.createElement("input");
            noteField.type = "text";
            noteField.id = "battle-note";
            noteField.placeholder = T("e.g. victory at Hesperus, withdrew after round 6");
            endBox.appendChild(noteField);
        }

        var footer = document.createElement("p");
        footer.className = "cta";
        function button(className, label, onClick) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = className;
            b.textContent = T(label);
            b.addEventListener("click", onClick);
            footer.appendChild(b);
            return b;
        }
        if (fromHangar) {
            button("btn btn-primary", "Keep damage & end", function () {
                var n = carryOver({
                    system: options.system, units: options.units,
                    round: options.round, note: noteField ? noteField.value.trim() : ""
                });
                endBox.close();
                options.onEnd(n);
            });
        }
        button(fromHangar ? "btn" : "btn btn-primary", "End without damage", function () {
            options.units.forEach(function (e) {
                if (e.mechId) { setState(options.system, e.mechId, null); }
            });
            endBox.close();
            options.onEnd(0);
        });
        button("btn btn-small", "Cancel", function () { endBox.close(); });
        endBox.appendChild(footer);
        endBox.showModal();
    }

    window.MechsCampaign = {
        readState: readState, applyState: applyState,
        isDamaged: isDamaged, summary: summary, badge: badge,
        carryOver: carryOver, repair: repair, endDialog: endDialog,
        workshop: workshop,
        /* Campaign management (campaign.html) */
        campaigns: campaigns, active: active, activeId: activeId, create: create,
        activate: activate, rename: rename, remove: remove,
        log: log, removeLogEntry: removeLogEntry,
        stateOf: stateOf, setState: setState, data: data, saveData: saveData
    };
})();
