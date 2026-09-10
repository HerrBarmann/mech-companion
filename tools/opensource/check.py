#!/usr/bin/env python3
"""Projektprüfung für Entwicklung und CI (docs/history/TASKS-OPENSOURCE.md, Phase 1.6 / 4.3).

Prüft, ohne etwas zu ändern:
  1. alle JSON-Dateien unter website/data sind gültig
  2. Service-Worker-Precache: jeder Eintrag existiert, jede HTML/JS/CSS-Datei
     unter website/ hat einen Eintrag
  3. Übersetzungen vollständig (ruft den Generator im Prüfmodus auf)
  4. JavaScript-Syntax (node --check), falls node vorhanden
  5. keine privaten Muster im Repo (Datei site/private-patterns.txt, eine
     Regex je Zeile; fehlt die Datei, wird der Schritt übersprungen)
  6. Platzhalter: Impressum/Datenschutz im Repo tragen noch {{site.…}}
     (also keine echten Betreiberdaten), und website/ enthält kein dist/

Aufruf: python3 <tools>/opensource/check.py [--root PFAD]
Exit-Code 1 bei mindestens einem Fehler."""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

HIER = Path(__file__).resolve().parent
ROOT = HIER.parent.parent
if "--root" in sys.argv:
    ROOT = Path(sys.argv[sys.argv.index("--root") + 1]).resolve()
WEB = ROOT / "website"
TOOLS = HIER.parent
fehler = []


def melde(ok, text):
    print(("  ok  " if ok else "  FEHLER  ") + text)
    if not ok:
        fehler.append(text)


def json_pruefen():
    print("[1] JSON")
    ordner = [d for d in (WEB / "data",) if d.is_dir()]
    dateien = [p for d in ordner for p in d.glob("*.json")]
    for p in dateien:
        try:
            json.loads(p.read_text(encoding="utf-8"))
            melde(True, p.name)
        except Exception as e:
            melde(False, f"{p.name}: {e}")


def precache_pruefen():
    print("[2] Service-Worker-Precache")
    sw = (WEB / "sw.js").read_text(encoding="utf-8")
    m = re.search(r"var (?:DATEIEN|FILES) = \[(.*?)\];", sw, re.S)
    if not m:
        melde(False, "Precache-Liste in sw.js nicht gefunden")
        return
    eintraege = re.findall(r'"\./([^"]*)"', m.group(1))
    for e in eintraege:
        if e and not (WEB / e).exists():
            melde(False, f"Precache-Eintrag fehlt auf der Platte: {e}")
    vorhanden = set(eintraege)
    stubs = 0
    for muster in ("**/*.html", "js/**/*.js", "css/*.css"):
        for p in WEB.glob(muster):
            rel = str(p.relative_to(WEB))
            # Weiterleitungs-Stubs stehen absichtlich nicht im Precache.
            if p.suffix == ".html" and "mechs-redirect" in p.read_text(encoding="utf-8"):
                stubs += 1
                if rel in vorhanden:
                    melde(False, f"Weiterleitung gehört nicht in den Precache: {rel}")
                continue
            if rel not in vorhanden and "vendor" not in rel:
                melde(False, f"nicht im Precache: {rel}")
    for m in ("./data/units/", "./img/units/"):
        treffer = [e for e in eintraege if e.startswith(m.lstrip("./"))]
        if treffer:
            melde(False, f"Einheiten-Daten gehören NICHT in den Precache: {len(treffer)} Einträge unter {m}")
    melde(True, f"{len(eintraege)} Einträge geprüft, {stubs} Weiterleitungen ausgenommen")


def i18n_pruefen():
    print("[3] Übersetzungen")
    for name, arg in (("translate.py", "--check"),):
        skript = TOOLS / name
        if skript.exists():
            lauf = subprocess.run([sys.executable, str(skript), arg], capture_output=True, text=True)
            offen = re.search(r"offen:\s*(\d+)|missing:\s*(\d+)", lauf.stdout + lauf.stderr)
            zahl = int(next(g for g in (offen.groups() if offen else ()) if g) if offen else -1)
            melde(zahl == 0, f"{name}: {zahl if zahl >= 0 else 'Ausgabe nicht lesbar'} offen")
            return
    melde(False, "kein Übersetzungsgenerator gefunden")


def js_pruefen():
    print("[4] JavaScript-Syntax")
    if not shutil.which("node"):
        print("  übersprungen (kein node)")
        return
    for p in sorted((WEB / "js").rglob("*.js")):
        lauf = subprocess.run(["node", "--check", str(p)], capture_output=True, text=True)
        melde(lauf.returncode == 0, f"{p.relative_to(WEB)}" + ("" if lauf.returncode == 0 else ": " + lauf.stderr.strip()[:200]))


def private_muster():
    print("[5] Private Muster")
    datei = ROOT / "site" / "private-patterns.txt"
    if not datei.exists():
        print("  übersprungen (site/private-patterns.txt fehlt)")
        return
    zeilen = [z.strip() for z in datei.read_text(encoding="utf-8").splitlines() if z.strip() and not z.startswith("#")]
    muster = [z for z in zeilen if not z.startswith("!")]
    ausnahmen = [z[1:] for z in zeilen if z.startswith("!")]
    treffer = []
    for p in list(ROOT.rglob("*")):
        if not p.is_file():
            continue
        rel = p.relative_to(ROOT)
        if rel.parts[0] in ("site", "dist", ".git", "mm-data", "node_modules") or p.suffix in (".png", ".jpg", ".ico", ".pdf"):
            continue
        if any(str(rel).startswith(a) for a in ausnahmen):
            continue
        if p.name.startswith("mekbay-"):
            continue
        try:
            text = p.read_text(encoding="utf-8")
        except Exception:
            continue
        for mu in muster:
            if re.search(mu, text):
                treffer.append(f"{rel}: /{mu}/")
                break
    for t in treffer:
        melde(False, t)
    if not treffer:
        melde(True, f"{len(muster)} Muster, keine Treffer ({len(ausnahmen)} Ausnahmen)")


def platzhalter_pruefen():
    print("[6] Platzhalter")
    # Nur die echten Seiten: unter den alten Namen liegt seit 3.4 eine
    # Weiterleitung, und die trägt naturgemäß keine Platzhalter.
    for name in ("imprint.html", "privacy.html"):
        p = WEB / name
        if p.exists():
            melde("{{site." in p.read_text(encoding="utf-8"), f"{name} enthält Platzhalter")
    melde(not (WEB / "dist").exists(), "kein dist/ innerhalb von website/")


json_pruefen()
precache_pruefen()
i18n_pruefen()
js_pruefen()
private_muster()
platzhalter_pruefen()
print()
print("FEHLER: " + str(len(fehler)) if fehler else "Alles in Ordnung.")
sys.exit(1 if fehler else 0)
