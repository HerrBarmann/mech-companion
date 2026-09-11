/* Hangar Alpha Strike: enter, manage, export and share unit cards. Values
   live in the storage module (localStorage), photos in IndexedDB. */
(function () {
    "use strict";

    /* Freshly created structures carry today's data version right away,
       otherwise migrate.js would run them through once more on next start. */
    var DATA_VERSION = (window.MechsMigrate && MechsMigrate.VERSION) || 3;

    var SYSTEM = "alpha-strike";
    var S = window.MechsStorage;
    var ROOT = new URL("..", document.currentScript.src);

    var list = document.getElementById("mech-list");
    var editor = document.getElementById("editor");
    var form = document.getElementById("mech-form");
    var photoField = document.getElementById("f-photo");
    var photoPreview = document.getElementById("f-photo-preview");
    var message = document.getElementById("message");
    var modBox = document.getElementById("mod-rows");
    var MOD = window.MechsModifiers;

    var editingId = null;        /* null = new 'Mech */
    var takenSourceId = null;    /* database id of the model */
    var takenIcon = null;
    var newPhoto = null;         /* shrunk blob, waiting to be saved */
    var removePhoto = false;
    var objectUrls = [];

    var T = window.T || function (s) { return s; };

    /* Unit types (CONCEPT §10, F2): besides 'Mechs the hangar also holds
       vehicles, infantry, battle armor and ProtoMechs - same unit card, in
       battle their heat and crit tables differ. */
    var TYPE_NAMES = { BM: "BattleMech", IM: "IndustrialMech", CV: "Vehicle", SV: "Support vehicle",
                       BA: "Battle Armor", CI: "Infantry", PM: "ProtoMech" };
    function typeName(type) { return T(TYPE_NAMES[type] || type || "BattleMech"); }

    function el(tag, className, text) {
        var e = document.createElement(tag);
        if (className) { e.className = className; }
        if (text !== undefined) { e.textContent = T(text); }
        return e;
    }
    function showMessage(text, ok) {
        message.textContent = text;
        message.className = "flash " + (ok ? "flash-ok" : "flash-err");
        message.hidden = false;
        clearTimeout(showMessage.t);
        showMessage.t = setTimeout(function () { message.hidden = true; }, 6000);
    }

    /* --- List -------------------------------------------------------------- */
    function render() {
        objectUrls.forEach(URL.revokeObjectURL);
        objectUrls = [];
        list.innerHTML = "";
        var mechs = S.loadHangar(SYSTEM).mechs;
        document.getElementById("hangar-empty").hidden = mechs.length !== 0;

        mechs.forEach(function (m) {
            var card = el("article", "card");
            var row = el("div", "mech-row");

            var photo;
            if (m.icon) {
                photo = el("img", "photo-thumb mech-icon");
                photo.alt = "";
                photo.src = new URL(m.icon, ROOT);
            } else {
                photo = el("div", "photo-empty", "no photo");
            }
            row.appendChild(photo);
            S.loadPhoto(m.id).then(function (blob) {
                if (!blob) { return; }
                var image = el("img", "photo-thumb");
                image.alt = "";
                image.src = URL.createObjectURL(blob);
                objectUrls.push(image.src);
                row.replaceChild(image, photo);
            });

            /* Wie im Classic-Hangar: der Wert, gegen den man aufstellt,
               steht rechtsbündig in einer Spalte - hier PV. */
            var info = el("div", "mech-info");
            var kopf = el("div", "mech-head");
            var name = document.createElement("h3");
            name.textContent = m.name;
            kopf.appendChild(name);
            kopf.appendChild(el("span", "mech-key", "PV " + (m.pv || "?")));
            info.appendChild(kopf);

            var zeile = el("p", "mech-stats mech-line");
            zeile.appendChild(el("span", "",
                (m.type && m.type !== "BM" ? typeName(m.type) + " · " : "") +
                "MV " + (m.mv || "?") + " · TMM " + numberOr(m.tmm, "?") +
                " · SZ " + (m.sz || "?") + " · Skill " + numberOr(m.skill, "?")));
            info.appendChild(zeile);

            var zweit = el("p", "mech-stats mech-sub");
            zweit.textContent = T("Damage") + " " + (m.s || "0") + "/" + (m.m || "0") + "/" + (m.l || "0") +
                " · OV " + numberOr(m.ov, 0) + " · A " + numberOr(m.armor, 0) +
                " · S " + numberOr(m.structure, 0) +
                (m.special ? " · " + m.special : "");
            info.appendChild(zweit);

            var buttons = el("p", "cta");
            var b1 = el("button", "btn btn-small", "Edit");
            b1.type = "button";
            b1.addEventListener("click", function () { edit(m); });
            var b2 = el("button", "btn btn-small", "Share");
            b2.type = "button";
            b2.addEventListener("click", function () { share(m); });
            var b3 = el("button", "btn btn-small btn-danger", "Delete");
            b3.type = "button";
            b3.addEventListener("click", function () {
                if (confirm(Z(m.name) + " " + T("delete from the hangar for good?"))) {
                    S.deleteMech(SYSTEM, m.id);
                    render();
                }
            });
            buttons.appendChild(b1); buttons.appendChild(b2); buttons.appendChild(b3);
            if (window.MechsCampaign && MechsCampaign.isDamaged(SYSTEM, m)) {
                info.appendChild(MechsCampaign.badge(SYSTEM, m));
                var rep = el("button", "btn btn-small", "Repair");
                rep.type = "button";
                rep.title = T("Clear the damage from the last battle");
                rep.addEventListener("click", function () {
                    MechsCampaign.workshop({
                        system: SYSTEM, mech: m, storage: S,
                        onDone: function (fullyRepaired) {
                            render();
                            showMessage(Z(m.name) + " " + T(fullyRepaired ? "is ready for action again." : "was partially repaired."), true);
                        }
                    });
                });
                buttons.appendChild(rep);
            }
            info.appendChild(buttons);

            row.appendChild(info);
            card.appendChild(row);
            list.appendChild(card);
        });
    }
    function numberOr(value, fallback) {
        return (value === 0 || value) ? value : fallback;
    }

    /* --- Editor ------------------------------------------------------------ */
    function field(name) { return form.elements[name]; }

    function openEditor() {
        editor.hidden = false;
        editor.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    function clearEditor() {
        form.reset();
        editingId = null;
        takenIcon = null;
        newPhoto = null;
        removePhoto = false;
        photoPreview.hidden = true;
        document.getElementById("editor-title").textContent = T("New unit");
        takenSourceId = null;
        if (MOD) { MOD.fill(modBox, []); }
        if (field("type")) { field("type").value = "BM"; }
    }

    document.getElementById("mod-add-btn").addEventListener("click", function () {
        if (MOD) { modBox.appendChild(MOD.row()); }
    });
    document.getElementById("new-btn").addEventListener("click", function () {
        clearEditor();
        openEditor();
        field("skill").value = 4;
    });
    document.getElementById("cancel-btn").addEventListener("click", function () {
        editor.hidden = true;
        clearEditor();
    });

    function edit(m) {
        clearEditor();
        editingId = m.id;
        takenIcon = m.icon || null;
        document.getElementById("editor-title").textContent = m.name + " " + T("edit");
        takenSourceId = m.sourceId || null;
        if (MOD) { MOD.fill(modBox, m.modifiers); }
        ["name", "type", "pv", "sz", "mv", "tmm", "skill", "s", "m", "l", "ov",
         "armor", "structure", "special", "notes"].forEach(function (n) {
            if ((m[n] === 0 || m[n]) && field(n)) { field(n).value = m[n]; }
        });
        S.loadPhoto(m.id).then(function (blob) {
            if (blob && editingId === m.id) {
                photoPreview.src = URL.createObjectURL(blob);
                objectUrls.push(photoPreview.src);
                photoPreview.hidden = false;
            }
        });
        openEditor();
    }

    photoField.addEventListener("change", function () {
        var file = photoField.files[0];
        if (!file) { return; }
        S.shrinkPhoto(file).then(function (blob) {
            newPhoto = blob;
            removePhoto = false;
            photoPreview.src = URL.createObjectURL(blob);
            objectUrls.push(photoPreview.src);
            photoPreview.hidden = false;
        }).catch(function () {
            showMessage("The image could not be read.", false);
        });
    });
    document.getElementById("photo-remove-btn").addEventListener("click", function () {
        newPhoto = null;
        removePhoto = true;
        photoField.value = "";
        photoPreview.hidden = true;
    });

    form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var mech = {
            id: editingId || undefined,
            version: DATA_VERSION,
            name: field("name").value.trim(),
            type: (field("type") && field("type").value) || "BM",
            pv: intOrNull(field("pv").value), sz: intOrNull(field("sz").value),
            mv: field("mv").value.trim(),
            tmm: intOrNull(field("tmm").value), skill: intOrNull(field("skill").value),
            s: field("s").value.trim(), m: field("m").value.trim(), l: field("l").value.trim(),
            ov: intOrNull(field("ov").value),
            armor: intOrNull(field("armor").value), structure: intOrNull(field("structure").value),
            special: field("special").value.trim(),
            notes: field("notes").value.trim(),
            icon: takenIcon || undefined,
            modifiers: (MOD && MOD.read(modBox).length) ? MOD.read(modBox) : undefined,
            sourceId: takenSourceId || undefined
        };
        if (!mech.name) { showMessage("A name is required.", false); return; }
        if (mech.armor === null || mech.structure === null) {
            showMessage("Armor and structure need numbers – the bubbles on the card.", false);
            return;
        }
        mech = S.saveMech(SYSTEM, mech);
        var photoWork = Promise.resolve();
        if (newPhoto) { photoWork = S.savePhoto(mech.id, newPhoto); }
        else if (removePhoto) { photoWork = Promise.resolve(S.deletePhoto(mech.id)); }
        photoWork.catch(function () {}).then(function () {
            editor.hidden = true;
            clearEditor();
            render();
            showMessage(Z(mech.name) + " " + T("is in the hangar."), true);
        });
    });
    function intOrNull(value) {
        value = String(value).trim();
        if (value === "") { return null; }
        var n = parseInt(value, 10);
        return isNaN(n) ? null : n;
    }

    /* --- Export / import / sharing ----------------------------------------- */
    document.getElementById("export-btn").addEventListener("click", function () {
        S.createExport(SYSTEM).then(function (blob) {
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "mechs-hangar-alpha-strike.json";
            a.click();
            setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
            backupNotice();
        });
    });
    document.getElementById("import-field").addEventListener("change", function (ev) {
        var file = ev.target.files[0];
        if (!file) { return; }
        S.readImport(SYSTEM, file).then(function (result) {
            render();
            showMessage(T("Import done:") + " " + result.added + " " + T("new,") + " " + result.replaced + " " + T("updated."), true);
        }).catch(function (error) {
            showMessage(T("Import failed:") + " " + error.message, false);
        });
        ev.target.value = "";
    });
    function share(m) {
        var link = S.shareLink(m);
        if (window.MechsShare) {
            MechsShare.dialog(link, T("Share") + " · " + m.name, "");
            return;
        }
        (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
            .then(function () {
                showMessage(T("Share link for") + " " + Z(m.name) + " " + T("copied – paste it into the group chat."), true);
            })
            .catch(function () { prompt(T("Link to copy:"), link); });
    }
    /* Headless: database shard -> hangar 'Mech (for shared lances) */
    function mechFromShard(m, entry, id) {
        var as = m.as || {};
        return {
            version: DATA_VERSION, name: m.name, type: m.type || "BM", pv: as.pv, sz: as.sz, mv: as.mv, tmm: as.tmm,
            skill: (entry.s === 0 || entry.s) ? entry.s : 4,
            s: as.s, m: as.m, l: as.l, ov: as.ov, armor: as.armor, structure: as.structure,
            special: as.special || "", notes: "", icon: m.icon || undefined, sourceId: id
        };
    }

    /* --- Database search: same DB as Classic, filled from the as block
       (official card values via MekBay/MegaMek). --------------------------- */
    var dbSearchField = document.getElementById("db-search");
    var dbResults = document.getElementById("db-results");
    var dbStatus = document.getElementById("db-status");
    var dbIndex = null;         /* unified: {id, name, type, t, tech, era, role, pv} */
    var dbLoading = null;
    var dbFilter = "";          /* "", BM, CV (incl. SV), INF (BA+CI), PM */

    function showDbStatus(text) {
        dbStatus.textContent = text;
        dbStatus.hidden = !text;
    }
    /* Merge both indexes: 'Mechs (from the MTFs) and the remaining ground
       units (MekBay). If the second index is missing (old cache), the 'Mech
       search stays usable anyway. */
    function loadIndex() {
        if (dbIndex) { return Promise.resolve(dbIndex); }
        if (dbLoading) { return dbLoading; }
        dbLoading = Promise.all([
            fetch(new URL("data/mechs-index.json", ROOT)).then(function (r) { return r.json(); }),
            fetch(new URL("data/units-index.json", ROOT)).then(function (r) { return r.json(); })
                .catch(function () { return { units: [] }; })
        ]).then(function (d) {
            var all = d[0].mechs.map(function (m) {
                return { id: m[0], name: m[1], type: "BM", t: m[2], tech: m[3], era: m[4], role: m[5] };
            });
            d[1].units.forEach(function (e) {
                all.push({ id: e[0], name: e[1], type: e[2], t: e[3], tech: e[4], era: e[5], role: e[6], pv: e[7] });
            });
            all.sort(function (a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
            dbIndex = all;
            return all;
        }).catch(function (error) { dbLoading = null; throw error; });
        return dbLoading;
    }
    function loadDbIndex() {
        if (dbIndex) { return; }
        showDbStatus(T("Loading index …"));
        loadIndex().then(function () {
            showDbStatus("");
            searchDb();
        }).catch(function () {
            showDbStatus(T("Index could not be loaded – offline and never opened before?"));
        });
    }
    function typeMatches(type) {
        if (!dbFilter) { return true; }
        if (dbFilter === "CV") { return type === "CV" || type === "SV"; }
        if (dbFilter === "INF") { return type === "BA" || type === "CI"; }
        return type === dbFilter;
    }
    function searchDb() {
        if (!dbIndex) { return; }
        var q = dbSearchField.value.trim().toLowerCase();
        dbResults.innerHTML = "";
        if (q.length < 2) { showDbStatus(""); return; }
        var parts = q.split(/\s+/);
        var hits = [];
        var total = 0;
        for (var i = 0; i < dbIndex.length; i++) {
            if (!typeMatches(dbIndex[i].type)) { continue; }
            var name = dbIndex[i].name.toLowerCase();
            var matches = parts.every(function (t) { return name.indexOf(t) !== -1; });
            if (matches) {
                total++;
                if (hits.length < 30) { hits.push(dbIndex[i]); }
            }
        }
        showDbStatus(total === 0 ? T("Nothing found.")
            : (total > 30 ? total + " " + T("hits – the first 30:") : ""));
        hits.forEach(function (m) {
            var row = el("button", "slot-button");
            row.type = "button";
            row.appendChild(el("span", "w-name", m.name));
            row.appendChild(el("span", "w-info",
                " " + (m.type !== "BM" ? typeName(m.type) + " · " : "") +
                (m.t ? m.t + " t · " : "") + m.tech + (m.era ? " · " + m.era : "") +
                (m.pv ? " · PV " + m.pv : "")));
            row.addEventListener("click", function () { takeFromDb(m.id, m.name); });
            dbResults.appendChild(row);
        });
    }
    var dbTypes = document.getElementById("db-types");
    if (dbTypes) {
        dbTypes.addEventListener("click", function (ev) {
            var chip = ev.target.closest("button[data-type]");
            if (!chip) { return; }
            dbFilter = chip.dataset.type;
            dbTypes.querySelectorAll("button").forEach(function (b) {
                b.setAttribute("aria-pressed", String(b === chip));
            });
            if (dbIndex) { searchDb(); } else { loadDbIndex(); }
        });
    }
    function takeFromDb(id, name) {
        showDbStatus(T("Loading") + " " + name + " …");
        fetch(new URL("data/units/" + id + ".json", ROOT))
            .then(function (r) { return r.json(); })
            .then(function (m) {
                if (!m.as) {
                    showDbStatus(T("For") + " " + Z(name) + " " + T("no Alpha Strike values are available."));
                    return;
                }
                showDbStatus("");
                clearEditor();
                takenIcon = m.icon || null;
                takenSourceId = id;
                document.getElementById("editor-title").textContent = T("From database:") + " " + m.name;
                field("name").value = m.name;
                if (field("type")) { field("type").value = m.type || "BM"; }
                field("pv").value = m.as.pv;
                field("sz").value = m.as.sz;
                field("mv").value = m.as.mv;
                field("tmm").value = m.as.tmm;
                field("skill").value = 4;
                field("s").value = m.as.s;
                field("m").value = m.as.m;
                field("l").value = m.as.l;
                field("ov").value = m.as.ov;
                field("armor").value = m.as.armor;
                field("structure").value = m.as.structure;
                field("special").value = m.as.special;
                field("notes").value = [
                    m.source ? T("Source:") + " " + m.source : "",
                    m.role ? T("Role:") + " " + m.role : "",
                    m.era ? T("Era:") + " " + m.era : ""
                ].filter(Boolean).join(" · ");
                openEditor();
            })
            .catch(function () {
                showDbStatus(Z(name) + " " + T("could not be loaded – offline and never opened before?"));
            });
    }
    if (dbSearchField) {
        dbSearchField.addEventListener("focus", loadDbIndex);
        dbSearchField.addEventListener("input", function () {
            if (dbIndex) { searchDb(); } else { loadDbIndex(); }
        });
    }

    /* --- Offer from a share link ------------------------------------------- */
    var shared = S.fromShareLink();
    if (shared && shared.name) {
        var offer = document.getElementById("import-offer");
        offer.hidden = false;
        document.getElementById("import-offer-text").textContent =
            T("Shared ’Mech:") + " " + Z(shared.name) + " – " + T("add it to the hangar?");
        document.getElementById("import-yes-btn").addEventListener("click", function () {
            delete shared.id;
            S.saveMech(SYSTEM, shared);
            offer.hidden = true;
            history.replaceState(null, "", location.pathname);
            render();
            showMessage(Z(shared.name) + " " + T("is in the hangar."), true);
        });
        document.getElementById("import-no-btn").addEventListener("click", function () {
            offer.hidden = true;
            history.replaceState(null, "", location.pathname);
        });
    }


    /* --- Shared lance (database references) -------------------------------- */
    var lance = window.MechsShare ? MechsShare.fromLanceLink() : null;
    if (lance) {
        var lanceOffer = document.getElementById("import-offer");
        lanceOffer.hidden = false;
        document.getElementById("import-offer-text").textContent =
            T("Shared lance:") + " " + lance.length + " " + T("’Mechs to import from the database?") +
            " (" + lance.map(function (x) { return x.n; }).join(", ") + ")";
        document.getElementById("import-yes-btn").addEventListener("click", function () {
            loadIndex()
                .then(function (all) {
                    var byName = {};
                    all.forEach(function (m) { byName[m.name] = m.id; });
                    return Promise.all(lance.map(function (x) {
                        var id = x.q || byName[x.n];
                        if (!id) { return null; }
                        return fetch(new URL("data/units/" + id + ".json", ROOT))
                            .then(function (r) { return r.json(); })
                            .then(function (m) { return mechFromShard(m, x, id); })
                            .catch(function () { return null; });
                    }));
                })
                .then(function (mechs) {
                    var n = 0;
                    mechs.forEach(function (m) { if (m) { S.saveMech(SYSTEM, m); n++; } });
                    lanceOffer.hidden = true;
                    history.replaceState(null, "", location.pathname);
                    render();
                    showMessage(n + " " + T("’Mechs imported from the shared lance.") +
                        (n < lance.length ? " " + T("Not found:") + " " + (lance.length - n) : ""), n > 0);
                });
        });
        document.getElementById("import-no-btn").addEventListener("click", function () {
            lanceOffer.hidden = true;
            history.replaceState(null, "", location.pathname);
        });
    }

    /* Backup reminder: hangar data lives in the browser only. */
    function backupNotice() {
        var mechs = S.loadHangar(SYSTEM).mechs;
        var box = document.getElementById("backup-notice");
        if (!box) {
            box = el("p", "hint backup-notice");
            box.id = "backup-notice";
            var group = document.getElementById("export-btn").parentNode;
            group.parentNode.insertBefore(box, group.nextSibling);
        }
        var date = S.backupDate(SYSTEM);
        var days = date ? Math.floor((Date.now() - new Date(date).getTime()) / 86400000) : null;
        if (!mechs.length || (days !== null && days < 14)) { box.hidden = true; return; }
        box.textContent = (days === null ? T("No backup yet") : T("Last backup") + " " + days + " " + T("days ago")) +
            " – " + T("Hangar data lives only on this device. Export a backup now.");
        box.hidden = false;
    }

    /* Repair old hangar copies: quietly pull missing values (PV, icon) from
       the database - entries already made stay untouched. */
    function fillInMissing() {
        var mechs = S.loadHangar(SYSTEM).mechs.filter(function (m) {
            return (m.pv === null || m.pv === undefined || !m.icon);
        });
        if (!mechs.length) { return; }
        loadIndex()
            .then(function (all) {
                var idByName = {};
                all.forEach(function (m) { idByName[m.name] = m.id; });
                var runs = mechs.map(function (mech) {
                    var id = idByName[mech.name];
                    if (!id) { return Promise.resolve(false); }
                    return fetch(new URL("data/units/" + id + ".json", ROOT))
                        .then(function (r) { return r.json(); })
                        .then(function (db) {
                            var changed = false;
                            var as = db.as || {};
                            if ((mech.pv === null || mech.pv === undefined) && as.pv) { mech.pv = as.pv; changed = true; }
                            if (!mech.icon && db.icon) { mech.icon = db.icon; changed = true; }
                            if (changed) { S.saveMech(SYSTEM, mech); }
                            return changed;
                        })
                        .catch(function () { return false; });
                });
                Promise.all(runs).then(function (results) {
                    var n = results.filter(Boolean).length;
                    if (!n) { return; }
                    render();
                    showMessage(n + " ’Mech" + (n > 1 ? "s" : "") + " " + T("filled in from the database (PV/icon)."), true);
                });
            })
            .catch(function () {});
    }

    render();
    fillInMissing();
    backupNotice();
})();
