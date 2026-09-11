/* Digital record sheet Alpha Strike (CONCEPT.md 4.7): open a battle, pull
   'Mechs in from the hangar, and the screen replaces card and pencil -
   armor/structure as tappable bubbles, heat levels with their effects in
   plain words, crits. The state survives a reload (localStorage) and is kept
   apart from the hangar: every unit tracks a COPY of its values. */
(function () {
    "use strict";

    /* Freshly created structures carry today's data version right away,
       otherwise migrate.js would run them through once more on next start. */
    var DATA_VERSION = (window.MechsMigrate && MechsMigrate.VERSION) || 3;

    var SYSTEM = "alpha-strike";
    var KEY = "battle-" + SYSTEM;
    var S = window.MechsStorage;

    var HEAT_EFFECT = [
        "",
        "+1 to attacks · −2″ MV",
        "+2 to attacks · −4″ MV · TMM −1",
        "+3 to attacks · −6″ MV · TMM −1",
        "SHUTDOWN: skip a full round, TMM −4, then heat 0"
    ];

    var selectionView = document.getElementById("selection");
    var battleView = document.getElementById("battle");
    var unitsBox = document.getElementById("units");
    var selectionList = document.getElementById("selection-list");
    var startButton = document.getElementById("start-btn");

    var state = S.load(KEY, { version: DATA_VERSION, units: [] });
    if (!state.round) { state.round = 1; }
    var objectUrls = [];
    var calculatorConfig = null;
    var glossary = null;
    /* Rule values live in data/alpha-strike-rules.json, never here. The
       fallbacks below only cover the moment before the file has arrived. */
    var rules = null;
    fetch(new URL("data/as-abilities.json", new URL("..", document.currentScript.src)))
        .then(function (r) { return r.json(); })
        .then(function (d) { glossary = d.abilities; });
    fetch(new URL("data/alpha-strike-rules.json", new URL("..", document.currentScript.src)))
        .then(function (r) { return r.json(); })
        .then(function (d) { rules = d; if (!battleView.hidden) { showBattle(); } });
    fetch(new URL("data/calculator-alpha-strike.json", new URL("..", document.currentScript.src)))
        .then(function (r) { return r.json(); })
        .then(function (d) {
            calculatorConfig = d;
            if (!battleView.hidden) { showBattle(); }
            /* The selection may already have been open before pvSkill loaded. */
            else if (!selectionView.hidden) { showSelection(); }
        });

    function store() { S.save(KEY, state); }

    /* Unit types (CONCEPT §10, F2): only 'Mechs have heat; vehicles and
       ProtoMechs have crit tables of their own (AS:CE), infantry and battle
       armor none at all. Older hangar entries without a type are 'Mechs. */
    var TYPE_NAMES = { BM: "BattleMech", IM: "IndustrialMech", CV: "Vehicle", SV: "Support vehicle",
                       BA: "Battle Armor", CI: "Infantry", PM: "ProtoMech" };
    var DIE_FACES = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    function typeOf(m) { return m.type || "BM"; }
    function typeName(m) { return T(TYPE_NAMES[typeOf(m)] || typeOf(m)); }
    function hasHeat(m) { var t = typeOf(m); return t === "BM" || t === "IM"; }
    function critKind(m) {
        var t = typeOf(m);
        if (t === "CV" || t === "SV") { return "vehicle"; }
        if (t === "PM") { return "proto"; }
        if (t === "BA" || t === "CI") { return "none"; }
        return "mech";
    }
    /* Motive modifier from the movement code in the MV value, plus whatever
       special abilities change it. Both tables come from the rules file. */
    function motiveModifier(m) {
        var table = rules && rules.motiveTable;
        if (!table) { return 0; }
        var code = (/["″]([a-z])/.exec(String(m.mv || "")) || [])[1] || "";
        var mod = table.modifiers && typeof table.modifiers[code] === "number"
            ? table.modifiers[code] : 0;
        var byAbility = table.abilityModifiers || {};
        Object.keys(byAbility).forEach(function (key) {
            if (key.charAt(0) === "_") { return; }
            if (new RegExp("\\b" + key + "\\b").test(m.special || "")) { mod += byAbility[key]; }
        });
        return mod;
    }
    /* Crit counters with defaults - older battle states do not know the
       vehicle/proto fields yet. */
    function critsOf(e) {
        var k = e.crits || (e.crits = {});
        ["engine", "fireControl", "weapon", "mpHits", "motive"].forEach(function (f) { if (!k[f]) { k[f] = 0; } });
        k.mpHalved = !!k.mpHalved; k.crewStunned = !!k.crewStunned;
        return k;
    }
    function immobile(e) { var k = critsOf(e); return k.crewStunned || k.motive >= 3; }

    /* A stunned crew comes back: the effect runs out at the end of the
       FOLLOWING turn, so a crew stunned in turn 3 acts again in turn 5.
       Nothing used to clear the flag - a stunned vehicle stayed stunned for
       the rest of the battle, which is not what the rules page said either. */
    function stunCrew(k) {
        k.crewStunned = true;
        k.crewStunnedUntil = state.round + ((rules && rules.crewStunnedRounds) || 1);
    }
    function advanceRound() {
        state.round++;
        delete state.initiative;
        state.units.forEach(function (e) {
            var k = critsOf(e);
            /* An older battle state carries no expiry - let it run out now
               rather than keeping the unit stunned forever. */
            if (k.crewStunned && (k.crewStunnedUntil || 0) < state.round) {
                k.crewStunned = false;
                delete k.crewStunnedUntil;
            }
        });
    }
    var T = window.T || function (s) { return s; };
    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }

    /* --- Selection: units from the hangar ---------------------------------- */
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
            label.textContent = m.name + (typeOf(m) !== "BM" ? " · " + typeName(m) : "");
            /* PV is for skill 4 - other skills shift it along the AS:CE
               ladder (parameters in rechner-alphastrike.json). */
            var pvEffective = pvWithSkill(m.pv || 0, m.skill);
            box.dataset.points = pvEffective;
            var pvText = "PV " + (m.pv ? pvEffective : "?");
            if (m.pv && pvEffective !== m.pv) { pvText += " (Skill " + m.skill + ", " + T("base") + " " + m.pv + ")"; }
            var numbers = el("span", "mech-stats",
                "A " + m.armor + " · S " + m.structure + " · " + pvText);
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

    function pvWithSkill(pv, skill) {
        var k = calculatorConfig && calculatorConfig.pvSkill;
        if (!k || !pv || skill === undefined || skill === null || skill === 4) { return pv; }
        var steps = 4 - skill;
        var perStep = steps > 0
            ? 1 + Math.floor(Math.max(0, pv - k.improveFrom) / k.improveStep)
            : 1 + Math.floor(Math.max(0, pv - k.worsenFrom) / k.worsenStep);
        return Math.max(1, pv + steps * perStep);
    }

    /* Budget: keep the sum of the selected units against an optional point
       budget, live ("build a lance to a fixed budget"). */
    var budgetField = document.getElementById("budget");
    var budgetStatus = document.getElementById("budget-status");
    function updateBudget() {
        var boxes = selectionList.querySelectorAll("input:checked");
        var total = 0;
        boxes.forEach(function (b) { total += parseInt(b.dataset.points, 10) || 0; });
        var parts = [boxes.length + " " + T("selected") + " · " + total + " PV"];
        var budget = parseInt(budgetField.value, 10);
        if (budget > 0) {
            var left = budget - total;
            parts.push(left >= 0 ? left + " PV " + T("left") : T("OVER BUDGET by") + " " + (-left) + " PV");
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
            if (m) { addUnit(m.id, m); }
        });
        var limit = parseInt(document.getElementById("round-limit").value, 10);
        if (limit > 0) { state.roundLimit = limit; }
        if (state.units.length) { store(); showBattle(); }
    });
    document.getElementById("selection-back-btn").addEventListener("click", showBattle);
    var lanceButton = document.getElementById("lance-btn");
    if (lanceButton && window.MechsShare) {
        lanceButton.addEventListener("click", function () {
            var entries = state.units.filter(function (e) { return e.mechId; }).map(function (e) {
                var k = e.copy;
                return { q: k.sourceId || null, n: k.name, s: k.skill };
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

    document.getElementById("adhoc-form").addEventListener("submit", function (ev) {
        ev.preventDefault();
        var f = ev.target.elements;
        var name = f.name.value.trim();
        var a = parseInt(f.armor.value, 10);
        var s = parseInt(f.structure.value, 10);
        if (!name || isNaN(a) || isNaN(s)) { return; }
        addUnit(null, { name: name, armor: a, structure: s,
                        skill: parseInt(f.skill.value, 10) || 4 });
        ev.target.reset();
        f.skill.value = 4;
        store();
        showBattle();
    });

    function addUnit(mechId, mech) {
        var unit = {
            gid: S.newId(),
            mechId: mechId,
            copy: JSON.parse(JSON.stringify(mech)),
            armorDamage: 0, structureDamage: 0, heat: 0, ovDeclared: 0,
            crits: { engine: 0, fireControl: 0, weapon: 0, mpHalved: false, mpHits: 0, crewStunned: false, motive: 0 },
            destroyed: false
        };
        /* Campaign: damage carried over from the last battle. */
        if (window.MechsCampaign && mechId) {
            MechsCampaign.applyState(SYSTEM, unit, MechsCampaign.stateOf(SYSTEM, mechId));
            critsOf(unit);
        }
        state.units.push(unit);
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

    /* --- Round mechanics: the end phase as a checklist over all mechs ------ */
    function roundBar() {
        var bar = el("div", "round-bar");
        var text = T("Round") + " " + state.round + (state.roundLimit ? "/" + state.roundLimit : "");
        bar.appendChild(el("span", "round-number", text));
        if (window.MechsInitiative) {
            bar.appendChild(MechsInitiative.bar({
                state: state, save: store, rerender: showBattle, alphaStrike: true,
                ownCount: state.units.filter(function (e) { return !e.destroyed; }).length || 4
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
        /* Only units with a heat scale need the wizard - vehicles, infantry
           and ProtoMechs go straight into the next round. */
        var alive = state.units.filter(function (e) { return !e.destroyed && hasHeat(e.copy); });
        if (!state.units.some(function (e) { return !e.destroyed; })) { return; }
        if (!alive.length) {
            if (!confirm(T("No heat to resolve – end turn") + " " + state.round + " " + T("now?"))) { return; }
            advanceRound();
            store(); showBattle();
            return;
        }
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
            return { e: e, heat: e.heat, ovDeclared: e.ovDeclared, externalHeat: e.externalHeat };
        });
        epCancel = function () {
            backup.forEach(function (s) {
                s.e.heat = s.heat;
                s.e.ovDeclared = s.ovDeclared;
                s.e.externalHeat = s.externalHeat;
            });
            epCancel = null;
            epDialog.close();
            showBattle();
        };

        function show() {
            var e = alive[step];
            var m = e.copy;
            /* Pre-filled from the declaration plus external heat, but free to
               correct - the end phase IS the heat calculation. */
            var extra = (e.ovDeclared || 0) + (e.externalHeat || 0);
            var didNotFire = false;
            var water = false;
            epDialog.innerHTML = "";

            var header = el("div", "pip-label");
            header.appendChild(el("span", "", T("End phase · round") + " " + state.round));
            header.appendChild(el("span", "", (step + 1) + "/" + alive.length));
            epDialog.appendChild(header);
            epDialog.appendChild(el("h3", "", m.name));
            epDialog.appendChild(el("p", "hint",
                "Heat this round – pre-filled from the overheat declaration and external heat."));

            var preview = el("p", "heat-effect");
            function recompute() {
                if (didNotFire) { return 0; }
                return Math.max(0, Math.min(4, e.heat + extra - (water ? 1 : 0)));
            }
            function drawPreview() {
                var next = recompute();
                preview.textContent = T("Heat") + " " + e.heat +
                    (extra ? " + " + extra : "") +
                    (water ? " − 1 (" + T("water") + ")" : "") +
                    " → " + T("level") + " " + (next === 4 ? T("S (shutdown!)") : next);
            }
            var heatBox = el("div", "heat-display");
            var stepper = el("span", "stepper");
            var minus = el("button", "", "−");
            minus.type = "button";
            var value = el("span", "value");
            var plus = el("button", "", "+");
            plus.type = "button";
            function drawStepper() { value.textContent = "+" + extra; drawPreview(); }
            minus.addEventListener("click", function () { if (extra > 0) { extra--; drawStepper(); } });
            plus.addEventListener("click", function () { if (extra < 8) { extra++; drawStepper(); } });
            stepper.appendChild(minus); stepper.appendChild(value); stepper.appendChild(plus);
            heatBox.appendChild(stepper);
            epDialog.appendChild(heatBox);
            drawStepper();
            var switches = el("div", "chips");
            [["Did not fire → 0", function (on) { didNotFire = on; }],
             ["In water −1", function (on) { water = on; }]].forEach(function (o) {
                var chip = el("button", "chip", o[0]);
                chip.type = "button";
                chip.setAttribute("aria-pressed", "false");
                chip.addEventListener("click", function () {
                    var on = chip.getAttribute("aria-pressed") !== "true";
                    chip.setAttribute("aria-pressed", String(on));
                    o[1](on);
                    drawPreview();
                });
                switches.appendChild(chip);
            });
            epDialog.appendChild(switches);
            drawPreview();
            epDialog.appendChild(preview);

            var footer = el("p", "cta");
            var apply = el("button", "btn btn-primary",
                step + 1 < alive.length ? "Apply & next" : "Apply & finish the round");
            apply.type = "button";
            apply.addEventListener("click", function () {
                e.heat = recompute();
                e.ovDeclared = 0;
                e.externalHeat = 0;
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
            advanceRound();
            epCancel = null;
            epDialog.close();
            store(); showBattle();
        }
        show();
        epDialog.showModal();
    }

    function unitCard(e) {
        var m = e.copy;
        var card = el("article", "card unit-panel" + (e.destroyed ? " destroyed" : ""));
        card.id = "unit-" + e.gid;

        /* Header */
        var header = el("div", "unit-header");
        var headerImage = null;
        if (m.icon) {
            headerImage = el("img", "photo-thumb mech-icon");
            headerImage.alt = "";
            headerImage.src = new URL(m.icon, new URL("..", document.querySelector('script[src*="as-battle"]').src));
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
        var title = el("h3", "", m.name);
        header.appendChild(title);
        if (typeOf(m) !== "BM") { header.appendChild(el("span", "unit-type", typeName(m))); }
        if (e.destroyed) { header.appendChild(el("span", "destroyed-banner", "Destroyed")); }
        else if (m.pv) { header.appendChild(el("span", "pv", "PV " + m.pv)); }
        card.appendChild(header);

        /* Values with the impairments folded in */
        var band = el("div", "stats-band");
        var k = critsOf(e);
        var kind = critKind(m);
        var attackPlus = (e.heat < 4 ? e.heat : 0) + 2 * k.fireControl;
        /* Movement: a 'Mech MP crit halves it, a ProtoMech stacks, a vehicle
           follows its motive level and engine; immobile = TMM −4. */
        var mvText = m.mv || "?", tmmText = numberOr(m.tmm, "?");
        var mvImpaired = false, tmmImpaired = false;
        if (typeof m.tmm === "number" && e.heat >= 2 && e.heat < 4) { tmmText = m.tmm + "−1"; tmmImpaired = true; }
        if (typeof m.tmm === "number" && e.heat === 4) { tmmText = m.tmm + "−4"; tmmImpaired = true; }
        if (kind === "mech" && k.mpHalved) { mvText += " ·½"; tmmText += " ·½"; mvImpaired = tmmImpaired = true; }
        if (kind === "proto" && k.mpHits) {
            var times = k.mpHits > 1 ? "×" + k.mpHits : "";
            mvText += " ·½" + times; tmmText += " ·½" + times; mvImpaired = tmmImpaired = true;
        }
        if (kind === "vehicle") {
            if (k.motive === 1) { mvText += " −2″"; tmmText += " −1"; mvImpaired = tmmImpaired = true; }
            if (k.motive === 2) { mvText += " ·½"; tmmText += " ·½"; mvImpaired = tmmImpaired = true; }
            if (k.engine) { mvText += " ·½ (" + T("Engine") + ")"; mvImpaired = true; }
        }
        if (immobile(e)) { mvText = "0 · " + T("immobile"); tmmText = "−4"; mvImpaired = tmmImpaired = true; }
        stat(band, "MV", mvText, mvImpaired);
        stat(band, "TMM", tmmText, tmmImpaired);
        stat(band, "SZ", numberOr(m.sz, "?"), false);
        var weaponPenalty = k.weapon ? " " + T("each") + " −" + k.weapon : "";
        if (kind === "vehicle" && k.engine) { weaponPenalty += " ·½ (" + T("Engine") + ")"; }
        stat(band, "S/M/L", (m.s || "0") + "/" + (m.m || "0") + "/" + (m.l || "0") + weaponPenalty,
             k.weapon > 0 || (kind === "vehicle" && k.engine > 0));
        if (hasHeat(m)) { stat(band, "OV", numberOr(m.ov, 0), false); }
        stat(band, "Skill", numberOr(m.skill, "?"), false);
        if (attackPlus > 0) { stat(band, "Attacks", "+" + attackPlus, true); }
        if (e.ovDeclared > 0) { stat(band, "OV declared", "+" + e.ovDeclared + " " + T("damage S/M"), true); }
        if (kind === "mech" && k.engine > 0) { stat(band, "Engine", T("+1 heat when firing"), true); }
        if (k.crewStunned) { stat(band, "Crew", T("stunned – no move, no attack"), true); }
        card.appendChild(band);
        if (m.special) { card.appendChild(specialChips(m.special)); }

        /* Action: the attack runs entirely in the popup - SATOR, the overheat
           declaration and the dice in one place (CONCEPT 4.7). */
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

        /* Bubble rows */
        card.appendChild(pipRow("Armor", m.armor, e.armorDamage, false, function (value) {
            e.armorDamage = value;
            store(); showBattle();
        }));
        card.appendChild(pipRow("Structure", m.structure, e.structureDamage, true, function (value) {
            e.structureDamage = value;
            if (e.structureDamage >= m.structure) { e.destroyed = true; }
            store(); showBattle();
        }));

        /* Heat level: it comes about in the end phase and its penalties apply
           from the following round - which is why this round's overheat is
           only DECLARED and turns into a level with the end phase button.
           Cooling down (did not fire -> 0, water −1) stays a tap on the
           chips. */
        var heatRow = el("div", "pip-row");
        var heatLabel = el("div", "pip-label");
        heatLabel.appendChild(el("span", "", "Heat level (in effect now)"));
        heatRow.appendChild(heatLabel);
        var chips = el("div", "chips");
        for (var level = 0; level <= 4; level++) {
            (function (value) {
                var chip = el("button", "chip", value === 4 ? "S" : String(value));
                chip.type = "button";
                chip.setAttribute("aria-pressed", String(e.heat === value));
                chip.addEventListener("click", function () {
                    e.heat = value;
                    store(); showBattle();
                });
                chips.appendChild(chip);
            })(level);
        }
        heatRow.appendChild(chips);
        heatRow.appendChild(el("p", "heat-effect", HEAT_EFFECT[e.heat]));

        if (!e.destroyed) {
            e.externalHeat = e.externalHeat || 0;
            if (e.ovDeclared > 0) {
                heatRow.appendChild(el("p", "heat-effect",
                    T("OV declared:") + " +" + e.ovDeclared + " " + T("damage at short/medium THIS round")));
            }

            /* External heat hits EVERY mech: HT weapons, flamers, an engine
               crit when firing - note it down for the end phase. */
            var extLabel = el("div", "pip-label");
            extLabel.appendChild(el("span", "", "Extra heat (HT hits, engine crit …)"));
            extLabel.style.marginTop = "0.7rem";
            heatRow.appendChild(extLabel);
            heatRow.appendChild((function () {
                var box = el("span", "stepper");
                var minus = el("button", "", "−");
                minus.type = "button";
                minus.addEventListener("click", function () {
                    if (e.externalHeat > 0) { e.externalHeat--; store(); showBattle(); }
                });
                var display = el("span", "value", "+" + e.externalHeat);
                var plus = el("button", "", "+");
                plus.type = "button";
                plus.addEventListener("click", function () {
                    if (e.externalHeat < 4) { e.externalHeat++; store(); showBattle(); }
                });
                box.appendChild(minus); box.appendChild(display); box.appendChild(plus);
                return box;
            })());

            var pending = (e.ovDeclared || 0) + e.externalHeat;
            if (pending > 0) {
                var endPhaseButton = el("button", "btn btn-small",
                    T("End phase:") + " +" + pending + " " + T("apply heat"));
                endPhaseButton.type = "button";
                endPhaseButton.style.marginTop = "0.5rem";
                endPhaseButton.style.marginLeft = "0.7rem";
                endPhaseButton.addEventListener("click", function () {
                    e.heat = Math.min(4, e.heat + pending);
                    e.ovDeclared = 0;
                    e.externalHeat = 0;
                    store(); showBattle();
                });
                heatRow.appendChild(endPhaseButton);
            }
            heatRow.appendChild(el("p", "hint",
                "Heat builds up in the end phase; penalties apply from the following round. " +
                "Cooling by hand: did not fire → 0, in water −1 level."));
        }
        /* Crits - the table that fits the unit type, none for infantry/BA */
        if (kind !== "none") {
            var critRow = el("div", "pip-row");
            var critLabel = el("div", "pip-label");
            critLabel.appendChild(el("span", "", "Critical hits"));
            var tableButton = el("button", "special-chip", "2D6 table");
            tableButton.type = "button";
            tableButton.title = T("Show critical hit table");
            tableButton.addEventListener("click", function () { showCritTable(kind); });
            critLabel.appendChild(tableButton);
            critRow.appendChild(critLabel);
            var critBox = el("div", "crit-row");
            var counter = function (name, field, max, deadly) {
                critBox.appendChild(critChip(name, k[field], max, function () {
                    k[field] = (k[field] + 1) % (max + 1);
                    if (deadly && k[field] === max) { e.destroyed = true; }
                    store(); showBattle();
                }));
            };
            if (kind !== "proto") { counter("Engine", "engine", 2, true); }
            counter("Fire Control", "fireControl", 4, false);
            counter("Weapon", "weapon", 4, false);
            if (kind === "mech") {
                var mp = el("button", "chip", "MP halved");
                mp.type = "button";
                mp.dataset.count = k.mpHalved ? "1" : "0";
                mp.addEventListener("click", function () { k.mpHalved = !k.mpHalved; store(); showBattle(); });
                critBox.appendChild(mp);
            }
            if (kind === "proto") { counter("MP", "mpHits", 3, false); }
            if (kind === "vehicle") {
                var crew = el("button", "chip", "Crew stunned");
                crew.type = "button";
                crew.dataset.count = k.crewStunned ? "1" : "0";
                crew.title = T("No movement, no attacks, counts as immobile – deselect again after the next turn");
                crew.addEventListener("click", function () {
                    if (k.crewStunned) { k.crewStunned = false; delete k.crewStunnedUntil; }
                    else { stunCrew(k); }
                    store(); showBattle();
                });
                critBox.appendChild(crew);
            }
            critRow.appendChild(critBox);
            if (kind === "vehicle") { critRow.appendChild(motiveRow(e, m, k)); }
            card.appendChild(critRow);
        } else if (!e.destroyed) {
            card.appendChild(el("p", "hint",
                "No critical hits – infantry and battle armor only tick off armor and structure."));
        }
        if (hasHeat(m)) { card.appendChild(heatRow); }

        /* Foot of the card */
        var footer = el("p", "cta");
        var wreck = el("button", "btn btn-small", e.destroyed ? "Not destroyed after all" : "Destroyed");
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

    /* --- The attack as a popup: SATOR + overheat declaration + dice -------- */
    var agDialog = null;
    function showAttackDialog(e) {
        var m = e.copy;
        if (!agDialog) {
            agDialog = document.createElement("dialog");
            agDialog.className = "dialog-box attack-dialog";
            agDialog.addEventListener("click", function (ev) {
                if (ev.target === agDialog) { agDialog.close(); }
            });
            /* Refresh the card when it closes (OV badge, selection). */
            agDialog.addEventListener("close", function () { store(); showBattle(); });
            document.body.appendChild(agDialog);
        }
        agDialog.innerHTML = "";
        var header = el("div", "pip-label");
        header.appendChild(el("span", "", "Attack · SATOR"));
        header.appendChild(el("span", "", "Skill " + numberOr(m.skill, 4)));
        agDialog.appendChild(header);
        agDialog.appendChild(el("h3", "", m.name));

        if (e.heat >= 4) {
            agDialog.appendChild(el("p", "hint",
                "Shut down – this ’Mech cannot attack this round."));
        } else if (critsOf(e).crewStunned) {
            agDialog.appendChild(el("p", "hint",
                "Crew stunned – this unit can neither move nor attack."));
        } else {
            var currentToHit = null;

            /* Damage per band, including the declared overheat */
            var damageLine = el("p", "heat-effect");
            function drawDamage() {
                var ov = e.ovDeclared || 0;
                var t = T("Damage S/M/L:") + " " + (m.s || "0") + "/" + (m.m || "0") + "/" + (m.l || "0");
                if (e.crits.weapon) { t += " · " + T("weapon crits each") + " −" + e.crits.weapon; }
                if (critKind(m) === "vehicle" && e.crits.engine) { t += " · " + T("Engine: damage halved"); }
                if (ov > 0) { t += " · OV +" + ov + " " + T("at S/M"); }
                damageLine.textContent = t;
            }

            /* Overheat belongs to the attack declaration - declare it here. */
            if (m.ov > 0) {
                var ovLabel = el("div", "pip-label");
                ovLabel.appendChild(el("span", "", T("Declare overheat") + " (OV " + m.ov + ")"));
                agDialog.appendChild(ovLabel);
                var ovChips = el("div", "chips");
                for (var ov = 0; ov <= m.ov; ov++) {
                    (function (value) {
                        var chip = el("button", "chip", String(value));
                        chip.type = "button";
                        chip.setAttribute("aria-pressed", String((e.ovDeclared || 0) === value));
                        chip.addEventListener("click", function () {
                            e.ovDeclared = value;
                            ovChips.querySelectorAll(".chip").forEach(function (c, j) {
                                c.setAttribute("aria-pressed", String(j === value));
                            });
                            drawDamage();
                            store();
                        });
                        ovChips.appendChild(chip);
                    })(ov);
                }
                agDialog.appendChild(ovChips);
            }

            /* Own modifiers (abilities, quirks) like the mech sources. */
            var MOD = window.MechsModifiers;
            var modTotal = MOD ? MOD.sum(m, e.activeMods) : 0;
            var base = numberOr(m.skill, 4) + e.heat + 2 * e.crits.fireControl + modTotal;
            var parts = ["Skill " + numberOr(m.skill, 4)];
            if (e.heat > 0) { parts.push(T("Heat") + " +" + e.heat); }
            if (e.crits.fireControl > 0) { parts.push("Fire Control +" + 2 * e.crits.fireControl); }
            if (MOD) { MOD.texts(m, e.activeMods).forEach(function (x) { parts.push(x); }); }
            var modChips = MOD ? MOD.chips({
                mech: m, unit: e,
                onToggle: function () { store(); redrawDialog(e); }
            }) : null;
            if (modChips) { agDialog.appendChild(modChips); }
            var calculatorBox = el("div", "attack-content");
            MechsCalculator.create(calculatorBox, calculatorConfig, {
                compact: true, withoutMechSources: true,
                /* Gelände und Sonderfälle hinter eine Zeile - dieselbe
                   Aufteilung wie im Classic-Dialog. Die Reichweite bleibt
                   hier sichtbar: SATOR rechnet sie einmal für die Einheit,
                   es gibt keine Waffenliste, die sie übernehmen könnte. */
                collapse: ["woods", "partial-cover", "target-immobile", "other"],
                baseExtra: base, baseText: parts.join(" · "),
                state: e.attack || null,
                onChange: function (aState) { e.attack = aState; store(); },
                onToHit: function (toHit, impossible) {
                    currentToHit = impossible ? null : toHit;
                }
            });
            agDialog.appendChild(calculatorBox);

            drawDamage();
            agDialog.appendChild(damageLine);
            agDialog.appendChild(MechsDice.block({
                toHit: function () { return currentToHit; }
            }));
            agDialog.appendChild(el("p", "hint",
                "On a hit: mark the damage for the matching range band on the target – " +
                "every point of structure damage triggers a crit roll there."));
        }

        var footer = el("p", "cta");
        if (critKind(m) !== "none") {
            var tableButton = el("button", "btn btn-small", "Crit table");
            tableButton.type = "button";
            tableButton.addEventListener("click", function () { showCritTable(critKind(m)); });
            footer.appendChild(tableButton);
        }
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

    /* --- Special abilities: clickable chips with an explanation popup ------ */
    function glossaryEntry(code) {
        if (!glossary) { return null; }
        /* "JMPS1" -> "JMPS", "LRM1/1/2" -> "LRM", "TUR(2/2/1)" -> "TUR",
           "IF0*" -> "IF", "CT0.5" -> "CT", "ARTAC-2" -> "ART" (family) */
        var core = code.split("(")[0].split("/")[0].replace(/[)\s]/g, "")
            .replace(/[\d.*-]+$/, "").toUpperCase();
        if (!core) { return null; }
        if (core.indexOf("ART") === 0) { core = "ART"; }
        return glossary.find(function (f) {
            return f.key.split(/[\/ ]+/).some(function (alt) {
                var candidate = alt.replace(/[#().…]/g, "").replace(/[\d.*-]+$/, "").toUpperCase();
                return candidate && candidate === core;
            });
        }) || null;
    }
    /* Commas inside brackets do not separate: "TUR(2/3/2,IF1)" stays one. */
    function splitSpecials(text) {
        var parts = [], depth = 0, current = "";
        for (var i = 0; i < text.length; i++) {
            var c = text[i];
            if (c === "(") { depth++; }
            if (c === ")") { depth = Math.max(0, depth - 1); }
            if (c === "," && depth === 0) { parts.push(current); current = ""; } else { current += c; }
        }
        parts.push(current);
        return parts;
    }
    function specialChips(text) {
        var row = el("div", "special-chips");
        splitSpecials(text).forEach(function (raw) {
            var code = raw.trim();
            if (!code) { return; }
            var chip = el("button", "special-chip", code);
            chip.type = "button";
            chip.title = T("What does") + " " + code + "?";
            chip.addEventListener("click", function () { showAbility(code); });
            row.appendChild(chip);
        });
        return row;
    }
    /* Crit and motive tables are the quick reference next to the chips. They
       come from data/alpha-strike-rules.json - the same file the rules page
       quotes, so the two cannot drift apart any more. */
    function critTable(kind) { return (rules && rules.critTables && rules.critTables[kind]) || []; }
    function motiveTable() { return (rules && rules.motiveTable && rules.motiveTable.rows) || []; }
    function motiveLevels() {
        return (rules && rules.motiveTable && rules.motiveTable.levels)
            || ["no motive damage", "MV −2″, TMM −1", "MV and TMM halved", "immobile"];
    }
    function tableOf(rows) {
        var t = el("table");
        rows.forEach(function (row) {
            var tr = el("tr");
            tr.appendChild(el("td", "num", row[0]));
            tr.appendChild(el("td", "", row[1]));
            t.appendChild(tr);
        });
        return t;
    }
    var ktDialog = null;
    function showCritTable(kind) {
        kind = critTable(kind).length ? kind : "mech";
        if (!ktDialog) {
            ktDialog = document.createElement("dialog");
            ktDialog.className = "dialog-box crit-dialog";
            ktDialog.addEventListener("click", function (ev) {
                if (ev.target === ktDialog) { ktDialog.close(); }
            });
            document.body.appendChild(ktDialog);
        }
        ktDialog.innerHTML = "";
        var header = el("div", "pip-label");
        header.appendChild(el("span", "", T("Critical hit table (2D6)") +
            (kind === "vehicle" ? " · " + T("Vehicle") : kind === "proto" ? " · " + T("ProtoMech") : "")));
        ktDialog.appendChild(header);
        ktDialog.appendChild(el("p", "hint",
            "Roll for every hit that damages structure."));
        ktDialog.appendChild(tableOf(critTable(kind)));
        if (kind === "vehicle") {
            var motiveHeader = el("div", "pip-label");
            motiveHeader.style.marginTop = "0.8rem";
            motiveHeader.appendChild(el("span", "", "Motive damage (2D6, on every hit)"));
            ktDialog.appendChild(motiveHeader);
            ktDialog.appendChild(el("p", "hint",
                "Modifier: tracked/naval +0 · wheeled/hover +1 · VTOL/WiGE +2 · ARS −1"));
            ktDialog.appendChild(tableOf(motiveTable()));
        }
        var footer = el("p", "cta");
        var close = el("button", "btn btn-small", "Close");
        close.type = "button";
        close.addEventListener("click", function () { ktDialog.close(); });
        footer.appendChild(close);
        var more = el("a", "btn btn-small", kind === "mech" ? "Rules: damage" : "Rules: vehicles & co.");
        more.href = kind === "mech" ? "rules.html#damage" : "rules.html#units";
        footer.appendChild(more);
        ktDialog.appendChild(footer);
        ktDialog.showModal();
    }
    /* Vehicles: set the motive level by hand or roll for it directly (2D6 +
       modifier by drive type), the result stays on the card. */
    function motiveRow(e, m, k) {
        var box = el("div", "motive-row");
        var lab = el("div", "pip-label");
        lab.appendChild(el("span", "", "Motive damage (roll on every hit)"));
        box.appendChild(lab);
        var chips = el("div", "chips");
        motiveLevels().forEach(function (name, i) {
            var chip = el("button", "chip", i === 0 ? "–" : name);
            chip.type = "button";
            chip.setAttribute("aria-pressed", String(k.motive === i));
            chip.addEventListener("click", function () { k.motive = i; store(); showBattle(); });
            chips.appendChild(chip);
        });
        box.appendChild(chips);
        var mod = motiveModifier(m);
        var rollButton = el("button", "btn btn-small dice-btn",
            T("Motive roll 2D6") + (mod ? " " + (mod > 0 ? "+" : "−") + Math.abs(mod) : ""));
        rollButton.type = "button";
        rollButton.addEventListener("click", function () {
            var a = MechsDice.d6(), b = MechsDice.d6(), total = a + b + mod;
            var level = total >= 12 ? 3 : (total === 11 ? 2 : (total >= 9 ? 1 : 0));
            e.motiveRoll = { a: a, b: b, mod: mod, level: level };
            if (level > k.motive) { k.motive = level; }
            store(); showBattle();
        });
        box.appendChild(rollButton);
        if (e.motiveRoll) {
            var w = e.motiveRoll;
            box.appendChild(el("p", "heat-effect",
                DIE_FACES[w.a - 1] + DIE_FACES[w.b - 1] + " " + (w.a + w.b) +
                (w.mod ? (w.mod > 0 ? " + " : " − ") + Math.abs(w.mod) + " = " + (w.a + w.b + w.mod) : "") +
                " → " + T(motiveLevels()[w.level])));
        }
        return box;
    }

    var dialog = null;
    function showAbility(code) {
        if (!dialog) {
            dialog = document.createElement("dialog");
            dialog.className = "dialog-box";
            dialog.addEventListener("click", function (ev) {
                if (ev.target === dialog) { dialog.close(); }
            });
            document.body.appendChild(dialog);
        }
        var entry = glossaryEntry(code);
        dialog.innerHTML = "";
        var header = el("div", "pip-label");
        header.appendChild(el("span", "", code + (entry ? " · " + entry.name : "")));
        dialog.appendChild(header);
        dialog.appendChild(el("p", "small", entry ? entry.text
            : "No lexicon entry for that yet – see the rulebook."));
        var footer = el("p", "cta");
        var close = el("button", "btn btn-small", "Close");
        close.type = "button";
        close.addEventListener("click", function () { dialog.close(); });
        footer.appendChild(close);
        var more = el("a", "btn btn-small", "All abilities");
        more.href = "rules.html#abilities";
        footer.appendChild(more);
        dialog.appendChild(footer);
        dialog.showModal();
    }

    function stat(band, name, value, impaired) {
        var s = el("span", "stat" + (impaired ? " impaired" : ""));
        s.appendChild(document.createTextNode(T(name) + " "));
        s.appendChild(el("b", "", String(value)));
        band.appendChild(s);
    }
    function numberOr(value, fallback) { return (value === 0 || value) ? value : fallback; }

    /* Bubbles as on paper: tapping marks off up to here, tapping the last
       marked one makes it whole again. */
    function pipRow(name, total, damage, structure, set) {
        var row = el("div", "pip-row");
        var label = el("div", "pip-label");
        label.appendChild(el("span", "", name));
        label.appendChild(el("span", "", (total - damage) + "/" + total));
        row.appendChild(label);
        var pips = el("div", "pips" + (structure ? " pips-structure" : ""));
        for (var i = 0; i < total; i++) {
            (function (index) {
                var gone = index < damage;
                var pip = el("button", "pip" + (gone ? " gone" : ""), gone ? "×" : "·");
                pip.type = "button";
                pip.setAttribute("aria-label", T(name) + " " + T("bubble") + " " + (index + 1) +
                    (gone ? " " + T("(marked)") : ""));
                pip.addEventListener("click", function () {
                    set(index < damage ? index : index + 1);
                });
                pips.appendChild(pip);
            })(i);
        }
        row.appendChild(pips);
        return row;
    }

    function critChip(name, count, max, onClick) {
        var chip = el("button", "chip", T(name) + (count ? " ×" + count : ""));
        chip.type = "button";
        chip.dataset.count = String(count);
        chip.title = T(name) + ": " + T("tap to count up") + " (0–" + max + ")";
        chip.addEventListener("click", onClick);
        return chip;
    }

    /* --- End of battle ----------------------------------------------------- */
    document.getElementById("more-btn").addEventListener("click", showSelection);
    document.getElementById("end-btn").addEventListener("click", function () {
        function finish(n) {
            state = { version: DATA_VERSION, units: [], round: 1 };
            S.remove(KEY);
            showSelection();
            if (n) { showMessage(n + " " + T(n === 1 ? "unit keeps its damage in the hangar." : "units keep their damage in the hangar.")); }
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

    if (state.units.length) { showBattle(); } else { showSelection(); }
})();
