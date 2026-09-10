/* Per-unit modifiers (CONCEPT §10, F5): pilot abilities, quirks, house rules
   - everything that sits on a unit permanently and shifts the to-hit number.
   Deliberately typed in by hand instead of coming from a rules table: the
   group's own sheet is the source, we only do the arithmetic.

   Hangar: rows (name + value) in the editor, stored as
           mech.modifiers = [{name, value}]
   Battle: chips in the attack dialog, the active ones remembered in
           unit.activeMods = {index: true} - the battle unit holds a copy of
           the mech, so the indices stay stable. */
(function () {
    "use strict";

    var T = window.T || function (s) { return s; };
    var RANGE = 6;   /* −6 to +6 covers abilities and quirks */

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }
    function signed(value) { return (value > 0 ? "+" : value < 0 ? "−" : "±") + Math.abs(value); }

    /* --- Hangar editor ---------------------------------------------------- */
    function row(mod) {
        mod = mod || {};
        var r = el("div", "mod-edit-row");

        var nameBox = el("div", "mod-field-name");
        nameBox.appendChild(el("label", "", "Ability / quirk"));
        var name = document.createElement("input");
        name.type = "text";
        name.placeholder = T("e.g. Sniper, Poor Targeting Systems");
        if (mod.name) { name.value = mod.name; }
        nameBox.appendChild(name);
        r.appendChild(nameBox);

        var valueBox = el("div", "mod-field-value");
        valueBox.appendChild(el("label", "", "To-hit"));
        var select = document.createElement("select");
        for (var v = -RANGE; v <= RANGE; v++) {
            var o = el("option", "", signed(v));
            o.value = String(v);
            if ((mod.value === 0 || mod.value) ? mod.value === v : v === -1) { o.selected = true; }
            select.appendChild(o);
        }
        valueBox.appendChild(select);
        r.appendChild(valueBox);

        var removeBox = el("div", "mod-field-button");
        var remove = el("button", "btn btn-small btn-danger", "×");
        remove.type = "button";
        remove.setAttribute("aria-label", T("Remove modifier"));
        remove.addEventListener("click", function () { r.remove(); });
        removeBox.appendChild(remove);
        r.appendChild(removeBox);
        return r;
    }
    function read(container) {
        if (!container) { return []; }
        return Array.prototype.map.call(container.children, function (r) {
            var fields = r.querySelectorAll("input, select");
            return { name: fields[0].value.trim(), value: parseInt(fields[1].value, 10) || 0 };
        }).filter(function (mod) { return mod.name; });
    }
    /* Fill the editor with the existing modifiers (none = no rows). */
    function fill(container, mods) {
        if (!container) { return; }
        container.innerHTML = "";
        (mods && mods.length ? mods : []).forEach(function (mod) { container.appendChild(row(mod)); });
    }

    /* --- Battle ----------------------------------------------------------- */
    function list(mech) {
        return (mech && mech.modifiers) || [];
    }
    function sum(mech, active) {
        var s = 0;
        list(mech).forEach(function (mod, i) { if (active && active[i]) { s += mod.value || 0; } });
        return s;
    }
    /* Names of the active modifiers for the arithmetic line
       ("Gunnery 4 · Sniper −1") */
    function texts(mech, active) {
        var t = [];
        list(mech).forEach(function (mod, i) {
            if (active && active[i]) { t.push(mod.name + " " + signed(mod.value || 0)); }
        });
        return t;
    }
    /* Chips to switch them on and off; onToggle() redraws the dialog. */
    function chips(options) {
        var mech = options.mech;
        var mods = list(mech);
        if (!mods.length) { return null; }
        var unit = options.unit;
        unit.activeMods = unit.activeMods || {};

        var container = document.createDocumentFragment();
        var label = el("div", "pip-label");
        label.appendChild(el("span", "", "Abilities & quirks"));
        container.appendChild(label);
        var box = el("div", "chips mod-chips");
        mods.forEach(function (mod, i) {
            var chip = el("button", "chip", mod.name + " " + signed(mod.value || 0));
            chip.type = "button";
            chip.setAttribute("aria-pressed", String(!!unit.activeMods[i]));
            chip.addEventListener("click", function () {
                if (unit.activeMods[i]) { delete unit.activeMods[i]; } else { unit.activeMods[i] = true; }
                options.onToggle();
            });
            box.appendChild(chip);
        });
        container.appendChild(box);
        return container;
    }

    window.MechsModifiers = {
        row: row, read: read, fill: fill,
        sum: sum, texts: texts, chips: chips, list: list
    };
})();
