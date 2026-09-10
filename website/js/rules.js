/* Rules pages: filter across the sections, the jump bar opens its target,
   a "back to top" button, and everything unfolds before printing. */
(function () {
    "use strict";

    var sections = Array.prototype.slice.call(document.querySelectorAll("details.section"));

    /* --- Filter: type, and the matching sections stay and open up -------- */
    var field = document.getElementById("rules-filter");
    var noMatch = document.getElementById("no-match");
    if (field) {
        field.addEventListener("input", function () {
            var q = field.value.trim().toLowerCase();
            var hits = 0;
            sections.forEach(function (d) {
                if (q.length < 2) {
                    d.hidden = false;
                    d.open = false;
                    return;
                }
                var haystack = (d.textContent + " " + (d.dataset.keywords || "")).toLowerCase();
                var matches = haystack.indexOf(q) !== -1;
                d.hidden = !matches;
                d.open = matches;
                if (matches) { hits++; }
            });
            if (noMatch) { noMatch.hidden = !(q.length >= 2 && hits === 0); }
        });
    }

    /* --- Jump bar: open the target, then scroll to it -------------------- */
    function openTarget() {
        if (!location.hash) { return; }
        var target = document.getElementById(location.hash.slice(1));
        if (target && target.tagName === "DETAILS") { target.open = true; }
    }
    window.addEventListener("hashchange", openTarget);
    openTarget();

    /* --- "Back to top" --------------------------------------------------- */
    var toTop = document.querySelector(".to-top");
    if (toTop) {
        var visible = false;
        window.addEventListener("scroll", function () {
            var wanted = window.scrollY > 600;
            if (wanted !== visible) {
                visible = wanted;
                toTop.classList.toggle("visible", wanted);
            }
        }, { passive: true });
        toTop.addEventListener("click", function () {
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    }

    /* --- Printing: folded cards would be empty handouts ------------------ */
    window.addEventListener("beforeprint", function () {
        sections.forEach(function (d) { d.open = true; });
    });

    /* --- Falling damage (CONCEPT §3.2) ----------------------------------- */
    /* The formula is two lines above this in the page text; typing it into a
       phone calculator between two rolls is the part that costs time. Only
       the Classic rules page carries the mount point. */
    var fallBox = document.getElementById("fall-calc");
    if (!fallBox) { return; }

    var T = window.T || function (s) { return s; };
    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }
    function numberField(id, label, value, min, max) {
        var wrap = el("div", "fall-field");
        var l = el("label", "", label);
        l.htmlFor = id;
        var input = document.createElement("input");
        input.type = "number";
        input.id = id;
        input.value = value;
        input.min = min;
        input.max = max;
        input.inputMode = "numeric";
        wrap.appendChild(l);
        wrap.appendChild(input);
        return { box: wrap, input: input };
    }

    fetch(new URL("../data/classic-rules.json", document.currentScript ? document.currentScript.src : location.href))
        .then(function (r) { return r.json(); })
        .then(function (d) { buildFallCalculator(d.falling); })
        .catch(function () { /* no calculator without its values - the text stays */ });

    function buildFallCalculator(f) {
        if (!f) { return; }
        fallBox.appendChild(el("h3", "", "Falling damage"));

        var row = el("div", "fall-row");
        var tons = numberField("fall-tons", "Tonnage", 45, 10, 200);
        var levels = numberField("fall-levels", "Levels fallen", 0, 0, 20);
        row.appendChild(tons.box);
        row.appendChild(levels.box);
        fallBox.appendChild(row);

        var out = el("p", "fall-result");
        fallBox.appendChild(out);

        function compute() {
            var t = parseInt(tons.input.value, 10);
            var lv = parseInt(levels.input.value, 10);
            if (isNaN(t) || t <= 0 || isNaN(lv) || lv < 0) { out.textContent = "—"; return; }
            var perLevel = t / f.perTons;
            perLevel = f.roundUp ? Math.ceil(perLevel) : Math.round(perLevel);
            var total = perLevel * (lv + f.levelsPlus);
            /* The damage is not applied in one lump: it is rolled for
               location in groups of five, and the remainder is its own
               group. Spelling the groups out is the whole point - that is
               the number of hit location rolls to make. */
            var full = Math.floor(total / f.groupSize);
            var rest = total % f.groupSize;
            var groups;
            if (full === 0) { groups = T("one group of") + " " + rest; }
            else if (rest === 0) { groups = full + "×" + f.groupSize; }
            else { groups = full + "×" + f.groupSize + " + " + rest; }

            out.textContent = "";
            /* "points of damage" rather than "damage": a single lowercase
               word is indistinguishable from a CSS class to the translation
               generator, so it would never reach the dictionary. */
            out.appendChild(el("strong", "", total + " " + T("points of damage")));
            out.appendChild(el("span", "muted",
                " · " + perLevel + " " + T("per level") + " × " + (lv + f.levelsPlus)
                + " · " + groups));
        }
        tons.input.addEventListener("input", compute);
        levels.input.addEventListener("input", compute);
        compute();

        /* Facing after the fall: the die, not the table. Which hexside a 1-6
           means is the Facing After Fall Table in the book - the app does not
           carry it, so it shows the roll and says what to do with it. */
        if (window.MechsDice) {
            var facing = el("div", "fall-facing");
            var button = el("button", "btn btn-small", "Roll 1D6 for the facing");
            button.type = "button";
            var result = el("span", "fall-facing-result");
            button.addEventListener("click", function () {
                var roll = MechsDice.d6();
                result.textContent = T("Facing after fall") + ": " + roll
                    + " · " + T("that decides the hit location column");
            });
            facing.appendChild(button);
            facing.appendChild(result);
            fallBox.appendChild(facing);
        }
    }
})();
