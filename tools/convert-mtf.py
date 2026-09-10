#!/usr/bin/env python3
"""MTF-Konverter: MegaMek mm-data -> Hangar-Format dieses Projekts.

Liest alle BattleMech-Dateien (Config: Biped / Biped OmniMek) aus einem
mm-data-Checkout und erzeugt:

  website/data/units-index.json   kompakter Suchindex (wird offline gecacht)
  website/data/units/<id>.json    vollstaendige Einheit je Variante (on-demand)

Quelldaten: https://github.com/MegaMek/mm-data (CC BY-NC-SA 4.0).
Laeuft LOKAL, nie auf dem Server. Aufruf:

  python3 tools/convert-mtf.py /pfad/zu/mm-data [mekbay-units.json]

Optionaler zweiter Parameter: MekBays generierte Einheitsdatenbank
(curl -sH "Accept-Encoding: gzip" https://db.mekbay.com/units.json | gunzip
 > mekbay-units.json). Sie reichert jeden Mech ueber die UUID mit BV und den
Alpha-Strike-Kartenwerten an (as-Block) - abgeleitet aus denselben
CC-BY-NC-SA-Quelldaten, siehe LIZENZEN.md.

Struktur-Tabelle und Waffenwerte kommen aus website/data/classic-rules.json
bzw. waffen.json - eine Quelle, keine Duplikate.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

PROJEKT = Path(__file__).resolve().parent.parent
LIZENZ = ("Abgeleitet aus MegaMek mm-data (github.com/MegaMek/mm-data), "
          "MegaMek Data (C) The MegaMek Team, CC BY-NC-SA 4.0. "
          "MechWarrior, BattleMech, 'Mech and BattleTech are registered "
          "trademarks of The Topps Company, Inc.")

ARMOR_ZU_ZONE = {
    "HD": "head", "CT": "ct", "RTC": "ctr",
    "RT": "rt", "RTR": "rtr", "LT": "lt", "RTL": "ltr",
    "RA": "ra", "LA": "la", "RL": "rl", "LL": "ll",
}
ORT_ZU_KURZ = {
    "Head": "KO", "Center Torso": "ZT", "Right Torso": "RT", "Left Torso": "LT",
    "Right Arm": "RA", "Left Arm": "LA", "Right Leg": "RB", "Left Leg": "LB",
}
BLOCK_ZU_ZONE = {
    "Head": ("head", 6), "Center Torso": ("ct", 12),
    "Right Torso": ("rt", 12), "Left Torso": ("lt", 12),
    "Right Arm": ("ra", 12), "Left Arm": ("la", 12),
    "Right Leg": ("rb", 6), "Left Leg": ("lb", 6),
}
# mm-data ist englisch; wir vereinheitlichen nur Schreibweisen.
SLOT_NORM = {"-Empty-": ""}
TECH_KURZ = {"Inner Sphere": "IS", "Clan": "Clan"}


def lade_werte():
    cw = json.loads((PROJEKT / "website/data/classic-rules.json").read_text())
    wf = json.loads((PROJEKT / "website/data/weapons.json").read_text())
    return cw["structure"], wf["weapons"]


def lade_mekset(mm_root):
    """Icon-Zuordnung aus mekset.txt: exact "Chassis Modell" bzw. chassis "Chassis"."""
    exakt, chassis = {}, {}
    pfad = mm_root / "data/images/units/mekset.txt"
    if not pfad.exists():
        return exakt, chassis
    for zeile in pfad.read_text(errors="replace").splitlines():
        m = re.match(r'\s*(exact|chassis)\s+"([^"]+)"\s+"([^"]+)"', zeile)
        if m:
            (exakt if m.group(1) == "exact" else chassis)[m.group(2).lower()] = m.group(3)
    return exakt, chassis


def icon_fuer(chassis_roh, modell, exakt, chassis_map):
    voll = (chassis_roh + " " + modell).strip().lower()
    return exakt.get(voll) or chassis_map.get(chassis_roh.lower())


def slug(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def norm_munition(text):
    """'Clan Ammo LRM-20 (OMNIPOD)' -> ('LRM 20', faktor 1.0)"""
    t = re.sub(r"\((?:OMNIPOD|ARMORED)\)", "", text, flags=re.I).strip()
    faktor = 0.5 if re.search(r"-\s*Half", t, re.I) else 1.0
    t = re.sub(r"-\s*(Half|Full)", "", t, flags=re.I)
    t = re.sub(r"^(IS|Clan|CL)\s+", "", t, flags=re.I)
    t = re.sub(r"\bAmmo\b", "", t, flags=re.I).strip(" -")
    t = re.sub(r"\bLRM-(\d+)", r"LRM \1", t)
    t = re.sub(r"\bSRM-(\d+)", r"SRM \1", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t, faktor


def slot_normieren(roh):
    t = re.sub(r"\((?:OMNIPOD|ARMORED)\)", "", roh).strip()
    heck = "(R)" in t
    t = t.replace("(R)", "").strip()
    if t in SLOT_NORM:
        return SLOT_NORM[t]
    # Alte interne Namen erst entzerren ("CLDoubleHeatSink" -> "Double Heat
    # Sink"), DANN Schluesselwoerter pruefen - sonst rutschen kompakte
    # Schreibweisen an der Uebersetzung vorbei.
    t = re.sub(r"^(IS|CL)(?=[A-Z])", "", t)
    if " " not in t:
        t = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", t)
        t = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", t)
        t = re.sub(r"(?<=[A-Za-z])(?=\d)", " ", t)
    tl = t.lower()
    # Nur ganze Woerter: "Re-engineered Laser" enthaelt "engine", ist aber
    # eine Waffe und kein Triebwerksslot.
    if re.search(r"\bengine\b", tl):
        return "Engine"
    if "heat sink" in tl:
        return "Heat Sink"
    if "jump jet" in tl:
        return "Jump Jet"
    if re.search(r"\bammo\b", tl):
        name, _ = norm_munition(t)
        return "Ammo (" + name + ")" if name else "Ammo"
    return t + (" (Rear)" if heck else "")


def lade_mekbay_waffen(pfad):
    """MekBay-Gerätedatenbank (equipment2.json, MegaMek-abgeleitet, CC BY-NC-SA)
    -> Waffeneinträge im waffen.json-Format {IS:{name:eintrag}, Clan:{...}}.
    Füllt nur Lücken; das kuratierte waffen.json behält Vorrang."""
    eq = json.loads(Path(pfad).read_text())["equipment"]

    # Munition indexieren: (ammoType, rackSize, tech) -> (Schuss/Tonne, Schaden/Schuss)
    munition = {}
    for e in eq.values():
        a = e.get("ammo")
        if e.get("type") != "ammo" or not a or not a.get("shots"):
            continue
        standard = "M_STANDARD" in (a.get("munitionType") or ["M_STANDARD"])
        tech = e.get("tech", {}).get("base", "All")
        schluessel = (a.get("type"), a.get("rackSize"), tech)
        if standard or schluessel not in munition:
            munition[schluessel] = (a["shots"], a.get("damagePerShot"))

    def mun_fuer(w, tech):
        for t in (tech, "All", "IS", "Clan"):
            treffer = munition.get((w.get("ammoType"), w.get("rackSize"), t))
            if treffer:
                return treffer
        return (None, None)

    ergebnis = {"IS": {}, "Clan": {}}
    aufschub = []   # Nicht-Mech-Waffen nur nehmen, wenn der Name sonst fehlt
    for e in eq.values():
        w = e.get("weapon")
        if e.get("type") != "weapon" or not w:
            continue
        tech = e.get("tech", {}).get("base", "All")
        ziele = ["IS", "Clan"] if tech == "All" else ([tech] if tech in ("IS", "Clan") else ["IS", "Clan"])
        r = w.get("ranges")
        wasser = False
        if not r and w.get("wRanges"):
            r = w["wRanges"]          # Torpedos: Reichweite gilt nur im Wasser
            wasser = True
        dmg = w.get("damage")
        schuss, je_schuss = mun_fuer(w, tech)

        # MML schaltet zwischen LRM- und SRM-Profil - LRM-Reichweite anzeigen
        if w.get("atClass") == "MML" and not r:
            r = [7, 14, 21]
            w = dict(w, minRange=6)
            dmg = "cluster"
            schaden = "1/missile (LRM) · 2/missile (SRM)"
        elif dmg == "cluster":
            rakete = (w.get("atClass") in ("LRM", "SRM", "MML", "ATM", "MRM", "ROCKET_LAUNCHER")
                      or "TORPEDO" in (w.get("ammoType") or ""))
            if je_schuss and rakete:
                schaden = f"{je_schuss}/missile"
            elif je_schuss:
                schaden = f"Cluster {w.get('rackSize')}×{je_schuss}"
            else:
                schaden = f"Cluster {w.get('rackSize') or '?'}"
        elif isinstance(dmg, list):
            schaden = "/".join(str(int(x)) for x in dmg)
        elif dmg == "artillery":
            schaden = "Artillery (see rules)"
        elif dmg in ("variable", "special"):
            schaden = "see rules"
        elif isinstance(dmg, (int, float)):
            schaden = int(dmg) if float(dmg).is_integer() else dmg
        else:
            schaden = ""
        if not r or len(r) < 3:
            # Nahbereichswaffen ohne Reichweitenband (B-Pods u. ae.)
            if not isinstance(dmg, (int, float)):
                continue
            r = [0, 0, 0]

        reichweite = {"short": r[0], "medium": r[1], "long": r[2]}
        if wasser:
            reichweite["waterOnly"] = True
        if w.get("minRange"):
            reichweite["min"] = w["minRange"]
        heat = w.get("heat")
        eintrag = {
            "damage": schaden,
            "heat": heat if isinstance(heat, (int, float)) else None,
            "range": reichweite,
            "ammoPerTon": schuss,
        }
        ist_mech = "F_MEK_WEAPON" in (e.get("flags") or [])
        for z in ziele:
            if not ist_mech:
                aufschub.append((z, e["name"], eintrag))
            elif e["name"] not in ergebnis[z]:
                ergebnis[z][e["name"]] = eintrag
    for z, name, eintrag in aufschub:
        ergebnis[z].setdefault(name, eintrag)
    return ergebnis


MUN_ALIASSE = [("hyperassaultgaussrifle", "hag"), ("improvedatm", "iatm"),
               ("machinegun", "mg"), ("autocannon", "ac")]


def kanon_name(t):
    t = re.sub(r"[\s\-/.()']+", "", t.lower())
    for lang, kurz in MUN_ALIASSE:
        t = t.replace(lang, kurz)
    return "".join(sorted(t))


def waffen_werte(name, techbase, waffen_db):
    basis = re.sub(r"^(IS|Clan)\s+", "", name).strip()
    for tech in ([techbase, "IS", "Clan"] if techbase else ["IS", "Clan"]):
        eintrag = waffen_db.get(tech, {}).get(basis)
        if eintrag:
            return basis, eintrag
    return basis, None


def reichweite_text(r):
    if not r["long"]:
        return "point blank"
    kml = f"{r['short']}/{r['medium']}/{r['long']}"
    if r.get("min"):
        kml = f"min {r['min']} · {kml}"
    return kml + (" (water only)" if r.get("waterOnly") else "")


def parse_mtf(pfad, struktur_tab, waffen_db, exakt_icons, chassis_icons):
    zeilen = pfad.read_text(encoding="utf-8", errors="replace").splitlines()
    felder = {}
    for z in zeilen:
        m = re.match(r"^([A-Za-z][A-Za-z0-9 /_-]*):(.*)$", z)
        if m and m.group(1) not in BLOCK_ZU_ZONE:
            felder.setdefault(m.group(1).strip().lower(), m.group(2).strip())

    config = felder.get("config", "")
    if config not in ("Biped", "Biped OmniMek"):
        return None, "config"

    tonnage = int(felder.get("mass", "0"))
    st = struktur_tab["tonnage"].get(str(tonnage))
    if not st:
        return None, "tonnage"

    # Panzerung
    panzerung = {}
    for kurz, zone in ARMOR_ZU_ZONE.items():
        wert = felder.get((kurz + " armor").lower())
        # Manche Dateien schreiben den Panzerungstyp mit in die Zeile
        # ("HD armor:Clan Standard(Clan):9") - es zählt die letzte Zahl.
        zahl = re.search(r"(\d+)\s*$", wert or "")
        if not zahl:
            return None, "armor"
        panzerung[zone] = int(zahl.group(1))

    techbase = TECH_KURZ.get(felder.get("techbase", ""), "Mix")

    # Wärmetauscher: "20 Single" / "17 Clan Double" / "11 IS Double"
    wt = felder.get("heat sinks", "10 Single")
    wt_m = re.match(r"(\d+)\s+(.*)", wt)
    wt_anzahl = int(wt_m.group(1)) if wt_m else 10
    wt_doppelt = "double" in (wt_m.group(2).lower() if wt_m else "")

    # Slot-Blöcke
    krit_slots = {}
    i = 0
    while i < len(zeilen):
        kopf = zeilen[i].rstrip().rstrip(":")
        if zeilen[i].rstrip().endswith(":") and kopf in BLOCK_ZU_ZONE:
            zone, anzahl = BLOCK_ZU_ZONE[kopf]
            block = []
            j = i + 1
            while j < len(zeilen) and zeilen[j].strip():
                block.append(zeilen[j].strip())
                j += 1
            krit_slots[zone] = [slot_normieren(s) for s in block[:anzahl]]
            while len(krit_slots[zone]) < anzahl:
                krit_slots[zone].append("")
            i = j
        else:
            i += 1
    if len(krit_slots) != 8:
        return None, "slots"

    # Munition zählen: Tonnen je Waffenname aus allen Slots
    mun_tonnen = {}
    for zeile in zeilen:
        if re.search(r"\bammo\b", zeile, re.I) and ":" not in zeile:
            name, faktor = norm_munition(zeile)
            if name:
                mun_tonnen[name] = mun_tonnen.get(name, 0.0) + faktor

    # Waffenliste
    waffen = []
    try:
        start = next(i for i, z in enumerate(zeilen) if re.match(r"^Weapons:\d+", z))
    except StopIteration:
        return None, "weapons"
    for z in zeilen[start + 1:]:
        if not z.strip():
            break
        m = re.match(r"^(.*),\s*(Head|Center Torso|Right Torso|Left Torso|Right Arm|Left Arm|Right Leg|Left Leg)(\s*\(R\))?\s*$", z.strip())
        if not m:
            continue
        roh_name = m.group(1).strip()
        zone = ORT_ZU_KURZ[m.group(2)]
        heck = bool(m.group(3))
        name, werte = waffen_werte(roh_name, techbase, waffen_db)
        munition = None
        if werte and werte["ammoPerTon"]:
            tonnen = mun_tonnen.get(name, 0.0)
            if not tonnen:
                k = kanon_name(name)
                tonnen = next((v for mk, v in mun_tonnen.items() if kanon_name(mk) == k), 0.0)
            munition = int(tonnen * werte["ammoPerTon"]) if tonnen else None
        waffen.append({
            "name": name + (" (Rear)" if heck else ""),
            "location": zone,
            "damage": werte["damage"] if werte else "",
            "heat": werte["heat"] if werte else None,
            "range": reichweite_text(werte["range"]) if werte else "",
            "ammo": munition,
        })

    chassis_roh = felder.get("chassis", "?")
    chassis = chassis_roh
    # Clans nennen viele Chassis anders (Mad Cat = Timber Wolf) - beide Namen
    # in den Anzeigenamen, damit die Suche unter beiden findet.
    if felder.get("clanname"):
        chassis += " (" + felder["clanname"] + ")"
    modell = felder.get("model", "")
    mul_id = felder.get("mul id", "")
    mech_id = "mul-" + mul_id if mul_id and mul_id != "-1" else "slug-" + slug(chassis + " " + modell)

    # mekset kennt teils den rohen ("Mad Cat"), teils den Kombi-Namen
    # ("Mad Cat (Timber Wolf)") - beide probieren.
    icon_quelle = (icon_fuer(chassis_roh, modell, exakt_icons, chassis_icons)
                   or icon_fuer(chassis, modell, exakt_icons, chassis_icons))

    era = felder.get("era", "")
    mech = {
        "_license": LIZENZ,
        "id": mech_id,
        "version": 1,
        "name": (chassis + " " + modell).strip(),
        "tonnage": tonnage,
        "bv": None,
        "notes": "",
        "source": felder.get("source", ""),
        "era": int(era) if era.isdigit() else None,
        "techBase": techbase,
        "role": felder.get("role", ""),
        "movement": {"walk": int(felder.get("walk mp", "0")),
                     "jump": int(felder.get("jump mp", "0"))},
        "pilot": {"name": "", "gunnery": 4, "piloting": 5},
        "heatSinks": {"count": wt_anzahl, "double": wt_doppelt},
        "armor": panzerung,
        "structure": {"head": struktur_tab["head"], "ct": st["ct"], "rt": st["sideTorso"],
                      "lt": st["sideTorso"], "ra": st["arm"], "la": st["arm"],
                      "rl": st["leg"], "ll": st["leg"]},
        "weapons": waffen,
        "critSlots": krit_slots,
    }
    if icon_quelle:
        mech["_iconQuelle"] = icon_quelle   # nur fuer den Kopierschritt
        mech["icon"] = "img/units/" + icon_quelle.replace("meks/", "").replace("/", "_")
    mech["_uuid"] = felder.get("uuid", "")
    return mech, None


def mekbay_anreichern(mech, mekbay_map):
    """BV + Alpha-Strike-Kartenwerte aus MekBays Datenbank (Join per UUID)."""
    u = mekbay_map.get(mech.pop("_uuid", ""))
    if not u:
        return False
    if u.get("bv"):
        mech["bv"] = u["bv"]
    a = u.get("as")
    if a and a.get("Arm"):
        mech["as"] = {
            "pv": a.get("PV"), "sz": a.get("SZ"), "mv": a.get("MV", ""),
            "tmm": a.get("TMM"), "ov": a.get("OV", 0),
            "armor": a.get("Arm"), "structure": a.get("Str"),
            "s": str(a.get("dmg", {}).get("dmgS", "")),
            "m": str(a.get("dmg", {}).get("dmgM", "")),
            "l": str(a.get("dmg", {}).get("dmgL", "")),
            "special": ", ".join(a.get("specials", [])),
        }
    return "as" in mech


def main():
    if len(sys.argv) < 2:
        sys.exit("Aufruf: convert-mtf.py /pfad/zu/mm-data")
    quelle = Path(sys.argv[1]) / "data/mekfiles/meks"
    if not quelle.is_dir():
        sys.exit(f"Kein Mek-Verzeichnis: {quelle}")

    struktur_tab, waffen_db = lade_werte()
    equipment_pfad = PROJEKT / "mekbay-equipment.json"
    if equipment_pfad.exists():
        mb_waffen = lade_mekbay_waffen(equipment_pfad)
        ergaenzt = 0
        for tech in ("IS", "Clan"):
            for name, eintrag in mb_waffen[tech].items():
                if name not in waffen_db.get(tech, {}):
                    waffen_db.setdefault(tech, {})[name] = eintrag
                    ergaenzt += 1
        print(f"MekBay-Gerätedaten: {ergaenzt} Waffeneinträge ergänzt (kuratierte behalten Vorrang)")
    mm_root = Path(sys.argv[1])
    mekbay_map = {}
    if len(sys.argv) > 2:
        mb = json.loads(Path(sys.argv[2]).read_text())
        for u in mb.get("units", []):
            if u.get("uuid"):
                mekbay_map[u["uuid"]] = u
        print(f"MekBay-Datenbank: {len(mekbay_map)} Einheiten geladen")
    exakt_icons, chassis_icons = lade_mekset(mm_root)
    ziel = PROJEKT / "website/data/units"
    ziel.mkdir(exist_ok=True)
    icon_ziel = PROJEKT / "website/img/units"
    icon_ziel.mkdir(exist_ok=True)
    icons_kopiert = set()

    index, gesehen = [], set()
    uebersprungen = {}
    for pfad in sorted(quelle.rglob("*.mtf")):
        mech, grund = parse_mtf(pfad, struktur_tab, waffen_db, exakt_icons, chassis_icons)
        if mech is None:
            uebersprungen[grund] = uebersprungen.get(grund, 0) + 1
            continue
        if mech["id"] in gesehen:
            uebersprungen["duplikat"] = uebersprungen.get("duplikat", 0) + 1
            continue
        gesehen.add(mech["id"])
        if mekbay_anreichern(mech, mekbay_map):
            uebersprungen["mit-as"] = uebersprungen.get("mit-as", 0) + 1
        quelle_icon = mech.pop("_iconQuelle", None)
        if quelle_icon:
            von = mm_root / "data/images/units" / quelle_icon
            nach = icon_ziel / mech["icon"].split("/")[-1]
            if von.exists():
                if nach.name not in icons_kopiert:
                    nach.write_bytes(von.read_bytes())
                    icons_kopiert.add(nach.name)
            else:
                mech.pop("icon", None)
        (ziel / (mech["id"] + ".json")).write_text(
            json.dumps(mech, ensure_ascii=False, separators=(",", ":")))
        index.append([mech["id"], mech["name"], mech["tonnage"], mech["techBase"],
                      mech["era"] or 0, mech["role"]])

    index.sort(key=lambda e: (e[1].lower(), e[4]))
    index_datei = PROJEKT / "website/data/units-index.json"
    index_datei.write_text(json.dumps({
        "_license": LIZENZ,
        "version": 1,
        "fields": ["id", "name", "tonnage", "tech", "era", "role"],
        "mechs": index,
    }, ensure_ascii=False, separators=(",", ":")))

    print(f"{len(index)} Mechs konvertiert -> {ziel}")
    print(f"Index: {index_datei} ({index_datei.stat().st_size // 1024} KB)")
    print(f"Icons kopiert: {len(icons_kopiert)} -> {icon_ziel}")
    print(f"Übersprungen: {uebersprungen}")


if __name__ == "__main__":
    main()
