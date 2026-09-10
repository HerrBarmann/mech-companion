/* Glossary English <-> German (CONCEPT 3.5): a searchable list from
   data/glossary.json, filtered by text (either direction) and category. */
(function () {
    "use strict";
    if (!document.getElementById("glossary-list")) { return; }

    var ROOT = new URL("..", document.currentScript.src);
    var list = document.getElementById("glossary-list");
    var search = document.getElementById("glossary-search");
    var categoryBox = document.getElementById("glossary-categories");
    var asOf = document.getElementById("glossary-status");
    var noMatch = document.getElementById("glossary-empty");
    var data = null;
    var activeCategory = "";

    var T = window.T || function (s) { return s; };

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }

    fetch(new URL("data/glossary.json", ROOT))
        .then(function (r) { return r.json(); })
        .then(function (d) {
            data = d;
            if (asOf && d.asOf) { asOf.textContent = d.asOf; }
            buildCategories();
            render();
        })
        .catch(function () { list.textContent = T("Glossary could not be loaded."); });

    function buildCategories() {
        Object.keys(data.categories).forEach(function (id) {
            var chip = el("button", "chip", data.categories[id]);
            chip.type = "button";
            chip.setAttribute("aria-pressed", "false");
            chip.addEventListener("click", function () {
                activeCategory = activeCategory === id ? "" : id;
                categoryBox.querySelectorAll(".chip").forEach(function (c, i) {
                    c.setAttribute("aria-pressed",
                        String(Object.keys(data.categories)[i] === activeCategory));
                });
                render();
            });
            categoryBox.appendChild(chip);
        });
    }

    function render() {
        var q = search.value.trim().toLowerCase();
        list.innerHTML = "";
        var hits = 0;
        data.entries.forEach(function (entry) {
            if (activeCategory && entry.category !== activeCategory) { return; }
            var text = (entry.en + " " + entry.de + " " + (entry.note || "")).toLowerCase();
            if (q && text.indexOf(q) === -1) { return; }
            hits++;
            var row = el("div", "weapon-row glossary-row");
            var info = el("div");
            var header = el("div", "w-name", entry.en);
            header.appendChild(el("span", "glossary-arrow", " ↔ "));
            header.appendChild(el("span", "glossary-target", entry.de));
            info.appendChild(header);
            var bottom = el("div", "small");
            bottom.appendChild(el("span", "topic-tag", data.categories[entry.category] || entry.category));
            if (entry.note) { bottom.appendChild(document.createTextNode(" " + T(entry.note))); }
            info.appendChild(bottom);
            row.appendChild(info);
            list.appendChild(row);
        });
        noMatch.hidden = hits !== 0;
    }

    search.addEventListener("input", function () { if (data) { render(); } });
})();
