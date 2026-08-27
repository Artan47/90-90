#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Construction du bordereau de prix — RFX rfx_808 / BPS-26-01958-ITB.

Base : coût de revient annoncé 6'000 CHF de fourniture + 4'000 CHF de montage.
Objectif : ×2.5 sur la fourniture (marge globale), coefficient réparti par
famille de produit ; ×1.5 sur le montage (soit 105 CHF/h de vente).
"""

# --- Paramètres de marge ------------------------------------------------
COUT_FOURNITURE = 6000.0
COUT_MONTAGE = 4000.0
COEF_FOURNITURE_GLOBAL = 2.5          # objectif du chef d'entreprise
COEF_MONTAGE = 1.5
COUT_HORAIRE_INTERNE = 70.0           # charges comprises (cf. fiche de salaire)
COEF_CHAP2 = 1.25                     # commandes isolées sur 2 ans

# Coefficients par famille (la menuiserie absorbe la marge, pas l'électroménager)
COEF = {"menuiserie": None, "sanitaire": 2.5, "pierre": 2.4, "appareil": 1.5}

# --- Chapitre 1 : ligne, qté, coût matière unitaire, heures de pose unitaires
CH1 = [
    ("2.2.1",  "Caisson supérieur 0.415 × 0.60 × 0.80", 1,     130.0, 0.80, "menuiserie"),
    ("2.2.2",  "Caisson supérieur 0.60 × 0.60 × 0.80",  3,     165.0, 0.80, "menuiserie"),
    ("2.2.3",  "Caisson supérieur 0.50 × 0.60 × 0.80",  2,     150.0, 0.80, "menuiserie"),
    ("2.2.4",  "Caisson inférieur 0.415 × 0.60 × 0.80", 1,     165.0, 1.00, "menuiserie"),
    ("2.2.5",  "Caisson inférieur 0.60 × 0.60 × 0.80",  2,     205.0, 1.00, "menuiserie"),
    ("2.2.6",  "Caisson inférieur 0.50 × 0.60 × 0.80",  2,     185.0, 1.00, "menuiserie"),
    ("2.2.7",  "Caisson inf. 0.60 + tiroir et panier couverts", 1, 330.0, 1.30, "menuiserie"),
    ("2.2.8",  "Caisson colonne 0.60 × 0.60 × 1.68",    1,     360.0, 1.80, "menuiserie"),
    ("2.2.9",  "Réfrigérateur Miele K 7737 D ou équiv.", 1,   1640.0, 1.20, "appareil"),
    ("2.2.10", "Caisson supérieur 0.60 × 0.60 × 0.60",  1,     150.0, 0.80, "menuiserie"),
    ("2.2.11", "Évier inox brossé 1 bac + égouttoir",   1,     320.0, 1.80, "sanitaire"),
    ("2.2.12", "Mitigeur monocommande + limitateur",    1,     180.0, 1.00, "sanitaire"),
    ("2.2.13", "Plan de travail Dekton 20 mm Danae (ml)", 3.215, 230.0, 1.60, "pierre"),
    ("2.2.14", "Éclairage LED encastré socle",          1,     180.0, 2.00, "menuiserie"),
    ("2.2.15", "Dosseret panneau bois traité (ml)",     3.825,  60.0, 1.20, "menuiserie"),
]


def arrondi5(x):
    """Prix unitaires arrondis à 5 francs."""
    return round(x / 5) * 5


def fmt(x, d=2):
    return f"{x:,.{d}f}".replace(",", "'")


# --- Heures : les heures directes ne couvrent pas installations de chantier,
# livraison DDP + déchargement, protections, réglages, nettoyage, réception.
# Le budget montage de 4'000.- fixe le total ; le supplément est réparti au
# prorata des heures directes.
heures_directes = sum(q * h for _, _, q, _, h, _ in CH1)
heures_totales = COUT_MONTAGE / COUT_HORAIRE_INTERNE
k_heures = heures_totales / heures_directes
prix_heure_vendu = COUT_HORAIRE_INTERNE * COEF_MONTAGE          # 105.- / h
pose_unitaire = lambda h: h * k_heures * prix_heure_vendu

# --- Coefficient menuiserie : solde pour atteindre 2.5 × 6'000 = 15'000.-
mat = {f: sum(q * c for _, _, q, c, _, fam in CH1 if fam == f)
       for f in ("menuiserie", "sanitaire", "pierre", "appareil")}
cible = COUT_FOURNITURE * COEF_FOURNITURE_GLOBAL
autres = sum(mat[f] * COEF[f] for f in ("sanitaire", "pierre", "appareil"))
COEF["menuiserie"] = round((cible - autres) / mat["menuiserie"], 3)


def ligne(code, desc, qte, cm, h, fam, coef_chap=1.0):
    # un appareil commandé isolément coûte le même prix d'achat : pas de majoration
    c = 1.0 if fam == "appareil" else coef_chap
    pu = arrondi5((cm * COEF[fam] + pose_unitaire(h)) * c)
    return code, desc, qte, pu, round(pu * qte, 2)


def tableau(lignes, titre):
    print(f"\n{titre}")
    print(f"{'Ligne':7} {'Désignation':52} {'Qté':>6} {'PU CHF':>9} {'Total CHF':>11}")
    print("-" * 89)
    total = 0.0
    for code, desc, qte, pu, tot in lignes:
        total += tot
        qte_s = fmt(qte, 3).rstrip("0").rstrip(".") if qte % 1 else str(int(qte))
        print(f"{code:7} {desc[:52]:52} {qte_s:>6} {fmt(pu):>9} {fmt(tot):>11}")
    print("-" * 89)
    print(f"{'SOUS-TOTAL':60} {'':6} {'':9} {fmt(total):>11}")
    return total


print(f"Coût de revient        : fourniture {fmt(COUT_FOURNITURE)} + montage {fmt(COUT_MONTAGE)}")
print(f"Heures directes        : {heures_directes:.2f} h  →  heures budgétées {heures_totales:.2f} h "
      f"(coef. frais de chantier {k_heures:.3f})")
print(f"Taux de vente montage  : {fmt(prix_heure_vendu)} CHF/h")
print(f"Coefficients matière   : menuiserie ×{COEF['menuiserie']}, sanitaire ×{COEF['sanitaire']}, "
      f"pierre ×{COEF['pierre']}, électroménager ×{COEF['appareil']}")

lignes1 = [ligne(*l) for l in CH1]
t1 = tableau(lignes1, "CHAPITRE 1 — Cuisine BPS (prix fermes, DDP + déchargement inclus)")

# --- Chapitre 2 : catalogue de prix unitaires, valable 2 ans --------------
CH2_REPRIS = {  # ligne chap. 2 -> ligne chap. 1 équivalente
    "2.3.1": "2.2.1", "2.3.2": "2.2.2", "2.3.3": "2.2.3", "2.3.4": "2.2.4",
    "2.3.6": "2.2.6", "2.3.8": "2.2.12", "2.3.9": "2.2.13", "2.3.16": "2.2.14",
    "2.3.17": "2.2.8", "2.3.19": "2.2.10",
}
CH2_DESC = {
    "2.3.1": "Caisson supérieur 0.415 × 0.60 × 0.80",
    "2.3.2": "Caisson supérieur 0.60 × 0.60 × 0.80",
    "2.3.3": "Caisson supérieur 0.50 × 0.60 × 0.80",
    "2.3.4": "Caisson inférieur 0.415 × 0.60 × 0.80",
    "2.3.6": "Caisson inférieur 0.50 × 0.60 × 0.80",
    "2.3.8": "Mitigeur monocommande + limitateur",
    "2.3.9": "Plan de travail Dekton 20 mm Danae (ml)",
    "2.3.16": "Éclairage LED encastré socle",
    "2.3.17": "Caisson colonne réfrigérateur 0.60 × 0.60 × 1.68",
    "2.3.19": "Caisson supérieur 0.60 × 0.60 × 0.60",
}
CH2_NOUVEAU = [   # code, désignation, qté, coût matière, heures, famille
    ("2.3.5",  "Caisson inférieur 0.60 × 0.60 × 0.65",         1, 190.0, 1.00, "menuiserie"),
    ("2.3.7",  "Module tiroir inf. + panier couverts (cais. 0.60)", 1, 165.0, 0.60, "menuiserie"),
    ("2.3.10", "Plan de travail stratifié 30 mm, prof. 0.60 (ml)", 1, 110.0, 1.20, "menuiserie"),
    ("2.3.11", "Plan de travail inox brossé 40 mm (ml)",       1, 460.0, 1.60, "sanitaire"),
    ("2.3.12", "Évier simple résine + égouttoir",              1, 250.0, 1.80, "sanitaire"),
    ("2.3.13", "Évier simple inox + égouttoir",                1, 320.0, 1.80, "sanitaire"),
    ("2.3.14", "Crédence inox brossé h. 0.65 (ml)",            1, 195.0, 1.30, "sanitaire"),
    ("2.3.15", "Crédence faïence h. 0.65 (ml)",                1,  95.0, 2.20, "menuiserie"),
    ("2.3.18", "Réfrigérateur Miele ou équivalent",            1, 1640.0, 1.20, "appareil"),
    ("2.3.20", "Banquette murale bois, module 850 mm (ml)",    4.2, 330.0, 1.40, "menuiserie"),
]
REGIE = [("2.3.21", "Chef menuisier / chef de montage (heure)", 30, 105.0),
         ("2.3.22", "Aide monteur (heure)", 30, 82.0)]

ch1_par_code = {c: (q, pu) for c, _, q, pu, _ in lignes1}
lignes2 = []
for code in sorted(set(CH2_REPRIS) | {c for c, *_ in CH2_NOUVEAU} | {c for c, *_ in REGIE},
                   key=lambda c: (int(c.split(".")[2]))):
    if code in CH2_REPRIS:
        pu = arrondi5(ch1_par_code[CH2_REPRIS[code]][1] * COEF_CHAP2)
        lignes2.append((code, CH2_DESC[code], 1, pu, pu))
    elif code in {c for c, *_ in REGIE}:
        c, d, q, pu = next(r for r in REGIE if r[0] == code)
        lignes2.append((c, d, q, pu, round(pu * q, 2)))
    else:
        l = next(n for n in CH2_NOUVEAU if n[0] == code)
        lignes2.append(ligne(*l, coef_chap=COEF_CHAP2))

t2 = tableau(lignes2, "CHAPITRE 2 — Bordereau de prix unitaires (quantités annuelles indicatives)")

titre_total = "TOTAL DE L'OFFRE ÉVALUÉ (chap. 1 + chap. 2)"
print(f"\n{titre_total:60} {'':6} {'':9} {fmt(t1 + t2):>11} CHF HT")
marge = t1 - (COUT_FOURNITURE + COUT_MONTAGE)
print(f"\nChapitre 1 : coût de revient {fmt(COUT_FOURNITURE + COUT_MONTAGE)} — "
      f"marge brute {fmt(marge)} ({marge / t1 * 100:.1f} % du prix de vente)")


# --- Scénario B : le budget de 6'000.- ne couvre que la menuiserie ---------
PRIX_REEL = {"2.2.9": 2800.0, "2.2.13": 380.0}   # achat net réaliste
cout_b = (COUT_FOURNITURE + COUT_MONTAGE
          + (PRIX_REEL["2.2.9"] - 1640.0)
          + (PRIX_REEL["2.2.13"] - 230.0) * 3.215)
marge_b = t1 - cout_b
print("\n" + "=" * 89)
print("SCÉNARIO B — si les 6'000.- ne comprennent ni le Miele ni le Dekton")
print(f"  Coût de revient réel du chapitre 1 : {fmt(cout_b)} CHF")
print(f"  Marge aux prix ci-dessus           : {fmt(marge_b)} CHF ({marge_b / t1 * 100:.1f} %)")
pu_frigo = arrondi5(PRIX_REEL["2.2.9"] * COEF["appareil"] + pose_unitaire(1.20))
pu_dekton = arrondi5(PRIX_REEL["2.2.13"] * COEF["pierre"] + pose_unitaire(1.60))
t1_b = t1 - 2705.0 - 880.0 * 3.215 + pu_frigo + pu_dekton * 3.215
print(f"  Prix à corriger : 2.2.9 → {fmt(pu_frigo)} CHF/pce ; 2.2.13 → {fmt(pu_dekton)} CHF/ml")
print(f"  Nouveau sous-total chapitre 1      : {fmt(t1_b)} CHF "
      f"(marge {fmt(t1_b - cout_b)} = {(t1_b - cout_b) / t1_b * 100:.1f} %)")


# --- Édition du bordereau (HTML + PDF) ------------------------------------
import html as _h
import os
import subprocess

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

_CSS = """
@page { size: A4; margin: 13mm 13mm 11mm 13mm; }
body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 8.6pt;
       color: #16181d; margin: 0; line-height: 1.3; }
.entete { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2.5pt solid #16181d; padding-bottom: 6pt; margin-bottom: 11pt; }
.societe { font-size: 13pt; font-weight: 700; }
.coord { font-size: 8.4pt; color: #4a4f58; margin-top: 2pt; }
.ref { text-align: right; font-size: 8.4pt; line-height: 1.5; }
.ref .rfx { font-weight: 700; font-size: 9.5pt; }
h1 { font-size: 11pt; margin: 0 0 8pt 0; text-transform: uppercase; letter-spacing: .3pt; }
h2 { font-size: 9pt; margin: 14pt 0 5pt 0; text-transform: uppercase; letter-spacing: .5pt;
     border-bottom: 1pt solid #16181d; padding-bottom: 3pt; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-size: 7.4pt; text-transform: uppercase; letter-spacing: .4pt;
     color: #6b7280; font-weight: 600; border-bottom: .5pt solid #c9ced6; padding: 0 4pt 3pt 0; }
td { padding: 2.6pt 4pt 2.6pt 0; border-bottom: .4pt solid #eceff3; vertical-align: top; }
th.n, td.n { text-align: right; padding-right: 0; font-variant-numeric: tabular-nums;
             white-space: nowrap; }
td.code { color: #6b7280; width: 42pt; }
tr.sub td { font-weight: 700; border-top: 1pt solid #16181d; border-bottom: none; padding-top: 5pt; }
tr.tot td { font-weight: 700; font-size: 10pt; border-top: 2pt solid #16181d;
            border-bottom: 2pt solid #16181d; padding: 6pt 0; }
.notes { margin-top: 12pt; font-size: 7.4pt; color: #4a4f58; line-height: 1.45; }
.notes ul { margin: 3pt 0 0 0; padding-left: 11pt; }
.encadre { margin-top: 10pt; background: #f4f6f9; border-left: 3pt solid #16181d;
           padding: 7pt 10pt; font-size: 7.8pt; }
"""


def _rows(lignes):
    out = []
    for code, desc, qte, pu, tot in lignes:
        q = fmt(qte, 3).rstrip("0").rstrip(".") if qte % 1 else str(int(qte))
        out.append(f'<tr><td class="code">{code}</td><td>{_h.escape(desc)}</td>'
                   f'<td class="n">{q}</td><td class="n">{fmt(pu)}</td>'
                   f'<td class="n">{fmt(tot)}</td></tr>')
    return "".join(out)


def editer_pdf():
    dossier = os.path.dirname(os.path.abspath(__file__))
    doc = f"""<!doctype html><html lang="fr"><head><meta charset="utf-8">
<title>Offre LD-Agencium — RFX rfx_808</title><style>{_CSS}</style></head><body>
<div class="entete">
  <div><div class="societe">LD-Agencium Sàrl</div>
    <div class="coord">Boulevard Pont d'Arve 10 · 1205 Genève<br>IDE CHE-148.046.691</div></div>
  <div class="ref"><div class="rfx">RFX rfx_808 — BPS-26-01958-ITB</div>
    Fourniture, agencement et pose de cuisine domestique<br>
    Offre de prix · francs suisses, hors taxes<br>
    Validité : 24 mois · Incoterms 2020 DDP + déchargement</div>
</div>

<h1>Bordereau de prix</h1>

<h2>Chapitre 1 — Cuisine BPS (prix forfaitaire, tous frais inclus)</h2>
<table>
<tr><th>Ligne</th><th>Désignation</th><th class="n">Qté</th><th class="n">PU CHF</th><th class="n">Montant CHF</th></tr>
{_rows(lignes1)}
<tr class="sub"><td></td><td>Sous-total chapitre 1</td><td class="n"></td><td class="n"></td><td class="n">{fmt(t1)}</td></tr>
</table>

<h2>Chapitre 2 — Prix unitaires (quantités annuelles indicatives)</h2>
<table>
<tr><th>Ligne</th><th>Désignation</th><th class="n">Qté</th><th class="n">PU CHF</th><th class="n">Montant CHF</th></tr>
{_rows(lignes2)}
<tr class="sub"><td></td><td>Sous-total chapitre 2</td><td class="n"></td><td class="n"></td><td class="n">{fmt(t2)}</td></tr>
<tr class="tot"><td></td><td>Total de l'offre (chapitres 1 + 2)</td><td class="n"></td><td class="n"></td><td class="n">{fmt(t1 + t2)}</td></tr>
</table>

<div class="encadre">
<strong>Prestations comprises dans les prix</strong> — relevé et vérification des quantités sur
plans, plans d'atelier soumis à validation, fabrication, livraison DDP avec déchargement,
installations de chantier, moyens de levage, protections des ouvrages existants, découpes et
ajustements, raccordements des appareils sanitaires, réglages, joints, nettoyage, évacuation et
tri des déchets, remise des documents de réception et garantie SIA 118 de 2 ans.
</div>

<div class="notes"><strong>Conditions</strong>
<ul>
<li>Prix fermes et non révisables pendant 24 mois dès l'adjudication, hors taxes, en francs suisses.</li>
<li>Chapitre 2 : prix unitaires applicables aux commandes complémentaires isolées ; les
    quantités annuelles indiquées sont estimatives et n'engagent pas le maître de l'ouvrage.</li>
<li>Heures de régie facturées à la demi-heure, sur bon de régie contresigné, du lundi au
    vendredi en horaire normal.</li>
<li>Délai indicatif : 6 semaines de fabrication dès validation des plans d'atelier,
    3 jours ouvrables de pose.</li>
<li>Toute modification des quantités constatée lors du relevé contradictoire est traitée aux
    prix unitaires du chapitre 2.</li>
</ul></div>
</body></html>"""
    chemin_html = os.path.join(dossier, "offre-rfx-808-ld-agencium.html")
    chemin_pdf = os.path.join(dossier, "offre-rfx-808-ld-agencium.pdf")
    with open(chemin_html, "w", encoding="utf-8") as f:
        f.write(doc)
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox",
                    "--no-pdf-header-footer", f"--print-to-pdf={chemin_pdf}",
                    "file://" + chemin_html], check=True, capture_output=True)
    print(f"\nBordereau édité : {chemin_pdf}")


editer_pdf()
