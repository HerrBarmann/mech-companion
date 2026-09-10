#!/usr/bin/env python3
"""Weiterleitungs-Stubs für die alten Adressen (docs/history/TASKS-OPENSOURCE.md 3.4).

Die Seiten haben in Phase 3 englische Namen bekommen, und die Sprachen haben
in Phase 2 die Plätze getauscht. Wer einen alten Link geteilt oder gesetzt hat,
soll trotzdem ankommen - auf einem reinen FTP-Webspace gibt es keine
Server-Regeln, also übernimmt das eine kleine HTML-Datei je alter Adresse.

Drei Herkünfte, jede mit ihrem eigenen Ziel:

    /<deutscher Name>        die deutsche Seite von früher  ->  /de/<neuer Name>
    /en/<deutscher Name>     der englische Spiegel          ->  /<neuer Name>
    /de/<deutscher Name>     nach der Sprachumkehr          ->  /de/<neuer Name>

Die Sprache bleibt also, wo sie war. Adressen, deren Name sich nicht geändert
hat, bekommen keinen Stub - dort liegt die echte Seite (und wer Deutsch
gewohnt ist, wird von i18n.js anhand der gemerkten Sprache weitergeschickt).

Der Stub trägt `<meta name="mechs-redirect">`; daran erkennen ihn der
Übersetzungsgenerator, der Precache-Bauer und die Prüfung und lassen ihn in
Ruhe. Query und Fragment reicht er weiter - Teil-Links (`?mech=`, `?lance=`,
das alte `?lanze=`) überleben den Umzug.

    python3 tools/build-redirects.py [--check]
"""
import json
import sys
from pathlib import Path

PROJEKT = Path(__file__).resolve().parent.parent
WEB = PROJEKT / "website"
KARTE = PROJEKT / "tools/opensource/rename-map.json"

VORLAGE = """<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1" name="viewport"/>
<meta content="noindex, follow" name="robots"/>
<meta content="{ziel}" name="mechs-redirect"/>
<title>{titel}</title>
<link href="{ziel}" rel="canonical"/>
<!-- Das Skript steht VOR dem Refresh und gewinnt damit das Rennen: nur es
     nimmt Query und Fragment mit (Teil-Links!). Der Refresh ist der Weg für
     abgeschaltetes JavaScript und wartet deshalb eine Sekunde. -->
<script>location.replace("{ziel}" + location.search + location.hash);</script>
<meta content="1; url={ziel}" http-equiv="refresh"/>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 2rem;">
<p>{text_de} <a href="{ziel}">{ziel}</a></p>
<p>{text_en}</p>
</body>
</html>
"""

TEXT = {
    "de": ("Diese Seite ist umgezogen:", "This page has moved.", "Umgezogen"),
    "en": ("Diese Seite ist umgezogen:", "This page has moved:", "Moved"),
}


def seiten():
    return {a: b for a, b in json.loads(KARTE.read_text(encoding="utf-8"))["pages"].items()
            if not a.startswith("_")}


def relativ(von_rel, nach_rel):
    """Relativer Link von einer Adresse zur anderen (beide relativ zu website/)."""
    von = von_rel.split("/")[:-1]
    nach = nach_rel.split("/")
    while von and nach[:-1] and von[0] == nach[0]:
        von.pop(0)
        nach.pop(0)
    return "/".join([".."] * len(von) + nach)


def ist_echte_seite(rel):
    """Liegt dort eine Inhaltsseite - oder nichts bzw. eine Weiterleitung?"""
    p = WEB / rel
    return p.exists() and "mechs-redirect" not in p.read_text(encoding="utf-8")


def stubs():
    """{Pfad relativ zu website/: (Ziel relativ dazu, Sprache)}"""
    ergebnis = {}
    for alt, neu in seiten().items():
        # 1. deutsche Wurzel von früher -> die deutsche Seite
        if alt != "de/" + neu and not ist_echte_seite(alt):
            ergebnis[alt] = (relativ(alt, "de/" + neu), "de")
        # 2. der alte englische Spiegel -> die Wurzel
        ergebnis["en/" + alt] = (relativ("en/" + alt, neu), "en")
        # 3. deutsche Adressen mit altem Namen
        if alt != neu:
            ergebnis["de/" + alt] = (relativ("de/" + alt, "de/" + neu), "de")
    return ergebnis


def main():
    nur_pruefen = "--check" in sys.argv
    plan = stubs()
    geschrieben, gleich = 0, 0
    for rel, (ziel, lang) in sorted(plan.items()):
        text_de, text_en, titel = TEXT[lang]
        inhalt = VORLAGE.format(lang=lang, ziel=ziel, titel=titel,
                                text_de=text_de, text_en=text_en)
        pfad = WEB / rel
        if pfad.exists() and "mechs-redirect" not in pfad.read_text(encoding="utf-8"):
            print(f"ÜBERSPRUNGEN (echte Seite): {rel}")
            continue
        if pfad.exists() and pfad.read_text(encoding="utf-8") == inhalt:
            gleich += 1
            continue
        if nur_pruefen:
            print(f"fehlt oder veraltet: {rel} -> {ziel}")
            geschrieben += 1
            continue
        pfad.parent.mkdir(parents=True, exist_ok=True)
        pfad.write_text(inhalt, encoding="utf-8")
        geschrieben += 1
    wort = "wären zu schreiben" if nur_pruefen else "geschrieben"
    print(f"Weiterleitungen: {geschrieben} {wort}, {gleich} unverändert, {len(plan)} gesamt")
    return 1 if (nur_pruefen and geschrieben) else 0


if __name__ == "__main__":
    raise SystemExit(main())
