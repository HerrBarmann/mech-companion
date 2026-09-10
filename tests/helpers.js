/* Browsermodule in node laden.

   Die Skripte unter website/js/ sind IIFEs ohne Modulsystem: sie hängen ein
   Objekt an `window`. Hier bekommen sie ein Fenster aus einfachen Objekten
   und werden in einer eigenen vm-Umgebung ausgeführt - dieselbe Oberfläche,
   die der Browser bietet, nur so viel davon wie die reinen Funktionen
   brauchen. Kein Export-Schalter im Produktionscode, keine Abhängigkeit. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const WURZEL = path.join(__dirname, "..");
const JS = path.join(WURZEL, "website/js");

/* Ein Element, das genug kann, damit ein Modul beim Laden nicht stolpert. */
function element(tag) {
    const kind = {
        tagName: String(tag || "div").toUpperCase(),
        children: [],
        style: {},
        dataset: {},
        classList: { add() {}, remove() {}, contains: () => false },
        attribute: {},
        textContent: "",
        innerHTML: "",
        hidden: false,
        appendChild(k) { kind.children.push(k); return k; },
        insertBefore(k) { kind.children.unshift(k); return k; },
        replaceChild() {},
        removeChild() {},
        remove() {},
        addEventListener() {},
        removeEventListener() {},
        setAttribute(n, v) { kind.attribute[n] = String(v); },
        getAttribute(n) { return kind.attribute[n] === undefined ? null : kind.attribute[n]; },
        querySelector: () => null,
        querySelectorAll: () => [],
        closest: () => null,
        focus() {},
        click() {}
    };
    return kind;
}

function fensterBauen(extras) {
    const speicher = new Map();
    const dokument = {
        documentElement: Object.assign(element("html"), {
            getAttribute: () => "en",
            dataset: {}
        }),
        body: element("body"),
        currentScript: { src: "http://localhost/js/modul.js" },
        createElement: element,
        createTextNode: (t) => ({ textContent: t }),
        getElementById: () => null,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener() {}
    };
    const fenster = {
        document: dokument,
        location: { href: "http://localhost/index.html", pathname: "/index.html",
                    search: "", hash: "", replace() {} },
        localStorage: {
            getItem: (k) => (speicher.has(k) ? speicher.get(k) : null),
            setItem: (k, v) => speicher.set(k, String(v)),
            removeItem: (k) => speicher.delete(k)
        },
        navigator: { language: "en" },
        console,
        setTimeout,
        clearTimeout,
        history: { replaceState() {} },
        addEventListener() {}
    };
    Object.assign(fenster, extras || {});
    fenster.window = fenster;
    return fenster;
}

/** Lädt website/js/<name>.js und gibt das Fenster zurück. */
function lade(name, extras) {
    const fenster = fensterBauen(extras);
    const quelle = fs.readFileSync(path.join(JS, name + ".js"), "utf8");
    vm.runInNewContext(quelle, fenster);
    return fenster;
}

/** Speicher wie MechsStorage, aber im Arbeitsspeicher. */
function speicher(anfang) {
    const daten = JSON.parse(JSON.stringify(anfang || {}));
    let zaehler = 0;
    return {
        daten,
        load: (k, ersatz) => (k in daten ? JSON.parse(JSON.stringify(daten[k])) : ersatz),
        save: (k, v) => { daten[k] = JSON.parse(JSON.stringify(v)); return true; },
        remove: (k) => { delete daten[k]; },
        newId: () => "id-" + (++zaehler),
        loadHangar: (system) => (`hangar-${system}` in daten
            ? JSON.parse(JSON.stringify(daten[`hangar-${system}`]))
            : { version: 1, mechs: [] }),
        saveHangar: (system, h) => { daten[`hangar-${system}`] = JSON.parse(JSON.stringify(h)); }
    };
}

/** Eine Datendatei aus website/data/. */
function daten(name) {
    return JSON.parse(fs.readFileSync(path.join(WURZEL, "website/data", name), "utf8"));
}

module.exports = { lade, speicher, daten, element, WURZEL };
