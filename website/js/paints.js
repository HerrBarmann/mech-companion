/* Paint conversion: filters the table rows by the search field. */
(function () {
    "use strict";
    var field = document.getElementById("paint-search");
    var table = document.getElementById("paint-table");
    var empty = document.getElementById("paint-empty");
    if (!field || !table) { return; }

    field.addEventListener("input", function () {
        var q = field.value.trim().toLowerCase();
        var hits = 0;
        table.querySelectorAll("tr").forEach(function (row) {
            if (row.querySelector("th")) { return; }
            var matches = !q || row.textContent.toLowerCase().indexOf(q) !== -1;
            row.hidden = !matches;
            if (matches) { hits++; }
        });
        if (empty) { empty.hidden = hits !== 0; }
    });
})();
