/* Shared 2D6 dice block for the battle pages (CONCEPT 4.7): button -> two
   dice plus their total, optionally held against a to-hit number (hit or
   miss). Deliberately without animation - at the table, speed is what
   counts. */
(function () {
    "use strict";

    var PIPS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

    var T = window.T || function (s) { return s; };

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }

    function d6() { return 1 + Math.floor(Math.random() * 6); }

    /* options: { label (button text, default "Roll 2D6"),
                  toHit: function() -> number or null (show the total only),
                  onRoll: function(total, a, b) (optional) } */
    function block(options) {
        options = options || {};
        var container = el("div", "dice-block");
        var button = el("button", "btn btn-primary dice-btn",
            options.label || "Roll 2D6");
        button.type = "button";
        var result = el("div", "dice-result");
        result.hidden = true;

        button.addEventListener("click", function () {
            var a = d6(), b = d6(), total = a + b;
            result.innerHTML = "";
            result.hidden = false;
            var row = el("div", "dice-row");
            row.appendChild(el("span", "die-face", PIPS[a - 1]));
            row.appendChild(el("span", "die-face", PIPS[b - 1]));
            row.appendChild(el("span", "dice-total", "= " + total));
            result.appendChild(row);
            var target = options.toHit ? options.toHit() : null;
            if (target !== null && target !== undefined) {
                var hit = total >= target;
                result.appendChild(el("p",
                    "dice-verdict " + (hit ? "is-hit" : "is-miss"),
                    hit ? T("HIT") + " (" + T("target") + " " + target + "+)" : T("miss") + " (" + T("target") + " " + target + "+)"));
            }
            button.textContent = T("Roll again");
            if (options.onRoll) { options.onRoll(total, a, b); }
        });

        container.appendChild(button);
        container.appendChild(result);
        return container;
    }

    window.MechsDice = { block: block, d6: d6 };
})();
