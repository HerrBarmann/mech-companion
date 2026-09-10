/* Alpha Strike special-ability lexicon: a searchable list of the codes from
   data/as-abilities.json (CONCEPT 3.3) - extend it through the JSON. */
(function () {
    "use strict";
    if (!document.getElementById("fx-list")) { return; }

    var ROOT = new URL("..", document.currentScript.src);
    var list = document.getElementById("fx-list");
    var search = document.getElementById("fx-search");
    var asOf = document.getElementById("fx-status");
    var noMatch = document.getElementById("fx-empty");
    var data = null;

    var T = window.T || function (s) { return s; };

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }

    fetch(new URL("data/as-abilities.json", ROOT))
        .then(function (r) { return r.json(); })
        .then(function (d) {
            data = d;
            if (asOf && d.asOf) { asOf.textContent = d.asOf; }
            render();
        })
        .catch(function () { list.textContent = T("Lexicon could not be loaded."); });

    function render() {
        var q = search.value.trim().toLowerCase();
        list.innerHTML = "";
        var hits = 0;
        data.abilities.forEach(function (a) {
            if (q && (a.key + " " + a.name + " " + a.text).toLowerCase().indexOf(q) === -1) { return; }
            hits++;
            var row = el("div", "weapon-row");
            var info = el("div");
            var header = el("div", "w-name", a.key);
            header.appendChild(el("span", "w-info", "  " + a.name));
            info.appendChild(header);
            info.appendChild(el("div", "small", a.text));
            row.appendChild(info);
            list.appendChild(row);
        });
        noMatch.hidden = hits !== 0;
    }

    search.addEventListener("input", function () { if (data) { render(); } });
})();
