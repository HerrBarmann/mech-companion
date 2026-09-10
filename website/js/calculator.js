/* GATOR/SATOR calculator (CONCEPT 4.1): ONE engine, the configuration as
   data. It runs in two modes:
   - Standalone page: a #calculator element with data-config, all categories.
   - Embedded in the record sheet: MechsCalculator.create(...) - categories
     with source:"mech" are hidden and their values come in as a fixed base
     from the tracked mech state. At the table you then only type what is
     situational: movement, target, range, terrain. */
(function () {
    "use strict";

    /* P(2D6 >= to-hit) in percent */
    var PROBABILITY = { 2: 100, 3: 97.2, 4: 91.7, 5: 83.3, 6: 72.2, 7: 58.3,
                        8: 41.7, 9: 27.8, 10: 16.7, 11: 8.3, 12: 2.8 };

    var T = window.T || function (s) { return s; };

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }

    /* Which categories a run uses: the record sheet hides what it fills in
       itself (source "mech") and what it computes per weapon (the ranges). */
    function categoriesOf(config, options) {
        options = options || {};
        var skip = options.skip || [];
        return config.categories.filter(function (c) {
            if (options.withoutMechSources && c.source === "mech") { return false; }
            return skip.indexOf(c.id) === -1;
        });
    }

    /* A fresh selection, taking over what was stored where it still fits. */
    function defaultState(config, options) {
        options = options || {};
        var previousAll = options.state || {};
        var state = {};
        categoriesOf(config, options).forEach(function (c) {
            var previous = previousAll[c.id];
            if (c.type === "chips") {
                state[c.id] = (typeof previous === "number" && c.options[previous]) ? previous : (c.default || 0);
            }
            if (c.type === "toggle") { state[c.id] = !!previous; }
            if (c.type === "counter") { state[c.id] = (typeof previous === "number") ? previous : 0; }
        });
        return state;
    }

    /* The sum. The ONE place where a selection becomes a number - the record
       sheet computes its per-weapon target number with it too, so there is no
       second copy that can drift. */
    function toHit(config, state, options) {
        options = options || {};
        state = state || {};
        var total = (config.base || 0) + (options.baseExtra || 0);
        categoriesOf(config, options).forEach(function (c) {
            var v = state[c.id];
            if (c.type === "chips") {
                var i = (typeof v === "number" && c.options[v]) ? v : (c.default || 0);
                total += c.options[i].value;
            }
            if (c.type === "toggle" && v) { total += c.value; }
            if (c.type === "counter" && typeof v === "number") { total += v * c.value; }
        });
        return total;
    }

    /* P(2D6 >= n) in percent, for the line under the target number. */
    function chance(n) { return PROBABILITY[Math.min(12, Math.max(2, n))]; }

    /* One decimal, in the notation of the display language. */
    function format(p) {
        var lang = (window.MechsI18n && window.MechsI18n.lang) || "en";
        try {
            return p.toLocaleString(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
        } catch (e) {
            return p.toFixed(1);
        }
    }

    /* options: { compact, withoutMechSources, baseExtra, baseText,
                  state (stored selection), onChange(state) } */
    function create(container, config, options) {
        options = options || {};
        var categories = categoriesOf(config, options);
        var state = defaultState(config, options);
        function currentToHit() { return toHit(config, state, options); }

        container.innerHTML = "";
        var readout = el("div", "readout" + (options.compact ? "" : " calculator-readout"));
        readout.appendChild(el("p", "readout-label", "To-hit"));
        var value = el("div", "readout-value");
        var aside = el("p", "readout-aside");
        readout.appendChild(value);
        readout.appendChild(aside);
        container.appendChild(readout);

        if (options.baseText) {
            container.appendChild(el("p", "hint", T("From the record sheet:") + " " + options.baseText));
        }

        function update() {
            var n = currentToHit();
            if (n > 12) {
                readout.classList.add("impossible");
                value.textContent = n + "+";
                aside.textContent = T(config.above12);
            } else {
                readout.classList.remove("impossible");
                value.textContent = Math.max(2, n) + "+";
                var p = chance(n);
                /* Das Dezimalzeichen gehört zur Sprache, nicht ins
                   Programm: "83.3" im Englischen, "83,3" im Deutschen. */
                aside.textContent = format(p) + " " + T("% on 2D6");
            }
            if (options.onChange) { options.onChange(state); }
            /* For the dice block in the attack dialog: report the current
               to-hit number. */
            if (options.onToHit) { options.onToHit(Math.max(2, n), n > 12); }
        }

        categories.forEach(function (c) {
            var card = el("div", (options.compact ? "calculator-compact" : "card calculator-category"));
            var header = el("div", "pip-label");
            var left = el("span");
            if (c.group) { left.appendChild(el("b", "gator-letter", c.group)); }
            left.appendChild(document.createTextNode(" " + T(c.label)));
            header.appendChild(left);
            card.appendChild(header);

            if (c.type === "chips") {
                var chips = el("div", "chips");
                c.options.forEach(function (o, i) {
                    var chip = el("button", "chip", o.label);
                    chip.type = "button";
                    chip.setAttribute("aria-pressed", String(state[c.id] === i));
                    chip.addEventListener("click", function () {
                        state[c.id] = i;
                        chips.querySelectorAll(".chip").forEach(function (other, j) {
                            other.setAttribute("aria-pressed", String(j === i));
                        });
                        update();
                    });
                    chips.appendChild(chip);
                });
                card.appendChild(chips);
            }
            if (c.type === "toggle") {
                var toggle = el("button", "chip", (c.value > 0 ? "+" : "") + c.value);
                toggle.type = "button";
                toggle.setAttribute("aria-pressed", String(state[c.id]));
                toggle.addEventListener("click", function () {
                    state[c.id] = !state[c.id];
                    toggle.setAttribute("aria-pressed", String(state[c.id]));
                    update();
                });
                var row = el("div", "chips");
                row.appendChild(toggle);
                card.appendChild(row);
            }
            if (c.type === "counter") {
                var min = c.min || 0;
                var max = c.max === undefined ? 9 : c.max;
                var box = el("span", "stepper");
                var minus = el("button", "", "−");
                minus.type = "button";
                var display = el("span", "value");
                var plus = el("button", "", "+");
                plus.type = "button";
                function renderCounter() {
                    var mod = state[c.id] * c.value;
                    display.textContent = (mod > 0 ? "+" : "") + mod;
                }
                minus.addEventListener("click", function () {
                    if (state[c.id] > min) { state[c.id]--; renderCounter(); update(); }
                });
                plus.addEventListener("click", function () {
                    if (state[c.id] < max) { state[c.id]++; renderCounter(); update(); }
                });
                box.appendChild(minus); box.appendChild(display); box.appendChild(plus);
                renderCounter();
                card.appendChild(box);
            }
            if (c.note && !options.compact) {
                card.appendChild(el("p", "hint", c.note));
            }
            container.appendChild(card);
        });

        var footer = el("p", "cta");
        var reset = el("button", "btn" + (options.compact ? " btn-small" : ""), T("Reset"));
        reset.type = "button";
        reset.addEventListener("click", function () {
            create(container, config, Object.assign({}, options, { state: null }));
            if (options.onChange) { options.onChange(null); }
        });
        footer.appendChild(reset);
        container.appendChild(footer);

        update();
    }

    window.MechsCalculator = {
        create: create,
        /* pure, for the record sheet and the tests */
        toHit: toHit, defaultState: defaultState, chance: chance, format: format
    };

    /* Standalone mode */
    var standalone = document.getElementById("calculator");
    if (standalone && standalone.dataset.config) {
        var ROOT = new URL("..", document.currentScript.src);
        fetch(new URL("data/" + standalone.dataset.config, ROOT))
            .then(function (r) { return r.json(); })
            .then(function (config) { create(standalone, config, {}); })
            .catch(function () { standalone.textContent = T("Calculator configuration could not be loaded."); });
    }
})();
