#!/usr/bin/env python3
"""Deploy-Build: Vorlagen aus website/ + Konfiguration (+ privates Overlay) -> dist/

Das Repository enthält die App mit Platzhaltern statt Betreiberdaten und mit
einem neutralen Erscheinungsbild. Gebaut wird immer über dieses Skript - auch
für die öffentliche Demo, damit es nur einen Weg gibt und nie Platzhalter im
Browser landen.

Konfiguration (das erste vorhandene gewinnt):
  site/site.json        private Instanz, gitignored
  site.default.json     Standard des Repositories

Optional darüber:
  site/overlay/**       Dateien, die 1:1 über website/ gelegt werden
                        (Logo, Icons, css/tokens.local.css, eigene Seiten)

Ablauf: website/ nach dist/ abgleichen (nur geänderte Dateien, verwaiste
werden entfernt), Overlay darüberlegen, dann in allen Textdateien
Platzhalter {{site.pfad.zum.wert}} ersetzen. Bleibt ein Platzhalter übrig,
bricht der Build ab.

Aufruf: python3 <tools>/opensource/build.py [--site PFAD] [--out PFAD] [--clean]
Danach dist/ hochladen (deploy.sh spiegelt dist/)."""
import json
import os
import re
import shutil
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
ROOT = HIER.parent.parent
WEB = ROOT / "website"
SITE = ROOT / "site"
OUT = ROOT / "dist"
if "--site" in sys.argv:
    SITE = Path(sys.argv[sys.argv.index("--site") + 1]).resolve()
if "--out" in sys.argv:
    OUT = Path(sys.argv[sys.argv.index("--out") + 1]).resolve()

TEXT = {".html", ".webmanifest", ".js", ".css", ".json", ".txt", ".xml", ".svg", ".md"}
PLATZHALTER = re.compile(r"\{\{site\.([a-zA-Z0-9_.]+)\}\}")
# Große, nie personalisierte Bäume: nur abgleichen, nicht nach Platzhaltern durchsuchen.
MASSENDATEN = ("data/units", "img/units")


def konfig_laden():
    for kandidat in (SITE / "site.json", ROOT / "site.default.json"):
        if kandidat.exists():
            return json.loads(kandidat.read_text(encoding="utf-8")), kandidat
    sys.exit("Weder site/site.json noch site.default.json gefunden.")


def wert(konfig, pfad):
    knoten = konfig
    for teil in pfad.split("."):
        if not isinstance(knoten, dict) or teil not in knoten:
            return None
        knoten = knoten[teil]
    return knoten


def abgleichen(quelle, ziel):
    """Wie rsync: nur kopieren, was fehlt oder sich geändert hat."""
    kopiert = 0
    gewollt = set()
    for pfad in quelle.rglob("*"):
        if pfad.name == ".DS_Store":
            continue
        rel = pfad.relative_to(quelle)
        gewollt.add(rel)
        z = ziel / rel
        if pfad.is_dir():
            z.mkdir(parents=True, exist_ok=True)
            continue
        q = pfad.stat()
        if z.exists():
            s = z.stat()
            if s.st_size == q.st_size and int(s.st_mtime) >= int(q.st_mtime):
                continue
        z.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(pfad, z)
        kopiert += 1
    return kopiert, gewollt


def verwaiste_entfernen(ziel, gewollt):
    entfernt = 0
    for pfad in sorted(ziel.rglob("*"), key=lambda p: -len(p.parts)):
        rel = pfad.relative_to(ziel)
        if rel in gewollt:
            continue
        if pfad.is_file():
            pfad.unlink(); entfernt += 1
        elif pfad.is_dir() and not any(pfad.iterdir()):
            pfad.rmdir()
    return entfernt


def main():
    konfig, quelle = konfig_laden()
    if "--clean" in sys.argv and OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(exist_ok=True)

    kopiert, gewollt = abgleichen(WEB, OUT)
    overlay = SITE / "overlay"
    n_overlay = 0
    if overlay.is_dir():
        for p in overlay.rglob("*"):
            if p.is_file() and p.name != ".DS_Store":
                rel = p.relative_to(overlay)
                gewollt.add(rel)
                ziel = OUT / rel
                ziel.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, ziel)
                n_overlay += 1
    entfernt = verwaiste_entfernen(OUT, gewollt)

    offen = []
    n_ersetzt = 0
    for p in OUT.rglob("*"):
        if not p.is_file() or p.suffix not in TEXT:
            continue
        rel = str(p.relative_to(OUT))
        if any(rel.startswith(m) for m in MASSENDATEN):
            continue
        text = p.read_text(encoding="utf-8")
        if "{{site." not in text:
            continue

        def ersetze(m):
            v = wert(konfig, m.group(1))
            if v is None:
                offen.append(f"{rel}: {m.group(0)}")
                return m.group(0)
            return str(v)

        p.write_text(PLATZHALTER.sub(ersetze, text), encoding="utf-8")
        n_ersetzt += 1

    dateien = sum(1 for p in OUT.rglob("*") if p.is_file())
    print(f"Konfiguration: {quelle.relative_to(ROOT)} ({konfig.get('name')})")
    print(f"dist/: {dateien} Dateien · kopiert {kopiert} · Overlay {n_overlay} · entfernt {entfernt} · Platzhalter in {n_ersetzt} Dateien gefüllt")
    if offen:
        print("UNGEFÜLLTE PLATZHALTER:")
        for o in sorted(set(offen)):
            print("  " + o)
        sys.exit(1)


if __name__ == "__main__":
    main()
