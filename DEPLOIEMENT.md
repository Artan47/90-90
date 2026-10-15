# Mettre l'application en ligne sur www.sadite.ch (Infomaniak)

L'application est un **site statique** : des fichiers HTML, CSS, JS et des
images. Aucun serveur applicatif, aucune base de données, aucun PHP. Elle se
dépose telle quelle sur un hébergement web classique.

---

## 1. Construire le site

```bash
npm install
npm run build
```

Le dossier **`out/`** contient tout le site. C'est le seul dossier à mettre
en ligne.

```
out/
  index.html          ← page d'accueil
  stays/index.html
  plan/index.html
  timeline/index.html
  settings/index.html
  about/index.html
  manifest.webmanifest
  sw.js               ← service worker (mode hors ligne)
  icons/
  _next/              ← styles et scripts
```

---

## 2. Déposer les fichiers chez Infomaniak

Dans le **Manager Infomaniak** → *Hébergement Web* → votre site :

1. **Créer le site** pour le domaine `sadite.ch`, en cochant aussi
   `www.sadite.ch`.
2. Dans **FTP/SSH**, créer un utilisateur FTP si vous n'en avez pas.
3. Envoyer **le contenu de `out/`** (pas le dossier lui-même) dans le
   répertoire racine du site, généralement `/web/` ou `/sites/sadite.ch/`.

Avec un client FTP (FileZilla, Cyberduck), ou en ligne de commande :

```bash
# Exemple avec lftp — remplacez l'utilisateur et le serveur par les vôtres
lftp -u VOTRE_UTILISATEUR ftp.infomaniak.com \
  -e "mirror -R --delete out/ /web/ ; quit"
```

> ⚠️ `--delete` supprime sur le serveur les fichiers absents de `out/`.
> C'est voulu : les anciens bundles JavaScript doivent disparaître.

---

## 3. Activer HTTPS — indispensable

Dans le Manager → **Certificats SSL**, activer le certificat **Let's Encrypt**
(gratuit), puis forcer la redirection HTTP → HTTPS.

Ce n'est pas optionnel : **le service worker et l'installation sur l'écran
d'accueil ne fonctionnent qu'en HTTPS**. Sans certificat, l'application
s'affiche mais perd le mode hors ligne et ne s'installe pas.

---

## 4. Choisir entre `sadite.ch` et `www.sadite.ch`

Prenez-en **un seul** comme adresse officielle et redirigez l'autre dessus
(Manager → *Domaine* → *Redirections*). Deux adresses distinctes signifient
**deux stockages séparés** : les séjours saisis sur `www.sadite.ch`
n'apparaîtraient pas sur `sadite.ch`, parce que les données vivent dans le
navigateur, par domaine.

C'est le piège le plus probable de cette mise en ligne.

---

## 5. Vérifier après la mise en ligne

1. Ouvrir `https://www.sadite.ch` sur un téléphone.
2. Saisir un séjour, fermer l'onglet, rouvrir : le séjour est toujours là.
3. **Mode avion** → recharger la page : l'application doit s'ouvrir et
   calculer normalement.
4. Android/Chrome : la bannière « Installer » apparaît.
   iPhone/Safari : Partager → *Sur l'écran d'accueil*.
5. Onglet **Réseau** des outils de développement : aucune requête vers un
   domaine autre que `sadite.ch`.

---

## 6. Mettre à jour le site

```bash
git pull
npm install
npm run build
# puis renvoyer out/ par FTP, comme à l'étape 2
```

Le service worker porte un identifiant unique à chaque construction : les
visiteurs reçoivent la nouvelle version au chargement suivant, sans avoir à
vider leur cache.

---

## 7. Ce qui ne change pas

Aucune donnée ne part sur le serveur d'Infomaniak. Les séjours, les
passeports et les personnes restent **dans le navigateur de chaque
appareil**. L'hébergeur ne sert que des fichiers ; il ne voit jamais le
contenu saisi.

Conséquence à connaître : **les données ne se synchronisent pas d'un
appareil à l'autre**. Chaque téléphone a les siennes. L'export JSON des
réglages sert à les transférer ou à les sauvegarder.
