/* Service worker - cache first, with a versioned cache.
   Count VERSION up on every deploy; "activate" clears the old caches out.
   Every path is relative to the scope, so the same worker runs locally (in a
   subfolder) and on the domain (at the root). */
"use strict";

var VERSION = "mechs-v151";
/* Units from the unit database live in a cache of their OWN, which survives
   app updates - it only changes when the DATABASE has been generated again
   (count it up after every converter run!). The old units cache is cleared
   out automatically on activation. The name changed with the move from
   daten/mechs to data/units: the paths behind the old entries no longer
   exist. */
var UNITS_CACHE = "mechs-units-v1";

var FILES = [
    "./",
    "./alpha-strike/battle.html",
    "./alpha-strike/campaign.html",
    "./alpha-strike/hangar.html",
    "./alpha-strike/rules.html",
    "./alpha-strike/unit-cards.html",
    "./classic/battle.html",
    "./classic/campaign.html",
    "./classic/hangar.html",
    "./classic/hit-locations.html",
    "./classic/record-sheet.html",
    "./classic/rules.html",
    "./de/alpha-strike/battle.html",
    "./de/alpha-strike/campaign.html",
    "./de/alpha-strike/hangar.html",
    "./de/alpha-strike/rules.html",
    "./de/alpha-strike/unit-cards.html",
    "./de/classic/battle.html",
    "./de/classic/campaign.html",
    "./de/classic/hangar.html",
    "./de/classic/hit-locations.html",
    "./de/classic/record-sheet.html",
    "./de/classic/rules.html",
    "./de/imprint.html",
    "./de/index.html",
    "./de/knowledge/comparison.html",
    "./de/knowledge/eras.html",
    "./de/knowledge/glossary.html",
    "./de/knowledge/index.html",
    "./de/knowledge/scenarios.html",
    "./de/painting/guide.html",
    "./de/painting/index.html",
    "./de/painting/paints.html",
    "./de/painting/scheme.html",
    "./de/painting/techniques.html",
    "./de/privacy.html",
    "./imprint.html",
    "./index.html",
    "./knowledge/comparison.html",
    "./knowledge/eras.html",
    "./knowledge/glossary.html",
    "./knowledge/index.html",
    "./knowledge/scenarios.html",
    "./painting/guide.html",
    "./painting/index.html",
    "./painting/paints.html",
    "./painting/scheme.html",
    "./painting/techniques.html",
    "./privacy.html",
    "./js/abilities.js",
    "./js/app.js",
    "./js/as-battle.js",
    "./js/as-hangar.js",
    "./js/as-unit-cards.js",
    "./js/calculator.js",
    "./js/campaign-page.js",
    "./js/campaign.js",
    "./js/classic-battle.js",
    "./js/classic-hangar.js",
    "./js/classic-record-sheet.js",
    "./js/dice.js",
    "./js/factions.js",
    "./js/glossary.js",
    "./js/hit-locations.js",
    "./js/i18n-de.js",
    "./js/i18n.js",
    "./js/initiative.js",
    "./js/migrate.js",
    "./js/modifiers.js",
    "./js/paints.js",
    "./js/rules.js",
    "./js/scheme.js",
    "./js/share.js",
    "./js/silhouette.js",
    "./js/storage.js",
    "./js/vendor/qrcode.js",
    "./js/weapon-math.js",
    "./css/app.css",
    "./css/components.css",
    "./css/print.css",
    "./css/style.local.css",
    "./css/tokens.css",
    "./css/tokens.local.css",
    "./de/manifest.webmanifest",
    "./manifest.webmanifest",
    "./data/alpha-strike-rules.json",
    "./data/as-abilities.json",
    "./data/calculator-alpha-strike.json",
    "./data/calculator-classic.json",
    "./data/classic-rules.json",
    "./data/factions.json",
    "./data/glossary.json",
    "./data/mechs-index.json",
    "./data/units-index.json",
    "./data/weapons.json",
    "./img/apple-touch-icon.png",
    "./img/favicon.svg",
    "./img/icon-192.png",
    "./img/icon-512.png",
    "./img/logo-badge.svg"
];

self.addEventListener("install", function (ev) {
    ev.waitUntil(
        caches.open(VERSION).then(function (cache) {
            /* cache: "reload" goes around the browser's HTTP cache -
               otherwise an old asset it kept on a hunch could poison the
               fresh precache of a new version. */
            return cache.addAll(FILES.map(function (d) {
                return new Request(d, { cache: "reload" });
            }));
        }).then(function () {
            /* The new version takes over right away - together with the
               controllerchange reload in app.js there is no "stuck on the
               old state" phase any more. */
            return self.skipWaiting();
        })
    );
});

self.addEventListener("activate", function (ev) {
    ev.waitUntil(
        caches.keys().then(function (names) {
            return Promise.all(names.map(function (name) {
                if (name !== VERSION && name !== UNITS_CACHE) { return caches.delete(name); }
            }));
        }).then(function () { return self.clients.claim(); })
    );
});

/* Cache first: the cache first, the network only as a supply line. Answers
   from the network go into the cache, so that files nobody preloaded are
   there offline after the first call too. GET only, own origin only. */
self.addEventListener("fetch", function (ev) {
    if (ev.request.method !== "GET") { return; }
    var url = new URL(ev.request.url);
    if (url.origin !== self.location.origin) { return; }

    /* Unit database: cache first, into the lasting units cache. */
    if (url.pathname.indexOf("/data/units/") !== -1 || url.pathname.indexOf("/img/units/") !== -1) {
        ev.respondWith(
            caches.open(UNITS_CACHE).then(function (cache) {
                return cache.match(ev.request).then(function (hit) {
                    if (hit) { return hit; }
                    return fetch(ev.request).then(function (answer) {
                        if (answer && answer.status === 200) {
                            cache.put(ev.request, answer.clone());
                        }
                        return answer;
                    });
                });
            })
        );
        return;
    }

    /* Page NAVIGATION: network first (a fresh state after every deploy),
       after 2.5 s or offline it falls back to the cache. Only the remaining
       assets stay strictly cache first. */
    if (ev.request.mode === "navigate") {
        ev.respondWith(
            Promise.race([
                fetch(ev.request),
                new Promise(function (_, fail) { setTimeout(fail, 2500, new Error("slow")); })
            ]).then(function (answer) {
                if (answer && answer.status === 200) {
                    var copy = answer.clone();
                    caches.open(VERSION).then(function (cache) { cache.put(ev.request, copy); });
                }
                return answer;
            }).catch(function () {
                return caches.match(ev.request).then(function (hit) {
                    return hit || caches.match("./index.html");
                });
            })
        );
        return;
    }

    ev.respondWith(
        caches.match(ev.request, { ignoreSearch: false }).then(function (hit) {
            if (hit) { return hit; }
            return fetch(ev.request).then(function (answer) {
                if (answer && answer.status === 200 && answer.type === "basic") {
                    var copy = answer.clone();
                    caches.open(VERSION).then(function (cache) { cache.put(ev.request, copy); });
                }
                return answer;
            });
        })
    );
});

/* The update notice in the UI sends this message when the user taps
   "Reload" - the waiting worker takes over at once. */
self.addEventListener("message", function (ev) {
    if (ev.data && ev.data.type === "activate-now") { self.skipWaiting(); }
});
