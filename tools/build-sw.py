#!/usr/bin/env python3
"""Precache-Liste des Service Workers aus dem Dateibaum erzeugen
(docs/history/TASKS-OPENSOURCE.md 2.7).

Bis hierher war die Liste in website/sw.js von Hand gepflegt - bei jeder
neuen Seite und jeder neuen Sprache eine Fehlerquelle. Dieses Skript
schreibt sie aus dem, was wirklich da ist:

  alle *.html (Quelle und Sprachspiegel), ohne Weiterleitungs-Stubs
  js/**/*.js ausser den generierten Woerterbuechern? nein - die auch
  css/*.css, data/*.json (ohne die Einheiten-Shards), img/* (ohne Einheiten-Icons)
  alle manifest.webmanifest

Nicht enthalten: data/units/ und img/units/ - die liegen im eigenen,
dauerhaften Einheiten-Cache und werden bei Bedarf geladen.

Aufruf: python3 tools/build-sw.py [--bump]
  --bump  zaehlt zusaetzlich die VERSION hoch"""
import re
import sys
from pathlib import Path

PROJEKT = Path(__file__).resolve().parent.parent
WEB = PROJEKT / "website"
SW = WEB / "sw.js"
AUSGENOMMEN_ORDNER = {"data/units", "img/units"}


def sammeln():
    dateien = ["./"]
    def rel(p):
        return "./" + str(p.relative_to(WEB)).replace("\\", "/")

    def erlaubt(p):
        s = str(p.relative_to(WEB)).replace("\\", "/")
        if any(s.startswith(o + "/") for o in AUSGENOMMEN_ORDNER):
            return False
        # Weiterleitungs-Stubs (build-redirects.py) gehören nicht in den
        # Precache: sie sind Wegweiser für alte Adressen, kein Inhalt, und
        # offline hilft ein Wegweiser auf eine ungecachte Seite niemandem.
        if p.suffix == ".html" and "mechs-redirect" in p.read_text(encoding="utf-8"):
            return False
        return True

    for muster in ("**/*.html", "js/**/*.js", "css/*.css", "**/manifest.webmanifest"):
        for p in sorted(WEB.glob(muster)):
            if p.is_file() and erlaubt(p):
                dateien.append(rel(p))
    for ordner in ("data",):
        for p in sorted((WEB / ordner).glob("*.json")) if (WEB / ordner).is_dir() else []:
            dateien.append(rel(p))
    for p in sorted(WEB.glob("img/*")):
        if p.is_file() and p.suffix in (".svg", ".png"):
            dateien.append(rel(p))
    # Reihenfolge stabil und ohne Doppelte
    gesehen, ergebnis = set(), []
    for d in dateien:
        if d not in gesehen:
            gesehen.add(d)
            ergebnis.append(d)
    return ergebnis


def main():
    text = SW.read_text(encoding="utf-8")
    dateien = sammeln()
    block = "var FILES = [\n" + "".join(f'    "{d}",\n' for d in dateien).rstrip(",\n") + "\n];"
    neu, n = re.subn(r"var FILES = \[.*?\];", block.replace("\\", "\\\\"), text, count=1, flags=re.S)
    if not n:
        sys.exit("Precache-Liste in sw.js nicht gefunden")
    if "--bump" in sys.argv:
        m = re.search(r'var VERSION = "mechs-v(\d+)";', neu)
        if m:
            neu = neu.replace(m.group(0), f'var VERSION = "mechs-v{int(m.group(1)) + 1}";', 1)
            print("VERSION ->", f"mechs-v{int(m.group(1)) + 1}")
    SW.write_text(neu, encoding="utf-8")
    print(f"Precache: {len(dateien)} Einträge")


if __name__ == "__main__":
    main()
