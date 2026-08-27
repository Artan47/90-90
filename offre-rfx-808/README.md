# RFX rfx_808 — BPS-26-01958-ITB · Fourniture, agencement et pose de cuisine

Construction du prix de l'offre LD-Agencium Sàrl.

```bash
python3 offre-rfx-808/calcul_offre.py     # imprime le détail et régénère le PDF
```

`calcul_offre.py` contient toute la logique ; les coûts de revient et les coefficients
sont en tête de fichier. `offre-rfx-808-ld-agencium.pdf` est le bordereau à joindre.

## Méthode de prix

Coût de revient annoncé : **6'000.– de fourniture + 4'000.– de montage = 10'000.–**.

1. **Ventilation du coût.** Les 6'000.– sont répartis ligne par ligne (caissons,
   électroménager, plan de travail, sanitaire, dosseret) et les 4'000.– convertis en
   heures : 57.1 h à 70.–/h de coût interne (charges comprises, cf. la fiche de salaire
   du monteur). Les heures directes de pose ne représentent que 29.4 h ; le solde couvre
   le relevé, la préparation, la livraison DDP, les protections de chantier, les réglages
   et le nettoyage — imposés par la remarque v du cahier des charges — et est réparti au
   prorata.
2. **Marge fourniture ×2.5**, mais **répartie par famille** et non uniformément :
   menuiserie ×3.05, sanitaire ×2.5, plan de travail Dekton ×2.4, électroménager ×1.5.
   Le total reste 6'000 × 2.5 = **15'000.–**, tout en gardant chaque ligne crédible :
   un Miele majoré de 150 % sortirait au-dessus du prix public et ferait sauter l'offre
   à l'analyse des prix unitaires.
3. **Marge montage ×1.5**, soit un prix de vente de **105.–/h** — le même que le tarif
   de régie du chef monteur au chapitre 2, ce qui rend l'offre cohérente de bout en bout.
4. Prix unitaires arrondis à 5 francs.

| | CHF |
|---|---:|
| Sous-total chapitre 1 | 21'008.95 |
| Sous-total chapitre 2 | 33'858.00 |
| **Total évalué** | **54'866.95** |
| Coût de revient chapitre 1 | 10'000.00 |
| **Marge brute chapitre 1** | **11'008.95 (52.4 %)** |

Le chapitre 2 est majoré de **+25 %** par rapport aux prix équivalents du chapitre 1 :
une commande isolée sur deux ans supporte son propre déplacement, sa propre mise en
route et le risque d'indexation des matières. L'électroménager échappe à cette
majoration (le prix d'achat, lui, ne change pas).

## Point de vigilance sur le coût de revient

Le prix des lignes 2.2.9 (réfrigérateur Miele K 7737 D) et 2.2.13 (Dekton Danae) est
difficilement compatible avec un budget matière de 6'000.– pour l'ensemble : le calcul
ci-dessus ne peut leur attribuer que 1'640.– et 230.–/ml. Si les 6'000.– ne couvrent en
réalité que les meubles, le scénario B du script recalcule :

| | CHF |
|---|---:|
| Coût de revient réel | 11'642.25 |
| Marge aux prix ci-dessus | 9'366.70 (44.6 %) |
| Prix corrigé ligne 2.2.9 | 4'445.00 /pce |
| Prix corrigé ligne 2.2.13 | 1'240.00 /ml |
| Sous-total chapitre 1 corrigé | 23'906.35 |

**À vérifier avant de saisir les prix** : demander l'offre nette du fournisseur pour le
Miele et le devis du marbrier pour le Dekton, puis relancer le script avec les vrais
chiffres.

## Ce qu'il faut soigner dans la réponse, au-delà du prix

- **Vérifier les quantités sur les plans** (remarques i et vi) : le soumissionnaire est
  responsable des métrés. Les 3.215 ml de Dekton et les 3.825 ml de dosseret doivent être
  recomptés sur les plans avant dépôt — une erreur ici est à la charge de l'adjudicataire.
- **Ne laisser aucune ligne à 0** : le système additionne les montants, une ligne vide ou
  à zéro peut faire écarter l'offre comme incomplète.
- **DDP + déchargement** : la livraison, le déchargement, les moyens de levage et les
  protections sont dans les prix, jamais en supplément.
- **Prix fermes 24 mois** : les 25 % du chapitre 2 couvrent aussi ce risque d'indexation.
- **Équivalences** : proposer le Miele demandé au chapitre 1 ; si une variante équivalente
  moins chère existe, la présenter comme variante chiffrée séparément, sans remplacer
  l'offre de base — remplacer le produit demandé dans l'offre de base est un motif
  classique d'écartement.
- **Différenciateurs à mettre en avant** dans la partie technique : entreprise genevoise
  soumise à la CCT, personnel déclaré, atelier propre, délais de fabrication (6 semaines)
  et de pose (3 jours), garantie SIA 118, disponibilité SAV, références de chantiers
  similaires, procédure de validation des plans d'atelier avant fabrication.
