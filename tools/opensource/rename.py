#!/usr/bin/env python3
"""Bezeichner umbenennen (docs/history/TASKS-OPENSOURCE.md 3.1).

Liest `rename-map.json` und wendet EINE Kategorie an. Nie alles auf einmal:
Nach jeder Kategorie stehen Syntaxprüfung, Browser-Durchlauf und ein Commit,
sonst lässt sich ein Fehler nicht mehr zuordnen.

    python3 tools/opensource/rename.py cssClasses [--probe]

Ersetzt wird NIE global mit Wortgrenzen - dafür sind die Tabellen zu kurz
(die Klasse `k`, der Schlüssel `wert`). Jede Kategorie kennt stattdessen die
Stellen, an denen ihre Namen stehen dürfen:

  cssClasses   CSS-Selektoren, class="…"-Attribute (auch in HTML-Strings im
               JavaScript), die Klassenargumente von el()/className/
               classList/closest/querySelector - und dieselben Attribute in
               den Wörterbüchern der Sprachpakete, weil dort ganze
               HTML-Schnipsel als Schlüssel stehen.

Die Sprachspiegel unter website/<code>/ werden NICHT angefasst; sie entstehen
neu aus translate.py. Danach: build-sw.py --bump, translate.py, check.py.
"""
import json
import re
import sys
from collections import Counter
from pathlib import Path

HIER = Path(__file__).resolve().parent
ROOT = HIER.parent.parent
WEB = ROOT / "website"
I18N = ROOT / "tools" / "i18n"
DESIGN = ROOT / "design-system"

KARTE = json.loads((HIER / "rename-map.json").read_text(encoding="utf-8"))


def tabelle(kategorie):
    roh = KARTE[kategorie]
    return {k: v for k, v in roh.items() if not k.startswith("_") and isinstance(v, str)}


def sprachordner():
    liste = json.loads((I18N / "languages.json").read_text(encoding="utf-8"))
    return {s["code"] for s in liste}


def quelldateien(endungen):
    """Alle Dateien der Quellsprache; erzeugte Spiegel und Massendaten außen vor."""
    ohne = sprachordner()
    for wurzel in (WEB, DESIGN):
        if not wurzel.is_dir():
            continue
        for p in sorted(wurzel.rglob("*")):
            if not p.is_file() or p.suffix not in endungen:
                continue
            rel = p.relative_to(wurzel)
            if rel.parts[0] in ohne or rel.parts[:2] == ("daten", "mechs"):
                continue
            if p.name.startswith("i18n-"):
                continue          # erzeugte Wörterbücher, siehe translate.py
            yield p


def paketdateien():
    for ordner in sorted(I18N.iterdir()):
        if ordner.is_dir():
            for p in sorted(ordner.glob("*.json")):
                if not p.name.startswith("_"):
                    yield p


# --- cssClasses -------------------------------------------------------------

SKRIPT_BLOCK = re.compile(r"(<script(?![^>]*\bsrc=)[^>]*>)(.*?)(</script>)", re.S)

CLASS_ATTR = re.compile(r"""(class\s*=\s*)(["'])([^"']*)\2""")
SELEKTOR_RUFE = re.compile(
    r"""((?:querySelector|querySelectorAll|closest|matches)\s*\(\s*)(["'])([^"']*)\2""")
CLASSLIST = re.compile(
    r"""(classList\.(?:add|remove|toggle|contains|replace)\s*\()([^)]*)\)""")
CLASSNAME = re.compile(r"""(\.className\s*(?:\+?=)\s*)(["'])([^"']*)\2""")
EL_AUFRUF = re.compile(r"""(\bel\(\s*(?:"[a-z0-9]+"|'[a-z0-9]+')\s*,\s*)(["'])([^"']*)\2""")
SELEKTOR_KLASSE = re.compile(r"\.([A-Za-z_][\w-]*)")


def tokens_ersetzen(wert, tab, zaehler):
    """Eine Klassenliste ("a b c") tokenweise übersetzen."""
    teile = wert.split(" ")
    for i, t in enumerate(teile):
        if t in tab:
            teile[i] = tab[t]
            zaehler[t] += 1
    return " ".join(teile)


def selektor_ersetzen(wert, tab, zaehler):
    """In einem CSS-Selektor jede .klasse übersetzen."""
    def eins(m):
        name = m.group(1)
        if name in tab:
            zaehler[name] += 1
            return "." + tab[name]
        return m.group(0)
    return SELEKTOR_KLASSE.sub(eins, wert)


def css_klassen(text, endung, tab, zaehler):
    if endung == ".css":
        text = selektor_ersetzen(text, tab, zaehler)
    if endung == ".html":
        # Inline-Skripte spielen nach denselben Regeln wie eine .js-Datei.
        text = SKRIPT_BLOCK.sub(
            lambda m: m.group(1) + css_klassen(m.group(2), ".js", tab, zaehler) + m.group(3),
            text)
    text = CLASS_ATTR.sub(
        lambda m: m.group(1) + m.group(2) + tokens_ersetzen(m.group(3), tab, zaehler) + m.group(2),
        text)
    if endung == ".js":
        for muster in (EL_AUFRUF, CLASSNAME):
            text = muster.sub(
                lambda m: m.group(1) + m.group(2) + tokens_ersetzen(m.group(3), tab, zaehler) + m.group(2),
                text)
        text = SELEKTOR_RUFE.sub(
            lambda m: m.group(1) + m.group(2) + selektor_ersetzen(m.group(3), tab, zaehler) + m.group(2),
            text)

        def liste(m):
            args = re.sub(r"""(["'])([^"']*)\1""",
                          lambda a: a.group(1) + tokens_ersetzen(a.group(2), tab, zaehler) + a.group(1),
                          m.group(2))
            return m.group(1) + args + ")"
        text = CLASSLIST.sub(liste, text)
    return text


def lauf_cssClasses(probe):
    tab = tabelle("cssClasses")
    zaehler = Counter()
    berichte = []
    for p in quelldateien({".css", ".html", ".js"}):
        alt = p.read_text(encoding="utf-8")
        vorher = sum(zaehler.values())
        neu = css_klassen(alt, p.suffix, tab, zaehler)
        n = sum(zaehler.values()) - vorher
        if n:
            berichte.append((p.relative_to(ROOT), n))
            if not probe:
                p.write_text(neu, encoding="utf-8")

    # Sprachpakete: die Schlüssel sind HTML-Schnipsel mit class="…"
    for p in paketdateien():
        d = json.loads(p.read_text(encoding="utf-8"))
        vorher = sum(zaehler.values())
        if isinstance(d, list):
            neu = [css_klassen(x, ".html", tab, zaehler) if isinstance(x, str) else x for x in d]
        elif isinstance(d, dict):
            neu = {css_klassen(k, ".html", tab, zaehler):
                   (css_klassen(v, ".html", tab, zaehler) if isinstance(v, str) else v)
                   for k, v in d.items()}
        else:
            continue
        n = sum(zaehler.values()) - vorher
        if n:
            berichte.append((p.relative_to(ROOT), n))
            if not probe:
                p.write_text(json.dumps(neu, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")
    return tab, zaehler, berichte


# --- ids, Formularfelder, data-Attribute ------------------------------------

ID_ATTR = re.compile(
    r"""((?:\bid|for|form|list|aria-controls|aria-labelledby|aria-describedby)\s*=\s*)(["'])([^"']*)\2""")
NAME_ATTR = re.compile(r"""(\bname\s*=\s*)(["'])([^"']*)\2""")
FRAGMENT = re.compile(r"#([A-Za-z_][\w-]*)")
ID_SELEKTOR = re.compile(r"#([A-Za-z_][\w-]*)")
JS_ID_RUFE = re.compile(r"""(getElementById\s*\(\s*)(["'])([^"']*)\2""")
JS_ID_ZUWEISUNG = re.compile(r"""(\.id\s*=\s*)(["'])([^"']*)\2""")
JS_ELEMENTS = re.compile(r"""(\.elements\[\s*)(["'])([^"']*)\2""")
# Der Kurzruf auf ein Formularfeld: hieß bis Schritt 6 `feld(…)`, seither
# `field(…)`. Beide Namen bleiben stehen, damit ein Lauf auf einem älteren
# Stand nicht stillschweigend nichts trifft.
FELD_RUFE = re.compile(r"""(\b(?:feld|field)\(\s*)(["'])([^"']*)\2""")
JS_STRING = re.compile(r"""(["'])((?:[^"'\\\n]|\\.)*)\1""")
DATASET = re.compile(r"\.dataset\.([A-Za-z]+)\b")


def eins_zu_eins(wert, tab, zaehler):
    if wert in tab:
        zaehler[wert] += 1
        return tab[wert]
    return wert


def fragmente_ersetzen(wert, tab, zaehler):
    def eins(m):
        if m.group(1) in tab:
            zaehler[m.group(1)] += 1
            return "#" + tab[m.group(1)]
        return m.group(0)
    return FRAGMENT.sub(eins, wert)


def praefixe_ersetzen(text, praefixe, zaehler):
    """"einheit-" + gid → "unit-" + gid: nur der Literalteil wird getauscht."""
    def eins(m):
        inhalt = m.group(2)
        for alt, neu in praefixe.items():
            if inhalt.startswith(alt):
                zaehler[alt] += 1
                return m.group(1) + neu + inhalt[len(alt):] + m.group(1)
        return m.group(0)
    return JS_STRING.sub(eins, text)


def ids_anwenden(text, endung, tab, felder, dattr, praefixe, zaehler):
    if endung == ".html":
        # Inline-Skripte spielen nach denselben Regeln wie eine .js-Datei.
        text = SKRIPT_BLOCK.sub(
            lambda m: m.group(1)
            + ids_anwenden(m.group(2), ".js", tab, felder, dattr, praefixe, zaehler)
            + m.group(3), text)
    text = ID_ATTR.sub(
        lambda m: m.group(1) + m.group(2)
        + " ".join(eins_zu_eins(t, tab, zaehler) for t in m.group(3).split())
        + m.group(2), text)
    if endung == ".html":
        text = NAME_ATTR.sub(
            lambda m: m.group(1) + m.group(2) + eins_zu_eins(m.group(3), felder, zaehler) + m.group(2),
            text)
        text = re.sub(r"""(href\s*=\s*)(["'])([^"']*)\2""",
                      lambda m: m.group(1) + m.group(2) + fragmente_ersetzen(m.group(3), tab, zaehler) + m.group(2),
                      text)
    if endung == ".css":
        text = ID_SELEKTOR.sub(
            lambda m: "#" + eins_zu_eins(m.group(1), tab, zaehler), text)
    if endung == ".js":
        for muster, quelle in ((JS_ID_RUFE, tab), (JS_ID_ZUWEISUNG, tab),
                               (JS_ELEMENTS, felder), (FELD_RUFE, felder)):
            text = muster.sub(
                lambda m, q=quelle: m.group(1) + m.group(2) + eins_zu_eins(m.group(3), q, zaehler) + m.group(2),
                text)
        # Sprungmarken stehen auch mitten in Zeichenketten ("rules.html#damage").
        text = JS_STRING.sub(
            lambda m: m.group(1) + fragmente_ersetzen(m.group(2), tab, zaehler) + m.group(1),
            text)
        text = praefixe_ersetzen(text, praefixe, zaehler)
    # data-Attribute: in HTML, CSS und JS steht immer derselbe Name.
    for alt, neu in dattr.items():
        anzahl = len(re.findall(r"(?<![\w-])" + re.escape(alt) + r"(?![\w-])", text))
        if anzahl:
            zaehler[alt] += anzahl
            text = re.sub(r"(?<![\w-])" + re.escape(alt) + r"(?![\w-])", neu, text)
        if endung == ".js":
            # dataset.sprache ⇄ data-sprache
            js_name = re.sub(r"-([a-z])", lambda m: m.group(1).upper(), alt[len("data-"):])
            js_neu = re.sub(r"-([a-z])", lambda m: m.group(1).upper(), neu[len("data-"):])
            n = len(re.findall(r"\.dataset\." + js_name + r"\b", text))
            if n:
                zaehler[alt] += n
                text = re.sub(r"\.dataset\." + js_name + r"\b", ".dataset." + js_neu, text)
    return text


def lauf_ids(probe):
    roh = KARTE["ids"]
    tab = {k: v for k, v in roh.items() if not k.startswith("_") and isinstance(v, str)}
    felder = {k: v for k, v in roh["formFields"].items() if not k.startswith("_")}
    # Die Beschriftungen hängen als id/for am Feldnamen: f-<feld>, a-<feld>.
    for alt, neu in felder.items():
        for praefix in ("f-", "a-"):
            tab.setdefault(praefix + alt, praefix + neu)
    dattr = {k: v for k, v in KARTE["dataAttributes"].items() if not k.startswith("_")}
    praefixe = {k: v for k, v in KARTE["idPrefixes"].items() if not k.startswith("_")}
    zaehler = Counter()
    berichte = []

    def bearbeite(text, endung):
        return ids_anwenden(text, endung, tab, felder, dattr, praefixe, zaehler)

    for p in quelldateien({".css", ".html", ".js"}):
        alt = p.read_text(encoding="utf-8")
        vorher = sum(zaehler.values())
        neu = bearbeite(alt, p.suffix)
        n = sum(zaehler.values()) - vorher
        if n:
            berichte.append((p.relative_to(ROOT), n))
            if not probe:
                p.write_text(neu, encoding="utf-8")

    for p in paketdateien():
        d = json.loads(p.read_text(encoding="utf-8"))
        vorher = sum(zaehler.values())
        if isinstance(d, list):
            neu = [bearbeite(x, ".html") if isinstance(x, str) else x for x in d]
        elif isinstance(d, dict):
            neu = {bearbeite(k, ".html"): (bearbeite(v, ".html") if isinstance(v, str) else v)
                   for k, v in d.items()}
        else:
            continue
        n = sum(zaehler.values()) - vorher
        if n:
            berichte.append((p.relative_to(ROOT), n))
            if not probe:
                p.write_text(json.dumps(neu, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")

    alle = dict(tab, **felder, **dattr, **praefixe)
    return alle, zaehler, berichte


# --- modules, Methoden, Options-Schlüssel -----------------------------------

OPTIONEN_ZU_MODUL = {
    "calculatorOptions": ("MechsCalculator", "create"),
    "diceOptions": ("MechsDice", "block"),
    "initiativeOptions": ("MechsInitiative", "bar"),
    "campaignOptions": ("MechsCampaign", ("endDialog", "workshop")),
    "modifierOptions": ("MechsModifiers", "chips"),
}


def klammer_ende(text, auf):
    """Index hinter der schließenden Klammer zu text[auf] == '('."""
    tiefe, i, n = 0, auf, len(text)
    while i < n:
        c = text[i]
        if c in "\"'":
            j = i + 1
            while j < n and text[j] != c:
                j += 2 if text[j] == "\\" else 1
            i = j + 1
            continue
        if c == "(":
            tiefe += 1
        elif c == ")":
            tiefe -= 1
            if tiefe == 0:
                return i + 1
        i += 1
    return n


def optionen_am_aufruf(text, empfaenger, methoden, tab, zaehler):
    """Schlüssel im Objektliteral eines Aufrufs <empfaenger>.methode({ … }).

    Die Abkürzungen zählen mit: die Seiten rufen MOD.chips(…) und
    K.workshop(…), nicht den vollen Modulnamen."""
    if isinstance(methoden, str):
        methoden = (methoden,)
    for modul, methode in ((e, m) for e in empfaenger for m in methoden):
        muster = re.compile(r"\b" + re.escape(modul) + r"\." + re.escape(methode) + r"\s*\(")
        pos = 0
        while True:
            m = muster.search(text, pos)
            if not m:
                break
            auf = m.end() - 1
            zu = klammer_ende(text, auf)
            block = text[auf:zu]
            neu = block
            for alt, ziel in tab.items():
                neu, n = re.subn(r"(?<![\w.$])" + re.escape(alt) + r"(\s*:)", ziel + r"\1", neu)
                zaehler[alt] += n
            text = text[:auf] + neu + text[zu:]
            pos = auf + len(neu)
    return text


def lauf_modules(probe):
    roh = KARTE["modules"]
    module = {k: v for k, v in roh.items()
              if not k.startswith("_") and isinstance(v, str)}
    methoden = roh["methods"]
    empfaenger = {k: v for k, v in roh["receivers"].items() if not k.startswith("_")}
    zaehler = Counter()
    berichte = []
    optionen = {k: {a: b for a, b in roh[k].items() if not a.startswith("_")}
                for k in OPTIONEN_ZU_MODUL}

    def bearbeite(text, name):
        # 1. Die globalen Namen selbst - eindeutig genug für Wortgrenzen.
        for alt, neu in module.items():
            if alt == neu:
                continue
            text, n = re.subn(r"\b" + re.escape(alt) + r"\b", neu, text)
            zaehler[alt] += n
        # 2. Methoden nur hinter einem bekannten Empfänger.
        for modul, tab in methoden.items():
            for alt, neu in tab.items():
                if alt.startswith("_") or alt == neu:
                    continue
                for r in empfaenger.get(modul, [modul]):
                    text, n = re.subn(
                        r"(\b" + re.escape(r) + r"\.)" + re.escape(alt) + r"\b",
                        r"\1" + neu, text)
                    zaehler[alt] += n
        # 3. Die Schlüssel im Export-Literal des Moduls selbst.
        for modul, tab in methoden.items():
            export = re.search(r"(?:window\." + re.escape(modul) + r"|var api)\s*=\s*\{", text)
            if not export:
                continue
            auf = export.end() - 1
            tiefe, i = 0, auf
            while i < len(text):
                if text[i] == "{":
                    tiefe += 1
                elif text[i] == "}":
                    tiefe -= 1
                    if tiefe == 0:
                        break
                i += 1
            block = text[auf:i + 1]
            neu_block = block
            for alt, neu in tab.items():
                if alt.startswith("_") or alt == neu:
                    continue
                neu_block, n = re.subn(r"(?<![\w.$])" + re.escape(alt) + r"(\s*:)", neu + r"\1", neu_block)
                zaehler[alt] += n
            text = text[:auf] + neu_block + text[i + 1:]
        # 4. Options-Schlüssel: im Modul selbst (optionen.<key>) und am Aufruf.
        for schluessel, (modul, meth) in OPTIONEN_ZU_MODUL.items():
            tab = optionen[schluessel]
            for alt, neu in tab.items():
                if alt == neu:
                    continue
                text, n = re.subn(r"(\boptionen\.)" + re.escape(alt) + r"\b", r"\1" + neu, text)
                zaehler[alt] += n
            text = optionen_am_aufruf(text, empfaenger.get(modul, [modul]), meth, tab, zaehler)
        return text

    for p in quelldateien({".js", ".html"}):
        alt = p.read_text(encoding="utf-8")
        vorher = sum(zaehler.values())
        neu = bearbeite(alt, p.name)
        n = sum(zaehler.values()) - vorher
        if n:
            berichte.append((p.relative_to(ROOT), n))
            if not probe:
                p.write_text(neu, encoding="utf-8")

    alle = dict(module)
    for tab in methoden.values():
        alle.update({k: v for k, v in tab.items() if not k.startswith("_")})
    for tab in optionen.values():
        alle.update(tab)
    return alle, zaehler, berichte


# --- dataFiles: die von Hand gepflegten Datendateien ------------------------
#
# Jede Datei bekommt ihre eigene Umschreibung. Eine generische Tabelle ginge
# hier schief: "standard" heißt in classic-werte.json die Slot-Vorbelegung
# (defaults) und im Rechner die Voreinstellung einer Kategorie (default),
# "typ" ist einmal die Einheitenart und einmal die Art eines Bedienelements.
# Die Einheitendateien stehen NICHT hier - sie kommen aus den Konvertern.

ZONEN_KARTE = {"kopf": "head", "zt": "ct", "zth": "ctr", "rth": "rtr",
               "lth": "ltr", "rb": "rl", "lb": "ll"}
RICHTUNGEN_KARTE = {"vorn": "front", "hinten": "rear", "links": "left", "rechts": "right"}


def schluessel_neu(objekt, tabelle):
    """Neues dict mit übersetzten Schlüsseln, Reihenfolge bleibt."""
    if not isinstance(objekt, dict):
        return objekt
    return {tabelle.get(k, k): v for k, v in objekt.items()}


def zonen_karte(objekt):
    return schluessel_neu(objekt, ZONEN_KARTE)


def daten_classic_werte(d, karte):
    krit_ids = karte["dataValues"]["critComponentIds"]
    hitze_typen = karte["dataValues"]["heatThresholdTypes"]
    d = schluessel_neu(d, {
        "_hinweis": "_note", "stand": "asOf", "struktur": "structure",
        "hitzeSchwellen": "heatThresholds", "pilotBewusstsein": "pilotConsciousness",
        "kritWurf": "critRoll", "trefferzonen": "hitLocations",
        "kritSlots": "critSlots", "kritKomponenten": "critComponents",
        "bvSkillFaktor": "bvSkillFactor", "clusterTabelle": "clusterTable",
        "schadenTransfer": "damageTransfer"})
    s = schluessel_neu(d["structure"], {"kopf": "head"})
    s["tonnage"] = {t: schluessel_neu(v, {"zt": "ct", "st": "sideTorso", "bein": "leg"})
                    for t, v in s["tonnage"].items()}
    d["structure"] = s
    d["heatThresholds"] = [
        schluessel_neu(dict(h, typ=hitze_typen.get(h["typ"], h["typ"])),
                       {"wert": "value", "typ": "type", "effekt": "effect"})
        for h in d["heatThresholds"]]
    tz = schluessel_neu(d["hitLocations"], dict(RICHTUNGEN_KARTE, _hinweis="_note"))
    for richtung in RICHTUNGEN_KARTE.values():
        tz[richtung] = {wurf: ([ZONEN_KARTE.get(e[0], e[0])] + e[1:]) if isinstance(e, list) else e
                        for wurf, e in tz[richtung].items()}
    d["hitLocations"] = tz
    ks = schluessel_neu(d["critSlots"], {"_hinweis": "_note", "anzahl": "count",
                                         "standard": "defaults", "namenZuordnung": "nameMap"})
    ks["count"] = zonen_karte(ks["count"])
    ks["defaults"] = zonen_karte(ks["defaults"])
    ks["nameMap"] = [[fragment, krit_ids.get(kid, kid)] for fragment, kid in ks["nameMap"]]
    d["critSlots"] = ks
    d["critComponents"] = [
        schluessel_neu(dict(k, id=krit_ids.get(k["id"], k["id"])),
                       {"stufen": "levels", "ausserGefechtBei": "outOfActionAt",
                        "jeTreffer": "perHit"})
        for k in d["critComponents"]]
    d["bvSkillFactor"] = schluessel_neu(d["bvSkillFactor"], {"_hinweis": "_note", "tabelle": "table"})
    d["clusterTable"] = schluessel_neu(d["clusterTable"], {"_hinweis": "_note"})
    dt = schluessel_neu(d["damageTransfer"], dict(ZONEN_KARTE, _hinweis="_note"))
    d["damageTransfer"] = {k: (ZONEN_KARTE.get(v, v) if k != "_note" else v) for k, v in dt.items()}
    return d


def daten_rechner(d, karte):
    kat_ids = karte["dataValues"]["calculatorCategoryIds"]
    typen = karte["dataValues"]["calculatorTypes"]
    d = schluessel_neu(d, {"_hinweis": "_note", "stand": "asOf", "titel": "title",
                           "basis": "base", "ueber12": "above12",
                           "kategorien": "categories", "pvSkill": "pvSkill"})
    d["categories"] = [
        schluessel_neu(dict(k, id=kat_ids.get(k["id"], k["id"]),
                            typ=typen.get(k.get("typ"), k.get("typ")),
                            optionen=[schluessel_neu(o, {"wert": "value"})
                                      for o in k.get("optionen", [])]),
                       {"gruppe": "group", "typ": "type", "standard": "default",
                        "optionen": "options", "wert": "value", "hinweis": "note",
                        "quelle": "source"})
        for k in d["categories"]]
    for k in d["categories"]:
        if k.get("type") is None:
            del k["type"]
        if not k.get("options"):
            k.pop("options", None)
    if "pvSkill" in d:
        d["pvSkill"] = schluessel_neu(d["pvSkill"], {
            "_hinweis": "_note", "verbessernAb": "improveFrom", "verbessernJe": "improveStep",
            "verschlechternAb": "worsenFrom", "verschlechternJe": "worsenStep"})
    return d


def daten_faehigkeiten(d, karte):
    d = schluessel_neu(d, {"_hinweis": "_note", "stand": "asOf",
                           "faehigkeiten": "abilities"})
    d["abilities"] = [schluessel_neu(f, {"k": "key"}) for f in d["abilities"]]
    return d


def daten_glossar(d, karte):
    d = schluessel_neu(d, {"_hinweis": "_note", "stand": "asOf",
                           "kategorien": "categories", "eintraege": "entries"})
    d["entries"] = [schluessel_neu(e, {"kat": "category", "hinweis": "note"})
                    for e in d["entries"]]
    return d


def daten_waffen(d, karte):
    d = schluessel_neu(d, {"_hinweis": "_note", "stand": "asOf", "waffen": "weapons"})
    for tech, waffen in d["weapons"].items():
        d["weapons"][tech] = {
            name: schluessel_neu(dict(w, reichweite=schluessel_neu(
                w.get("reichweite") or {}, {"kurz": "short", "mittel": "medium", "lang": "long"})),
                {"schaden": "damage", "hitze": "heat", "reichweite": "range",
                 "munProTon": "ammoPerTon"})
            for name, w in waffen.items()}
    return d


def daten_fraktionen(d, karte):
    kat_ids = karte["dataValues"]["factionCategoryIds"]
    d = schluessel_neu(d, {"_hinweis": "_note", "stand": "asOf",
                           "kategorien": "categories", "fraktionen": "factions"})
    d["categories"] = [schluessel_neu(dict(k, id=kat_ids.get(k["id"], k["id"])),
                                      {"beschreibung": "description"})
                       for k in d["categories"]]
    d["factions"] = [
        schluessel_neu(dict(f, kategorie=kat_ids.get(f.get("kategorie"), f.get("kategorie")),
                            farben=schluessel_neu(f.get("farben") or {},
                                                  {"basis": "base", "akzent": "accent"})),
                       {"beschreibung": "description", "kuerzel": "abbreviation",
                        "kurzprofil": "profile", "untertitel": "subtitle",
                        "kategorie": "category", "farben": "colors",
                        "farbfolge": "paintSequence", "tipp": "tip",
                        "verbaende": "subunits"})
        for f in d["factions"]]
    return d


DATEIEN = {
    "classic-werte.json": daten_classic_werte,
    "rechner-classic.json": daten_rechner,
    "rechner-alphastrike.json": daten_rechner,
    "as-faehigkeiten.json": daten_faehigkeiten,
    "glossar.json": daten_glossar,
    "waffen.json": daten_waffen,
    "fraktionen.json": daten_fraktionen,
}


def lauf_dataFiles(probe):
    zaehler = Counter()
    berichte = []
    for name, umbau in DATEIEN.items():
        pfad = WEB / "daten" / name
        d = json.loads(pfad.read_text(encoding="utf-8"))
        neu = umbau(d, KARTE)
        text = json.dumps(neu, ensure_ascii=False, indent=4) + "\n"
        zaehler[name] += 1
        berichte.append((pfad.relative_to(ROOT), 1))
        if not probe:
            pfad.write_text(text, encoding="utf-8")
    return {n: n for n in DATEIEN}, zaehler, berichte


# --- dataKeys: die Feldnamen im Code ----------------------------------------
#
# Ersetzt wird an zwei Stellen: hinter einem Punkt (m.panzerung) und als
# Schlüssel eines Objektliterals (panzerung: …). Zeichenketten bleiben außen
# vor - dort steht mal ein Feldname, mal ein Anzeigetext, und der Unterschied
# ist nicht zu sehen. Die wenigen Feldnamen in Zeichenketten stehen in
# stringKeys und werden je Datei benannt.

def lauf_dataKeys(probe):
    regeln = KARTE["dataKeyRules"]
    ausnahmen = set(regeln["skip"])
    tab = {}
    for gruppe, inhalt in KARTE["dataKeys"].items():
        if gruppe.startswith("_") or not isinstance(inhalt, dict):
            continue
        for alt, neu in inhalt.items():
            if alt.startswith("_") or not isinstance(neu, str) or alt == neu:
                continue
            if alt in ausnahmen:
                continue
            if alt in tab and tab[alt] != neu:
                raise SystemExit(f"dataKeys: {alt!r} -> {tab[alt]!r} und {neu!r}; "
                                 f"gehört in dataKeyRules.byReceiver")
            tab[alt] = neu
    zaehler = Counter()
    berichte = []

    def bearbeite(text):
        for empfaenger, alt, neu in regeln["byReceiver"]:
            for r in empfaenger:
                text, n = re.subn(r"(\b" + re.escape(r) + r"\.)" + re.escape(alt) + r"\b",
                                  r"\1" + neu, text)
                zaehler[alt] += n
        for alt, neu in tab.items():
            text, n = re.subn(r"(?<=\.)" + re.escape(alt) + r"\b(?!\s*\()", neu, text)
            zaehler[alt] += n
            # Nur echte Objektschlüssel: ein Ternär (liste ? liste : null)
            # sieht sonst genauso aus wie "liste:".
            text, m = re.subn(r"([{,]\s*)" + re.escape(alt) + r"(\s*:)", r"\1" + neu + r"\2", text)
            zaehler[alt] += m
        return text

    for p in quelldateien({".js", ".html"}):
        # migrate.js führt die alten Namen absichtlich weiter - sie sind sein
        # Gegenstand. Würde man hier ersetzen, wäre die Migration wirkungslos.
        if p.name == "migrate.js":
            continue
        alt = p.read_text(encoding="utf-8")
        vorher = sum(zaehler.values())
        neu = bearbeite(alt)
        n = sum(zaehler.values()) - vorher
        if n:
            berichte.append((p.relative_to(ROOT), n))
            if not probe:
                p.write_text(neu, encoding="utf-8")
    return tab, zaehler, berichte


# --- zones: Zonencodes, Waffenzonen, Angriffsrichtungen ---------------------
#
# Kurze Wörter, deshalb nur an drei Stellen: eine Zeichenkette, die GENAU ein
# Code ist, ein Objektschlüssel, der genau ein Code ist, und der Zonenteil der
# Panzerungsfelder (name="a_zt"). Alles andere bliebe zu unsicher; die
# Handvoll zusammengesetzter Fälle steht im Commit.

def lauf_zones(probe):
    roh = KARTE["zones"]
    zonen = {k: v for k, v in roh.items()
             if not k.startswith("_") and isinstance(v, str) and k != v}
    codes = {k: v for k, v in roh["weaponLocationCodes"].items() if k != v}
    richtungen = {k: v for k, v in roh["directions"].items() if k != v}
    alle = dict(zonen, **codes, **richtungen)
    zaehler = Counter()
    berichte = []

    def bearbeite(text, endung):
        if endung == ".js":
            # Nur im JavaScript: in HTML wäre id="links" ein Treffer, und das
            # ist die Linkliste unter Wissen, keine Angriffsrichtung.
            for alt, neu in alle.items():
                text, n = re.subn(r'(["\'])' + re.escape(alt) + r'\1', r"\g<1>" + neu + r"\g<1>", text)
                zaehler[alt] += n
                text, m = re.subn(r"([{,]\s*)" + re.escape(alt) + r"(\s*:)", r"\1" + neu + r"\2", text)
                zaehler[alt] += m
        for alt, neu in zonen.items():
            for muster, ersatz in ((r'(["\'])a_' + re.escape(alt) + r'\1', r"\g<1>a_" + neu + r"\g<1>"),
                                   (r'(name|id|for)="((?:f-)?a_)' + re.escape(alt) + r'"',
                                    r'\1="\g<2>' + neu + '"')):
                text, n = re.subn(muster, ersatz, text)
                zaehler[alt] += n
        return text

    for p in quelldateien({".js", ".html"}):
        if p.name == "migrate.js":
            continue
        alt = p.read_text(encoding="utf-8")
        vorher = sum(zaehler.values())
        neu = bearbeite(alt, p.suffix)
        n = sum(zaehler.values()) - vorher
        if n:
            berichte.append((p.relative_to(ROOT), n))
            if not probe:
                p.write_text(neu, encoding="utf-8")
    return alle, zaehler, berichte


LAEUFE = {"cssClasses": lauf_cssClasses, "ids": lauf_ids, "modules": lauf_modules,
          "dataFiles": lauf_dataFiles, "dataKeys": lauf_dataKeys, "zones": lauf_zones}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    probe = "--probe" in sys.argv
    if len(args) != 1 or args[0] not in LAEUFE:
        sys.exit(f"Aufruf: rename.py <{'|'.join(LAEUFE)}> [--probe]")
    kategorie = args[0]
    tab, zaehler, berichte = LAEUFE[kategorie](probe)

    print(f"{'(Probe) ' if probe else ''}{kategorie}: {sum(zaehler.values())} Ersetzungen "
          f"in {len(berichte)} Dateien")
    for rel, n in berichte:
        print(f"  {n:5}  {rel}")
    ohne = sorted(k for k in tab if not zaehler[k])
    if ohne:
        print(f"\n{len(ohne)} Einträge OHNE Treffer - Tabelle prüfen:")
        for k in ohne:
            print(f"  {k} -> {tab[k]}")


if __name__ == "__main__":
    main()
