/* Weapons quick reference (CONCEPT 3.2): the common weapons with their
   range brackets, damage, heat and ammo, filterable - to look something up
   without opening a 'Mech.

   Values come from data/weapons.json, the curated table. That file is also
   what the converter consults first when it fills the database, so the two
   cannot disagree. A 'Mech taken out of the database carries its own values
   and stays editable; where the two differ, the record sheet wins. */
(function () {
    "use strict";
    if (!document.getElementById("wx-list")) { return; }

    var ROOT = new URL("..", document.currentScript.src);
    var list = document.getElementById("wx-list");
    var search = document.getElementById("wx-search");
    var techBox = document.getElementById("wx-tech");
    var asOf = document.getElementById("wx-status");
    var noMatch = document.getElementById("wx-empty");
    var data = null;
    var tech = null;               /* null = every tech base */

    var TECH_NAMES = { IS: "Inner Sphere", Clan: "Clan" };

    var T = window.T || function (s) { return s; };

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }
    /* Past T(): weapon names are product names and are never translated
       (CLAUDE.md), and "3/6/9" would be handed to the pattern rules that
       exist for range strings like "7/14/21 (water only)". */
    function plain(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        e.textContent = text;
        return e;
    }

    fetch(new URL("data/weapons.json", ROOT))
        .then(function (r) { return r.json(); })
        .then(function (d) {
            data = d;
            if (asOf && d.asOf) { asOf.textContent = d.asOf; }
            buildChips();
            render();
        })
        .catch(function () { list.textContent = T("Weapon values could not be loaded."); });

    /* One chip per tech base plus "all" - the same values differ between
       Inner Sphere and Clan, so the base is the one filter that matters. */
    function buildChips() {
        var keys = Object.keys(data.weapons);
        var all = el("button", "chip", "All");
        all.type = "button";
        all.dataset.tech = "";
        techBox.appendChild(all);
        keys.forEach(function (k) {
            var chip = el("button", "chip", TECH_NAMES[k] || k);
            chip.type = "button";
            chip.dataset.tech = k;
            techBox.appendChild(chip);
        });
        techBox.addEventListener("click", function (ev) {
            var chip = ev.target.closest(".chip");
            if (!chip) { return; }
            tech = chip.dataset.tech || null;
            render();
        });
    }

    /* "6/12/18", and the minimum range as its own item - it is the value
       people forget, so it does not get hidden inside the bracket list. */
    function rangeText(r) {
        if (!r) { return ""; }
        return [r.short, r.medium, r.long].join("/");
    }

    function render() {
        var q = search.value.trim().toLowerCase();
        list.innerHTML = "";
        var hits = 0;

        Object.keys(data.weapons).forEach(function (base) {
            if (tech && base !== tech) { return; }
            var names = Object.keys(data.weapons[base]).filter(function (name) {
                return !q || name.toLowerCase().indexOf(q) !== -1;
            });
            if (!names.length) { return; }

            /* The heading only earns its place when both bases are shown. */
            if (!tech) { list.appendChild(el("h4", "wx-group", TECH_NAMES[base] || base)); }

            names.forEach(function (name) {
                var w = data.weapons[base][name];
                hits++;
                var row = el("div", "wx-row");
                var head = el("div", "wx-head");
                head.appendChild(plain("span", "wx-name", name));
                head.appendChild(plain("span", "wx-range", rangeText(w.range)));
                row.appendChild(head);

                var parts = [];
                /* Der Schadenstext kann "1/missile" sein - ein Datenwert, für den es
                   Musterregeln gibt, also durch T(). */
                parts.push(T("Damage") + " " + T(String(w.damage)));
                parts.push(T("Heat") + " " + w.heat);
                if (w.range && w.range.min) { parts.push(T("Minimum range") + " " + w.range.min); }
                if (w.ammoPerTon) { parts.push(T("Shots per ton") + " " + w.ammoPerTon); }
                row.appendChild(el("div", "wx-values", parts.join(" · ")));
                list.appendChild(row);
            });
        });

        noMatch.hidden = hits !== 0;
        techBox.querySelectorAll(".chip").forEach(function (c) {
            c.setAttribute("aria-pressed", String((c.dataset.tech || null) === tech));
        });
    }

    search.addEventListener("input", function () { if (data) { render(); } });
})();
