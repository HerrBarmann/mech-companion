#!/usr/bin/env python3
"""Alpha-Strike-Bodeneinheiten außer ’Mechs (Fahrzeuge, Unterstützungsfahrzeuge,
VTOLs, Infanterie, Battle Armor, ProtoMechs) aus MekBays Einheitsdatenbank in
unsere Datenform bringen (CONCEPT §10, F2 – Alpha Strike zuerst).

Erzeugt:
  website/data/units/<id>.json         ein Shard je Einheit (gleiches Verzeichnis
                                        wie die ’Mechs: MUL-Ids sind über alle
                                        Einheitstypen eindeutig, der Service Worker
                                        cacht das Verzeichnis on-demand)
  website/data/units-index.json    kompakter Suchindex (wird offline gecacht)
  website/img/units/<ordner>_<datei>    Top-Down-Icons aus mm-data (Ordnername als
                                        Präfix, damit nichts mit ’Mech-Icons kollidiert)

Aufruf:
  python3 tools/convert-as-units.py /pfad/zu/mm-data [mekbay-units.json] [--alle]

Quelle: https://db.mekbay.com/units.json (gzip; Ablage als mekbay-units.json im
Projektordner). Standard: nur kanonische Einheiten (--alle nimmt auch die
inoffiziellen MegaMek-Eigenbauten mit). Die Werte sind aus MegaMek-Daten generiert
und stehen unter CC BY-NC-SA 4.0 (siehe LIZENZEN.md). Classic-Werte gibt es für
diese Einheiten (noch) nicht – nur der Alpha-Strike-Block."""
import json
import re
import sys
import unicodedata
from collections import Counter
from pathlib import Path

PROJEKT = Path(__file__).resolve().parent.parent
LIZENZ = ("Abgeleitet aus MegaMek/MekBay (github.com/MegaMek/mekbay, db.mekbay.com), "
          "MegaMek Data (C) The MegaMek Team, CC BY-NC-SA 4.0. MechWarrior, BattleMech, "
          "'Mech und BattleTech sind eingetragene Marken von The Topps Company, Inc.")
TYPEN = {"Tank", "VTOL", "Infantry", "ProtoMek"}     # Bodeneinheiten; Luft/Raum später
TECH_KURZ = {"Inner Sphere": "IS", "Clan": "Clan"}


def slug(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", text.lower())).strip("-")


def name_von(u):
    """MekBay trennt Chassis und Modell; BA-Modelle kommen als "[David](Sqd4)"."""
    modell = re.sub(r"\]\(", "] (", (u.get("model") or "").strip())
    name = (u.get("chassis") or "").strip()
    if modell:
        name += " " + modell
    return re.sub(r"\s+", " ", name).strip()


def as_block(a):
    dmg = a.get("dmg", {})
    return {
        "pv": a.get("PV"), "sz": a.get("SZ"), "mv": a.get("MV", ""),
        "tmm": a.get("TMM"), "ov": a.get("OV", 0),
        "armor": a.get("Arm", 0), "structure": a.get("Str", 0),
        "s": str(dmg.get("dmgS", "")), "m": str(dmg.get("dmgM", "")), "l": str(dmg.get("dmgL", "")),
        "special": ", ".join(a.get("specials", [])),
    }


def main():
    argumente = [a for a in sys.argv[1:] if not a.startswith("--")]
    alle = "--alle" in sys.argv
    if not argumente:
        sys.exit("Aufruf: convert-as-units.py /pfad/zu/mm-data [mekbay-units.json] [--alle]")
    mm_root = Path(argumente[0])
    bilder = mm_root / "data/images/units"
    quelle = Path(argumente[1]) if len(argumente) > 1 else PROJEKT / "mekbay-units.json"
    daten = json.loads(quelle.read_text())
    einheiten = [u for u in daten.get("units", [])
                 if u.get("type") in TYPEN and u.get("as")
                 and (u["as"].get("Arm") or u["as"].get("Str"))
                 and (alle or u.get("canon"))]
    print(f"MekBay: {len(daten.get('units', []))} Einheiten, davon {len(einheiten)} Bodeneinheiten außer ’Mechs")

    ziel = PROJEKT / "website/data/units"
    ziel.mkdir(exist_ok=True)
    icon_ziel = PROJEKT / "website/img/units"
    icon_ziel.mkdir(exist_ok=True)
    # Nur die Ids der ’MECH-Shards, nicht einfach alles im Ordner: sonst
    # hielte ein zweiter Lauf die eigenen Dateien vom letzten Mal für fremde
    # Kollisionen und schriebe fast nichts mehr.
    mech_index = PROJEKT / "website/data/units-index.json"
    mech_ids = set()
    if mech_index.exists():
        mech_ids = {z[0] for z in json.loads(mech_index.read_text(encoding="utf-8"))["mechs"]}

    # MUL-Id nur, wenn sie positiv und innerhalb dieser Liste eindeutig ist –
    # sonst ein Namens-Slug (Doppelte MekBay-Ids kommen bei Squad-Varianten vor).
    id_zaehler = Counter(u.get("id", 0) for u in einheiten)
    vergeben = set()
    index, icons_kopiert, ohne_icon, kollisionen = [], set(), 0, 0
    typen = Counter()
    for u in sorted(einheiten, key=lambda x: name_von(x).lower()):
        name = name_von(u)
        mul = u.get("id", 0)
        if mul and mul > 0 and id_zaehler[mul] == 1:
            eid = f"mul-{mul}"
        else:
            eid = "slug-" + slug(name)
        basis, n = eid, 2
        while eid in vergeben:
            eid = f"{basis}-{n}"
            n += 1
        if eid in mech_ids and eid.startswith("mul-"):
            # Derselbe MUL-Eintrag existiert schon als ’Mech-Shard (sollte nicht vorkommen).
            kollisionen += 1
            continue
        vergeben.add(eid)

        a = u["as"]
        typ = a.get("TP") or "CV"
        typen[typ] += 1
        eintrag = {
            "_license": LIZENZ,
            "id": eid,
            "version": 1,
            "name": name,
            "type": typ,                                 # CV, SV, BA, CI, PM
            "moveType": u.get("moveType") or "",         # Tracked, Hover, VTOL, Jump, Leg …
            "tonnage": u.get("tons"),
            "techBase": TECH_KURZ.get(u.get("techBase", ""), "Mix"),
            "era": u.get("year") or 0,
            "role": "" if u.get("role") in (None, "None") else u.get("role"),
            "bv": u.get("bv") or None,
            "source": "MekBay/MegaMek",
            "as": as_block(a),
        }
        icon = u.get("icon") or ""
        if icon:
            von = bilder / icon
            datei = icon.replace(" ", "-").replace("/", "_")
            if von.exists():
                nach = icon_ziel / datei
                if datei not in icons_kopiert and not nach.exists():
                    nach.write_bytes(von.read_bytes())
                icons_kopiert.add(datei)
                eintrag["icon"] = "img/units/" + datei
            else:
                ohne_icon += 1
        (ziel / f"{eid}.json").write_text(json.dumps(eintrag, ensure_ascii=False, separators=(",", ":")))
        index.append([eid, name, typ, eintrag["tonnage"], eintrag["techBase"], eintrag["era"],
                      eintrag["role"], eintrag["as"]["pv"]])

    index_datei = PROJEKT / "website/data/units-index.json"
    index_datei.write_text(json.dumps({
        "_license": LIZENZ,
        "version": 1,
        "fields": ["id", "name", "type", "tonnage", "tech", "era", "role", "pv"],
        "units": index,
    }, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(index)} Einheiten -> {ziel} ({dict(typen)})")
    print(f"Index: {index_datei} ({index_datei.stat().st_size // 1024} KB)")
    print(f"Icons: {len(icons_kopiert)} Dateien, {ohne_icon} Einheiten ohne Icon, {kollisionen} Kollisionen übersprungen")


if __name__ == "__main__":
    main()
