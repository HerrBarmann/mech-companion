/* Hit location helper (CONCEPT 4.3): pick the attack direction, roll or read
   the table - the location that was hit lights up on the silhouette. The
   tables come from data/classic-rules.json. */
(function () {
    "use strict";

    var ROOT = new URL("..", document.currentScript.src);

    var LOCATION_NAME = {
        head: "Head", ct: "Center torso", rt: "Right torso", lt: "Left torso",
        ra: "Right arm", la: "Left arm", rl: "Right leg", ll: "Left leg"
    };
    /* Silhouette as on the record sheet: the 'Mech is facing us. */
    var DOLL = {
        head: "92,6 128,6 136,20 128,34 92,34 84,20",
        ct: "86,40 134,40 134,156 110,168 86,156",
        lt: "138,40 178,48 178,138 138,156",
        rt: "82,40 42,48 42,138 82,156",
        la: "182,52 210,62 210,168 188,176 182,144",
        ra: "38,52 10,62 10,168 32,176 38,144",
        ll: "114,166 140,160 158,296 118,296",
        rl: "106,166 80,160 62,296 102,296"
    };
    var LABEL = { ct: [110, 52], lt: [158, 58], rt: [62, 58], la: [196, 72],
                  ra: [24, 72], ll: [130, 182], rl: [90, 182], head: [110, 24] };

    var rules = null;
    var direction = "front";
    var lastRoll = null;   /* {total, d1, d2} */

    var container = document.getElementById("hit-locations");

    var T = window.T || function (s) { return s; };

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }

    fetch(new URL("data/classic-rules.json", ROOT))
        .then(function (r) { return r.json(); })
        .then(function (d) { rules = d; render(); })
        .catch(function () { container.textContent = T("Tables could not be loaded."); });

    function roll() {
        var d1 = 1 + Math.floor(Math.random() * 6);
        var d2 = 1 + Math.floor(Math.random() * 6);
        lastRoll = { total: d1 + d2, d1: d1, d2: d2 };
        render();
    }

    function render() {
        container.innerHTML = "";
        var table = rules.hitLocations[direction];
        var hit = lastRoll ? table[String(lastRoll.total)] : null;

        /* Direction */
        var directionCard = el("div", "card calculator-category");
        var header = el("div", "pip-label");
        header.appendChild(el("span", "", "Attack from direction"));
        directionCard.appendChild(header);
        var chips = el("div", "chips");
        [["front", "Front"], ["left", "Left"], ["right", "Right"], ["rear", "Rear"]].forEach(function (d) {
            var chip = el("button", "chip", d[1]);
            chip.type = "button";
            chip.setAttribute("aria-pressed", String(direction === d[0]));
            chip.addEventListener("click", function () {
                direction = d[0];
                lastRoll = null;
                render();
            });
            chips.appendChild(chip);
        });
        directionCard.appendChild(chips);
        container.appendChild(directionCard);

        /* Roll and result */
        var result = el("div", "readout");
        if (hit) {
            result.appendChild(el("p", "readout-label",
                T("Rolled:") + " " + lastRoll.d1 + " + " + lastRoll.d2 + " = " + lastRoll.total));
            result.appendChild(el("div", "readout-value", LOCATION_NAME[hit[0]]));
            var notes = [];
            if (hit[1]) { notes.push(T("Roll for a critical hit!")); }
            if (hit[0] === "head") { notes.push(T("Pilot takes 1 hit.")); }
            if (direction === "rear" && ["ct", "rt", "lt"].indexOf(hit[0]) !== -1) {
                notes.push(T("Rear armor!"));
            }
            result.appendChild(el("p", "readout-aside", notes.join(" · ") || " "));
        } else {
            result.appendChild(el("p", "readout-label", "Hit location"));
            result.appendChild(el("div", "readout-value", "?"));
            result.appendChild(el("p", "readout-aside", "Roll or read the table"));
        }
        var button = el("button", "btn btn-primary", "Roll 2D6");
        button.type = "button";
        button.style.marginTop = "0.6rem";
        button.addEventListener("click", roll);
        result.appendChild(el("div")).appendChild(button);
        container.appendChild(result);

        /* Silhouette */
        var svgParts = [];
        Object.keys(DOLL).forEach(function (location) {
            var className = hit && hit[0] === location ? "z-hit" : "";
            svgParts.push('<polygon class="' + className + '" points="' + DOLL[location] + '"></polygon>');
            var l = LABEL[location];
            svgParts.push('<text class="z-label" x="' + l[0] + '" y="' + l[1] + '">' +
                T(location === "head" ? "HD" : location.toUpperCase()) + '</text>');
        });
        var dollBox = el("div", "doll-wrap");
        dollBox.innerHTML = '<svg class="doll doll-hit" viewBox="0 0 220 310" role="img" aria-label="' + T("Hit location silhouette") + '">' +
            svgParts.join("") + "</svg>";
        container.appendChild(dollBox);

        /* Table */
        var tableCard = el("div", "card");
        tableCard.appendChild(el("h2", "", T("Table") + " · " + T(direction.charAt(0).toUpperCase() + direction.slice(1)))).style.fontSize = "1.05rem";
        var scroll = el("div", "table-scroll");
        var t = el("table", "zones-table");
        Object.keys(table).sort(function (a, b) { return a - b; }).forEach(function (roll2d6) {
            var row = el("tr", lastRoll && String(lastRoll.total) === roll2d6 ? "hit-row" : "");
            var entry = table[roll2d6];
            row.appendChild(el("td", "zone-name", roll2d6));
            row.appendChild(el("td", "", T(LOCATION_NAME[entry[0]]) + (entry[1] ? " + " + T("crit") : "")));
            t.appendChild(row);
        });
        scroll.appendChild(t);
        tableCard.appendChild(scroll);
        container.appendChild(tableCard);
    }
})();
