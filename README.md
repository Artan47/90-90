# Sa ditë — llogaritësi 90/180 për Schengenin

Application web installable (PWA) qui calcule les jours restants dans l'espace
Schengen selon la règle **90 jours sur toute période de 180 jours**, pour des
ressortissants du Kosovo qui font des allers-retours fréquents.

**Plusieurs personnes** peuvent être suivies sur le même appareil, chacune avec
son historique, son passeport et son compteur — le quota 90/180 est individuel.
Interface en **albanais (shqip)** et en **français**, changeable à tout moment
dans les réglages. Aucun compte, aucun serveur, **aucune donnée ne quitte
l'appareil**.

---

## Pourquoi cette application

Depuis le 1er janvier 2024, les titulaires d'un passeport biométrique du Kosovo
entrent sans visa dans l'espace Schengen pour des séjours courts limités à
90 jours sur 180.

Depuis le 10 avril 2026, le système **EES** enregistre les passages
numériquement (empreintes, reconnaissance faciale) et **le tampon sur le
passeport a été supprimé**. Une personne qui vient plusieurs fois par an n'a
donc plus aucune trace papier de ses jours consommés. Un dépassement, même d'un
jour, est enregistré en base et suit la personne au passage frontière suivant.

L'outil officiel EES existe, mais **il ne connaît que les passages depuis le
12 octobre 2025 et ne permet pas de planifier un voyage futur**. C'est
exactement ce que fait cette application.

---

## La règle de droit implémentée

**Base légale :** article 6 §1 du règlement (UE) 2016/399 (code frontières
Schengen) — séjour de 90 jours maximum sur toute période de 180 jours, « ce qui
implique d'examiner la période de 180 jours précédant chaque jour de séjour ».

### Les cinq règles opérationnelles

1. **La fenêtre de 180 jours est glissante**, pas fixe. Pas de semestre, pas de
   remise à zéro au 1er janvier. Pour chaque jour évalué `D`, on examine la
   fenêtre `[D − 179 ; D]`, soit 180 jours calendaires **incluant `D`**.
2. **Le jour d'entrée compte comme premier jour, le jour de sortie comme
   dernier jour.** Tous deux comptent comme des journées pleines, quelle que
   soit l'heure. Entrée et sortie le même jour = 1 jour.
3. **On compte des jours de présence distincts** dans la fenêtre, et ce nombre
   doit être ≤ 90. On ne somme pas les durées de séjour : deux séjours qui se
   chevauchent ne comptent leurs jours communs qu'une fois (`Set` de dates ISO).
4. **Le compte est commun à tout l'espace Schengen.** Ce n'est pas 90 jours par
   pays ; le pays visité n'est enregistré qu'à titre informatif.
5. **Ne comptent pas** : les jours sous visa national de long séjour (type D) ou
   sous titre de séjour d'un État Schengen (`exempt: true`), ni les jours passés
   hors de l'espace Schengen.

### Trois idées fausses que l'application n'implémente PAS

Ce sont les bugs classiques des calculateurs amateurs. Chacun est couvert par un
test qui échouerait si la logique était naïve.

| Idée fausse | Réalité | Test |
| --- | --- | --- |
| « 90 jours dehors = 90 jours de crédit rendus » | Après un séjour continu de 90 jours, 90 jours d'absence ne rendent **qu'un seul jour**. Le crédit revient jour par jour, à mesure que chaque jour consommé sort de la fenêtre. | TEST A |
| « Les jours restants aujourd'hui = la durée maximale du prochain séjour » | Faux, et très en dessous de la réalité : pendant le séjour, d'anciens jours continuent de sortir de la fenêtre. **40 jours restants permettent 70 jours consécutifs.** | TEST B |
| « La fenêtre part de demain / de la veille » | La fenêtre est `[D − 179 ; D]`, bornes incluses, soit exactement 180 jours. Un décalage d'un jour fausse tout le calcul. | TEST 1 |
| « Les jours passés dehors s'ajoutent au quota » | Non. Attendre une semaine hors Schengen n'ajoute rien **en soi** : le quota ne remonte que lorsqu'un ancien jour de présence **sort** de la fenêtre de 180 jours. D'où des paliers brutaux — dans un cas réel, entrer deux jours plus tard fait passer de 13 à 43 jours possibles. | `stayMilestones` |

### Ce que la règle ne couvre pas

Rappelé dans l'écran « Rreth aplikacionit » (À propos) de l'application :

- Passeport biométrique, délivré depuis moins de 10 ans, valable au moins
  3 mois après la date de sortie prévue.
- Justification de l'objet du séjour, moyens de subsistance, assurance.
- Le **travail rémunéré est interdit** sous exemption de visa, même quelques jours.
- **Le garde-frontière a le dernier mot.**
- **ETIAS n'est pas encore en vigueur** : son lancement a été repoussé à 2027.
  L'application affiche un encart informatif, sans fonctionnalité associée.

---

## Table datée d'appartenance à l'espace Schengen

**Source unique de vérité : [`lib/schengen-membership.ts`](lib/schengen-membership.ts).
Aucun autre fichier ne contient de liste de pays.**

L'appartenance à Schengen change : un séjour de 20 jours en Roumanie en mai 2023
ne consommait aucun jour du quota, le même séjour en mai 2026 en consomme 20.
La table est donc **datée**, et le moteur tranche **pays par jour**, pas pays par
pays.

> **Dernière vérification : `2026-08-27`** (constante `LAST_VERIFIED`)
> **Prochaine échéance attendue : Chypre.**

| Pays | Compte à partir du | Remarque |
| --- | --- | --- |
| Allemagne, Autriche, Belgique, Danemark, Espagne, Estonie, Finlande, France, Grèce, Hongrie, Italie, Lettonie, Lituanie, Luxembourg, Malte, Pays-Bas, Pologne, Portugal, Slovaquie, Slovénie, Suède, Tchéquie | toujours | membres de longue date |
| Islande, Liechtenstein, Norvège, Suisse | toujours | États associés (non-UE) |
| **Croatie** | `2023-01-01` | |
| **Bulgarie**, **Roumanie** | `2024-03-31` | frontières aériennes et maritimes ; pleine adhésion le `2025-01-01` |
| **Chypre** | ❌ jamais | contrôles intérieurs non abolis, quota 90/180 **séparé** |
| **Irlande** | ❌ jamais | opt-out, régime national |
| **Kosovo**, **Macédoine du Nord**, **Albanie** | ❌ jamais | pays d'origine des utilisateurs : proposés pour marquer les sorties |

Le sélecteur de pays ne propose délibérément que les 29 États Schengen, Chypre
et l'Irlande (les deux cas contre-intuitifs), et les trois pays d'origine
ci-dessus. Un code pays absent de la table n'est jamais compté.

L'espace Schengen compte aujourd'hui **29 États** : 25 États membres de l'UE plus
l'Islande, le Liechtenstein, la Norvège et la Suisse. Un test vérifie ce compte.

### Mettre à jour la table

Quand un pays rejoint l'espace Schengen (Chypre, à terme) :

1. **Vérifier la date d'effet** sur le site du Conseil de l'UE ou au Journal
   officiel de l'Union européenne (décision d'application de l'acquis). Attention
   à la distinction entre l'ouverture des frontières aériennes/maritimes et la
   pleine adhésion terrestre — c'est la première qui fait courir le quota.
2. **Modifier uniquement `lib/schengen-membership.ts`** : donner au pays sa date
   d'effet dans `since` (au lieu de `null`), et ajuster `SCHENGEN_STATE_COUNT`.
3. **Mettre à jour `LAST_VERIFIED`** à la date du jour.
4. **Ajouter un cas de test** « avant / après » dans `lib/schengen-membership.test.ts`,
   sur le modèle de celui de la Roumanie.
5. **`npm test`.**

Les séjours déjà enregistrés sont automatiquement recalculés : ils sont stockés
avec leur code pays, jamais avec un nombre de jours figé.

---

## Architecture

```
lib/
  date.ts                  Helpers de dates calendaires pures (Date.UTC)
  schengen-membership.ts   TABLE DATÉE — source unique de vérité des pays
  schengen.ts              MOTEUR 90/180 — fonctions pures, sans UI ni horloge
  storage.ts               localStorage tolérant aux pannes + export/import JSON
  notifications.ts         Rappels locaux (aucun serveur, aucun push distant)
  passport.ts              Validité du passeport (10 ans, 6 mois, 3 mois après sortie)
  types.ts                 Stay, Person, Profile, AppData
  i18n/sq.ts               Toutes les chaînes, en albanais (langue de référence)
  i18n/fr.ts               Traduction française
  i18n/index.ts            Registre des langues, détection, jetons {x}
app/
  page.tsx                 Écran 1 — « Sa ditë më kanë mbetur? »
  stays/                   Écran 2 — « Qëndrimet e mia »
  plan/                    Écran 3 — « Planifiko udhëtimin »
  timeline/                Écran 4 — « Kalendari »
  settings/                Écran 5 — « Cilësimet »
  about/                   À propos, avertissements, sources officielles
public/
  manifest.webmanifest, sw.js, icons/
scripts/
  make-icons.mjs           Génère les icônes PWA (encodeur PNG sans dépendance)
  build-sw.mjs             Remplit le précache du service worker après le build
  e2e-check.mjs            Vérifie les critères d'acceptation dans un vrai Chromium
```

### Plusieurs personnes

Chaque personne a son `id`, son nom, ses séjours et son passeport. Le
sélecteur en haut de l'écran est visible en permanence : c'est le garde-fou
contre l'erreur la plus coûteuse de l'application — saisir les séjours d'une
personne dans le compteur d'une autre, ce qui donnerait un résultat faux sans
le moindre avertissement.

Au premier lancement, une personne est créée d'office (« Unë » / « Moi ») pour
que l'application soit utilisable sans configuration.

**Migration depuis la version 1.** Les sauvegardes mono-personne sont reprises
telles quelles : leurs séjours deviennent la première personne, le passeport
est conservé, et la langue — qui vivait dans le profil — remonte au niveau de
l'application. La migration est idempotente et couverte par une dizaine de
tests, dont un qui vérifie qu'**aucun séjour n'est perdu**. Le fichier est
réécrit au format courant dès la première ouverture.

### Règle d'or sur les dates

Toutes les dates sont des **dates calendaires pures**, sans heure ni fuseau,
transportées comme chaînes `"YYYY-MM-DD"`.

`new Date("2026-01-05").getDate()` renvoie **le 4 janvier** à l'ouest de
Greenwich : c'est le bug qui casse ce type d'application. Toute l'arithmétique
passe donc par `Date.UTC(...)` dans `lib/date.ts`. La seule fonction qui lit
l'horloge est `todayIso()` ; **le moteur reçoit toujours le jour en paramètre**,
ce qui le rend déterministe et testable.

### Moteur de calcul

Toutes les fonctions de `lib/schengen.ts` sont pures :

| Fonction | Rôle |
| --- | --- |
| `windowStart(day)` | Début de la fenêtre `[day − 179 ; day]` |
| `countedDays(stays, from, to)` | `Set` des jours qui consomment le quota (dédoublonné, exclusions appliquées) |
| `usedOn` / `remainingOn` / `isCompliantOn` | Compteurs pour un jour donné |
| `maxStayFrom(stays, entry)` | Durée maximale d'un séjour commençant à `entry` |
| `earliestReentry` / `fullResetDate` | Premier jour avec ≥ 1 jour, puis avec 90 jours |
| `simulate(stays, trip)` | Verdict d'un voyage, avec date exacte d'infraction |
| `timeline(stays, from, to)` | Un point par jour, pour le graphique |
| `validate(stays, today?)` | `OVERLAP`, `EXIT_BEFORE_ENTRY`, `FUTURE_ENTRY_IN_HISTORY`, `OVER_90` |
| `plannedOutlook(stays, today)` | Juge les voyages planifiés **en bloc**, pas un par un |
| `summarize(stays, today)` | Nombre de séjours réels et total de jours |
| `suggestEntryFor(stays, from, n)` | Première date d'entrée permettant `n` jours d'affilée |
| `stayMilestones(stays, from)` | Paliers : les dates à partir desquelles on peut rester plus longtemps |
| `closeOpenStays(stays, day)` | Ferme les séjours ouverts : hypothèse explicite des projections |
| `statusOn(stays, today)` | Vue d'ensemble de l'écran d'accueil |

Un séjour en cours (`exit === null`) est traité comme se terminant le jour
évalué. Les séjours `planned: true` sont exclus de l'historique réel et
n'entrent que dans les simulations.

`plannedOutlook` évalue chaque voyage planifié **dans le contexte de
l'historique réel ET des autres voyages planifiés** : deux voyages qui passent
isolément peuvent dépasser le quota une fois mis bout à bout. C'est ce calcul
unique qui alimente le résumé de l'écran d'accueil. Les boucles jour par jour sont bornées à
400 itérations (`MAX_ITERATIONS`) pour ne jamais boucler à l'infini.

---

## Développement

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # suite complète, rejouée sous 3 fuseaux horaires
npm run test:coverage
npm run typecheck
npm run build        # export statique dans out/ + précache du service worker
npm run verify       # build + tests + vérification navigateur des critères
```

### Audit par référence indépendante

Le moteur a été confronté à une **seconde implémentation écrite
indépendamment** (présence jour par jour sur des numéros de jour depuis
l'epoch, fenêtre glissante par somme directe, durée maximale par force
brute) sur des historiques aléatoires incluant séjours ouverts, séjours
exempts et pays à adhésion datée : **plus de 4 000 comparaisons, aucun
écart**.

Trois bugs réels ont été trouvés et corrigés par cette démarche :

1. **Projections faussées par un séjour en cours.** Un séjour sans date de
   sortie était réputé courir jusqu'au jour sondé ; en sondant des dates de
   plus en plus lointaines, il grossissait indéfiniment, la recherche
   n'aboutissait jamais et la fonction renvoyait sa **borne de sécurité
   comme si c'était une vraie date** — jusqu'à 7 mois d'écart affichés à
   l'utilisateur. `closeOpenStays()` fixe désormais l'hypothèse
   explicitement (« on sort à la date de référence »), et l'interface
   l'affiche au lieu de la sous-entendre.
2. **Borne de recherche trop courte.** 400 itérations ne suffisaient pas sur
   un historique déjà largement en dépassement. `fullResetDate` est
   maintenant calculée **exactement** (`dernier jour compté + 180`), sans
   boucle ; `earliestReentry` borne sa recherche sur la donnée, plus sur une
   constante.
3. **Dépassement saturé et conseil faux.** `simulate` renvoyait le PIC de
   dépassement, qui plafonne mécaniquement à 90 : une fenêtre de 180 jours ne
   peut pas contenir plus de 180 jours de présence. Un voyage d'un an
   annonçait donc « 90 jours de trop » alors qu'il en comptait 275, et le
   conseil « raccourcis de 90 jours » laissait un séjour encore illégal.
   `daysOver` est désormais le nombre de jours à RETRANCHER
   (`durée − durée légale maximale`), vérifié par un test qui raccourcit
   réellement le voyage et revérifie sa légalité.
4. **Accords grammaticaux.** 22 libellés affichaient « 1 jours »,
   « 1 séjours ». `fill()` accorde désormais via `Intl.PluralRules`, qui
   connaît les vraies règles : le français met « 0 jour » au singulier,
   l'albanais met « 0 ditë » au pluriel.

### Tests

`npm test` exécute la suite sous **UTC**, **Pacific/Kiritimati (UTC+14)** et
**Pacific/Niue (UTC−11)** : les résultats doivent être identiques dans les trois.

Les cas obligatoires du cahier des charges sont écrits tels quels dans
`lib/schengen.test.ts` (TEST 0, 1, A, B, C, D, E). Le seuil de couverture est
appliqué par `vitest.config.ts` et le build échoue en dessous.

`node scripts/e2e-check.mjs` vérifie dans un vrai navigateur : les chiffres du
TEST B affichés à l'écran, le fonctionnement en mode avion, l'enregistrement du
service worker et **l'absence de toute requête vers un domaine tiers**.

---

## Confidentialité

- **Aucune donnée ne quitte l'appareil.** Pas de compte, pas de serveur, pas de
  base de données. Tout vit dans `localStorage`.
- **Aucune analytique, aucune télémétrie.**
- **Aucune police ni script chargés depuis un domaine tiers** : la pile de
  polices est celle du système, tous les fichiers viennent de l'origine de
  l'application. Vérifiable dans l'onglet Réseau du navigateur, et vérifié
  automatiquement par `scripts/e2e-check.mjs`.
- `localStorage` peut être effacé par le navigateur : l'application propose
  l'**export JSON** dès quelques séjours enregistrés.

### Avertissement

Cet outil est **une aide au calcul**. Il n'a **aucune valeur juridique** ; seules
les autorités frontalières font foi. Ce rappel est affiché en permanence en pied
d'écran dans l'application.

### Sources officielles

- [Outil EES officiel — combien de temps puis-je rester](https://travel-europe.europa.eu/ees/check-how-long-you-can-stay)
  (ne connaît que les passages depuis le 12 octobre 2025)
- [Calculateur de court séjour de la Commission européenne](https://home-affairs.ec.europa.eu/policies/schengen-borders-and-visa/border-crossing/schengen-calculator_en)
  (pour les séjours antérieurs)

---

## Déploiement

Export statique (`output: "export"`), déployable tel quel sur n'importe quel
hébergeur de fichiers :

```bash
npm run build   # produit out/
```

Servir `out/` en HTTPS — le service worker et l'installation sur l'écran
d'accueil l'exigent.

Marche à suivre détaillée pour **www.sadite.ch** chez Infomaniak :
[DEPLOIEMENT.md](DEPLOIEMENT.md).

## Langues

L'application est disponible en **albanais** et en **français**. La langue se
change dans **Réglages → Langue / Gjuha**, et le choix est conservé.

Au premier lancement, la langue est déduite du navigateur : `fr-*` donne le
français, tout le reste donne l'albanais, qui est la langue des utilisateurs
visés.

### Ajouter une langue

L'albanais (`lib/i18n/sq.ts`) est la **langue de référence** : le type
`Messages` en est dérivé, donc une clé oubliée ailleurs casse la compilation.

1. Dupliquer `lib/i18n/sq.ts` (par ex. `sr.ts`) et traduire les **valeurs**,
   sans toucher aux clés ni aux jetons `{n}`, `{date}`.
2. L'ajouter à `LOCALES`, `LOCALE_LABELS` et `LOCALE_ORDER` dans
   `lib/i18n/index.ts`, et au type `Locale`.
3. Compléter `detectLocale()` si la langue doit être détectée automatiquement.
4. `npm test` — `lib/i18n/i18n.test.ts` vérifie que toutes les langues ont
   exactement les mêmes clés, aucune valeur vide, et les mêmes jetons `{x}`
   dans chaque libellé.

> ⚠️ Les libellés albanais sont une **proposition de départ** et doivent être
> relus par un locuteur natif. Ils sont tous dans un seul fichier : la
> relecture ne touche aucun code.
