/* Digital record sheet Classic BattleTech (CONCEPT.md 4.7): armor and
   structure per hit location, the 0-30 heat scale with its effects in plain
   words from data/classic-rules.json, ammo counters, weapon crits, pilot
   hits. Damage runs through the armor of a location first and then into the
   structure - the "−" button of a location does exactly that. */
(function () {
    "use strict";

    /* Freshly created structures carry today's data version right away,
       otherwise migrate.js would run them through once more on next start. */
    var DATA_VERSION = (window.MechsMigrate && MechsMigrate.VERSION) || 3;

    var SYSTEM = "classic";
    var KEY = "battle-" + SYSTEM;
    var S = window.MechsStorage;
    var ROOT = new URL("..", document.currentScript.src);

    /* [armor location, display, structure location or null (rear)] */
    var LOCATIONS = [
        ["head", "Head", "head"],
        ["ct", "Center torso", "ct"], ["ctr", "CT rear", null],
        ["rt", "R. torso", "rt"], ["rtr", "RT rear", null],
        ["lt", "L. torso", "lt"], ["ltr", "LT rear", null],
        ["ra", "R. arm", "ra"], ["la", "L. arm", "la"],
        ["rl", "R. leg", "rl"], ["ll", "L. leg", "ll"]
    ];
    /* Rear locations pass structure damage on to their front location. */
    var REAR_TO_STRUCTURE = { ctr: "ct", rtr: "rt", ltr: "lt" };

    var rules = null;
    var calculatorConfig = null;
    var state = S.load(KEY, { version: DATA_VERSION, units: [] });
    if (!state.round) { state.round = 1; }
    fetch(new URL("data/calculator-classic.json", ROOT))
        .then(function (r) { return r.json(); })
        .then(function (d) {
            calculatorConfig = d;
            if (rules && !battleView.hidden) { showBattle(); }
        });
    var objectUrls = [];

    var selectionView = document.getElementById("selection");
    var battleView = document.getElementById("battle");
    var unitsBox = document.getElementById("units");
    var selectionList = document.getElementById("selection-list");
    var startButton = document.getElementById("start-btn");

    fetch(new URL("data/classic-rules.json", ROOT))
        .then(function (r) { return r.json(); })
        .then(function (d) {
            rules = d;
            if (state.units.length) { showBattle(); } else { showSelection(); }
        });

    function store() { S.save(KEY, state); }
    var T = window.T || function (s) { return s; };
    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }

    /* --- Selection --------------------------------------------------------- */
    function showSelection() {
        selectionView.hidden = false;
        battleView.hidden = true;
        selectionList.innerHTML = "";
        var inBattle = {};
        state.units.forEach(function (e) { if (e.mechId) { inBattle[e.mechId] = true; } });
        var mechs = S.loadHangar(SYSTEM).mechs.filter(function (m) { return !inBattle[m.id]; });
        document.getElementById("selection-empty").hidden = mechs.length !== 0;

        mechs.forEach(function (m) {
            var row = el("div", "selection-row");
            var box = document.createElement("input");
            box.type = "checkbox";
            box.id = "choice-" + m.id;
            box.value = m.id;
            var label = document.createElement("label");
            label.htmlFor = box.id;
            label.textContent = m.name;
            /* BV is for G/P 4/5 - better or worse pilots scale it through the
               TW factor table (p. 315, kept as data). */
            var factor = bvSkillFactor(m.pilot);
            var bvEffective = m.bv ? Math.round(m.bv * factor) : 0;
            box.dataset.points = bvEffective;
            var bvText = "";
            if (m.bv) {
                bvText = " · BV " + bvEffective;
                if (factor !== 1) { bvText += " (" + m.bv + " × " + factor.toFixed(2) + ")"; }
            }
            var numbers = el("span", "mech-stats",
                m.tonnage + " t · G" + m.pilot.gunnery + "/P" + m.pilot.piloting + bvText);
            row.appendChild(box); row.appendChild(label); row.appendChild(numbers);
            if (window.MechsCampaign) {
                var badge = MechsCampaign.badge(SYSTEM, m);
                if (badge) { row.appendChild(badge); }
            }
            selectionList.appendChild(row);
        });
        updateBudget();
        startButton.textContent = state.units.length ? T("Add") : T("Start battle");
        document.getElementById("selection-back-btn").hidden = state.units.length === 0;
    }

    function bvSkillFactor(pilot) {
        var table = rules && rules.bvSkillFactor && rules.bvSkillFactor.table;
        if (!table || !pilot) { return 1; }
        var g = Math.min(8, Math.max(0, pilot.gunnery));
        var p = Math.min(8, Math.max(0, pilot.piloting));
        return table[g][p] || 1;
    }

    /* Budget: keep the sum of the selected units against an optional BV
       budget, live. */
    var budgetField = document.getElementById("budget");
    var budgetStatus = document.getElementById("budget-status");
    function updateBudget() {
        var boxes = selectionList.querySelectorAll("input:checked");
        var total = 0;
        boxes.forEach(function (b) { total += parseInt(b.dataset.points, 10) || 0; });
        var parts = [boxes.length + " " + T("selected") + " · " + total + " BV"];
        var budget = parseInt(budgetField.value, 10);
        if (budget > 0) {
            var left = budget - total;
            parts.push(left >= 0 ? left + " BV " + T("left") : T("OVER BUDGET by") + " " + (-left) + " BV");
        }
        budgetStatus.textContent = parts.join(" · ");
        budgetStatus.style.color = (budget > 0 && total > budget) ? "var(--accent-deep)" : "";
    }
    selectionList.addEventListener("change", updateBudget);
    budgetField.addEventListener("input", updateBudget);

    startButton.addEventListener("click", function () {
        var chosen = Array.prototype.slice.call(
            selectionList.querySelectorAll("input:checked")).map(function (b) { return b.value; });
        var mechs = S.loadHangar(SYSTEM).mechs;
        chosen.forEach(function (id) {
            var m = mechs.find(function (x) { return x.id === id; });
            if (!m) { return; }
            var unit = {
                gid: S.newId(),
                mechId: m.id,
                copy: JSON.parse(JSON.stringify(m)),
                armorDamage: {}, structureDamage: {},
                heat: 0,
                ammoUsed: {}, weaponsOut: {},
                pilotHits: 0,
                destroyed: false,
                note: ""
            };
            /* Campaign: damage carried over from the last battle. */
            if (window.MechsCampaign) {
                MechsCampaign.applyState(SYSTEM, unit, MechsCampaign.stateOf(SYSTEM, m.id));
            }
            state.units.push(unit);
        });
        var limit = parseInt(document.getElementById("round-limit").value, 10);
        if (limit > 0) { state.roundLimit = limit; }
        if (state.units.length) { store(); showBattle(); }
    });
    document.getElementById("selection-back-btn").addEventListener("click", showBattle);
    var lanceButton = document.getElementById("lance-btn");
    if (lanceButton && window.MechsShare) {
        lanceButton.addEventListener("click", function () {
            var entries = state.units.map(function (e) {
                var k = e.copy;
                return { q: k.sourceId || null, n: k.name, g: k.pilot.gunnery, p: k.pilot.piloting };
            });
            if (!entries.length) { return; }
            MechsShare.dialog(MechsShare.lanceLink(entries), T("Share lance") + " · " + entries.length,
                T("The recipient loads the ’Mechs from their own database – custom builds only via the single-unit link in the hangar."));
        });
    }
    var backupButton = document.getElementById("backup-btn");
    if (backupButton) {
        backupButton.addEventListener("click", function () {
            S.createExport(SYSTEM).then(function (blob) {
                var a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "mechs-hangar-" + SYSTEM + ".json";
                a.click();
                setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
            });
        });
    }

    /* --- Battle ------------------------------------------------------------ */
    function showBattle() {
        selectionView.hidden = true;
        battleView.hidden = false;
        objectUrls.forEach(URL.revokeObjectURL);
        objectUrls = [];
        unitsBox.innerHTML = "";
        unitsBox.appendChild(roundBar());
        if (state.units.length > 1) { unitsBox.appendChild(mechJumpBar()); }
        state.units.forEach(function (e) { unitsBox.appendChild(unitCard(e)); });
        /* The bar at the bottom too: whoever works down card by card closes
           the round right there. */
        if (state.units.length) { unitsBox.appendChild(roundBar()); }
    }

    /* --- Round mechanics: the end-phase checklist with the heat maths ------ */
    function roundBar() {
        var bar = el("div", "round-bar");
        var text = T("Round") + " " + state.round + (state.roundLimit ? "/" + state.roundLimit : "");
        bar.appendChild(el("span", "round-number", text));
        if (window.MechsInitiative) {
            bar.appendChild(MechsInitiative.bar({
                state: state, save: store, rerender: showBattle, alphaStrike: false
            }));
        }
        if (state.roundLimit && state.round >= state.roundLimit) {
            if (state.round > state.roundLimit) {
                bar.appendChild(el("span", "round-limit", "Limit reached!"));
            }
            var more = el("button", "btn btn-small", "+1 round");
            more.type = "button";
            more.title = T("Raise the round limit by one");
            more.addEventListener("click", function () {
                state.roundLimit++;
                store(); showBattle();
            });
            bar.appendChild(more);
        }
        var button = el("button", "btn btn-small btn-primary", "End phase");
        button.type = "button";
        button.addEventListener("click", startEndPhase);
        bar.appendChild(button);
        return bar;
    }

    var epDialog = null;
    var epCancel = null;
    function startEndPhase() {
        var alive = state.units.filter(function (e) { return !e.destroyed; });
        if (!alive.length) { return; }
        if (!epDialog) {
            epDialog = document.createElement("dialog");
            epDialog.className = "dialog-box end-phase-dialog";
            epDialog.addEventListener("click", function (ev) {
                if (ev.target === epDialog && epCancel) { epCancel(); }
            });
            /* Escape */
            epDialog.addEventListener("cancel", function () {
                if (epCancel) { epCancel(); }
            });
            document.body.appendChild(epDialog);
        }
        var step = 0;
        /* Undo the steps already applied when the phase is cancelled - only
           finishing it makes the end phase final. */
        var backup = alive.map(function (e) {
            return { e: e, heat: e.heat };
        });
        epCancel = function () {
            backup.forEach(function (s) { s.e.heat = s.heat; });
            epCancel = null;
            epDialog.close();
            showBattle();
        };

        function show() {
            var e = alive[step];
            var m = e.copy;
            var perSink = m.heatSinks.double ? 2 : 1;
            var dissipation = Math.max(0, (m.heatSinks.count - critCount(e, "heat-sink")) * perSink);
            var engineHits = critCount(e, "engine");
            var generated = (engineHits >= 1 ? (engineHits >= 2 ? 10 : 5) : 0) +
                (e.roundHeat ? (e.roundHeat.weapons || 0) + (e.roundHeat.movement || 0) : 0);
            epDialog.innerHTML = "";

            var header = el("div", "pip-label");
            header.appendChild(el("span", "", T("End phase · round") + " " + state.round));
            header.appendChild(el("span", "", (step + 1) + "/" + alive.length));
            epDialog.appendChild(header);
            epDialog.appendChild(el("h3", "", m.name));
            epDialog.appendChild(el("p", "hint",
                T("Enter movement and weapon heat – dissipation of") + " " + dissipation + " " +
                T("is subtracted.") + (engineHits ? " " + T("Engine hits:") + " +" + generated + " " + T("already pre-filled.") : "")));

            var preview = el("p", "heat-effect");
            var effects = el("p", "hint");
            function recompute() {
                return Math.max(0, Math.min(30, e.heat + generated - dissipation));
            }
            function draw() {
                var next = recompute();
                preview.textContent = T("Heat") + " " + e.heat + " + " + generated + " − " + dissipation + " → " + next;
                effects.textContent = next > 0 ? (heatSummary(next) || T("no effects")) : "";
            }
            var box = el("div", "heat-display");
            var stepper = el("span", "stepper");
            var minus = el("button", "", "−");
            minus.type = "button";
            var display = el("span", "value");
            var plus = el("button", "", "+");
            plus.type = "button";
            function drawStepper() { display.textContent = "+" + generated; draw(); }
            minus.addEventListener("click", function () { if (generated > 0) { generated--; drawStepper(); } });
            plus.addEventListener("click", function () { if (generated < 40) { generated++; drawStepper(); } });
            stepper.appendChild(minus); stepper.appendChild(display); stepper.appendChild(plus);
            box.appendChild(stepper);
            epDialog.appendChild(box);
            drawStepper();
            epDialog.appendChild(preview);
            epDialog.appendChild(effects);

            var footer = el("p", "cta");
            var apply = el("button", "btn btn-primary",
                step + 1 < alive.length ? "Apply & next" : "Apply & finish the round");
            apply.type = "button";
            apply.addEventListener("click", function () {
                e.heat = recompute();
                e.roundHeat = null;
                e.fired = {};
                next();
            });
            var skip = el("button", "btn btn-small", "Skip");
            skip.type = "button";
            skip.addEventListener("click", next);
            var cancel = el("button", "btn btn-small", "Cancel");
            cancel.type = "button";
            cancel.title = T("Cancel the end phase – discard all inputs, the round continues");
            cancel.addEventListener("click", function () { if (epCancel) { epCancel(); } });
            footer.appendChild(apply);
            footer.appendChild(skip);
            footer.appendChild(cancel);
            epDialog.appendChild(footer);
        }
        function next() {
            step++;
            if (step < alive.length) { show(); return; }
            state.round++;
            delete state.initiative;
            epCancel = null;
            epDialog.close();
            store(); showBattle();
        }
        show();
        epDialog.showModal();
    }

    function heatSummary(heat) {
        var best = { mp: null, attack: null, shutdown: null, ammo: null };
        rules.heatThresholds.forEach(function (s) {
            if (heat >= s.value) { best[s.type] = T(s.effect); }
        });
        var parts = [];
        ["mp", "attack", "shutdown", "ammo"].forEach(function (t) {
            if (best[t]) { parts.push(best[t]); }
        });
        return parts.join(" · ");
    }
    function runMp(walk) { return Math.ceil(walk * 1.5); }

    function critDef(id) {
        return rules.critComponents.find(function (k) { return k.id === id; });
    }
    /* Names of all slots that were hit (for mechs with a crit table). */
    function hitSlotNames(e) {
        var names = [];
        var slots = e.copy.critSlots;
        if (!slots) { return names; }
        Object.keys(e.slotCrits || {}).forEach(function (location) {
            e.slotCrits[location].forEach(function (i) {
                var n = (slots[location] || [])[i];
                if (n) { names.push(n); }
            });
        });
        return names;
    }
    function componentFromName(name) {
        var t = name.toLowerCase();
        var match = rules.critSlots.nameMap.find(function (p) {
            return t.indexOf(p[0]) !== -1;
        });
        return match ? match[1] : null;
    }
    /* Hits per component: slot hits plus the (older) list entries. */
    function critCount(e, id) {
        var n = e.crits.filter(function (k) { return k.component === id; }).length;
        hitSlotNames(e).forEach(function (name) {
            if (componentFromName(name) === id) { n++; }
        });
        return n;
    }
    function heatAttackMod(heat) {
        var mod = 0;
        rules.heatThresholds.forEach(function (s) {
            if (s.type === "attack" && heat >= s.value) {
                var m = /\+(\d+)/.exec(s.effect);
                if (m) { mod = parseInt(m[1], 10); }
            }
        });
        return mod;
    }
    function checkCritConsequences(e) {
        if (critCount(e, "engine") >= 3) { e.destroyed = true; }
        if (critCount(e, "cockpit") >= 1) { e.destroyed = true; e.pilotHits = 6; }
    }
    /* Weapon <-> crit slot: exact by location and by instance. Ammo slots do
       not count (the explosion hits the bin, not the barrel).

       Name matching in two stages: canon() levels out spelling variants
       ("LB 10-X AC" = "LBXAC 10", "AC/10" = "Autocannon/10", "MG" = "Machine
       Gun", words in another order), and only when that finds nothing does
       the rough substring comparison step in. Several identical weapons in
       one location share their slots in order - the left ER large laser does
       not go out with the right one. */
    var WEAPON_ALIAS = [["lightmachinegunarray", "lmga"], ["machinegunarray", "mga"],
                        ["machinegun", "mg"], ["antimissilesystem", "ams"],
                        ["silverbulletgaussrifle", "sbgr"], ["autocannon", "ac"],
                        ["snubnose", "sn"], ["rocketlauncher", "rl"],
                        ["improvedatm", "iatm"], ["cliatm", "iatm"],
                        ["battlemech", "mek"], ["werppc", "enhancedppc"],
                        ["computer", ""], ["unit", ""]];
    var SLOT_LOCATION_FROM_WEAPON = { ko: "head" };
    function flat(t) { return t.toLowerCase().replace(/[\s­\-/.()'’]+/g, ""); }
    function flatAlias(t) {
        t = flat(t);
        WEAPON_ALIAS.forEach(function (a) { t = t.split(a[0]).join(a[1]); });
        return t.replace(/cp$/, "");   /* the "(CP)" prototype marker */
    }
    function canon(t) {
        return flatAlias(t).split("").sort().join("");
    }
    function slotStatusPerWeapon(e) {
        var m = e.copy;
        var status = m.weapons.map(function () { return false; });
        if (!m.critSlots) { return status; }
        var groups = {};
        m.weapons.forEach(function (w, i) {
            var z = (w.location || "").toLowerCase();
            z = SLOT_LOCATION_FROM_WEAPON[z] || z;
            var key = z + "|" + canon(w.name);
            if (!groups[key]) {
                groups[key] = { location: z, canon: canon(w.name), name: w.name, wIdx: [] };
            }
            groups[key].wIdx.push(i);
        });
        Object.keys(groups).forEach(function (key) {
            var g = groups[key];
            var slots = m.critSlots[g.location] || [];
            var usable = [];
            slots.forEach(function (name, si) {
                if (name && componentFromName(name) !== "ammo") {
                    usable.push([si, name]);
                }
            });
            var pool = usable.filter(function (p) { return canon(p[1]) === g.canon; })
                .map(function (p) { return p[0]; });
            if (!pool.length) {
                var wFlat = flatAlias(g.name);
                pool = usable.filter(function (p) {
                    var n = flatAlias(p[1]);
                    return n.indexOf(wFlat) !== -1 || wFlat.indexOf(n) !== -1;
                }).map(function (p) { return p[0]; });
            }
            if (!pool.length) { return; }
            var hit = (e.slotCrits && e.slotCrits[g.location]) || [];
            var perWeapon = Math.max(1, Math.floor(pool.length / g.wIdx.length));
            g.wIdx.forEach(function (wi, k) {
                var from = k * perWeapon;
                var to = k === g.wIdx.length - 1 ? pool.length : from + perWeapon;
                for (var si = from; si < to; si++) {
                    if (hit.indexOf(pool[si]) !== -1) { status[wi] = true; return; }
                }
            });
        });
        return status;
    }
    /* Expanded crit locations survive the redraw of the card. */
    var openLocations = {};

    /* Jump straight to the right mech instead of scrolling. */
    function mechJumpBar() {
        var bar = el("div", "mech-jump-bar");
        state.units.forEach(function (e) {
            var chip = el("button", "special-chip" + (e.destroyed ? " is-gone" : ""),
                e.copy.name.replace(/\s*\(.*\)\s*/, " ").trim());
            chip.type = "button";
            chip.addEventListener("click", function () {
                var target = document.getElementById("unit-" + e.gid);
                if (target) { target.scrollIntoView({ behavior: "smooth", block: "start" }); }
            });
            bar.appendChild(chip);
        });
        return bar;
    }

    /* --- The attack as a popup: GATOR + dice + hit location ---------------- */
    /* [key in rules.hitLocations, label] */
    var DIRECTIONS = [["front", "front"], ["left", "left"],
                      ["right", "right"], ["rear", "rear"]];
    var MOVEMENT_HEAT = [0, 1, 2, 3, 0];   /* stood, walked, ran, jumped (min. 3), prone */
    var agDialog = null;

    /* --- Weapons in the attack -------------------------------------------
       Range bands, cluster hits and damage per shot are rules maths and live
       in js/weapon-math.js; here only what needs the dice and the state. */
    var WM = window.MechsWeaponMath;

    /* Results are stored language-neutrally (location keys instead of text),
       the display text only comes about when drawing - that way a roll stays
       readable after a change of language. */
    function rollLocation(direction) {
        var total = MechsDice.d6() + MechsDice.d6();
        var entry = rules.hitLocations[direction][String(total)];
        if (!entry) { return { location: "?", rear: false, crit: false, total: total }; }
        return { location: entry[0], rear: direction === "rear" && !!REAR_TO_STRUCTURE[entry[0] + "r"],
                 crit: entry[1], total: total };
    }
    function locationText(z) {
        if (z.location === "?") { return "?"; }
        return T(LOCATION_NAME[z.location] || z.location) + (z.rear ? " " + T("(rear armor)") : "") +
            (z.crit ? " (" + T("crit") + "!)" : "");
    }
    /* Display text of a stored roll (older states: finished text). */
    function rollText(result) {
        if (!result || typeof result !== "object") { return String(result || ""); }
        var t = result.total + " " + (result.hit ? T("HIT") : T("miss"));
        if (result.cluster) {
            t += " · " + T("Cluster") + " " + result.cluster.roll + " → " + result.cluster.hits + "/" + result.cluster.size + ": " +
                result.locations.map(function (z) { return z.damage + " → " + locationText(z); }).join(", ");
        } else if (result.locations && result.locations.length) {
            t += " → " + locationText(result.locations[0]);
        }
        return t;
    }
    function showAttackDialog(e) {
        var m = e.copy;
        if (!agDialog) {
            agDialog = document.createElement("dialog");
            agDialog.className = "dialog-box attack-dialog";
            agDialog.addEventListener("click", function (ev) {
                if (ev.target === agDialog) { agDialog.close(); }
            });
            agDialog.addEventListener("close", function () { store(); showBattle(); });
            document.body.appendChild(agDialog);
        }
        agDialog.innerHTML = "";
        var header = el("div", "pip-label");
        header.appendChild(el("span", "", "Attack · GATOR"));
        header.appendChild(el("span", "", "Gunnery " + m.pilot.gunnery));
        agDialog.appendChild(header);
        agDialog.appendChild(el("h3", "", m.name));

        var sensors = critCount(e, "sensors");
        if (sensors >= 2) {
            agDialog.appendChild(el("p", "hint",
                "Sensors destroyed – no more weapon attacks possible."));
        } else {
            var currentToHit = null;
            var currentState = e.attack || null;
            var heatMod = heatAttackMod(e.heat);
            /* Own modifiers (abilities, quirks) count into the base like the
               mech sources - they apply to every weapon. */
            var MOD = window.MechsModifiers;
            var modTotal = MOD ? MOD.sum(m, e.activeMods) : 0;
            var base = m.pilot.gunnery + heatMod + (sensors === 1 ? 2 : 0) + modTotal;
            var parts = ["Gunnery " + m.pilot.gunnery];
            if (heatMod > 0) { parts.push(T("Heat") + " +" + heatMod); }
            if (sensors === 1) { parts.push(T("Sensors") + " +2"); }
            if (MOD) { MOD.texts(m, e.activeMods).forEach(function (x) { parts.push(x); }); }
            var modChips = MOD ? MOD.chips({
                mech: m, unit: e,
                onToggle: function () { store(); redrawDialog(e); }
            }) : null;
            if (modChips) { agDialog.appendChild(modChips); }
            e.roundHeat = e.roundHeat || { weapons: 0, movement: 0 };
            e.fired = e.fired || {};
            e.ammoUsed = e.ammoUsed || {};
            var weaponBox = null, heatLine = null;
            var distance = e.distance || 6;
            var direction = "front";
            var slotStatus = slotStatusPerWeapon(e);

            function drawHeat() {
                if (!heatLine) { return; }
                heatLine.textContent = T("Heat this round:") + " " + T("weapons") + " " + e.roundHeat.weapons +
                    " + " + T("movement") + " " + e.roundHeat.movement + " = " + (e.roundHeat.weapons + e.roundHeat.movement);
            }
            function rememberMovementHeat() {
                var i = currentState && typeof currentState["attacker-movement"] === "number" ? currentState["attacker-movement"] : 0;
                e.roundHeat.movement = MOVEMENT_HEAT[i] || 0;
                drawHeat();
            }
            function drawWeapons() {
                if (!weaponBox) { return; }
                weaponBox.innerHTML = "";
                /* GATOR without the range categories - those come per
                   weapon, from the distance below. The sum itself is the
                   calculator's, so there is no second copy of it here. */
                var baseTn = MechsCalculator.toHit(calculatorConfig, currentState, {
                    baseExtra: base, withoutMechSources: true,
                    skip: ["range", "minimum-range"]
                });
                var none = true;
                m.weapons.forEach(function (w, i) {
                    if (e.weaponsOut[i] || slotStatus[i]) { return; }
                    none = false;
                    var r = WM.parseRange(w.range);
                    var band = r ? WM.bandFor(r, distance) : null;
                    var tn = band ? baseTn + band.mod + band.minPenalty : null;
                    var ammoLeft = (w.ammo !== null && w.ammo !== undefined) ? w.ammo - (e.ammoUsed[i] || 0) : null;
                    var row = el("div", "weapon-row" + (e.fired[i] ? " fired" : ""));
                    var info = el("div");
                    info.appendChild(el("div", "w-name", w.name + " (" + T(w.location) + ")"));
                    var text = !r ? T("range unknown")
                        : (!band ? T("out of range")
                        : T(band.band) + " +" + band.mod +
                          (band.minPenalty ? " · " + T("minimum range") + " +" + band.minPenalty : "") +
                          " → " + (tn > 12 ? T("impossible") : tn + "+"));
                    text += " · " + T("Damage") + " " + T(w.damage || "?") + " · " + T("Heat") + " " + (w.heat === 0 || w.heat ? w.heat : "?");
                    if (ammoLeft !== null) { text += " · " + T("ammo") + " " + ammoLeft; }
                    info.appendChild(el("div", "w-info", text));
                    if (e.fired[i]) { info.appendChild(el("div", "w-info roll-result", rollText(e.fired[i]))); }
                    row.appendChild(info);
                    var rollButton = el("button", "chip dice-chip", "⚁");
                    rollButton.type = "button";
                    rollButton.title = T("Fire weapon: roll 2D6");
                    rollButton.disabled = !band || tn > 12 || ammoLeft === 0;
                    rollButton.addEventListener("click", function () {
                        var a = MechsDice.d6(), b = MechsDice.d6(), total = a + b;
                        var hit = total >= tn;
                        var result = { total: total, hit: hit, cluster: null, locations: [] };
                        if (hit) {
                            var size = WM.clusterSize(w);
                            if (size) {
                                var clusterRoll = MechsDice.d6() + MechsDice.d6();
                                var n = WM.clusterHits(rules.clusterTable, size, clusterRoll);
                                result.cluster = { roll: clusterRoll, hits: n, size: size };
                                result.locations = WM.spreadHits(w, n, function () { return rollLocation(direction); });
                            } else {
                                result.locations = [rollLocation(direction)];
                            }
                        }
                        e.fired[i] = result;
                        if (ammoLeft !== null) { e.ammoUsed[i] = (e.ammoUsed[i] || 0) + 1; }
                        e.roundHeat.weapons += (w.heat || 0);
                        store(); drawWeapons(); drawHeat();
                    });
                    row.appendChild(rollButton);
                    weaponBox.appendChild(row);
                });
                if (none) { weaponBox.appendChild(el("p", "hint", "No usable weapon.")); }
            }

            var calculatorBox = el("div", "attack-content");
            /* OHNE die Reichweiten-Kategorien: die Entfernung steht unten
               als Stepper und wird je Waffe verrechnet, weil jede Waffe
               andere Bänder hat. Sie standen trotzdem als Chips hier und
               zählten in die große Zielzahl - ein Tipp auf "Long +4" schob
               die Anzeige von 5+ auf 9+, während die Waffenzeilen bei 7+
               blieben. Zwei Zahlen auf einem Bildschirm, die sich
               widersprachen; die Waffenzeilen hatten recht. */
            MechsCalculator.create(calculatorBox, calculatorConfig, {
                compact: true, withoutMechSources: true,
                skip: ["range", "minimum-range"],
                readoutLabel: "To-hit before range",
                baseExtra: base, baseText: parts.join(" · "),
                state: e.attack || null,
                onChange: function (aState) {
                    e.attack = aState; currentState = aState;
                    rememberMovementHeat(); store(); drawWeapons();
                },
                onToHit: function (toHit, impossible) { currentToHit = impossible ? null : toHit; }
            });
            agDialog.appendChild(calculatorBox);

            /* Distance + direction -> band, target number and dice button per weapon */
            var weaponLabel = el("div", "pip-label");
            weaponLabel.appendChild(el("span", "", "Weapons at range"));
            var distStepper = el("span", "stepper");
            var distMinus = el("button", "", "−"); distMinus.type = "button";
            var distValue = el("span", "value");
            var distPlus = el("button", "", "+"); distPlus.type = "button";
            function drawDistance() { distValue.textContent = distance + " " + T("hexes"); }
            distMinus.addEventListener("click", function () { if (distance > 1) { distance--; e.distance = distance; drawDistance(); store(); drawWeapons(); } });
            distPlus.addEventListener("click", function () { if (distance < 40) { distance++; e.distance = distance; drawDistance(); store(); drawWeapons(); } });
            distStepper.appendChild(distMinus); distStepper.appendChild(distValue); distStepper.appendChild(distPlus);
            drawDistance();
            weaponLabel.appendChild(distStepper);
            weaponLabel.style.marginTop = "0.8rem";
            agDialog.appendChild(weaponLabel);

            var directionChips = el("div", "chips");
            DIRECTIONS.forEach(function (r) {
                var chip = el("button", "chip", r[1]);
                chip.type = "button";
                chip.title = T("Direction of the attack on the target");
                chip.setAttribute("aria-pressed", String(direction === r[0]));
                chip.addEventListener("click", function () {
                    direction = r[0];
                    directionChips.querySelectorAll(".chip").forEach(function (c, j) {
                        c.setAttribute("aria-pressed", String(DIRECTIONS[j][0] === direction));
                    });
                });
                directionChips.appendChild(chip);
            });
            agDialog.appendChild(directionChips);

            weaponBox = el("div", "weapons-dialog");
            agDialog.appendChild(weaponBox);
            heatLine = el("p", "heat-effect");
            agDialog.appendChild(heatLine);
            drawWeapons();
            rememberMovementHeat();
            agDialog.appendChild(el("p", "hint",
                "Rolling = firing: ammo is ticked off, the heat is pre-filled in the end phase. Hits roll their location right away."));
            var reset = el("button", "btn btn-small", "Reset round (rolls & heat)");
            reset.type = "button";
            reset.addEventListener("click", function () {
                e.fired = {}; e.roundHeat.weapons = 0;
                store(); drawWeapons(); drawHeat();
            });
            agDialog.appendChild(reset);

            /* A free roll without a weapon (physical attacks, special cases) */
            var free = el("details", "slot-crit");
            free.appendChild(el("summary", "", "Free roll & hit location by hand"));
            free.appendChild(MechsDice.block({ toHit: function () { return currentToHit; } }));
            var locationResult = el("p", "heat-effect");
            free.appendChild(MechsDice.block({
                label: "Roll hit location",
                toHit: function () { return null; },
                onRoll: function () {
                    var z = rollLocation(direction);
                    var locName = z.location === "?" ? "?" : T(LOCATION_NAME[z.location] || z.location) + (z.rear ? " " + T("(rear armor)") : "");
                    locationResult.textContent = "→ " + locName + (z.crit ? " – " + T("automatic crit roll!") : "");
                }
            }));
            free.appendChild(locationResult);
            agDialog.appendChild(free);
        }

        var footer = el("p", "cta");
        var close = el("button", "btn btn-small", "Close");
        close.type = "button";
        close.addEventListener("click", function () { agDialog.close(); });
        footer.appendChild(close);
        agDialog.appendChild(footer);
        if (!agDialog.open) { agDialog.showModal(); }
    }
    /* Rebuild without losing the scroll position (chips toggle). */
    function redrawDialog(e) {
        var pos = agDialog ? agDialog.scrollTop : 0;
        showAttackDialog(e);
        if (agDialog) { agDialog.scrollTop = pos; }
    }

    /* --- Ammo explosion on a crit hitting an ammo slot ---------------------
       Damage = the shots left in that slot × damage per shot, straight into
       the structure of the location; without CASE the excess moves inward
       (damage transfer), plus 2 pilot hits. The numbers are shown and only
       applied on confirmation. */
    var mxDialog = null;
    function ammoExplosion(e, location, index) {
        var m = e.copy;
        var slotName = m.critSlots[location][index];
        var inner = slotName.replace(/^Ammo\s*\(?/, "").replace(/\)$/, "").trim();
        var wIdx = -1;
        m.weapons.forEach(function (w, i) { if (wIdx < 0 && canon(w.name) === canon(inner)) { wIdx = i; } });
        if (wIdx < 0) {
            var ig = flatAlias(inner);
            m.weapons.forEach(function (w, i) {
                var wg = flatAlias(w.name);
                if (wIdx < 0 && (wg.indexOf(ig) !== -1 || ig.indexOf(wg) !== -1)) { wIdx = i; }
            });
        }
        var w = wIdx >= 0 ? m.weapons[wIdx] : null;
        var slotsTotal = 0;
        Object.keys(m.critSlots).forEach(function (z) {
            m.critSlots[z].forEach(function (n) { if (n === slotName) { slotsTotal++; } });
        });
        e.ammoUsed = e.ammoUsed || {};
        var left = w && w.ammo ? Math.max(0, w.ammo - (e.ammoUsed[wIdx] || 0)) : 0;
        var perSlot = w && w.ammo && slotsTotal ? Math.ceil(w.ammo / slotsTotal) : left;
        var shots = Math.min(left, perSlot);
        var perShot = w ? WM.damagePerShot(w) : 0;
        var damage = shots * perShot;
        var hasCase = m.critSlots[location].some(function (n) { return /CASE/i.test(n); });

        if (!mxDialog) {
            mxDialog = document.createElement("dialog");
            mxDialog.className = "dialog-box";
            document.body.appendChild(mxDialog);
        }
        mxDialog.innerHTML = "";
        var header = el("div", "pip-label");
        header.appendChild(el("span", "", "Ammo explosion"));
        header.appendChild(el("span", "", T(LOCATION_NAME[location] || location)));
        mxDialog.appendChild(header);
        mxDialog.appendChild(el("h3", "", T(slotName)));
        if (!w || !shots) {
            mxDialog.appendChild(el("p", "hint",
                "No ammo left in this slot (or no matching weapon) – the slot is only marked."));
        } else {
            mxDialog.appendChild(el("p", "heat-effect",
                shots + " " + T("shots") + " × " + perShot + " = " + damage + " " + T("damage to the structure")));
            mxDialog.appendChild(el("p", "hint",
                (hasCase ? T("CASE in this location: the damage stays in the location.")
                         : T("No CASE: excess transfers inward (damage transfer).")) +
                " " + T("Plus 2 pilot hits.")));
        }
        var footer = el("p", "cta");
        if (w && shots) {
            var ok = el("button", "btn btn-primary", "Apply explosion");
            ok.type = "button";
            ok.addEventListener("click", function () {
                structureDamageAt(e, location, damage, hasCase);
                e.ammoUsed[wIdx] = (e.ammoUsed[wIdx] || 0) + shots;
                e.pilotHits = Math.min(6, (e.pilotHits || 0) + 2);
                checkDestroyed(e);
                mxDialog.close();
                store(); showBattle();
            });
            footer.appendChild(ok);
        }
        var onlyMark = el("button", "btn btn-small", "Only mark the slot");
        onlyMark.type = "button";
        onlyMark.addEventListener("click", function () { mxDialog.close(); });
        footer.appendChild(onlyMark);
        mxDialog.appendChild(footer);
        mxDialog.showModal();
    }
    function structureDamageAt(e, location, amount, caseProtects) {
        var m = e.copy;
        var sLoc = structureLocationFor(location);
        var max = m.structure[sLoc] || 0;
        var before = e.structureDamage[sLoc] || 0;
        var here = Math.min(Math.max(0, max - before), amount);
        e.structureDamage[sLoc] = before + here;
        var left = amount - here;
        if (left > 0 && !caseProtects) {
            var onward = rules.damageTransfer && rules.damageTransfer[sLoc];
            if (onward) { applyDamage(e, onward, left); }
        }
        checkDestroyed(e);
    }

    function unitCard(e) {
        var m = e.copy;
        e.crits = e.crits || [];   /* older battle states do not know the field */
        var card = el("article", "card unit-panel" + (e.destroyed ? " destroyed" : ""));
        card.id = "unit-" + e.gid;

        /* Header */
        var header = el("div", "unit-header");
        var headerImage = null;
        if (m.icon) {
            headerImage = el("img", "photo-thumb mech-icon");
            headerImage.alt = "";
            headerImage.src = new URL(m.icon, ROOT);
            header.appendChild(headerImage);
        }
        if (e.mechId) {
            S.loadPhoto(e.mechId).then(function (blob) {
                if (!blob) { return; }
                var image = el("img", "photo-thumb");
                image.alt = "";
                image.src = URL.createObjectURL(blob);
                objectUrls.push(image.src);
                if (headerImage) { header.replaceChild(image, headerImage); }
                else { header.insertBefore(image, header.firstChild); }
            });
        }
        header.appendChild(el("h3", "", m.name));
        if (e.destroyed) { header.appendChild(el("span", "destroyed-banner", "Out of action")); }
        else { header.appendChild(el("span", "pv", m.tonnage + " t")); }
        card.appendChild(header);

        /* The value band - with the crits folded in wherever the maths is
           unambiguous: leg/hip crits push the MP down, jump jets the jump,
           destroyed heat sinks the dissipation. Everything else stands next
           to it as a marker and in plain words in the crit list. */
        var legActuator = critCount(e, "leg-actuator");
        var hip = critCount(e, "hip");
        var walkEff = Math.max(0, m.movement.walk - legActuator);
        if (hip >= 2) { walkEff = 0; }
        else if (hip === 1) { walkEff = Math.ceil(walkEff / 2); }
        var jumpEff = Math.max(0, (m.movement.jump || 0) - critCount(e, "jump-jet"));
        var perSink = m.heatSinks.double ? 2 : 1;
        var dissipationEff = Math.max(0, (m.heatSinks.count - critCount(e, "heat-sink")) * perSink);

        var band = el("div", "stats-band");
        stat(band, "MP", walkEff + "/" + runMp(walkEff) + "/" + jumpEff,
            walkEff !== m.movement.walk || jumpEff !== (m.movement.jump || 0));
        stat(band, "G/P", m.pilot.gunnery + "/" + m.pilot.piloting, false);
        stat(band, "Dissipation", dissipationEff, dissipationEff !== m.heatSinks.count * perSink);
        ["engine", "gyro", "sensors", "cockpit", "life-support", "ammo",
         "shoulder", "arm-actuator", "hand"].forEach(function (id) {
            var n = critCount(e, id);
            if (n > 0) { stat(band, critDef(id).name, "×" + n, true); }
        });
        if (e.pilotHits > 0) {
            var target = rules.pilotConsciousness[e.pilotHits - 1];
            stat(band, "Pilot", e.pilotHits + " " + T("hit") + (target ? " · " + T("conscious on") + " " + target + "+" : " · " + T("DEAD")), true);
        }
        card.appendChild(band);

        /* Action: the attack runs entirely in the popup - GATOR, the dice and
           the hit location in one place (CONCEPT 4.7). */
        if (calculatorConfig && !e.destroyed) {
            var action = el("div", "action-row");
            /* Der Würfel gehört auf den Knopf: er sagt, dass dahinter
               gewürfelt wird, nicht nur gerechnet. Eigenes Element, damit
               "Attack" als Wörterbuch-Schlüssel unverändert bleibt. */
            var attackButton = el("button", "btn btn-primary action-btn");
            var die = document.createElement("span");
            die.className = "action-die";
            die.setAttribute("aria-hidden", "true");
            die.textContent = "\u2681";
            attackButton.appendChild(die);
            attackButton.appendChild(document.createTextNode(T("Attack")));
            attackButton.type = "button";
            attackButton.addEventListener("click", function () { showAttackDialog(e); });
            action.appendChild(attackButton);
            card.appendChild(action);
        }

        /* Heat */
        var heatRow = el("div", "pip-row");
        var heatLabel = el("div", "pip-label");
        heatLabel.appendChild(el("span", "", "Heat (0–30)"));
        heatRow.appendChild(heatLabel);
        var display = el("div", "heat-display");
        display.appendChild(counter(e.heat, 30, function (delta) {
            e.heat = Math.min(30, Math.max(0, e.heat + (delta < 0 ? -1 : 1)));
            store(); showBattle();
        }, true));
        heatRow.appendChild(display);
        heatRow.appendChild(el("p", "heat-effect", heatSummary(e.heat) || T("no effects")));

        /* Weapons & ammo */
        if (m.weapons.length) {
            var weaponsRow = el("div", "pip-row");
            var weaponsLabel = el("div", "pip-label");
            weaponsLabel.appendChild(el("span", "", "Weapons & ammo"));
            weaponsRow.appendChild(weaponsLabel);
            var slotStatus = slotStatusPerWeapon(e);
            m.weapons.forEach(function (w, i) {
                /* Destroyed by the manual switch OR through a slot that was hit. */
                var slotOut = slotStatus[i];
                var out = !!e.weaponsOut[i] || slotOut;
                var row = el("div", "weapon-row" + (out ? " weapon-gone" : ""));
                var toggle = el("button", "chip", out ? "✗" : "✓");
                toggle.type = "button";
                toggle.disabled = slotOut;
                toggle.title = slotOut
                    ? "Destroyed via the critical hit table – undo it there"
                    : T("Weapon") + " " + (out ? T("restore") : T("mark as destroyed"));
                toggle.style.minWidth = "44px";
                toggle.addEventListener("click", function () {
                    e.weaponsOut[i] = !e.weaponsOut[i];
                    store(); showBattle();
                });
                row.appendChild(toggle);
                /* w-body: eigene Klasse, damit der Textblock NEBEN dem
                   Haken sitzt statt darunter. Ohne sie war eine Waffe drei
                   Zeilen hoch - Haken, Name, Werte - und ein Atlas mit
                   sieben Waffen 712 px. */
                var info = el("div", "w-body");
                info.appendChild(el("div", "w-name", w.name + " (" + T(w.location) + ")"));
                info.appendChild(el("div", "w-info",
                    T("Damage") + " " + T(w.damage || "?") + " · " + T("Heat") + " " + (w.heat === 0 || w.heat ? w.heat : "?") +
                    (w.range ? " · " + T(w.range) : "")));
                row.appendChild(info);
                if (w.ammo !== null && w.ammo !== undefined) {
                    var used = e.ammoUsed[i] || 0;
                    row.appendChild(counter(w.ammo - used, w.ammo, function (delta) {
                        if (delta < 0 && used < w.ammo) { e.ammoUsed[i] = used + 1; }
                        if (delta > 0 && used > 0) { e.ammoUsed[i] = used - 1; }
                        store(); showBattle();
                    }));
                }
                weaponsRow.appendChild(row);
            });
            card.appendChild(weaponsRow);
        }

        /* Armor & structure: the "paper doll" - a model for the phone instead
           of a copy of the paper sheet (tap a location, apply damage as an
           amount). */
        card.appendChild(armorDiagram(e));

        /* Critical hits: with a recorded crit table the slots with their dice
           numbers, otherwise (older mechs) the component selection. */
        if (m.critSlots) {
            card.appendChild(slotCritSection(e));
        } else {
        var critRow = el("div", "pip-row");
        var critLabel = el("div", "pip-label");
        critLabel.appendChild(el("span", "", "Critical hits"));
        critRow.appendChild(critLabel);
        critRow.appendChild(el("p", "hint", rules.critRoll));

        e.crits.forEach(function (k, index) {
            var def = critDef(k.component);
            if (!def) { return; }
            /* Which hit on this component is it? That sets the level. */
            var level = e.crits.slice(0, index + 1).filter(function (x) { return x.component === k.component; }).length;
            var effect = def.levels
                ? def.levels[Math.min(level - 1, def.levels.length - 1)]
                : def.perHit;
            var row = el("div", "weapon-row");
            var remove = el("button", "chip", "×");
            remove.type = "button";
            remove.title = T("Undo crit");
            remove.style.minWidth = "44px";
            remove.addEventListener("click", function () {
                e.crits.splice(index, 1);
                store(); showBattle();
            });
            row.appendChild(remove);
            var info = el("div");
            info.appendChild(el("div", "w-name",
                T(def.name) + (def.levels ? " · " + level + ". " + T("hit") : "") + " (" + T(k.location) + ")"));
            info.appendChild(el("div", "w-info", effect));
            row.appendChild(info);
            critRow.appendChild(row);
        });

        var entry = el("div", "crit-entry");
        var pick = document.createElement("select");
        pick.setAttribute("aria-label", T("Component hit"));
        rules.critComponents.forEach(function (def) {
            var o = el("option", "", def.name);
            o.value = def.id;
            if (critCount(e, def.id) >= def.max) {
                o.disabled = true;
                o.textContent = T(def.name) + " " + T("(full)");
            }
            pick.appendChild(o);
        });
        var locationPick = document.createElement("select");
        locationPick.setAttribute("aria-label", T("Location of the hit"));
        ["CT", "HD", "RT", "LT", "RA", "LA", "RL", "LL"].forEach(function (z) {
            var o = el("option", "", z);
            /* Label translated, value not - otherwise the German page writes
               its own abbreviation into the battle state. */
            o.value = z;
            locationPick.appendChild(o);
        });
        var plusButton = el("button", "btn btn-small", "+ Record crit");
        plusButton.type = "button";
        plusButton.addEventListener("click", function () {
            var def = critDef(pick.value);
            if (!def || critCount(e, def.id) >= def.max) { return; }
            e.crits.push({ component: def.id, location: locationPick.value });
            var n = critCount(e, def.id);
            if (def.outOfActionAt && n >= def.outOfActionAt) { e.destroyed = true; }
            if (def.id === "cockpit") { e.pilotHits = 6; }
            store(); showBattle();
        });
        entry.appendChild(pick);
        entry.appendChild(locationPick);
        entry.appendChild(plusButton);
        critRow.appendChild(entry);
        critRow.appendChild(el("p", "hint",
            "Tick off destroyed weapons directly in the weapon list (✗)."));
        card.appendChild(critRow);
        }

        /* Pilot */
        var pilotRow = el("div", "pip-row");
        var pilotLabel = el("div", "pip-label");
        pilotLabel.appendChild(el("span", "", T("Pilot hits") + (m.pilot.name ? " · " + m.pilot.name : "")));
        pilotRow.appendChild(pilotLabel);
        pilotRow.appendChild(counter(e.pilotHits, 6, function (delta) {
            e.pilotHits = Math.min(6, Math.max(0, e.pilotHits + (delta < 0 ? -1 : 1)));
            if (e.pilotHits >= 6) { e.destroyed = true; }
            store(); showBattle();
        }, true));
        card.appendChild(pilotRow);
        card.appendChild(heatRow);

        /* Foot */
        var footer = el("p", "cta");
        var wreck = el("button", "btn btn-small", e.destroyed ? "Not out after all" : "Out of action");
        wreck.type = "button";
        wreck.addEventListener("click", function () {
            e.destroyed = !e.destroyed;
            store(); showBattle();
        });
        var remove = el("button", "btn btn-small btn-danger", "Remove");
        remove.type = "button";
        remove.addEventListener("click", function () {
            if (!confirm(Z(m.name) + " " + T("remove from the battle?"))) { return; }
            state.units = state.units.filter(function (x) { return x.gid !== e.gid; });
            store();
            if (state.units.length) { showBattle(); } else { showSelection(); }
        });
        footer.appendChild(wreck); footer.appendChild(remove);
        card.appendChild(footer);

        return card;
    }

    /* --- Paper doll: the armor diagram -------------------------------------
       Deliberately NOT a copy of the official record sheet: instead of
       hundreds of pencil pips a tappable silhouette (drawn for this project,
       in the shape language of the site) with state colours and a location
       panel that applies damage as an AMOUNT (overflow into the structure
       included). Front as on the sheet: the 'Mech looks at us, its right
       side is on the left of the picture - the rear strips follow the same
       left-right logic (x-ray view), so nothing has to be thought over. */
    var DOLL_LOCATIONS = {
        head: { points: "92,6 128,6 136,20 128,34 92,34 84,20", num: [110, 24], label: null },
        ct:   { points: "86,40 134,40 134,156 110,168 86,156", num: [110, 92], sNum: [110, 110], label: ["CT", 110, 52] },
        lt:   { points: "138,40 178,48 178,138 138,156", num: [158, 94], sNum: [158, 112], label: ["LT", 158, 58] },
        rt:   { points: "82,40 42,48 42,138 82,156", num: [62, 94], sNum: [62, 112], label: ["RT", 62, 58] },
        la:   { points: "182,52 210,62 210,168 188,176 182,144", num: [196, 112], sNum: [196, 130], label: ["LA", 196, 72] },
        ra:   { points: "38,52 10,62 10,168 32,176 38,144", num: [24, 112], sNum: [24, 130], label: ["RA", 24, 72] },
        ll:   { points: "114,166 140,160 158,296 118,296", num: [134, 228], sNum: [134, 246], label: ["LL", 130, 182] },
        rl:   { points: "106,166 80,160 62,296 102,296", num: [86, 228], sNum: [86, 246], label: ["RL", 90, 182] },
        rtr:  { points: "236,70 262,70 262,150 236,150", num: [249, 114], label: ["RT", 249, 84] },
        ctr:  { points: "266,70 292,70 292,150 266,150", num: [279, 114], label: ["CT", 279, 84] },
        ltr:  { points: "296,70 322,70 322,150 296,150", num: [309, 114], label: ["LT", 309, 84] }
    };
    var LOCATION_NAME = {};
    LOCATIONS.forEach(function (z) { LOCATION_NAME[z[0]] = z[1]; });
    var activeLocations = {};   /* gid -> chosen location (display only, not persisted) */

    function structureLocationFor(loc) { return REAR_TO_STRUCTURE[loc] || loc; }

    function applyDamage(e, loc, amount) {
        var m = e.copy;
        var sLoc = structureLocationFor(loc);
        for (var i = 0; i < amount; i++) {
            var armorGone = e.armorDamage[loc] || 0;
            var structGone = e.structureDamage[sLoc] || 0;
            if (armorGone < (m.armor[loc] || 0)) { e.armorDamage[loc] = armorGone + 1; }
            else if (structGone < (m.structure[sLoc] || 0)) { e.structureDamage[sLoc] = structGone + 1; }
            else { break; }
        }
        checkDestroyed(e);
        store(); showBattle();
    }
    function undoDamage(e, loc) {
        var m = e.copy;
        var sLoc = structureLocationFor(loc);
        var armorGone = e.armorDamage[loc] || 0;
        var structGone = e.structureDamage[sLoc] || 0;
        if (structGone > 0 && armorGone >= (m.armor[loc] || 0)) { e.structureDamage[sLoc] = structGone - 1; }
        else if (armorGone > 0) { e.armorDamage[loc] = armorGone - 1; }
        checkDestroyed(e);
        store(); showBattle();
    }

    function armorDiagram(e) {
        var m = e.copy;
        var box = el("div", "pip-row");
        var label = el("div", "pip-label");
        label.appendChild(el("span", "", "Armor & structure"));
        box.appendChild(label);

        var svgParts = [];
        Object.keys(DOLL_LOCATIONS).forEach(function (loc) {
            var d = DOLL_LOCATIONS[loc];
            var sLoc = structureLocationFor(loc);
            var armorMax = m.armor[loc] || 0;
            var armorLeft = armorMax - (e.armorDamage[loc] || 0);
            var structMax = m.structure[sLoc] || 0;
            var structLeft = structMax - (e.structureDamage[sLoc] || 0);
            var cls = "z-full";
            if (structLeft <= 0) { cls = "z-gone"; }
            else if (armorLeft <= 0) { cls = "z-open"; }
            else if (armorLeft < armorMax) { cls = "z-part"; }
            if (activeLocations[e.gid] === loc) { cls += " z-active"; }
            svgParts.push('<polygon data-zone="' + loc + '" class="' + cls +
                '" points="' + d.points + '"></polygon>');
            if (d.label) {
                svgParts.push('<text class="z-label" x="' + d.label[1] + '" y="' + d.label[2] + '">' + T(d.label[0]) + '</text>');
            }
            var numCls = "z-nr" + (structLeft <= 0 ? " num-gone" : (armorLeft <= 0 ? " num-open" : ""));
            svgParts.push('<text class="' + numCls + '" x="' + d.num[0] + '" y="' + d.num[1] + '">' +
                (structLeft <= 0 ? "×" : armorLeft) + '</text>');
            if (d.sNum) {
                svgParts.push('<text class="z-snr" x="' + d.sNum[0] + '" y="' + d.sNum[1] + '">' +
                    (structLeft > 0 ? structLeft : "–") + '</text>');
            }
        });
        var holder = el("div", "doll-wrap");
        holder.innerHTML =
            '<svg class="doll" viewBox="0 0 330 310" role="img" aria-label="' + T("Armor diagram") + '">' +
            '<defs><pattern id="gone-' + e.gid + '" width="7" height="7" patternTransform="rotate(-45)" patternUnits="userSpaceOnUse">' +
            '<line x1="0" y1="0" x2="0" y2="7" class="gone-line"></line></pattern></defs>' +
            '<text class="z-label" x="279" y="60">' + T("Rear") + '</text>' +
            svgParts.join("") + "</svg>";
        holder.querySelectorAll(".z-gone").forEach(function (p) {
            p.style.fill = "url(#gone-" + e.gid + ")";
        });
        holder.querySelectorAll("[data-zone]").forEach(function (p) {
            p.addEventListener("click", function () {
                activeLocations[e.gid] = p.dataset.zone;
                showBattle();
            });
        });
        box.appendChild(holder);

        /* Location panel */
        var loc = activeLocations[e.gid];
        if (!loc) {
            box.appendChild(el("p", "hint", "Tap a location to apply damage."));
            return box;
        }
        var sLoc = structureLocationFor(loc);
        var armorMax = m.armor[loc] || 0;
        var armorGone = e.armorDamage[loc] || 0;
        var structMax = m.structure[sLoc] || 0;
        var structGone = e.structureDamage[sLoc] || 0;

        var panel = el("div", "zones-panel");
        var title = el("div", "pip-label");
        title.appendChild(el("span", "", LOCATION_NAME[loc]));
        title.appendChild(el("span", "", T("Armor") + " " + (armorMax - armorGone) + "/" + armorMax +
            " · " + T("Structure") + " " + (structMax - structGone) + "/" + structMax +
            (REAR_TO_STRUCTURE[loc] ? " (" + T(sLoc.toUpperCase()) + ")" : "")));
        panel.appendChild(title);

        var chips = el("div", "chips");
        [1, 2, 3, 5, 10].forEach(function (n) {
            var chip = el("button", "chip", "−" + n);
            chip.type = "button";
            chip.title = n + " " + T("damage to apply (overflow into structure)");
            chip.addEventListener("click", function () { applyDamage(e, loc, n); });
            chips.appendChild(chip);
        });
        var undo = el("button", "chip", "+1");
        undo.type = "button";
        undo.title = T("Undo the last point");
        undo.addEventListener("click", function () { undoDamage(e, loc); });
        chips.appendChild(undo);
        panel.appendChild(chips);

        var fine = el("div", "zones-fine");
        var armorFine = el("div", "zones-fine-block");
        armorFine.appendChild(el("span", "sys-name", "Armor"));
        armorFine.appendChild(counter(armorMax - armorGone, armorMax, function (delta) {
            if (delta < 0 && armorGone < armorMax) { e.armorDamage[loc] = armorGone + 1; }
            if (delta > 0 && armorGone > 0) { e.armorDamage[loc] = armorGone - 1; }
            checkDestroyed(e);
            store(); showBattle();
        }));
        fine.appendChild(armorFine);
        var structFine = el("div", "zones-fine-block");
        structFine.appendChild(el("span", "sys-name", "Structure"));
        structFine.appendChild(counter(structMax - structGone, structMax, function (delta) {
            if (delta < 0 && structGone < structMax) { e.structureDamage[sLoc] = structGone + 1; }
            if (delta > 0 && structGone > 0) { e.structureDamage[sLoc] = structGone - 1; }
            checkDestroyed(e);
            store(); showBattle();
        }));
        fine.appendChild(structFine);
        panel.appendChild(fine);
        box.appendChild(panel);
        return box;
    }

    /* --- Crit slots with their dice numbers (as on the paper sheet) -------- */
    var SLOT_LOCATIONS = [
        ["head", "Head"], ["ct", "Center torso"],
        ["rt", "Right torso"], ["lt", "Left torso"],
        ["ra", "Right arm"], ["la", "Left arm"],
        ["rl", "Right leg"], ["ll", "Left leg"]
    ];
    var SYSTEMS = [
        ["engine", "Engine", 3], ["gyro", "Gyro", 2],
        ["sensors", "Sensors", 2], ["life-support", "Life", 1]
    ];

    function slotToggle(e, location, index) {
        e.slotCrits = e.slotCrits || {};
        var hit = e.slotCrits[location] = e.slotCrits[location] || [];
        var pos = hit.indexOf(index);
        if (pos === -1) { hit.push(index); } else { hit.splice(pos, 1); }
        checkCritConsequences(e);
        store(); showBattle();
        if (pos === -1 && /^Ammo/.test(e.copy.critSlots[location][index] || "")) {
            ammoExplosion(e, location, index);
        }
    }

    /* Tapping a system row marks the matching slot (or frees it again). */
    function setSystem(e, id, target) {
        var slots = e.copy.critSlots;
        var guard = 12;
        while (critCount(e, id) < target && guard--) {
            var free = null;
            SLOT_LOCATIONS.some(function (z) {
                var location = z[0];
                return (slots[location] || []).some(function (name, i) {
                    var hit = (e.slotCrits && e.slotCrits[location]) || [];
                    if (name && componentFromName(name) === id && hit.indexOf(i) === -1) {
                        free = [location, i];
                        return true;
                    }
                    return false;
                });
            });
            if (!free) { break; }
            e.slotCrits = e.slotCrits || {};
            (e.slotCrits[free[0]] = e.slotCrits[free[0]] || []).push(free[1]);
        }
        while (critCount(e, id) > target && guard--) {
            var last = null;
            SLOT_LOCATIONS.forEach(function (z) {
                var location = z[0];
                ((e.slotCrits && e.slotCrits[location]) || []).forEach(function (i) {
                    var name = (slots[location] || [])[i];
                    if (name && componentFromName(name) === id) { last = [location, i]; }
                });
            });
            if (!last) { break; }
            var row = e.slotCrits[last[0]];
            row.splice(row.indexOf(last[1]), 1);
        }
        checkCritConsequences(e);
        store(); showBattle();
    }

    function slotCritSection(e) {
        var m = e.copy;
        e.slotCrits = e.slotCrits || {};
        var row = el("div", "pip-row");
        var label = el("div", "pip-label");
        label.appendChild(el("span", "", "Critical hits"));
        /* Die 2W6-Regel stand als fester Absatz auf JEDER Karte - derselbe
           Satz dreimal in einer Lanze, 60 px hoch. Jetzt ein Knopf wie im
           Alpha-Strike-Gefecht: einen Tipp entfernt statt dauernd im Weg. */
        var tableButton = el("button", "special-chip", "2D6 table");
        tableButton.type = "button";
        tableButton.title = T("Show critical hit table");
        tableButton.addEventListener("click", showCritRoll);
        label.appendChild(tableButton);
        row.appendChild(label);

        /* The system row as on the paper sheet */
        var systems = el("div", "system-row");
        SYSTEMS.forEach(function (sys) {
            var id = sys[0], name = sys[1], max = sys[2];
            var count = Math.min(critCount(e, id), max);
            var block = el("div", "system-block");
            block.appendChild(el("span", "sys-name", name));
            for (var i = 0; i < max; i++) {
                (function (index) {
                    var gone = index < count;
                    var pip = el("button", "pip" + (gone ? " gone" : ""), gone ? "×" : "·");
                    pip.type = "button";
                    pip.setAttribute("aria-label", T(name) + "-" + T("hit") + " " + (index + 1) + (gone ? " " + T("(marked)") : ""));
                    pip.addEventListener("click", function () {
                        setSystem(e, id, index < count ? index : index + 1);
                    });
                    block.appendChild(pip);
                })(i);
            }
            systems.appendChild(block);
        });
        row.appendChild(systems);

        /* Locations with their dice numbers.

           Acht gleich aussehende Zeilen, von denen sieben "—" sagen, sind
           sieben Zeilen, die nichts erzählen und die man trotzdem liest.
           Sichtbar ist deshalb nur, was wirklich getroffen wurde; der Rest
           liegt hinter EINER Zeile und ist einen Tipp entfernt. */
        function locationBox(z) {
            var location = z[0];
            var slots = m.critSlots[location] || [];
            var hit = e.slotCrits[location] || [];
            var box = el("details", "slot-crit");
            var key = e.gid + "-" + location;
            box.open = !!openLocations[key];
            box.addEventListener("toggle", function () {
                openLocations[key] = box.open;
            });
            var summaryRow = el("summary", "", z[1]);
            var badge = el("span", "count" + (hit.length ? " has-crits" : ""),
                hit.length ? hit.length + " " + T(hit.length === 1 ? "crit" : "crits") : "—");
            summaryRow.appendChild(badge);
            box.appendChild(summaryRow);

            var groups = el("div", "slot-groups");
            var halves = slots.length === 12 ? [["Roll 1–3", 0], ["Roll 4–6", 6]] : [["Roll 1–6", 0]];
            halves.forEach(function (h) {
                var group = el("div", "slot-group");
                group.appendChild(el("h4", "", h[0]));
                for (var i = 0; i < 6 && h[1] + i < slots.length; i++) {
                    var index = h[1] + i;
                    var name = slots[index];
                    var button = el("button", "slot-button", "");
                    button.type = "button";
                    button.appendChild(el("span", "slot-no", String(i + 1)));
                    if (name) {
                        var gone = hit.indexOf(index) !== -1;
                        if (gone) { button.classList.add("hit"); }
                        button.appendChild(document.createTextNode(T(name)));
                        (function (idx) {
                            button.addEventListener("click", function () { slotToggle(e, location, idx); });
                        })(index);
                    } else {
                        button.classList.add("slot-empty");
                        button.disabled = true;
                        button.appendChild(document.createTextNode(T("empty – reroll")));
                    }
                    group.appendChild(button);
                }
                groups.appendChild(group);
            });
            box.appendChild(groups);
            return box;
        }

        var getroffen = SLOT_LOCATIONS.filter(function (z) {
            return (e.slotCrits[z[0]] || []).length > 0;
        });
        var sauber = SLOT_LOCATIONS.filter(function (z) {
            return (e.slotCrits[z[0]] || []).length === 0;
        });
        getroffen.forEach(function (z) { row.appendChild(locationBox(z)); });

        if (sauber.length) {
            var rest = el("details", "slot-crit slot-crit-rest");
            var restKey = e.gid + "-rest";
            rest.open = !!openLocations[restKey];
            rest.addEventListener("toggle", function () { openLocations[restKey] = rest.open; });
            var restSummary = el("summary", "", "Locations without crits");
            restSummary.appendChild(el("span", "count", String(sauber.length)));
            rest.appendChild(restSummary);
            var restBox = el("div", "slot-rest-list");
            sauber.forEach(function (z) { restBox.appendChild(locationBox(z)); });
            rest.appendChild(restBox);
            row.appendChild(rest);
        }
        return row;
    }

    /* Die 2W6-Regel als Popup - derselbe Griff wie im Alpha-Strike-Gefecht,
       damit beide Systeme sich gleich anfühlen. */
    var crDialog = null;
    function showCritRoll() {
        if (!crDialog) {
            crDialog = document.createElement("dialog");
            crDialog.className = "dialog-box crit-dialog";
            crDialog.addEventListener("click", function (ev) {
                if (ev.target === crDialog) { crDialog.close(); }
            });
            document.body.appendChild(crDialog);
        }
        crDialog.innerHTML = "";
        var header = el("div", "pip-label");
        header.appendChild(el("span", "", "Critical hit table (2D6)"));
        crDialog.appendChild(header);
        crDialog.appendChild(el("p", "hint", "Roll for every hit that damages structure."));
        crDialog.appendChild(el("p", "", rules.critRoll));
        var footer = el("p", "cta");
        var close = el("button", "btn btn-small", "Close");
        close.type = "button";
        close.addEventListener("click", function () { crDialog.close(); });
        footer.appendChild(close);
        var more = el("a", "btn btn-small", "Rules: damage");
        more.href = "rules.html#damage";
        footer.appendChild(more);
        crDialog.appendChild(footer);
        crDialog.showModal();
    }

    /* Head or center torso without structure → done for. */
    function checkDestroyed(e) {
        var s = e.copy.structure;
        if ((e.structureDamage.head || 0) >= s.head || (e.structureDamage.ct || 0) >= s.ct) {
            e.destroyed = true;
        }
    }

    function stat(band, name, value, impaired) {
        var s = el("span", "stat" + (impaired ? " impaired" : ""));
        s.appendChild(document.createTextNode(T(name) + " "));
        s.appendChild(el("b", "", String(value)));
        band.appendChild(s);
    }

    /* Stepper: − value/max +   (upOnly=true shows the value alone, e.g. heat) */
    function counter(value, max, change, upOnly) {
        var box = el("span", "stepper");
        var minus = el("button", "", "−");
        minus.type = "button";
        minus.addEventListener("click", function () { change(-1); });
        var display = el("span", "value");
        if (upOnly) {
            display.textContent = value;
        } else {
            display.appendChild(document.createTextNode(value));
            var small = el("small", "", "/" + max);
            display.appendChild(small);
        }
        var plus = el("button", "", "+");
        plus.type = "button";
        plus.addEventListener("click", function () { change(1); });
        box.appendChild(minus); box.appendChild(display); box.appendChild(plus);
        return box;
    }

    /* --- End of battle ----------------------------------------------------- */
    document.getElementById("more-btn").addEventListener("click", showSelection);
    document.getElementById("end-btn").addEventListener("click", function () {
        function finish(n) {
            state = { version: DATA_VERSION, units: [], round: 1 };
            S.remove(KEY);
            showSelection();
            if (n) { showMessage(n + " " + T(n === 1 ? "’Mech keeps its damage in the hangar." : "’Mechs keep their damage in the hangar.")); }
        }
        if (window.MechsCampaign) {
            MechsCampaign.endDialog({ system: SYSTEM, units: state.units, storage: S,
                                       round: state.round, onEnd: finish });
            return;
        }
        if (!confirm(T("End the battle? All trackers are reset; the hangar is untouched."))) { return; }
        finish(0);
    });
    /* A short note above the selection (the page has no message field). */
    function showMessage(text) {
        var box = document.getElementById("campaign-message");
        if (!box) {
            box = el("p", "flash flash-ok");
            box.id = "campaign-message";
            var target = document.getElementById("selection");
            target.insertBefore(box, target.firstChild);
        }
        box.textContent = text;
        box.hidden = false;
        clearTimeout(showMessage.t);
        showMessage.t = setTimeout(function () { box.hidden = true; }, 6000);
    }
})();
