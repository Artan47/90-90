#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Génère les fiches de salaire mensuelles (HTML + PDF) de M. Kqiku Leugzim,
LD-Agencium Sàrl, Genève.

Toutes les hypothèses de calcul (taux, barèmes) sont regroupées dans le
dictionnaire PARAMS ci-dessous : il suffit d'y corriger une valeur pour
régénérer les trois fiches.

Usage :  python3 generer_fiches.py
"""

import html
import os
import subprocess
import sys

# --------------------------------------------------------------------------
# Paramètres
# --------------------------------------------------------------------------

EMPLOYEUR = {
    "nom": "LD-Agencium Sàrl",
    "adresse": "Boulevard Pont d'Arve 10",
    "npa_ville": "1205 Genève",
    "ide": "CHE-148.046.691",
}

EMPLOYE = {
    "nom": "Monsieur Kqiku Leugzim",
    "adresse": "Avenue Louis-Casaï 39",
    "npa_ville": "1220 Les Avanchets",
    "pays": "Suisse",
    "fonction": "Employé du second œuvre / agencement",
    "permis": "Permis B — imposé à la source (barème B1 : marié, un seul revenu, 1 enfant)",
    "age": 24,
    "iban": "CH88 0023 5235 7720 7540 N",
    "banque": "UBS Switzerland AG",
}

PARAMS = {
    # Rémunération
    "salaire_mensuel_brut": 7800.00,
    "part_13e_mensuelle": 7800.00 / 12,      # 13e salaire mensualisé (1/12)
    # Taux de cotisation part employé (Genève, 2026)
    "avs_ai_apg": 0.0530,
    "ac": 0.0110,                            # jusqu'à 148'200.- / an
    "aanp": 0.0130,                          # accidents non professionnels
    "amat_ge": 0.00043,                      # assurance maternité cantonale GE
    "ijm": 0.0140,                           # indemnités journalières maladie (50 % prime)
    "far": 0.0150,                           # retraite anticipée (CCT bâtiment)
    "contrib_prof": 0.0070,                  # contribution professionnelle CCT
    # LPP : à 24 ans, cotisation de risque uniquement (épargne dès 25 ans révolus)
    "lpp_taux_risque": 0.0075,               # part employé
    "lpp_deduction_coordination": 26460.00,  # annuel
    "lpp_salaire_max": 90720.00,             # annuel (limite supérieure LPP)
    # Impôt à la source Genève, barème B1
    "is_taux": 0.0650,
}

MOIS = [
    ("06", "Juin 2026", "30 juin 2026"),
    ("07", "Juillet 2026", "31 juillet 2026"),
    ("08", "Août 2026", "31 août 2026"),
]


# --------------------------------------------------------------------------
# Calculs
# --------------------------------------------------------------------------

def arrondi5(montant):
    """Arrondi au 5 centimes, usage suisse pour les fiches de salaire."""
    return round(round(montant * 20) / 20, 2)


def fmt(montant):
    """Format suisse : 8'450.00"""
    s = f"{abs(montant):,.2f}".replace(",", "'")
    return ("-" if montant < 0 else "") + s


def calculer():
    p = PARAMS
    brut_mensuel = p["salaire_mensuel_brut"]
    part_13e = arrondi5(p["part_13e_mensuelle"])
    brut_total = arrondi5(brut_mensuel + part_13e)

    # Salaire coordonné LPP (annuel plafonné, ramené au mois)
    brut_annuel = brut_total * 12
    base_lpp = min(brut_annuel, p["lpp_salaire_max"])
    salaire_coordonne = max(0.0, base_lpp - p["lpp_deduction_coordination"])
    coordonne_mensuel = salaire_coordonne / 12

    deductions = [
        ("AVS / AI / APG", p["avs_ai_apg"], brut_total),
        ("Assurance-chômage (AC)", p["ac"], brut_total),
        ("Assurance accidents non professionnels (AANP)", p["aanp"], brut_total),
        ("Assurance maternité cantonale (AMat GE)", p["amat_ge"], brut_total),
        ("Indemnités journalières maladie (IJM, 50 %)", p["ijm"], brut_total),
        ("Prévoyance professionnelle LPP (risque)", p["lpp_taux_risque"], coordonne_mensuel),
        ("Retraite anticipée CCT (FAR)", p["far"], brut_total),
        ("Contribution professionnelle CCT", p["contrib_prof"], brut_total),
    ]

    lignes = [(lib, taux, arrondi5(taux * base)) for lib, taux, base in deductions]
    total_deductions = arrondi5(sum(m for _, _, m in lignes))
    net_avant_impot = arrondi5(brut_total - total_deductions)
    impot_source = arrondi5(p["is_taux"] * brut_total)
    net_a_payer = arrondi5(net_avant_impot - impot_source)

    return {
        "brut_mensuel": brut_mensuel,
        "part_13e": part_13e,
        "brut_total": brut_total,
        "coordonne_mensuel": coordonne_mensuel,
        "salaire_coordonne": salaire_coordonne,
        "lignes": lignes,
        "total_deductions": total_deductions,
        "net_avant_impot": net_avant_impot,
        "impot_source": impot_source,
        "net_a_payer": net_a_payer,
        "brut_annuel": brut_annuel,
    }


# --------------------------------------------------------------------------
# Rendu HTML
# --------------------------------------------------------------------------

CSS = """
@page { size: A4; margin: 13mm 14mm 10mm 14mm; }
* { box-sizing: border-box; }
body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
       font-size: 9.3pt; color: #16181d; margin: 0; line-height: 1.35; }
.entete { display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2.5pt solid #16181d; padding-bottom: 7pt; margin-bottom: 13pt; }
.entete .societe { font-size: 14pt; font-weight: 700; letter-spacing: .2pt; }
.entete .coord { font-size: 9pt; color: #4a4f58; margin-top: 3pt; }
.entete .ide { font-size: 9pt; color: #6b7280; margin-top: 4pt; }
.bloc-adresse { text-align: right; font-size: 9.3pt; line-height: 1.45; }
.bloc-adresse .nom { font-weight: 600; }
h1 { font-size: 12pt; margin: 0 0 2pt 0; letter-spacing: .3pt; text-transform: uppercase; }
.periode { font-size: 9.3pt; color: #4a4f58; margin-bottom: 11pt; }
table { width: 100%; border-collapse: collapse; }
.infos { margin-bottom: 12pt; font-size: 8.8pt; }
.infos td { padding: 2.5pt 0; vertical-align: top; }
.infos td.lib { color: #6b7280; width: 16%; white-space: nowrap; }
.infos td.val { width: 34%; padding-right: 10pt; }
.detail th { text-align: left; font-size: 8.5pt; text-transform: uppercase;
             letter-spacing: .5pt; color: #6b7280; font-weight: 600;
             border-bottom: 1pt solid #c9ced6; padding: 0 0 4pt 0; }
.detail th.num, .detail td.num { text-align: right; }
.detail td { padding: 3.2pt 0; border-bottom: .5pt solid #e6e9ee; }
.detail td.taux { text-align: right; color: #6b7280; width: 15%; font-variant-numeric: tabular-nums; }
.detail td.num { width: 22%; font-variant-numeric: tabular-nums; }
.section td { padding-top: 9pt; font-weight: 700; font-size: 9pt;
              text-transform: uppercase; letter-spacing: .5pt; border-bottom: 1pt solid #c9ced6; }
tr.total td { font-weight: 700; border-top: 1pt solid #16181d; border-bottom: none; padding-top: 5pt; }
tr.net td { font-weight: 700; font-size: 11pt; border-top: 2pt solid #16181d;
            border-bottom: 2pt solid #16181d; padding: 7pt 0; }
.paiement { margin-top: 15pt; background: #f4f6f9; border-left: 3pt solid #16181d;
            padding: 8pt 11pt; font-size: 9pt; }
.paiement .titre { font-weight: 700; font-size: 8.5pt; text-transform: uppercase;
                   letter-spacing: .5pt; margin-bottom: 4pt; }
.notes { margin-top: 12pt; font-size: 7.4pt; color: #6b7280; line-height: 1.5; }
.notes ul { margin: 4pt 0 0 0; padding-left: 12pt; }
.signature { margin-top: 20pt; display: flex; justify-content: space-between; font-size: 8.5pt; }
.signature div { width: 45%; border-top: .5pt solid #9aa1ab; padding-top: 4pt; color: #6b7280; }
"""

def taux_txt(t):
    return f"{t * 100:.3f}".rstrip("0").rstrip(".").replace(".", ",") + " %"


def rendu_html(mois_lib, date_versement, c):
    e, s = EMPLOYEUR, EMPLOYE
    lignes = "".join(
        f'<tr><td>{html.escape(lib)}</td><td class="taux">{taux_txt(t)}</td>'
        f'<td class="num">– {fmt(m)}</td></tr>'
        for lib, t, m in c["lignes"]
    )
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Fiche de salaire — {html.escape(mois_lib)} — {html.escape(s['nom'])}</title>
<style>{CSS}</style></head><body>

<div class="entete">
  <div>
    <div class="societe">{html.escape(e['nom'])}</div>
    <div class="coord">{html.escape(e['adresse'])}<br>{html.escape(e['npa_ville'])}</div>
    <div class="ide">IDE {html.escape(e['ide'])}</div>
  </div>
  <div class="bloc-adresse">
    <div class="nom">{html.escape(s['nom'])}</div>
    {html.escape(s['adresse'])}<br>{html.escape(s['npa_ville'])}<br>{html.escape(s['pays'])}
  </div>
</div>

<h1>Décompte de salaire</h1>
<div class="periode">Période : {html.escape(mois_lib)} &nbsp;·&nbsp; Établi à Genève, le {html.escape(date_versement)}</div>

<table class="infos">
  <tr><td class="lib">Fonction</td><td class="val">{html.escape(s['fonction'])}</td>
      <td class="lib">Taux d'activité</td><td class="val">100 %</td></tr>
  <tr><td class="lib">Statut fiscal</td><td class="val">{html.escape(s['permis'])}</td>
      <td class="lib">Salaire annuel brut</td><td class="val">CHF {fmt(c['brut_annuel'])} (13 × CHF {fmt(c['brut_mensuel'])})</td></tr>
</table>

<table class="detail">
  <tr class="section"><td colspan="2">Gains</td><td class="num">CHF</td></tr>
  <tr><td>Salaire mensuel brut</td><td class="taux"></td><td class="num">{fmt(c['brut_mensuel'])}</td></tr>
  <tr><td>13<sup>e</sup> salaire (part mensualisée 1/12)</td><td class="taux"></td><td class="num">{fmt(c['part_13e'])}</td></tr>
  <tr class="total"><td>Total brut soumis aux cotisations</td><td class="taux"></td><td class="num">{fmt(c['brut_total'])}</td></tr>

  <tr class="section"><td>Déductions sociales — part employé</td><td class="taux">Taux</td><td class="num">CHF</td></tr>
  {lignes}
  <tr class="total"><td>Total des déductions sociales</td><td class="taux"></td><td class="num">– {fmt(c['total_deductions'])}</td></tr>

  <tr class="total"><td>Salaire net avant impôt</td><td class="taux"></td><td class="num">{fmt(c['net_avant_impot'])}</td></tr>
  <tr><td>Impôt à la source (canton de Genève, barème B1)</td>
      <td class="taux">{taux_txt(PARAMS['is_taux'])}</td>
      <td class="num">– {fmt(c['impot_source'])}</td></tr>

  <tr class="net"><td>Net à payer</td><td class="taux"></td><td class="num">CHF {fmt(c['net_a_payer'])}</td></tr>
</table>

<div class="paiement">
  <div class="titre">Versement</div>
  Virement bancaire en faveur de {html.escape(s['nom'])} — valeur au {html.escape(date_versement)}.<br>
  Banque : {html.escape(s['banque'])} &nbsp;·&nbsp; IBAN : <strong>{html.escape(s['iban'])}</strong>
</div>

<div class="notes">
  <strong>Remarques</strong>
  <ul>
    <li>Salaire annuel convenu : 13 × CHF {fmt(c['brut_mensuel'])} = CHF {fmt(c['brut_annuel'])}. Le 13<sup>e</sup> salaire est versé par douzièmes avec chaque paie.</li>
    <li>LPP : à {EMPLOYE['age']} ans, seule la cotisation de risque est due ; les bonifications de vieillesse débutent le 1<sup>er</sup> janvier suivant le 25<sup>e</sup> anniversaire. Salaire coordonné retenu : CHF {fmt(c['salaire_coordonne'])} par an.</li>
    <li>Cotisations FAR (retraite anticipée), IJM et contribution professionnelle prélevées en application de la convention collective de travail applicable au secteur de la construction / du second œuvre.</li>
    <li>L'impôt à la source est retenu et reversé à l'administration fiscale cantonale genevoise ; le taux appliqué correspond au barème B1 pour un revenu brut déterminant de CHF {fmt(c['brut_total'])}.</li>
    <li>Les éventuelles allocations familiales sont versées séparément par la caisse d'allocations familiales.</li>
  </ul>
</div>

<div class="signature">
  <div>L'employeur — {html.escape(e['nom'])}</div>
  <div>L'employé — {html.escape(s['nom'])}</div>
</div>

</body></html>
"""


# --------------------------------------------------------------------------
# Génération
# --------------------------------------------------------------------------

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

def main():
    dossier = os.path.dirname(os.path.abspath(__file__))
    c = calculer()

    for num, lib, date_versement in MOIS:
        base = f"fiche-salaire-2026-{num}-kqiku-leugzim"
        chemin_html = os.path.join(dossier, base + ".html")
        chemin_pdf = os.path.join(dossier, base + ".pdf")
        with open(chemin_html, "w", encoding="utf-8") as f:
            f.write(rendu_html(lib, date_versement, c))
        subprocess.run(
            [CHROME, "--headless", "--disable-gpu", "--no-sandbox",
             "--no-pdf-header-footer", f"--print-to-pdf={chemin_pdf}",
             "file://" + chemin_html],
            check=True, capture_output=True,
        )
        print(f"{lib:<14} brut {fmt(c['brut_total'])}  "
              f"déductions {fmt(c['total_deductions'])}  "
              f"impôt {fmt(c['impot_source'])}  →  net {fmt(c['net_a_payer'])}")

    print(f"\n3 fiches générées dans {dossier}")


if __name__ == "__main__":
    sys.exit(main())
