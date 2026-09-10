/* Print record sheets (CONCEPT §10, F4): builds one sheet per 'Mech out of
   the Classic hangar, with armor, structure, weapons, crit slots and the heat
   scale. Pure rendering - nothing is stored. */
(function () {
    "use strict";

    var SYSTEM = "classic";
    var S = window.MechsStorage;
    var ROOT = new URL("..", document.currentScript.src);
    var T = window.T || function (s) { return s; };
    /* The name of this instance for the footer of the sheet - it sits as a
       <meta> in the page and comes from site.json at build time. */
    function siteName() {
        var m = document.querySelector('meta[name="site-name"]');
        var value = (m && m.content) || "";
        return value.indexOf("{{") !== -1 ? "" : value;      /* placeholder unfilled */
    }
    /* Footer without a leading separator if no name is set. */
    function footerText(parts) {
        return parts.filter(function (x) { return x; }).join(" · ");
    }

    /* Armor locations including the rear; structure has no rear values. */
    var ARMOR_LOCATIONS = [
        ["head", "Head"], ["ct", "Center torso"], ["ctr", "CT rear"],
        ["rt", "Right torso"], ["rtr", "RT rear"],
        ["lt", "Left torso"], ["ltr", "LT rear"],
        ["ra", "Right arm"], ["la", "Left arm"],
        ["rl", "Right leg"], ["ll", "Left leg"]
    ];
    var STRUCTURE_LOCATIONS = [
        ["head", "Head"], ["ct", "Center torso"], ["rt", "Right torso"], ["lt", "Left torso"],
        ["ra", "Right arm"], ["la", "Left arm"], ["rl", "Right leg"], ["ll", "Left leg"]
    ];
    var SLOT_LOCATIONS = [
        ["head", "Head"], ["ct", "Center torso"], ["rt", "Right torso"], ["lt", "Left torso"],
        ["ra", "Right arm"], ["la", "Left arm"], ["rl", "Right leg"], ["ll", "Left leg"]
    ];

    var list = document.getElementById("selection-list");
    var sheetBox = document.getElementById("sheet");
    var statusDisplay = document.getElementById("selection-status");
    var rules = null;

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }
    function numberOr(value, fallback) { return (value === 0 || value) ? value : fallback; }
    function boxes(count, className) {
        var box = el("div", "boxes");
        for (var i = 0; i < (count || 0); i++) {
            if (i > 0 && i % 10 === 0) { box.appendChild(el("span", "gap")); }
            box.appendChild(el("span", "box" + (className ? " " + className : "")));
        }
        return box;
    }

    /* --- Selection --------------------------------------------------------- */
    function mechs() { return S.loadHangar(SYSTEM).mechs; }

    function renderSelection() {
        list.innerHTML = "";
        var all = mechs();
        document.getElementById("selection-empty").hidden = all.length !== 0;
        all.forEach(function (m) {
            var row = el("div", "selection-row");
            var box = document.createElement("input");
            box.type = "checkbox";
            box.id = "print-" + m.id;
            box.value = m.id;
            box.checked = true;
            var label = document.createElement("label");
            label.htmlFor = box.id;
            label.textContent = m.name + (m.tonnage ? " · " + m.tonnage + " t" : "");
            row.appendChild(box); row.appendChild(label);
            list.appendChild(row);
        });
        renderSheets();
    }
    function selected() {
        var ids = {};
        list.querySelectorAll("input:checked").forEach(function (b) { ids[b.value] = true; });
        return mechs().filter(function (m) { return ids[m.id]; });
    }

    /* --- Sheet ------------------------------------------------------------- */
    function block(title) {
        var b = el("div", "sheet-block");
        b.appendChild(el("h3", "", title));
        return b;
    }
    /* Wide tables scroll inside themselves on a phone - in print the frame
       is set to `overflow: visible`, so nothing is lost there. */
    function scrollable(content) {
        var box = el("div", "table-scroll");
        box.appendChild(content);
        return box;
    }
    function locationTable(locations, source, className) {
        var t = el("table", "zones-table");
        locations.forEach(function (loc) {
            var value = source ? source[loc[0]] : 0;
            var tr = el("tr");
            tr.appendChild(el("td", "zone", loc[1]));
            tr.appendChild(el("td", "num", String(numberOr(value, 0))));
            var td = el("td");
            td.appendChild(boxes(value, className));
            tr.appendChild(td);
            t.appendChild(tr);
        });
        return t;
    }
    function weaponTable(weapons) {
        var t = el("table", "sheet-table");
        var header = el("tr");
        ["Weapon", "Location", "Damage", "Heat", "Range", "ammo"].forEach(function (n) {
            header.appendChild(el("th", n === "Weapon" ? "" : "mono", n));
        });
        t.appendChild(header);
        weapons.forEach(function (w) {
            var tr = el("tr");
            tr.appendChild(el("td", "", w.name));
            tr.appendChild(el("td", "mono", w.location || "–"));
            tr.appendChild(el("td", "mono", T(w.damage || "?")));
            tr.appendChild(el("td", "mono", String(numberOr(w.heat, "?"))));
            tr.appendChild(el("td", "mono", T(w.range || "–")));
            var ammo = el("td", "mono");
            if (w.ammo) {
                ammo.appendChild(document.createTextNode(w.ammo + " "));
                ammo.appendChild(boxes(Math.min(w.ammo, 30)));
            } else {
                ammo.appendChild(document.createTextNode("–"));
            }
            tr.appendChild(ammo);
            t.appendChild(tr);
        });
        return t;
    }
    function slotColumns(critSlots) {
        var grid = el("div", "slot-columns");
        SLOT_LOCATIONS.forEach(function (loc) {
            var slots = (critSlots || {})[loc[0]] || [];
            if (!slots.length) { return; }
            var column = el("div", "slot-list");
            column.appendChild(el("h4", "", loc[1]));
            var ol = el("ol");
            slots.forEach(function (name) {
                var empty = !name || name === "-" || name === "—";
                var li = el("li", empty ? "empty" : "", empty ? "—" : T(name));
                ol.appendChild(li);
            });
            column.appendChild(ol);
            grid.appendChild(column);
        });
        return grid;
    }
    function heatTable() {
        var t = el("table", "sheet-table");
        var header = el("tr");
        header.appendChild(el("th", "mono", "Heat"));
        header.appendChild(el("th", "", "Effect"));
        t.appendChild(header);
        (rules && rules.heatThresholds ? rules.heatThresholds : []).forEach(function (threshold) {
            var tr = el("tr");
            tr.appendChild(el("td", "mono", String(threshold.value)));
            tr.appendChild(el("td", "", threshold.effect));
            t.appendChild(tr);
        });
        return t;
    }

    function sheet(m) {
        var b = el("div", "sheet");

        var header = el("div", "sheet-header");
        header.appendChild(el("h2", "", m.name));
        if (m.tonnage) { header.appendChild(el("span", "sheet-type", m.tonnage + " t")); }
        if (m.bv) { header.appendChild(el("span", "sheet-pv", "BV " + m.bv)); }
        b.appendChild(header);

        var walk = (m.movement && m.movement.walk) || 0;
        var jump = (m.movement && m.movement.jump) || 0;
        var sinks = m.heatSinks || {};
        var dissipation = (sinks.count || 0) * (sinks.double ? 2 : 1);
        var statRow = el("div", "sheet-values");
        function stat(name, content) {
            var s = el("span");
            s.appendChild(document.createTextNode(T(name) + " "));
            s.appendChild(el("b", "", String(content)));
            statRow.appendChild(s);
        }
        stat("Walk", walk);
        stat("Run", Math.ceil(walk * 1.5));
        stat("Jump", jump);
        stat("Heat sinks, total", (sinks.count || 0) + (sinks.double ? " ×2" : "") + " → " + T("Dissipation") + " " + dissipation);
        stat("Gunnery", numberOr(m.pilot && m.pilot.gunnery, "?"));
        stat("Piloting", numberOr(m.pilot && m.pilot.piloting, "?"));
        if (m.pilot && m.pilot.name) { stat("Pilot", m.pilot.name); }
        b.appendChild(statRow);

        var armor = block("Armor");
        armor.appendChild(locationTable(ARMOR_LOCATIONS, m.armor));
        b.appendChild(armor);

        var structure = block("Structure");
        structure.appendChild(locationTable(STRUCTURE_LOCATIONS, m.structure, "structure"));
        b.appendChild(structure);

        if (m.weapons && m.weapons.length) {
            var weapons = block("weapons");
            weapons.appendChild(scrollable(weaponTable(m.weapons)));
            b.appendChild(weapons);
        }
        if (m.critSlots) {
            var slots = block("Critical slots");
            slots.appendChild(slotColumns(m.critSlots));
            b.appendChild(slots);
        }
        if (m.modifiers && m.modifiers.length) {
            var mods = block("Abilities & quirks");
            var modList = el("div", "sheet-values");
            m.modifiers.forEach(function (mod) {
                var s = el("span");
                s.appendChild(document.createTextNode(mod.name + " "));
                s.appendChild(el("b", "", (mod.value > 0 ? "+" : mod.value < 0 ? "−" : "±") + Math.abs(mod.value || 0)));
                modList.appendChild(s);
            });
            mods.appendChild(modList);
            b.appendChild(mods);
        }

        var heat = block("Heat scale");
        heat.appendChild(scrollable(heatTable()));
        b.appendChild(heat);

        if (m.notes) {
            var notes = block("Notes");
            notes.appendChild(el("p", "", m.notes));
            b.appendChild(notes);
        }

        b.appendChild(el("p", "sheet-footer",
            footerText([siteName(), T("Rules values: Total Warfare / BattleMech Manual.") + " " +
                T("MechWarrior, BattleMech, ’Mech and BattleTech are registered trademarks of The Topps Company, Inc."),
                T("Mech Companion by Dennis Bormann · CC BY-NC-SA 4.0")])));
        return b;
    }

    function renderSheets() {
        sheetBox.innerHTML = "";
        var chosen = selected();
        statusDisplay.textContent = chosen.length + " " + T("of") + " " + mechs().length;
        chosen.forEach(function (m) { sheetBox.appendChild(sheet(m)); });
    }

    list.addEventListener("change", renderSheets);
    document.getElementById("all-btn").addEventListener("click", function () {
        list.querySelectorAll("input").forEach(function (b) { b.checked = true; });
        renderSheets();
    });
    document.getElementById("none-btn").addEventListener("click", function () {
        list.querySelectorAll("input").forEach(function (b) { b.checked = false; });
        renderSheets();
    });
    document.getElementById("print-btn").addEventListener("click", function () { window.print(); });

    fetch(new URL("data/classic-rules.json", ROOT))
        .then(function (r) { return r.json(); })
        .then(function (d) { rules = d; renderSheets(); })
        .catch(function () {});

    renderSelection();
})();
