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
})();
