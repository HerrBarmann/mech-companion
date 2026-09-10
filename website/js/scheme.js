/* Custom scheme - the mercenary workshop (CONCEPT 4.5): three colour
   pickers, a name, a live silhouette. Stored in localStorage (MechsStorage),
   shared through URL parameters (?name=&base=&trim=&accent= without a #) -
   entirely without a backend. */
(function () {
    "use strict";

    /* Freshly created structures carry today's data version right away,
       otherwise migrate.js sends them through again on the next start. */
    var DATA_VERSION = (window.MechsMigrate && MechsMigrate.VERSION) || 3;
    if (!document.getElementById("scheme-form")) { return; }

    var S = window.MechsStorage;
    var STORE = "schemes";
    var state = S.load(STORE, { version: DATA_VERSION, list: [] });

    var form = document.getElementById("scheme-form");
    var nameField = document.getElementById("scheme-name");
    var previewBox = document.getElementById("scheme-preview");
    var listBox = document.getElementById("scheme-list");
    var emptyNote = document.getElementById("scheme-empty");
    var shareNote = document.getElementById("scheme-share-notice");
    var editingId = null;

    var ROLES = ["base", "trim", "accent"];
    var fields = {};
    ROLES.forEach(function (role) {
        fields[role] = {
            color: document.getElementById("color-" + role),
            hex: document.getElementById("hex-" + role)
        };
    });

    var T = window.T || function (s) { return s; };

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }

    /* --- Live preview ---------------------------------------------------- */
    function values() {
        var v = {};
        ROLES.forEach(function (r) { v[r] = fields[r].color.value; });
        return v;
    }
    var preview = MechsSilhouette.create(values());
    previewBox.appendChild(preview);

    function render() { MechsSilhouette.paint(preview, values()); }

    ROLES.forEach(function (role) {
        var f = fields[role];
        f.color.addEventListener("input", function () {
            f.hex.value = f.color.value.toUpperCase();
            render();
        });
        f.hex.addEventListener("input", function () {
            var v = f.hex.value.trim();
            if (v && v[0] !== "#") { v = "#" + v; }
            if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                f.color.value = v;
                render();
            }
        });
        f.hex.value = f.color.value.toUpperCase();
    });

    /* --- Saving and the list --------------------------------------------- */
    form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var name = nameField.value.trim() || T("Custom scheme");
        var v = values();
        if (editingId) {
            var existing = state.list.find(function (x) { return x.id === editingId; });
            if (existing) { existing.name = name; ROLES.forEach(function (r) { existing[r] = v[r]; }); }
        } else {
            state.list.push({ id: S.newId(), name: name,
                base: v.base, trim: v.trim, accent: v.accent });
        }
        editingId = null;
        document.getElementById("scheme-save").textContent = T("Save scheme");
        S.save(STORE, state);
        renderList();
    });

    function shareLink(scheme) {
        var url = new URL(location.href.split("?")[0]);
        url.searchParams.set("name", scheme.name);
        ROLES.forEach(function (r) { url.searchParams.set(r, scheme[r].replace("#", "")); });
        return url.toString();
    }

    function renderList() {
        listBox.innerHTML = "";
        emptyNote.hidden = state.list.length !== 0;
        state.list.forEach(function (scheme) {
            var card = el("article", "card f-card scheme-card");
            var row = el("div", "f-preview");
            row.appendChild(MechsSilhouette.create(scheme));
            var info = el("div");
            info.appendChild(el("h3", "", scheme.name));
            var legend = el("ul", "f-legend");
            ROLES.forEach(function (r) {
                var li = el("li");
                var chip = el("span", "f-color");
                chip.style.background = scheme[r];
                li.appendChild(chip);
                li.appendChild(el("span", "role", r));
                li.appendChild(el("span", "hex", scheme[r].toUpperCase()));
                legend.appendChild(li);
            });
            info.appendChild(legend);
            row.appendChild(info);
            card.appendChild(row);

            var footer = el("p", "cta");
            var edit = el("button", "btn btn-small", "Edit");
            edit.type = "button";
            edit.addEventListener("click", function () {
                editingId = scheme.id;
                nameField.value = scheme.name;
                ROLES.forEach(function (r) {
                    fields[r].color.value = scheme[r];
                    fields[r].hex.value = scheme[r].toUpperCase();
                });
                render();
                document.getElementById("scheme-save").textContent = T("Save changes");
                form.scrollIntoView({ behavior: "smooth", block: "start" });
            });
            var share = el("button", "btn btn-small", "Share");
            share.type = "button";
            share.addEventListener("click", function () {
                var link = shareLink(scheme);
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(link).then(function () {
                        share.textContent = T("Link copied ✓");
                        setTimeout(function () { share.textContent = T("Share"); }, 1600);
                    }, function () { prompt(T("Link to share:"), link); });
                } else {
                    prompt(T("Link to share:"), link);
                }
            });
            var remove = el("button", "btn btn-small btn-danger", "Delete");
            remove.type = "button";
            remove.addEventListener("click", function () {
                if (!confirm(Z(scheme.name) + " " + T("delete?"))) { return; }
                state.list = state.list.filter(function (x) { return x.id !== scheme.id; });
                S.save(STORE, state);
                renderList();
            });
            footer.appendChild(edit); footer.appendChild(share); footer.appendChild(remove);
            card.appendChild(footer);
            listBox.appendChild(card);
        });
    }

    /* --- Adopt a shared scheme from the URL ------------------------------- */
    var params = new URLSearchParams(location.search);
    /* The roles were called basis/trim/akzent up to data version 3. Old
       links from the group chat should still open, so both are read. */
    var OLD_ROLE = { base: "basis", trim: "trim", accent: "akzent" };
    if (params.get("base") || params.get("basis") || params.get("name")) {
        if (params.get("name")) { nameField.value = params.get("name"); }
        ROLES.forEach(function (r) {
            var v = params.get(r) || params.get(OLD_ROLE[r]);
            if (v && /^[0-9a-fA-F]{6}$/.test(v)) {
                fields[r].color.value = "#" + v;
                fields[r].hex.value = ("#" + v).toUpperCase();
            }
        });
        render();
        shareNote.hidden = false;
    }

    renderList();
})();
