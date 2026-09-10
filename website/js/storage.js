/* Storage module (CONCEPT.md 4.6): a narrow interface over localStorage
   (values) and IndexedDB (photos), so that the hangar and the record sheet
   never hang directly off the browser APIs. Should a PHP sync ever join
   them, a second adapter goes in HERE and the tools stay untouched.

   Every stored structure carries a version field for migrations. */
(function () {
    "use strict";

    /* Freshly created structures carry today's data version right away,
       otherwise migrate.js sends them through again on the next start. */
    var DATA_VERSION = (window.MechsMigrate && MechsMigrate.VERSION) || 3;

    var PREFIX = "mechs-";

    /* --- Raw access ------------------------------------------------------- */
    function load(key, fallback) {
        try {
            var raw = localStorage.getItem(PREFIX + key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) { return fallback; }
    }
    function save(key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
            return true;
        } catch (e) { return false; }
    }
    function remove(key) {
        try { localStorage.removeItem(PREFIX + key); } catch (e) {}
    }

    function newId() {
        var b = new Uint8Array(6);
        crypto.getRandomValues(b);
        return Array.prototype.map.call(b, function (x) {
            return x.toString(16).padStart(2, "0");
        }).join("");
    }

    /* --- Hangar: the mech collection per game system ---------------------- */
    function loadHangar(system) {
        return load("hangar-" + system, { version: DATA_VERSION, mechs: [] });
    }
    function saveHangar(system, hangar) {
        return save("hangar-" + system, hangar);
    }
    function saveMech(system, mech) {
        var hangar = loadHangar(system);
        if (!mech.id) { mech.id = newId(); }
        var i = hangar.mechs.findIndex(function (m) { return m.id === mech.id; });
        if (i === -1) { hangar.mechs.push(mech); } else { hangar.mechs[i] = mech; }
        saveHangar(system, hangar);
        return mech;
    }
    function deleteMech(system, id) {
        var hangar = loadHangar(system);
        hangar.mechs = hangar.mechs.filter(function (m) { return m.id !== id; });
        saveHangar(system, hangar);
        deletePhoto(id);
    }

    /* --- Photos: IndexedDB, because images blow up localStorage ----------- */
    var dbPromise = null;
    function db() {
        if (!dbPromise) {
            dbPromise = new Promise(function (ok, fail) {
                var request = indexedDB.open("mechs", 1);
                request.onupgradeneeded = function () {
                    request.result.createObjectStore("fotos");
                };
                request.onsuccess = function () { ok(request.result); };
                request.onerror = function () { fail(request.error); };
            });
        }
        return dbPromise;
    }
    /* The store is still called "fotos": moving it would be a binary
       migration without a benefit, and the name is nowhere visible
       (docs/history/MIGRATION-V2.md §1). */
    function savePhoto(mechId, blob) {
        return db().then(function (d) {
            return new Promise(function (ok, fail) {
                var t = d.transaction("fotos", "readwrite");
                t.objectStore("fotos").put(blob, mechId);
                t.oncomplete = ok;
                t.onerror = function () { fail(t.error); };
            });
        });
    }
    function loadPhoto(mechId) {
        return db().then(function (d) {
            return new Promise(function (ok) {
                var request = d.transaction("fotos").objectStore("fotos").get(mechId);
                request.onsuccess = function () { ok(request.result || null); };
                request.onerror = function () { ok(null); };
            });
        }).catch(function () { return null; });
    }
    function deletePhoto(mechId) {
        return db().then(function (d) {
            d.transaction("fotos", "readwrite").objectStore("fotos").delete(mechId);
        }).catch(function () {});
    }

    /* Shrink a photo before storing it: 640 px on the long edge, JPEG. */
    function shrinkPhoto(file) {
        return new Promise(function (ok, fail) {
            var url = URL.createObjectURL(file);
            var image = new Image();
            image.onload = function () {
                var f = Math.min(1, 640 / Math.max(image.width, image.height));
                var canvas = document.createElement("canvas");
                canvas.width = Math.round(image.width * f);
                canvas.height = Math.round(image.height * f);
                canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                canvas.toBlob(function (blob) {
                    if (blob) { ok(blob); } else { fail(new Error("image not readable")); }
                }, "image/jpeg", 0.82);
            };
            image.onerror = function () { URL.revokeObjectURL(url); fail(new Error("image not readable")); };
            image.src = url;
        });
    }

    /* --- Export / import (file) -------------------------------------------
       Photos travel along as data URLs inside the file (CONCEPT 4.6), but
       never inside a share link. */
    function blobToDataUrl(blob) {
        return new Promise(function (ok) {
            var reader = new FileReader();
            reader.onload = function () { ok(reader.result); };
            reader.onerror = function () { ok(null); };
            reader.readAsDataURL(blob);
        });
    }
    function dataUrlToBlob(dataUrl) {
        return fetch(dataUrl).then(function (r) { return r.blob(); });
    }
    function backupDate(system) {
        try { return localStorage.getItem("mechs-backup-" + system); } catch (e) { return null; }
    }
    function createExport(system) {
        try { localStorage.setItem("mechs-backup-" + system, new Date().toISOString().slice(0, 10)); } catch (e) {}
        var hangar = loadHangar(system);
        return Promise.all(hangar.mechs.map(function (m) {
            return loadPhoto(m.id).then(function (blob) {
                return blob ? blobToDataUrl(blob) : null;
            });
        })).then(function (photos) {
            var pack = {
                type: "mechs-hangar",
                system: system,
                version: DATA_VERSION,
                exported: new Date().toISOString().slice(0, 10),
                mechs: hangar.mechs.map(function (m, i) {
                    var copy = JSON.parse(JSON.stringify(m));
                    if (photos[i]) { copy.photo = photos[i]; }
                    return copy;
                }),
                /* Campaigns (state and log) live in their own storage but
                   belong in the backup - otherwise the history is gone. */
                campaigns: load("campaigns-" + system, null)
            };
            return new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
        });
    }
    function readImport(system, file) {
        return file.text().then(function (text) {
            var pack = JSON.parse(text);
            /* Older backups carry German keys and values. The whole package
               therefore goes through the migration first - after that the
               rest of this function only sees today's format. */
            if (window.MechsMigrate) { pack = window.MechsMigrate.package(pack); }
            if (pack.type !== "mechs-hangar" || pack.system !== system) {
                throw new Error((window.T || function (s) { return s; })("That is not a hangar file for this game system."));
            }
            var hangar = loadHangar(system);
            var ids = {};
            hangar.mechs.forEach(function (m) { ids[m.id] = true; });
            var added = 0, replaced = 0;
            var photoWork = [];
            pack.mechs.forEach(function (m) {
                var photo = m.photo || null;
                delete m.photo;
                if (ids[m.id]) {
                    hangar.mechs = hangar.mechs.map(function (old) {
                        return old.id === m.id ? m : old;
                    });
                    replaced++;
                } else {
                    hangar.mechs.push(m);
                    added++;
                }
                if (photo) {
                    photoWork.push(dataUrlToBlob(photo).then(function (blob) {
                        return savePhoto(m.id, blob);
                    }).catch(function () {}));
                }
            });
            hangar.version = DATA_VERSION;
            saveHangar(system, hangar);
            if (pack.campaigns && pack.campaigns.campaigns) {
                save("campaigns-" + system, pack.campaigns);
            }
            return Promise.all(photoWork).then(function () {
                return { added: added, replaced: replaced };
            });
        });
    }

    /* --- Share link: one mech as a URL parameter (without the photo) ------ */
    function b64url(text) {
        var bytes = new TextEncoder().encode(text);
        var bin = "";
        bytes.forEach(function (b) { bin += String.fromCharCode(b); });
        return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
    function fromB64url(encoded) {
        var bin = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
        var bytes = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
        return new TextDecoder().decode(bytes);
    }
    function shareLink(mech) {
        var copy = JSON.parse(JSON.stringify(mech));
        delete copy.id;                     /* the recipient gets their own */
        var url = new URL(location.href);
        url.search = "";
        url.hash = "";
        url.searchParams.set("mech", b64url(JSON.stringify(copy)));
        return url.toString();
    }
    function fromShareLink() {
        var value = new URLSearchParams(location.search).get("mech");
        if (!value) { return null; }
        try {
            var m = JSON.parse(fromB64url(value));
            /* A shared link can be months old. */
            return window.MechsMigrate ? window.MechsMigrate.mech(m) : m;
        } catch (e) { return null; }
    }

    /* Bring stored data up to date before any script reads it (js/migrate.js
       sits before this file). The call lives here and not in every script,
       so that there is no order anyone can forget. */
    var api = {
        load: load, save: save, remove: remove, newId: newId,
        loadHangar: loadHangar, saveHangar: saveHangar,
        saveMech: saveMech, deleteMech: deleteMech,
        savePhoto: savePhoto, loadPhoto: loadPhoto, deletePhoto: deletePhoto,
        shrinkPhoto: shrinkPhoto,
        createExport: createExport, readImport: readImport, backupDate: backupDate,
        shareLink: shareLink, fromShareLink: fromShareLink
    };
    window.MechsStorage = api;
    if (window.MechsMigrate) { window.MechsMigrate.run(api); }
})();
