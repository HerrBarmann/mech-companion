#!/usr/bin/env python3
"""Übersetzte Spiegel der Website erzeugen (CONCEPT 5.7).

Englisch ist die Quelle und liegt in website/. Jedes Sprachpaket unter
tools/i18n/<code>/ erzeugt einen vollständigen Spiegel:

  website/<code>/<gleicher Pfad>.html   die übersetzten Seiten
  website/<code>/manifest.webmanifest   Name/Beschreibung in der Sprache
  website/js/i18n-<code>.js             Wörterbuch für per Skript erzeugte Texte
  tools/i18n/<code>/_missing.json   was noch fehlt

Ein neues Sprachpaket anlegen heißt: Ordner unter i18n/ anlegen, in
languages.json eintragen, die JSON-Dateien übersetzen, Skript laufen lassen.
Fehlendes bleibt in der Quellsprache stehen und steht im Bericht.

Zusätzlich schreibt das Skript in JEDE Seite (auch die Quelle) die
alternate-Links und den Sprachumschalter - bei zwei Sprachen ein Knopf, bei
mehr ein Menü.

Aufruf:  python3 tools/translate.py [--check]
  --check  nur prüfen und Berichte schreiben, nichts erzeugen (Exit 1 bei Lücken)

Texteinheit = ein Element ohne Blockkinder (p, li, h2, td, label, button ...)
mitsamt seiner Inline-Auszeichnung. Schlüssel ist sein innerHTML mit
normalisiertem Leerraum - so bleibt der Satzbau beim Übersetzen frei.

Läuft LOKAL (braucht beautifulsoup4), nie auf dem Server.
"""
import json
import os
import re
import sys
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Comment

PROJEKT = Path(__file__).resolve().parent.parent
WEB = PROJEKT / "website"
I18N = PROJEKT / "tools" / "i18n"

UNIT_TAGS = {"p", "li", "h1", "h2", "h3", "h4", "summary", "td", "th", "label",
             "button", "a", "small", "span", "dt", "dd", "figcaption", "option",
             "legend", "strong", "b", "em", "i", "title", "caption"}
BLOCK_TAGS = {"div", "p", "ul", "ol", "table", "thead", "tbody", "tr", "section",
              "article", "details", "nav", "header", "footer", "main", "h1", "h2",
              "h3", "h4", "li", "dl", "form", "blockquote", "pre", "svg",
              "fieldset", "figure", "dialog", "aside"}
SKIP_TAGS = {"script", "style", "svg"}
ATTRIBUTE = ("title", "alt", "placeholder", "aria-label")
HAT_BUCHSTABEN = re.compile(r"[A-Za-zÄÖÜäöüß]")
LEERRAUM = re.compile(r"\s+")
PLATZHALTER = re.compile(r"\{\{site\.[a-zA-Z0-9_.]+\}\}")


def norm(text):
    return LEERRAUM.sub(" ", text).strip()


def sprachen():
    datei = I18N / "languages.json"
    if not datei.exists():
        sys.exit(f"{datei} fehlt - siehe docs/I18N.md")
    liste = json.loads(datei.read_text(encoding="utf-8"))
    quelle = [s for s in liste if s.get("source")]
    if len(quelle) != 1:
        sys.exit("languages.json braucht genau eine Sprache mit \"source\": true")
    return liste, quelle[0]


def paket_laden(code):
    """Wörterbuch, unveränderte Texte und Muster eines Sprachpakets.

    patterns.json fängt Datenwerte ab, die in Kombinationen auftreten
    ("1/missile", "min 6 · 7/14/21", "7/14/21 (water only)"):
    [Regex, Ersatz, Flags], Ersatz in JavaScript-Schreibweise ($1). Ein
    Eintrag NUR mit Regex heißt "bleibt in dieser Sprache gleich" - das ist
    die Muster-Fassung von identical.json. Muster greifen erst, wenn kein
    Wörterbucheintrag passt."""
    ordner = I18N / code
    woerter, identisch, muster = {}, set(), []
    if not ordner.is_dir():
        return woerter, identisch, muster
    for pfad in sorted(ordner.glob("*.json")):
        if pfad.name.startswith("_"):
            continue
        d = json.loads(pfad.read_text(encoding="utf-8"))
        if pfad.name == "identical.json":
            identisch.update(d if isinstance(d, list) else d.keys())
            continue
        if pfad.name == "patterns.json":
            muster = [list(p) for p in d]
            continue
        for quelle, ziel in d.items():
            if quelle in woerter and woerter[quelle] != ziel:
                print(f"WARNUNG {code}: doppelt mit Abweichung: {quelle[:60]!r} in {pfad.name}")
            woerter[quelle] = ziel
    return woerter, identisch, muster


def muster_uebersetzen(text, muster):
    """Dieselbe Reihenfolge wie T() im Browser: jedes Muster einmal.

    Liefert (Ergebnis, getroffen). "getroffen" heißt: ein Muster ist
    zuständig - auch dann, wenn der Text unverändert bleibt."""
    neu, getroffen = text, False
    for p in muster:
        schalter = p[2] if len(p) > 2 else ""
        flags = re.I if "i" in schalter else 0
        if not re.search(p[0], neu, flags):
            continue
        getroffen = True
        if len(p) > 1:
            ersatz = re.sub(r"\$(\d)", r"\\\1", p[1])
            neu = re.sub(p[0], ersatz, neu, count=0 if "g" in schalter else 1, flags=flags)
    return neu, getroffen


def ist_einheit(el):
    if el.name not in UNIT_TAGS:
        return False
    return not any(k.name in BLOCK_TAGS for k in el.find_all(True))


def uebersetzbar(text):
    t = norm(text)
    if not t:
        return False
    ohne = PLATZHALTER.sub("", re.sub(r"<[^>]+>", "", t))
    return bool(HAT_BUCHSTABEN.search(ohne))


class Uebersetzer:
    def __init__(self, code, woerter, identisch, muster=()):
        self.code = code
        self.woerter = woerter
        self.identisch = identisch
        self.muster = list(muster)
        self.fehlend = {}
        self.aktuelle_seite = ""

    def melde(self, schluessel):
        if schluessel in self.identisch:
            return
        self.fehlend.setdefault(self.aktuelle_seite, [])
        if schluessel not in self.fehlend[self.aktuelle_seite]:
            self.fehlend[self.aktuelle_seite].append(schluessel)

    def text(self, quelle):
        k = norm(quelle)
        if not uebersetzbar(k):
            return quelle
        if k in self.woerter:
            return self.woerter[k]
        gedreht, getroffen = muster_uebersetzen(k, self.muster)
        if getroffen:
            return gedreht
        self.melde(k)
        return quelle

    def einheit(self, el):
        inner = norm(el.decode_contents())
        if not uebersetzbar(inner):
            # Kein eigener Text, aber vielleicht übersetzbare Attribute an den
            # Kindern (<span><input aria-label="…"></span>) - also weitergehen.
            self.durchlaufen(el)
            return
        if inner in self.woerter:
            neu = BeautifulSoup(self.woerter[inner], "html.parser")
            el.clear()
            for kind in list(neu.contents):
                el.append(kind)
        else:
            self.melde(inner)

    def durchlaufen(self, el):
        for kind in list(el.children):
            if isinstance(kind, Comment):
                continue
            if isinstance(kind, NavigableString):
                if uebersetzbar(str(kind)):
                    k = norm(str(kind))
                    if k in self.woerter:
                        kind.replace_with(str(kind).replace(k, self.woerter[k]))
                    else:
                        self.melde(k)
                continue
            if kind.name in SKIP_TAGS:
                continue
            if kind.name == "a" and "brand" in (kind.get("class") or []):
                continue   # Wortmarke bleibt in jeder Sprache gleich
            if kind.get("id") in ("lang-btn", "lang-menu"):
                continue   # Sprachwahl schreibt dieses Skript selbst, je Sprache
            for attr in ATTRIBUTE:
                if kind.has_attr(attr) and uebersetzbar(kind[attr]):
                    kind[attr] = self.text(kind[attr])
            if ist_einheit(kind):
                self.einheit(kind)
            else:
                self.durchlaufen(kind)


def asset_pfad(wert):
    """Relative Nicht-HTML-Pfade zeigen aus <code>/ eine Ebene höher."""
    # Ein Platzhalter ist kein Pfad: {{site.authority.url}} wird beim Build zu
    # einer vollständigen Adresse, ein vorangestelltes ../ macht sie kaputt.
    if not wert or wert.startswith("{{") or re.match(r"^(https?:|mailto:|#|data:|tel:)", wert):
        return wert
    ziel = wert.split("#")[0].split("?")[0]
    if ziel.endswith(".html") or ziel == "":
        return wert
    return "../" + wert


def pfad_zu(von_rel, nach_rel):
    """Relativer Link von einer Seite zur anderen (beide relativ zu website/)."""
    return os.path.relpath(str(nach_rel), str(Path(von_rel).parent)).replace(os.sep, "/")


def sprachwahl_setzen(soup, rel, aktueller_code, liste, quelle_code):
    """alternate-Links und Umschalter in eine Seite schreiben.

    rel ist der Pfad relativ zur Sprachwurzel (also ohne <code>/)."""
    kopf = soup.head
    if kopf is None:
        return
    for alt in soup.find_all("link", attrs={"rel": "alternate"}):
        alt.decompose()

    def seitenpfad(code):
        return str(rel) if code == quelle_code else f"{code}/{rel}"

    eigener = seitenpfad(aktueller_code)
    i18n_script = soup.find("script", src=re.compile(r"i18n\.js$"))
    for sprache in liste:
        code = sprache["code"]
        if code == aktueller_code:
            continue
        link = soup.new_tag("link", rel="alternate")
        link["hreflang"] = code
        link["href"] = pfad_zu(eigener, seitenpfad(code))
        if i18n_script:
            i18n_script.insert_before(link)
            i18n_script.insert_before("\n")
        else:
            kopf.append(link)

    knopf = soup.find(id="lang-btn")
    wahl = soup.find(id="lang-menu")
    halter = knopf or wahl
    if halter is None:
        return
    andere = [s for s in liste if s["code"] != aktueller_code]

    if len(liste) == 2:
        neu = soup.new_tag("a", id="lang-btn")
        neu["class"] = "btn btn-small btn-icon"
        ziel = andere[0]
        neu["data-lang"] = ziel["code"]
        neu["hreflang"] = ziel["code"]
        neu["lang"] = ziel["code"]
        neu["href"] = pfad_zu(eigener, seitenpfad(ziel["code"]))
        neu["title"] = ziel["native"]
        neu["aria-label"] = ziel["native"]
        neu.string = ziel["code"].upper()
    else:
        neu = soup.new_tag("details", id="lang-menu")
        neu["class"] = "sprach-wahl"
        gipfel = soup.new_tag("summary")
        gipfel["class"] = "btn btn-small btn-icon"
        gipfel.string = aktueller_code.upper()
        neu.append(gipfel)
        menue = soup.new_tag("div")
        menue["class"] = "sprach-menue"
        for ziel in andere:
            a = soup.new_tag("a")
            a["data-lang"] = ziel["code"]
            a["hreflang"] = ziel["code"]
            a["lang"] = ziel["code"]
            a["href"] = pfad_zu(eigener, seitenpfad(ziel["code"]))
            a.string = ziel["native"]
            menue.append(a)
        neu.append(menue)
    halter.replace_with(neu)


def manifest_schreiben(code, ue):
    quelle = json.loads((WEB / "manifest.webmanifest").read_text(encoding="utf-8"))
    ziel = dict(quelle)
    ziel["lang"] = code
    if "description" in ziel:
        ue.aktuelle_seite = "manifest"
        ziel["description"] = ue.text(ziel["description"])
    for feld in ("icons",):
        if feld in ziel:
            ziel[feld] = [dict(i, src="../" + i["src"]) for i in ziel[feld]]
    (WEB / code / "manifest.webmanifest").write_text(
        json.dumps(ziel, ensure_ascii=False, indent=4) + "\n", encoding="utf-8")


def seite_erzeugen(pfad, rel, ue, liste, quelle_code, nur_bericht):
    """Eine Quellseite in die Sprache von ue übersetzen und schreiben."""
    ue.aktuelle_seite = str(rel)
    soup = BeautifulSoup(pfad.read_text(encoding="utf-8"), "html.parser")

    if soup.title and soup.title.string:
        soup.title.string = ue.text(soup.title.string)
    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        meta["content"] = ue.text(meta["content"])
    ue.durchlaufen(soup.body if soup.body else soup)

    if nur_bericht:
        return

    soup.html["lang"] = ue.code
    for tag in soup.find_all(["link", "script", "img", "a", "source"]):
        for attr in ("href", "src"):
            if tag.has_attr(attr):
                tag[attr] = asset_pfad(tag[attr])
    # Eigenes Manifest der Sprache statt des Wurzel-Manifests
    man = soup.find("link", attrs={"rel": "manifest"})
    if man:
        tiefe = len(Path(rel).parts) - 1
        man["href"] = "../" * tiefe + "manifest.webmanifest"
    # Wörterbuch VOR i18n.js laden
    i18n = soup.find("script", src=re.compile(r"js/i18n\.js$"))
    if i18n:
        wb = soup.new_tag("script", src=i18n["src"].replace("i18n.js", f"i18n-{ue.code}.js"))
        i18n.insert_before(wb)
        i18n.insert_before("\n")

    sprachwahl_setzen(soup, rel, ue.code, liste, quelle_code)

    ziel = WEB / ue.code / rel
    ziel.parent.mkdir(parents=True, exist_ok=True)
    ziel.write_text(str(soup), encoding="utf-8")


def js_woerterbuch(code, woerter, muster):
    flach = {q: z for q, z in woerter.items() if "<" not in q}
    js = "/* Generiert von tools/translate.py - nicht von Hand pflegen. */\n"
    js += "window.MechsI18nWords = " + json.dumps(flach, ensure_ascii=False, indent=0) + ";\n"
    js += "window.MechsI18nPatterns = " + json.dumps(muster, ensure_ascii=False) + ";\n"
    (WEB / "js" / f"i18n-{code}.js").write_text(js, encoding="utf-8")
    return len(flach)


JS_ESCAPE = re.compile(r"\\u([0-9a-fA-F]{4})|\\(.)")
JS_STEUER = {"n": "\n", "t": "\t", "r": "\r", "b": "\b", "f": "\f", "v": "\v", "0": "\0"}
# Was sicher keine Anzeige ist. Anzeigetexte, die in jeder Sprache gleich
# bleiben (Abkürzungen wie " · TMM ", Eigennamen), gehören NICHT hierher,
# sondern in identical.json - dann sieht ein Übersetzer sie wenigstens.
JS_KEIN_TEXT = (
    re.compile(r'[<>{}]|="|https?:|\.(?:html|json|js|css|png|jpg|svg|webmanifest)\b'),
    # Pfade, Ids, Selektoren - aber NICHT ein einzelnes großgeschriebenes
    # Wort: "Zurücksetzen" besteht auch nur aus Wortzeichen.
    re.compile(r'^(?![A-ZÄÖÜ][a-zäöüß])[\w./#?&=:*\[\]-]+$'),
    re.compile(r'^[a-z0-9-]+(?:[ ,]+[a-z0-9-]+)*$'),           # CSS-Klassenlisten
    re.compile(r'^(?:var|rgba?|hsla?|url|calc|translate|linear-gradient)\('),   # CSS-Werte
)


def js_entschluesseln(roh):
    def eins(m):
        if m.group(1):
            return chr(int(m.group(1), 16))
        return JS_STEUER.get(m.group(2), m.group(2))
    return JS_ESCAPE.sub(eins, roh)


def js_literale(quelle):
    """Alle Zeichenketten einer JS-Datei, von links nach rechts gelesen.

    Ein eigener Durchlauf, weil Kommentare, reguläre Ausdrücke und
    Zeichenketten einander enthalten können (/["″]/ und "a/b" sind beides
    keine Fehler). Benachbarte Literale werden zusammengezogen: "a " + "b"
    ist zur Laufzeit EIN Text und muss als ganzer Satz im Wörterbuch stehen."""
    i, n, vorher = 0, len(quelle), ""
    offen = None                    # bereits gelesener Anfang einer Verkettung
    while i < n:
        c = quelle[i]
        if c == "/" and quelle.startswith("/*", i):
            ende = quelle.find("*/", i + 2)
            i = n if ende < 0 else ende + 2
            continue
        if c == "/" and quelle.startswith("//", i):
            ende = quelle.find("\n", i)
            i = n if ende < 0 else ende
            continue
        if c == "/" and not (vorher.isalnum() or vorher in "_$)]"):
            j, klasse = i + 1, False
            while j < n:
                d = quelle[j]
                if d == "\\":
                    j += 2
                    continue
                if d == "[":
                    klasse = True
                elif d == "]":
                    klasse = False
                elif d == "\n" or (d == "/" and not klasse):
                    break
                j += 1
            i = j + 1
            while i < n and quelle[i] in "gimsuy":
                i += 1
            vorher = "/"
            continue
        if c in "\"'":
            j, teile = i + 1, []
            while j < n:
                d = quelle[j]
                if d == "\\":
                    teile.append(quelle[j:j + 2])
                    j += 2
                    continue
                if d == c or d == "\n":
                    break
                teile.append(d)
                j += 1
            text = js_entschluesseln("".join(teile))
            offen = text if offen is None else offen + text
            i = j + 1
            # Folgt ein "+" und darauf wieder ein Literal, gehört es dazu.
            k = i
            while k < n and (quelle[k].isspace() or quelle.startswith("//", k)
                             or quelle.startswith("/*", k)):
                if quelle.startswith("//", k):
                    ende = quelle.find("\n", k)
                    k = n if ende < 0 else ende
                elif quelle.startswith("/*", k):
                    ende = quelle.find("*/", k + 2)
                    k = n if ende < 0 else ende + 2
                else:
                    k += 1
            weiter = False
            if k < n and quelle[k] == "+":
                k += 1
                while k < n and quelle[k].isspace():
                    k += 1
                weiter = k < n and quelle[k] in "\"'"
            if weiter:
                i = k
            else:
                yield offen
                offen = None
            vorher = '"'
            continue
        if not c.isspace():
            vorher = c
        i += 1
    if offen is not None:
        yield offen


# Wörter, die im Code stehen, aber nie angezeigt werden. Aktuell nur die
# Stoppliste, mit der factions.js Technikwörter aus den Farbnamen wirft -
# von außen sieht sie wie Anzeige aus.
JS_KEINE_ANZEIGE = {"Edge", "Highlight", "Like", "Panels", "Primer", "Wash",
                    "Drybrush", "Edges", "Zenithal", "Base", "Contrast"}


def js_zeichenketten(quelle):
    """Die Literale, die im Browser sichtbar sein können."""
    for text in js_literale(quelle):
        if text.strip() in JS_KEINE_ANZEIGE:
            continue
        t = text.strip()
        if len(t) < 3 or not HAT_BUCHSTABEN.search(t):
            continue
        if any(p.search(t) for p in JS_KEIN_TEXT):
            continue
        yield text


def js_und_daten_pruefen(ue):
    """Kandidaten aus JS-Literalen und Datendateien in den Bericht."""
    ue.aktuelle_seite = "js"
    for js in sorted((WEB / "js").glob("*.js")):
        # i18n-*.js sind die Wörterbücher selbst; migrate.js enthält nur
        # gespeicherte Altwerte und eine Konsolenmeldung, keine Anzeige.
        if js.name.startswith("i18n") or js.name == "migrate.js":
            continue
        for text in js_zeichenketten(js.read_text(encoding="utf-8")):
            ue.text(text)
    ue.aktuelle_seite = "data"
    d = WEB / "data"
    for name in ("calculator-classic.json", "calculator-alpha-strike.json"):
        r = json.loads((d / name).read_text(encoding="utf-8"))
        ue.text(r.get("above12", ""))
        for k in r["categories"]:
            ue.text(k.get("label", ""))
            ue.text(k.get("note", ""))
            for o in k.get("options", []):
                ue.text(o.get("label", ""))
    c = json.loads((d / "classic-rules.json").read_text(encoding="utf-8"))
    # Namen der Strukturslots (Aktuatoren, Triebwerk, Cockpit ...). Waffen-
    # und Ausrüstungsnamen aus der Datenbank bleiben, wie sie sind - das sind
    # Produktnamen, die auch deutsche Spieler englisch benutzen.
    for xs in c["critSlots"]["defaults"].values():
        for name in xs:
            ue.text(name)
    for h in c["heatThresholds"]:
        ue.text(h.get("effect", ""))
    for k in c["critComponents"]:
        ue.text(k.get("name", ""))
        for s in k.get("levels", []):
            ue.text(s)
    ue.text(c.get("critRoll", ""))
    a = json.loads((d / "as-abilities.json").read_text(encoding="utf-8"))
    for f in a["abilities"]:
        ue.text(f.get("name", ""))
        ue.text(f.get("text", ""))
    # Alpha-Strike-Krit- und Bewegungsschadenstabellen. Sie standen bis zur
    # Prüfung gegen das Buch als Literale in as-battle.js und wurden darüber
    # eingesammelt; als Datei müssen sie hier stehen, sonst fällt eine
    # geänderte Zeile still auf Englisch zurück.
    asr = json.loads((d / "alpha-strike-rules.json").read_text(encoding="utf-8"))
    for kind, zeilen in asr["critTables"].items():
        if kind.startswith("_"):
            continue
        for zeile in zeilen:
            ue.text(zeile[1])
    for zeile in asr["motiveTable"]["rows"]:
        ue.text(zeile[1])
    for stufe in asr["motiveTable"]["levels"]:
        ue.text(stufe)
    fr = json.loads((d / "factions.json").read_text(encoding="utf-8"))
    for k in fr["categories"]:
        ue.text(k.get("name", ""))
        ue.text(k.get("description", ""))
    for f in fr["factions"]:
        for feld in ("subtitle", "description", "subunits", "paintSequence", "tip"):
            ue.text(f.get(feld) or "")
        for farbe in (f.get("colors") or {}).values():
            ue.text(farbe.get("name", ""))
    g = json.loads((d / "glossary.json").read_text(encoding="utf-8"))
    for k in g["categories"].values():
        ue.text(k)
    for e in g["entries"]:
        ue.text(e.get("note") or "")
    # Waffenwerte: die kuratierte Tabelle UND die erzeugten Einheiten - dort
    # entstehen Texte wie "1/missile" oder "7/14/21 (water only)", die im
    # Gefecht angezeigt werden. Meist fängt sie ein Muster ab.
    ue.aktuelle_seite = "waffenwerte"
    for tech, waffen in json.loads((d / "weapons.json").read_text(encoding="utf-8"))["weapons"].items():
        for w in waffen.values():
            ue.text(str(w.get("damage") or ""))
    gesehen = set()
    for pfad in sorted((d / "units").glob("*.json")):
        for w in json.loads(pfad.read_text(encoding="utf-8")).get("weapons", []):
            for feld in ("damage", "range"):
                wert = w.get(feld)
                if isinstance(wert, str) and wert not in gesehen:
                    gesehen.add(wert)
                    ue.text(wert)


def main():
    nur_bericht = "--check" in sys.argv
    liste, quelle = sprachen()
    quelle_code = quelle["code"]
    codes = [s["code"] for s in liste if s["code"] != quelle_code]

    # Weiterleitungs-Stubs (siehe build-redirects.py) sind keine Inhaltsseiten:
    # sie tragen `<meta name="mechs-redirect">` und werden nicht gespiegelt.
    seiten = sorted(p for p in WEB.rglob("*.html")
                    if p.relative_to(WEB).parts[0] not in {s["code"] for s in liste}
                    and "mechs-redirect" not in p.read_text(encoding="utf-8"))
    offen_gesamt = 0

    for code in codes:
        woerter, identisch, muster = paket_laden(code)
        ue = Uebersetzer(code, woerter, identisch, muster)
        for pfad in seiten:
            seite_erzeugen(pfad, pfad.relative_to(WEB), ue, liste, quelle_code, nur_bericht)
        js_und_daten_pruefen(ue)
        if not nur_bericht:
            manifest_schreiben(code, ue)
            n = js_woerterbuch(code, woerter, muster)
            print(f"{code}: {len(seiten)} Seiten -> website/{code}/, Wörterbuch mit {n} Einträgen")
        offen = sum(len(v) for v in ue.fehlend.values())
        offen_gesamt += offen
        (I18N / code).mkdir(parents=True, exist_ok=True)
        (I18N / code / "_missing.json").write_text(
            json.dumps(ue.fehlend, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"  {code}: {len(woerter)} Einträge · offen: {offen}")
        for seite, eintraege in ue.fehlend.items():
            print(f"    {seite}: {len(eintraege)}")

    # Quellseiten bekommen dieselben alternate-Links und denselben Umschalter
    if not nur_bericht:
        for pfad in seiten:
            rel = pfad.relative_to(WEB)
            soup = BeautifulSoup(pfad.read_text(encoding="utf-8"), "html.parser")
            sprachwahl_setzen(soup, rel, quelle_code, liste, quelle_code)
            pfad.write_text(str(soup), encoding="utf-8")
        print(f"{quelle_code} (Quelle): {len(seiten)} Seiten mit Sprachwahl versehen")

    print(f"offen gesamt: {offen_gesamt}")
    sys.exit(1 if (nur_bericht and offen_gesamt) else 0)


if __name__ == "__main__":
    main()
