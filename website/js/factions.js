/* Faction browser: loads data/factions.json, renders the cards, filters by
   category and free text. */
(function () {
    "use strict";

    var ROOT = new URL("..", document.currentScript.src);
    var grid = document.getElementById("f-grid");
    var chipRow = document.getElementById("f-categories");
    var searchField = document.getElementById("f-search");
    var noMatch = document.getElementById("no-match");
    var asOf = document.getElementById("f-status");

    var data = null;
    var category = "all";
    /* The colour roles: keys in the data and labels at the same time. */
    var ROLES = ["base", "trim", "accent"];

    fetch(new URL("data/factions.json", ROOT))
        .then(function (r) { return r.json(); })
        .then(function (d) {
            data = d;
            if (asOf && d.asOf) { asOf.textContent = T("Data status") + " " + d.asOf; }
            buildChips();
            render();
        })
        .catch(function () {
            grid.innerHTML = "";
            grid.appendChild(el("p", "no-match", "Faction data could not be loaded."));
        });

    function buildChips() {
        var all = [{ id: "all", name: "All" }].concat(data.categories);
        all.forEach(function (c) {
            var b = document.createElement("button");
            b.type = "button";
            b.className = "chip";
            b.textContent = T(c.name);
            b.setAttribute("aria-pressed", String(c.id === category));
            b.addEventListener("click", function () {
                category = c.id;
                chipRow.querySelectorAll(".chip").forEach(function (other) {
                    other.setAttribute("aria-pressed", "false");
                });
                b.setAttribute("aria-pressed", "true");
                render();
            });
            chipRow.appendChild(b);
        });
    }

    function matches(f, q) {
        if (category !== "all" && f.category !== category) { return false; }
        if (!q) { return true; }
        var haystack = [f.name, f.subtitle, f.abbreviation, f.description, f.subunits, f.paintSequence]
            .filter(Boolean).join(" ").toLowerCase();
        return haystack.indexOf(q) !== -1;
    }

    function render() {
        var q = searchField ? searchField.value.trim().toLowerCase() : "";
        grid.innerHTML = "";
        var hits = 0;
        data.factions.forEach(function (f) {
            if (!matches(f, q)) { return; }
            hits++;
            grid.appendChild(f.profile ? shortCard(f) : fullCard(f));
        });
        if (noMatch) { noMatch.hidden = hits !== 0; }
    }

    var T = window.T || function (s) { return s; };

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text) { e.textContent = T(text); }
        return e;
    }

    function fullCard(f) {
        var card = el("article", "card f-card");

        var header = el("div", "f-header");
        var id = el("div", "");
        if (f.abbreviation) { id.appendChild(el("span", "f-code", f.abbreviation)); }
        id.appendChild(el("h3", "", f.name));
        if (f.subtitle) { id.appendChild(el("p", "f-house", f.subtitle)); }
        header.appendChild(id);

        var colors = el("div", "f-colors");
        ROLES.forEach(function (role) {
            var color = f.colors[role];
            if (!color) { return; }
            var chip = el("span", "f-color");
            chip.style.background = color.hex;
            chip.title = T(color.name) + " " + color.hex;
            colors.appendChild(chip);
        });
        header.appendChild(colors);
        card.appendChild(header);

        /* Silhouette preview (CONCEPT 4.4): see the scheme on the plating
           before the brush touches it. */
        var preview = el("div", "f-preview");
        preview.appendChild(MechsSilhouette.create({
            base: f.colors.base && f.colors.base.hex,
            trim: f.colors.trim && f.colors.trim.hex,
            accent: f.colors.accent && f.colors.accent.hex
        }));

        var legend = el("ul", "f-legend");
        ROLES.forEach(function (role) {
            var color = f.colors[role];
            if (!color) { return; }
            var li = el("li");
            var chip = el("span", "f-color");
            chip.style.background = color.hex;
            li.appendChild(chip);
            li.appendChild(el("span", "role", role));
            li.appendChild(el("span", "", color.name));
            li.appendChild(el("span", "hex", color.hex.toUpperCase()));
            legend.appendChild(li);
        });
        preview.appendChild(legend);
        card.appendChild(preview);

        card.appendChild(el("p", "f-text", f.description));

        if (f.subunits || f.paintSequence || f.tip) {
            var details = document.createElement("details");
            var summary = el("summary", "", "Recipe & details");
            details.appendChild(summary);
            if (f.subunits) { details.appendChild(meta("Units that differ", f.subunits)); }
            if (f.paintSequence) {
                details.appendChild(meta("Paint sequence", f.paintSequence));
                var paints = shoppingList(f.paintSequence);
                if (paints.length) {
                    var buy = el("p", "f-meta");
                    buy.appendChild(el("span", "tag-row", "Shopping list"));
                    var chips = el("span", "special-chips");
                    paints.forEach(function (name) {
                        chips.appendChild(el("span", "special-chip", name));
                    });
                    buy.appendChild(chips);
                    var more = el("a", "small", " Vallejo/Army Painter equivalents →");
                    more.href = "paints.html";
                    buy.appendChild(more);
                    details.appendChild(buy);
                }
            }
            if (f.tip) { details.appendChild(el("p", "f-warn", f.tip)); }
            card.appendChild(details);
        }
        return card;
    }

    function meta(title, text) {
        var p = el("p", "f-meta");
        p.appendChild(el("span", "tag-row", title));
        p.appendChild(document.createTextNode(T(text)));
        return p;
    }

    /* Pull the paint names out of the sequence text ("Zandri Dust",
       "Biel-Tan Green") - the technique words drop out. */
    var NOT_A_PAINT = ["Primer", "Wash", "Drybrush", "Edges", "Edge",
        "Highlight", "Zenithal", "Base", "Like", "Panels", "Contrast"];
    function shoppingList(paintSequence) {
        var found = paintSequence.match(/[A-Z][A-Za-zäöü'’-]+(?: [A-Z][A-Za-zäöü'’-]+)+/g) || [];
        var names = [];
        found.forEach(function (raw) {
            var words = raw.split(" ").filter(function (w) {
                return NOT_A_PAINT.indexOf(w) === -1;
            });
            var name = words.join(" ");
            if (words.length >= 2 && names.indexOf(name) === -1) { names.push(name); }
        });
        return names;
    }

    function shortCard(f) {
        var card = el("article", "card f-card f-short");
        var id = el("div", "");
        id.appendChild(el("h3", "", f.name));
        if (f.subtitle) { id.appendChild(el("p", "f-house", f.subtitle)); }
        card.appendChild(id);
        card.appendChild(el("p", "f-text", f.description));
        card.appendChild(el("p", "muted small", "Scheme still open – text card from the manual."));
        return card;
    }

    if (searchField) {
        searchField.addEventListener("input", function () {
            if (data) { render(); }
        });
    }
})();
