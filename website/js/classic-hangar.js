/* Hangar Classic BattleTech: record sheets entered digitally.
   Deliberately NOT a construction tool (CONCEPT 4.6): what is on the sheet
   gets copied over. The internal structure follows automatically from the
   tonnage (data/classic-rules.json) and is stored with the 'Mech. */
(function () {
    "use strict";

    /* Freshly created structures carry today's data version right away,
       otherwise migrate.js would run them through once more on next start. */
    var DATA_VERSION = (window.MechsMigrate && MechsMigrate.VERSION) || 3;

    var SYSTEM = "classic";
    var S = window.MechsStorage;
    var ROOT = new URL("..", document.currentScript.src);

    var ARMOR_LOCATIONS = [
        ["head", "Head"], ["ct", "Center torso"], ["ctr", "CT rear"],
        ["rt", "Right torso"], ["rtr", "RT rear"],
        ["lt", "Left torso"], ["ltr", "LT rear"],
        ["ra", "Right arm"], ["la", "Left arm"],
        ["rl", "Right leg"], ["ll", "Left leg"]
    ];
    var WEAPON_LOCATIONS = ["HD", "CT", "RT", "LT", "RA", "LA", "RL", "LL"];

    var rules = null;            /* classic-werte.json */
    var list = document.getElementById("mech-list");
    var editor = document.getElementById("editor");
    var form = document.getElementById("mech-form");
    var weaponBox = document.getElementById("weapon-rows");
    var modBox = document.getElementById("mod-rows");
    var MOD = window.MechsModifiers;
    var photoField = document.getElementById("f-photo");
    var photoPreview = document.getElementById("f-photo-preview");
    var message = document.getElementById("message");

    var editingId = null;
    var takenSourceId = null;    /* database id of the model */
    var takenIcon = null;
    var newPhoto = null;
    var removePhoto = false;
    var objectUrls = [];

    fetch(new URL("data/classic-rules.json", ROOT))
        .then(function (r) { return r.json(); })
        .then(function (d) { rules = d; showStructure(); buildSlotEditor(null); });

    /* --- Critical hit locations (slots) ------------------------------------ */
    var SLOT_LOCATIONS = [
        ["head", "Head"], ["ct", "Center torso"],
        ["rt", "Right torso"], ["lt", "Left torso"],
        ["ra", "Right arm"], ["la", "Left arm"],
        ["rl", "Right leg"], ["ll", "Left leg"]
    ];
    var slotEditor = document.getElementById("slot-editor");

    function buildSlotEditor(slots) {
        if (!rules) { return; }
        slotEditor.innerHTML = "";
        SLOT_LOCATIONS.forEach(function (z) {
            var location = z[0];
            var count = rules.critSlots.count[location];
            var filled = (slots && slots[location]) || rules.critSlots.defaults[location];
            var box = document.createElement("details");
            var header = el("summary", "", T(z[1]) + " (" + count + " Slots)");
            box.appendChild(header);
            var groups = el("div", "slot-groups");
            var halves = count === 12 ? [["Roll 1–3", 0], ["Roll 4–6", 6]] : [["Roll 1–6", 0]];
            halves.forEach(function (h) {
                var group = el("div", "slot-group");
                group.appendChild(el("h4", "", h[0]));
                for (var i = 0; i < 6 && h[1] + i < count; i++) {
                    var index = h[1] + i;
                    var row = el("div", "slot-row");
                    row.appendChild(el("span", "slot-no", String(i + 1)));
                    var inputField = document.createElement("input");
                    inputField.type = "text";
                    inputField.dataset.location = location;
                    inputField.dataset.slot = String(index);
                    /* The source text travels with the field. A name that a
                       language pack builds from a pattern ("Ammo (LRM 10)")
                       has no entry of its own in the dictionary, so
                       MechsI18n.back() would not find the way back and the
                       displayed text would end up in the 'Mech. An untouched
                       field therefore writes back exactly what it read. */
                    inputField.dataset.source = filled[index] || "";
                    inputField.value = T(filled[index] || "");
                    inputField.placeholder = T("empty (reroll)");
                    inputField.setAttribute("aria-label", T(z[1]) + " Slot " + (index + 1));
                    row.appendChild(inputField);
                    group.appendChild(row);
                }
                groups.appendChild(group);
            });
            box.appendChild(groups);
            slotEditor.appendChild(box);
        });
    }
    function readSlots() {
        var slots = {};
        SLOT_LOCATIONS.forEach(function (z) {
            slots[z[0]] = new Array(rules.critSlots.count[z[0]]).fill("");
        });
        slotEditor.querySelectorAll("input").forEach(function (i) {
            var source = i.dataset.source || "";
            var shown = i.value.trim();
            slots[i.dataset.location][parseInt(i.dataset.slot, 10)] =
                (shown === T(source)) ? source : I18N.back(shown);
        });
        return slots;
    }

    var T = window.T || function (s) { return s; };
    var I18N = window.MechsI18n || { lang: "en", back: function (s) { return s; } };

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
    function field(name) { return form.elements[name]; }
    function intOrNull(value) {
        value = String(value).trim();
        if (value === "") { return null; }
        var n = parseInt(value, 10);
        return isNaN(n) ? null : n;
    }
    function runMp(walk) { return Math.ceil(walk * 1.5); }

    /* --- Structure from the tonnage ---------------------------------------- */
    function structureFor(tonnage) {
        if (!rules || !rules.structure.tonnage[tonnage]) { return null; }
        var t = rules.structure.tonnage[tonnage];
        return { head: rules.structure.head, ct: t.ct, rt: t.sideTorso, lt: t.sideTorso,
                 ra: t.arm, la: t.arm, rl: t.leg, ll: t.leg };
    }
    function showStructure() {
        var s = structureFor(field("tonnage").value);
        var note = document.getElementById("structure-display");
        if (!s) { note.textContent = ""; return; }
        note.textContent = T("Internal structure (automatic): head") + " " + s.head +
            " · " + T("CT") + " " + s.ct + " · " + T("torso each") + " " + s.rt +
            " · " + T("arm each") + " " + s.ra + " · " + T("leg each") + " " + s.rl;
    }
    field("tonnage").addEventListener("change", showStructure);

    /* --- Weapon rows in the editor ----------------------------------------- */
    function weaponRow(w) {
        w = w || {};
        var row = el("div", "weapon-edit-row");
        row.appendChild(input("Weapon", "text", w.name, "AC/5", "weapon-field-name"));
        var locationPick = el("div");
        locationPick.appendChild(el("label", "", "Location"));
        var select = document.createElement("select");
        WEAPON_LOCATIONS.forEach(function (z) {
            var o = el("option", "", z);
            /* The label is translated (CT -> ZT), the value must not be:
               without this the German page would store its own abbreviation
               in the 'Mech. */
            o.value = z;
            if (w.location === z) { o.selected = true; }
            select.appendChild(o);
        });
        locationPick.appendChild(select);
        row.appendChild(locationPick);
        row.appendChild(input("Damage", "text", w.damage, "5"));
        row.appendChild(input("Heat", "number", w.heat, "1"));
        row.appendChild(input("Range", "text", w.range, "min 3 · 6/12/18"));
        row.appendChild(input("ammo", "number", w.ammo, "empty = energy"));
        var removeBox = el("div", "weapon-field-button");
        var remove = el("button", "btn btn-small btn-danger", "×");
        remove.type = "button";
        remove.setAttribute("aria-label", T("Remove weapon"));
        remove.addEventListener("click", function () { row.remove(); });
        removeBox.appendChild(remove);
        row.appendChild(removeBox);
        return row;
    }
    function input(label, type, value, placeholder, className) {
        var box = el("div", className || "");
        box.appendChild(el("label", "", label));
        var i = document.createElement("input");
        i.type = type;
        if (type === "number") { i.min = "0"; i.inputMode = "numeric"; }
        if (value === 0 || value) { i.value = value; }
        i.placeholder = T(placeholder || "");
        box.appendChild(i);
        return box;
    }
    document.getElementById("weapon-add-btn").addEventListener("click", function () {
        weaponBox.appendChild(weaponRow());
    });
    document.getElementById("mod-add-btn").addEventListener("click", function () {
        if (MOD) { modBox.appendChild(MOD.row()); }
    });
    function readWeapons() {
        return Array.prototype.map.call(weaponBox.children, function (row) {
            var fields = row.querySelectorAll("input, select");
            return {
                name: fields[0].value.trim(),
                location: fields[1].value,
                damage: fields[2].value.trim(),
                heat: intOrNull(fields[3].value),
                range: fields[4].value.trim(),
                ammo: intOrNull(fields[5].value)
            };
        }).filter(function (w) { return w.name; });
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

            /* Eine Lanze stellt man zusammen, indem man Tonnage und BV
               vergleicht - also stehen die beiden rechtsbündig
               untereinander und bilden eine Spalte, die man am Daumen
               herunterlesen kann. Vorher standen sie mitten in einer
               Zeile, die auf fünf umbrach. */
            var info = el("div", "mech-info");
            var kopf = el("div", "mech-head");
            var name = document.createElement("h3");
            name.textContent = m.name;               /* Produktname, nie durch T() */
            kopf.appendChild(name);
            kopf.appendChild(el("span", "mech-key", m.tonnage + " t"));
            info.appendChild(kopf);

            var zeile = el("p", "mech-stats mech-line");
            zeile.appendChild(el("span", "",
                "MP " + m.movement.walk + "/" + runMp(m.movement.walk) +
                "/" + (m.movement.jump || 0) +
                " · G" + m.pilot.gunnery + "/P" + m.pilot.piloting));
            if (m.bv) { zeile.appendChild(el("span", "mech-key", "BV " + m.bv)); }
            info.appendChild(zeile);

            var zweit = el("p", "mech-stats mech-sub");
            /* Pilot und Waffenzahl reichen zum Aufstellen. Die Wärmeabfuhr
               stand hier auch und drängte den Pilotennamen in die Ellipse -
               sie steht im Editor und auf der Gefechtskarte, wo sie zählt. */
            zweit.textContent = (m.pilot.name ? m.pilot.name + " · " : "") +
                m.weapons.length + " " + T("weapons");
            info.appendChild(zweit);

            if (window.MechsCampaign && MechsCampaign.isDamaged(SYSTEM, m)) {
                info.appendChild(MechsCampaign.badge(SYSTEM, m));
            }

            var buttons = el("p", "cta");
            [["Edit", function () { edit(m); }, "btn btn-small"],
             ["Share", function () { share(m); }, "btn btn-small"],
             ["Delete", function () {
                 if (confirm(Z(m.name) + " " + T("delete from the hangar for good?"))) {
                     S.deleteMech(SYSTEM, m.id);
                     render();
                 }
             }, "btn btn-small btn-danger"]
            ].forEach(function (k) {
                var b = el("button", k[2], k[0]);
                b.type = "button";
                b.addEventListener("click", k[1]);
                buttons.appendChild(b);
            });
            if (window.MechsCampaign && MechsCampaign.isDamaged(SYSTEM, m)) {
                var rep = el("button", "btn btn-small", "Repair");
                rep.type = "button";
                rep.title = T("Clear the damage from the last battle");
                rep.addEventListener("click", function () {
                    MechsCampaign.workshop({
                        system: SYSTEM, mech: m, storage: S,
                        critName: function (id) {
                            var def = rules && rules.critComponents &&
                                rules.critComponents.find(function (k) { return k.id === id; });
                            return def ? T(def.name) : id;
                        },
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

    /* --- Open / fill / save the editor ------------------------------------- */
    function clearEditor() {
        form.reset();
        weaponBox.innerHTML = "";
        weaponBox.appendChild(weaponRow());
        if (MOD) { MOD.fill(modBox, []); }
        editingId = null;
        newPhoto = null;
        removePhoto = false;
        photoPreview.hidden = true;
        document.getElementById("editor-title").textContent = T("New ’Mech");
        takenSourceId = null; takenIcon = null;
        showStructure();
        buildSlotEditor(null);
    }
    function openEditor() {
        editor.hidden = false;
        editor.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    document.getElementById("new-btn").addEventListener("click", function () {
        clearEditor();
        field("gunnery").value = 4;
        field("piloting").value = 5;
        field("heatSinks").value = 10;
        openEditor();
    });
    document.getElementById("cancel-btn").addEventListener("click", function () {
        editor.hidden = true;
        clearEditor();
    });

    function edit(m) {
        clearEditor();
        editingId = m.id;
        document.getElementById("editor-title").textContent = m.name + " " + T("edit");
        takenSourceId = m.sourceId || null; takenIcon = m.icon || null;
        if (MOD) { MOD.fill(modBox, m.modifiers); }
        field("name").value = m.name;
        field("tonnage").value = m.tonnage;
        if (m.bv) { field("bv").value = m.bv; }
        field("notes").value = m.notes || "";
        field("walk").value = m.movement.walk;
        field("jump").value = m.movement.jump || 0;
        field("pilotName").value = m.pilot.name || "";
        field("gunnery").value = m.pilot.gunnery;
        field("piloting").value = m.pilot.piloting;
        field("heatSinks").value = m.heatSinks.count;
        field("double").checked = !!m.heatSinks.double;
        ARMOR_LOCATIONS.forEach(function (z) { field("a_" + z[0]).value = m.armor[z[0]]; });
        weaponBox.innerHTML = "";
        (m.weapons.length ? m.weapons : [{}]).forEach(function (w) {
            weaponBox.appendChild(weaponRow(w));
        });
        buildSlotEditor(m.critSlots || null);
        S.loadPhoto(m.id).then(function (blob) {
            if (blob && editingId === m.id) {
                photoPreview.src = URL.createObjectURL(blob);
                objectUrls.push(photoPreview.src);
                photoPreview.hidden = false;
            }
        });
        showStructure();
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
        }).catch(function () { showMessage("The image could not be read.", false); });
    });
    document.getElementById("photo-remove-btn").addEventListener("click", function () {
        newPhoto = null;
        removePhoto = true;
        photoField.value = "";
        photoPreview.hidden = true;
    });

    form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var tonnage = intOrNull(field("tonnage").value);
        var structure = structureFor(tonnage);
        if (!structure) { showMessage("Value tables not loaded yet – wait a moment and save again.", false); return; }
        var armor = {};
        var missing = false;
        ARMOR_LOCATIONS.forEach(function (z) {
            var w = intOrNull(field("a_" + z[0]).value);
            if (w === null) { missing = true; }
            armor[z[0]] = w || 0;
        });
        if (missing) { showMessage("Please enter all eleven armor values from the record sheet (0 is allowed).", false); return; }

        var mech = {
            id: editingId || undefined,
            version: DATA_VERSION,
            name: field("name").value.trim(),
            tonnage: tonnage,
            bv: intOrNull(field("bv").value),
            notes: field("notes").value.trim(),
            movement: { walk: intOrNull(field("walk").value) || 0, jump: intOrNull(field("jump").value) || 0 },
            pilot: { name: field("pilotName").value.trim(),
                     gunnery: intOrNull(field("gunnery").value), piloting: intOrNull(field("piloting").value) },
            heatSinks: { count: intOrNull(field("heatSinks").value) || 0, double: field("double").checked },
            armor: armor,
            structure: structure,
            weapons: readWeapons(),
            critSlots: readSlots(),
            modifiers: (MOD && MOD.read(modBox).length) ? MOD.read(modBox) : undefined,
            sourceId: takenSourceId || undefined,
            icon: takenIcon || undefined
        };
        if (!mech.name) { showMessage("A name is required.", false); return; }
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

    /* --- Export / import / sharing ----------------------------------------- */
    document.getElementById("export-btn").addEventListener("click", function () {
        S.createExport(SYSTEM).then(function (blob) {
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "mechs-hangar-classic.json";
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
            MechsShare.dialog(link, T("Share") + " · " + m.name,
                link.length > 2300 ? T("This ’Mech is too large for a QR code – copy the link and share it in the group chat.") : "");
            return;
        }
        (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject())
            .then(function () { showMessage(T("Share link for") + " " + Z(m.name) + " " + T("copied."), true); })
            .catch(function () { prompt(T("Link to copy:"), link); });
    }
    /* Headless: database shard -> hangar 'Mech (for shared lances) */
    function mechFromShard(m, entry, id) {
        return {
            version: DATA_VERSION, name: m.name, tonnage: m.tonnage, bv: m.bv || null,
            notes: [m.source ? T("Source:") + " " + m.source : "", m.role ? T("Role:") + " " + m.role : ""].filter(Boolean).join(" · "),
            movement: { walk: m.movement.walk, jump: m.movement.jump || 0 },
            pilot: { name: "", gunnery: entry.g || 4, piloting: entry.p || 5 },
            heatSinks: { count: m.heatSinks.count, double: !!m.heatSinks.double },
            armor: JSON.parse(JSON.stringify(m.armor)),
            structure: structureFor(m.tonnage) || JSON.parse(JSON.stringify(m.structure || {})),
            weapons: JSON.parse(JSON.stringify(m.weapons || [])),
            critSlots: m.critSlots ? JSON.parse(JSON.stringify(m.critSlots)) : undefined,
            icon: m.icon || undefined, sourceId: id
        };
    }

    /* --- Database search (MegaMek mm-data, converted) ----------------------
       The index only loads on the first search; the single files come on
       demand and stay in the cache for good via the service worker. */
    var dbSearchField = document.getElementById("db-search");
    var dbResults = document.getElementById("db-results");
    var dbStatus = document.getElementById("db-status");
    var dbIndex = null;
    var dbLoading = false;

    function showDbStatus(text) {
        dbStatus.textContent = text;
        dbStatus.hidden = !text;
    }
    function loadDbIndex() {
        if (dbIndex || dbLoading) { return; }
        dbLoading = true;
        showDbStatus(T("Loading index …"));
        fetch(new URL("data/mechs-index.json", ROOT))
            .then(function (r) { return r.json(); })
            .then(function (d) {
                dbIndex = d.mechs;
                showDbStatus("");
                searchDb();
            })
            .catch(function () {
                dbLoading = false;
                showDbStatus(T("Index could not be loaded – offline and never opened before?"));
            });
    }
    function searchDb() {
        if (!dbIndex) { return; }
        var q = dbSearchField.value.trim().toLowerCase();
        dbResults.innerHTML = "";
        if (q.length < 2) { showDbStatus(""); return; }
        /* Token by token: "timber wolf prime" hits "Mad Cat (Timber Wolf) Prime". */
        var parts = q.split(/\s+/);
        function matches(m) {
            var name = m[1].toLowerCase();
            return parts.every(function (t) { return name.indexOf(t) !== -1; });
        }
        var hits = [];
        var total = 0;
        for (var i = 0; i < dbIndex.length; i++) {
            if (matches(dbIndex[i])) {
                total++;
                if (hits.length < 30) { hits.push(dbIndex[i]); }
            }
        }
        showDbStatus(total === 0 ? T("Nothing found.")
            : (total > 30 ? total + " " + T("hits – the first 30:") : ""));
        hits.forEach(function (m) {
            var row = el("button", "slot-button");
            row.type = "button";
            row.appendChild(el("span", "w-name", m[1]));
            row.appendChild(el("span", "w-info",
                " " + m[2] + " t · " + m[3] + (m[4] ? " · " + m[4] : "") + (m[5] ? " · " + m[5] : "")));
            row.addEventListener("click", function () { takeFromDb(m[0], m[1]); });
            dbResults.appendChild(row);
        });
    }
    function takeFromDb(id, name) {
        showDbStatus(T("Loading") + " " + name + " …");
        fetch(new URL("data/units/" + id + ".json", ROOT))
            .then(function (r) { return r.json(); })
            .then(function (m) {
                showDbStatus("");
                clearEditor();
                document.getElementById("editor-title").textContent = T("From database:") + " " + m.name;
                takenSourceId = id; takenIcon = m.icon || null;
                field("name").value = m.name;
                field("tonnage").value = m.tonnage;
                field("walk").value = m.movement.walk;
                field("jump").value = m.movement.jump || 0;
                field("gunnery").value = 4;
                field("piloting").value = 5;
                field("heatSinks").value = m.heatSinks.count;
                field("double").checked = !!m.heatSinks.double;
                ARMOR_LOCATIONS.forEach(function (z) {
                    field("a_" + z[0]).value = m.armor[z[0]];
                });
                field("notes").value = [
                    m.source ? T("Source:") + " " + m.source : "",
                    m.role ? T("Role:") + " " + m.role : "",
                    m.era ? T("Era:") + " " + m.era : ""
                ].filter(Boolean).join(" · ");
                weaponBox.innerHTML = "";
                (m.weapons.length ? m.weapons : [{}]).forEach(function (w) {
                    weaponBox.appendChild(weaponRow(w));
                });
                buildSlotEditor(m.critSlots || null);
                showStructure();
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
    if (shared && shared.name && shared.armor) {
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
            fetch(new URL("data/mechs-index.json", ROOT))
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    var byName = {};
                    d.mechs.forEach(function (m) { byName[m[1]] = m[0]; });
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

    /* Repair old hangar copies: quietly pull missing values (points, icon)
       from the database - entries already made stay untouched. Matched on the
       exact name; older versions carry no other reference. */
    function fillInMissing() {
        var mechs = S.loadHangar(SYSTEM).mechs.filter(function (m) {
            return (m.bv === null || m.bv === undefined || !m.icon);
        });
        if (!mechs.length) { return; }
        fetch(new URL("data/mechs-index.json", ROOT))
            .then(function (r) { return r.json(); })
            .then(function (d) {
                var idByName = {};
                d.mechs.forEach(function (m) { idByName[m[1]] = m[0]; });
                var runs = mechs.map(function (mech) {
                    var id = idByName[mech.name];
                    if (!id) { return Promise.resolve(false); }
                    return fetch(new URL("data/units/" + id + ".json", ROOT))
                        .then(function (r) { return r.json(); })
                        .then(function (db) {
                            var changed = false;
                            if ((mech.bv === null || mech.bv === undefined) && db.bv) { mech.bv = db.bv; changed = true; }
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
                    showMessage(n + " ’Mech" + (n > 1 ? "s" : "") + " " + T("filled in from the database (BV/icon)."), true);
                });
            })
            .catch(function () {});
    }

    clearEditor();
    editor.hidden = true;
    render();
    fillInMissing();
    backupNotice();
})();
