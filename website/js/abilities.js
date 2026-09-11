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

    /* 80 Einträge am Stück waren 7825 px - der nächste Abschnitt lag mehr
       als neun Bildschirme tiefer. Man schlägt hier ein Kürzel nach, das
       auf einer Karte steht; gelesen wird die Liste nie am Stück. */
    var CAP = 12;
    var showAll = false;

    function render() {
        var q = search.value.trim().toLowerCase();
        list.innerHTML = "";
        var hits = 0;
        var treffer = data.abilities.filter(function (a) {
            return !q || (a.key + " " + a.name + " " + a.text).toLowerCase().indexOf(q) !== -1;
        });
        var gekuerzt = !q && !showAll && treffer.length > CAP;
        (gekuerzt ? treffer.slice(0, CAP) : treffer).forEach(function (a) {
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
        if (gekuerzt) {
            var mehr = el("button", "btn btn-small", "Show all");
            mehr.type = "button";
            mehr.appendChild(document.createTextNode(" (" + treffer.length + ")"));
            mehr.addEventListener("click", function () { showAll = true; render(); });
            var box = el("p", "cta");
            box.appendChild(mehr);
            list.appendChild(box);
        }
        noMatch.hidden = hits !== 0;
    }

    search.addEventListener("input", function () { if (data) { render(); } });
})();
