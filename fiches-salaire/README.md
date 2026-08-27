# Fiches de salaire — Kqiku Leugzim / LD-Agencium Sàrl

Décomptes de salaire de **juin, juillet et août 2026**.

| Fichier | Période |
|---|---|
| `fiche-salaire-2026-06-kqiku-leugzim.pdf` | Juin 2026 |
| `fiche-salaire-2026-07-kqiku-leugzim.pdf` | Juillet 2026 |
| `fiche-salaire-2026-08-kqiku-leugzim.pdf` | Août 2026 |

Les `.html` sont les sources de mise en page ; `generer_fiches.py` régénère
HTML + PDF (toutes les valeurs et tous les taux sont dans le dictionnaire
`PARAMS` en tête du script).

```bash
python3 fiches-salaire/generer_fiches.py
```

## Données retenues

- Employeur : LD-Agencium Sàrl, Boulevard Pont d'Arve 10, 1205 Genève — IDE CHE-148.046.691
- Employé : Monsieur Kqiku Leugzim, Avenue Louis-Casaï 39, 1220 Les Avanchets (Suisse), 24 ans
- Salaire : CHF 7'800.– brut × 13 = CHF 101'400.– par an, 13ᵉ salaire **mensualisé** (1/12 = CHF 650.– par mois)
- Statut : permis B, marié, un enfant à charge → imposition à la source, barème **B1**
- Versement : UBS Switzerland AG, IBAN CH88 0023 5235 7720 7540 N

## Décompte mensuel (identique pour les trois mois)

| Poste | Taux | CHF |
|---|---:|---:|
| Salaire mensuel brut | | 7'800.00 |
| 13ᵉ salaire (1/12) | | 650.00 |
| **Total brut** | | **8'450.00** |
| AVS / AI / APG | 5,300 % | – 447.85 |
| Assurance-chômage (AC) | 1,100 % | – 92.95 |
| Accidents non professionnels (AANP) | 1,300 % | – 109.85 |
| Assurance maternité cantonale (AMat GE) | 0,043 % | – 3.65 |
| Indemnités journalières maladie (IJM, 50 % de la prime) | 1,400 % | – 118.30 |
| LPP — cotisation de risque | 0,750 % | – 40.15 |
| Retraite anticipée CCT (FAR) | 1,500 % | – 126.75 |
| Contribution professionnelle CCT | 0,700 % | – 59.15 |
| **Total des déductions sociales** | | **– 998.65** |
| **Salaire net avant impôt** | | **7'451.35** |
| Impôt à la source GE (barème B1) | 6,500 % | – 549.25 |
| **Net à payer** | | **6'902.10** |

## Bases de calcul

- **AVS/AI/APG 5,3 %** et **AC 1,1 %** : taux légaux fédéraux (part employé). Le salaire
  annuel de CHF 101'400.– reste sous le plafond AC de CHF 148'200.–, donc 1,1 % sur la
  totalité, sans cotisation de solidarité.
- **AMat GE 0,043 %** : assurance maternité cantonale genevoise (0,086 % au total,
  réparti par moitié entre employeur et employé).
- **AANP 1,3 %** : prime accidents non professionnels, à la charge de l'employé
  (LAA art. 91) — taux usuel dans la construction / le second œuvre.
- **IJM 1,4 %** : indemnités journalières maladie, l'employé supportant la moitié de la
  prime, conformément aux CCT du bâtiment.
- **FAR 1,5 %** et **contribution professionnelle 0,7 %** : retenues conventionnelles
  applicables aux métiers du bâtiment (retraite anticipée et frais d'exécution de la CCT).
- **LPP** : à 24 ans, il n'y a **pas encore de bonification de vieillesse** — celle-ci
  débute le 1ᵉʳ janvier qui suit le 25ᵉ anniversaire (LPP art. 7 et 8). Seule la
  cotisation de risque (décès/invalidité + frais) est prélevée, ici 0,75 % du salaire
  coordonné. Salaire coordonné : CHF 90'720.– (limite supérieure) – CHF 26'460.–
  (déduction de coordination) = **CHF 64'260.– par an**, soit CHF 5'355.– par mois.
- **Impôt à la source 6,5 %** : barème genevois B1 (marié, un seul revenu, un enfant)
  pour un revenu brut déterminant de CHF 8'450.– par mois.

## Coût employeur (indicatif, par mois)

| Poste | Taux | CHF |
|---|---:|---:|
| AVS / AI / APG | 5,300 % | 447.85 |
| Assurance-chômage | 1,100 % | 92.95 |
| Allocations familiales GE | 2,450 % | 207.00 |
| LAA professionnelle | 1,500 % | 126.75 |
| Assurance maternité GE | 0,043 % | 3.65 |
| IJM maladie (50 %) | 1,400 % | 118.30 |
| LPP — risque | 0,750 % | 40.15 |
| FAR (retraite anticipée) | 4,000 % | 338.00 |
| Contribution professionnelle CCT | 0,500 % | 42.25 |
| Frais administratifs caisse AVS (3 % des cotisations AVS) | | 13.45 |
| **Total charges patronales** | | **1'430.35** |
| **Coût total employeur** (8'450.– + charges) | | **9'880.35** |

## Points à vérifier avant l'envoi

Les taux légaux (AVS, AC, LPP, AMat) sont fermes. Les taux suivants dépendent de vos
contrats et de la CCT effectivement applicable, et devraient être confirmés avant
la remise des fiches :

1. **Taux d'impôt à la source** — le barème B1 genevois est progressif ; le taux exact
   pour un revenu brut déterminant de CHF 8'450.– doit être repris du fichier officiel
   des barèmes 2026 de l'administration fiscale cantonale. Corriger `is_taux` dans le
   script si nécessaire.
2. **Primes AANP et IJM** — reprendre les taux figurant sur les polices d'assurance de
   l'entreprise.
3. **CCT applicable** — les taux FAR (1,5 %) et contribution professionnelle (0,7 %)
   correspondent aux usages du secteur principal de la construction. Si l'entreprise
   relève de la CCT du second œuvre romand (agencement, menuiserie), les taux de
   retraite anticipée et de contribution professionnelle diffèrent.
4. **LPP** — vérifier auprès de la caisse de pension le taux de prime de risque et
   la date de début des bonifications de vieillesse (25 ans).
5. **Allocations familiales** — l'enfant à charge ouvre en principe droit à une
   allocation genevoise ; elle est versée par la caisse d'allocations familiales et
   n'a pas été portée sur les fiches. À ajouter si elle transite par l'employeur.
