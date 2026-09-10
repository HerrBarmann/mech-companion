/* Print unit cards (CONCEPT §10, F4): builds a print sheet with four cards
   per A4 page out of the Alpha Strike hangar. Pure rendering - nothing is
   stored and nothing is fetched except the skill ladder for the PV
   adjustment. */
(function () {
    "use strict";

    var SYSTEM = "alpha-strike";
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

    var TYPE_NAMES = { BM: "BattleMech", IM: "IndustrialMech", CV: "Vehicle", SV: "Support vehicle",
                       BA: "Battle Armor", CI: "Infantry", PM: "ProtoMech" };

    var list = document.getElementById("selection-list");
    var sheet = document.getElementById("sheet");
    var statusDisplay = document.getElementById("selection-status");
    var pvSkill = null;

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }
    function numberOr(value, fallback) { return (value === 0 || value) ? value : fallback; }
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
    /* The same ladder as in the battle selection (as-calculator.json). */
    function pvWithSkill(pv, skill) {
        var k = pvSkill;
        if (!k || !pv || skill === undefined || skill === null || skill === 4) { return pv; }
        var steps = 4 - skill;
        var perStep = steps > 0
            ? 1 + Math.floor(Math.max(0, pv - k.improveFrom) / k.improveStep)
            : 1 + Math.floor(Math.max(0, pv - k.worsenFrom) / k.worsenStep);
        return Math.max(1, pv + steps * perStep);
    }
    /* Boxes to tick off, with a gap after every ten so they can be counted. */
    function boxes(count, className) {
        var box = el("div", "boxes");
        for (var i = 0; i < (count || 0); i++) {
            if (i > 0 && i % 10 === 0) { box.appendChild(el("span", "gap")); }
            box.appendChild(el("span", "box" + (className ? " " + className : "")));
        }
        if (!count) { box.appendChild(el("span", "uc-pips", "–")); }
        return box;
    }
    function pipRow(name, count, className) {
        var row = el("div", "uc-pips");
        row.appendChild(document.createTextNode(T(name) + " " + (count || 0)));
        row.appendChild(boxes(count, className));
        return row;
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
            label.textContent = m.name + (typeOf(m) !== "BM" ? " · " + typeName(m) : "");
            row.appendChild(box); row.appendChild(label);
            list.appendChild(row);
        });
        renderSheet();
    }
    function selected() {
        var ids = {};
        list.querySelectorAll("input:checked").forEach(function (b) { ids[b.value] = true; });
        return mechs().filter(function (m) { return ids[m.id]; });
    }

    /* --- Cards ------------------------------------------------------------- */
    function card(m) {
        var c = el("article", "unit-card");

        var header = el("div", "uc-header");
        if (m.icon) {
            var image = el("img", "uc-icon");
            image.alt = "";
            image.src = new URL(m.icon, ROOT);
            header.appendChild(image);
        }
        header.appendChild(el("h3", "", m.name));
        var pvEffective = pvWithSkill(m.pv || 0, m.skill);
        header.appendChild(el("span", "uc-pv", "PV " + (m.pv ? pvEffective : "?")));
        c.appendChild(header);

        var stats = el("div", "uc-values");
        function stat(name, content) {
            var s = el("span");
            s.appendChild(document.createTextNode(T(name) + " "));
            s.appendChild(el("b", "", String(content)));
            stats.appendChild(s);
        }
        if (typeOf(m) !== "BM") { stats.appendChild(el("span", "uc-type", typeName(m))); }
        stat("SZ", numberOr(m.sz, "?"));
        stat("MV", m.mv || "?");
        stat("TMM", numberOr(m.tmm, "?"));
        stat("Skill", numberOr(m.skill, 4));
        if (hasHeat(m)) { stat("OV", numberOr(m.ov, 0)); }
        if (m.pv && pvEffective !== m.pv) { stat(T("PV base"), m.pv); }
        c.appendChild(stats);

        var damage = el("div", "uc-damage");
        [["S", m.s], ["M", m.m], ["L", m.l]].forEach(function (p) {
            var s = el("span");
            s.appendChild(el("b", "", String(p[1] || "0")));
            s.appendChild(document.createTextNode(p[0]));
            damage.appendChild(s);
        });
        c.appendChild(damage);

        c.appendChild(pipRow("Armor", m.armor));
        c.appendChild(pipRow("Structure", m.structure, "structure"));

        if (hasHeat(m)) {
            var heat = el("div", "uc-heat");
            heat.appendChild(document.createTextNode(T("Heat")));
            ["1", "2", "3", "S"].forEach(function (level) {
                heat.appendChild(el("span", "box"));
                heat.appendChild(document.createTextNode(level));
            });
            c.appendChild(heat);
        }

        var kind = critKind(m);
        if (kind !== "none") {
            var crits = el("div", "uc-pips");
            var parts = kind === "vehicle"
                ? [["Engine", 2], ["Fire Control", 4], ["Weapon", 4], ["Crew", 1], ["Motive", 3]]
                : kind === "proto"
                    ? [["Fire Control", 1], ["Weapon", 4], ["MP", 3]]
                    : [["Engine", 2], ["Fire Control", 4], ["Weapon", 4], ["MP", 1]];
            var row = el("div", "boxes");
            parts.forEach(function (p, i) {
                if (i > 0) { row.appendChild(el("span", "gap")); }
                var label = el("span", "uc-pips", p[0]);
                label.style.marginRight = "3px";
                row.appendChild(label);
                for (var j = 0; j < p[1]; j++) { row.appendChild(el("span", "box")); }
            });
            crits.appendChild(document.createTextNode(T("Critical hits")));
            crits.appendChild(row);
            c.appendChild(crits);
        }

        if (m.special) { c.appendChild(el("div", "uc-specials", m.special)); }
        /* A unit's own abilities and quirks belong on the card - in battle
           they are switched on one by one, here they are for reference. */
        if (m.modifiers && m.modifiers.length) {
            c.appendChild(el("div", "uc-specials uc-mods",
                T("Abilities & quirks") + ": " + m.modifiers.map(function (mod) {
                    return mod.name + " " + (mod.value > 0 ? "+" : mod.value < 0 ? "−" : "±") + Math.abs(mod.value || 0);
                }).join(" · ")));
        }
        return c;
    }

    function renderSheet() {
        sheet.innerHTML = "";
        var chosen = selected();
        statusDisplay.textContent = chosen.length + " " + T("of") + " " + mechs().length;
        if (!chosen.length) { return; }
        var page = el("div", "sheet");
        var grid = el("div", "card-grid");
        chosen.forEach(function (m) { grid.appendChild(card(m)); });
        page.appendChild(grid);
        page.appendChild(el("p", "sheet-footer",
            footerText([siteName(), T("Card values: Alpha Strike Commander’s Edition.") + " " +
                T("MechWarrior, BattleMech, ’Mech and BattleTech are registered trademarks of The Topps Company, Inc."),
                T("Mech Companion by Dennis Bormann · CC BY-NC-SA 4.0")])));
        sheet.appendChild(page);
    }

    list.addEventListener("change", renderSheet);
    document.getElementById("all-btn").addEventListener("click", function () {
        list.querySelectorAll("input").forEach(function (b) { b.checked = true; });
        renderSheet();
    });
    document.getElementById("none-btn").addEventListener("click", function () {
        list.querySelectorAll("input").forEach(function (b) { b.checked = false; });
        renderSheet();
    });
    document.getElementById("print-btn").addEventListener("click", function () { window.print(); });

    fetch(new URL("data/calculator-alpha-strike.json", ROOT))
        .then(function (r) { return r.json(); })
        .then(function (d) { pvSkill = d.pvSkill; renderSheet(); })
        .catch(function () {});

    renderSelection();
})();
