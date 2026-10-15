#!/usr/bin/env bash
#
# Envoie le site construit vers l'hébergement Infomaniak de sadite.ch.
#
#   ./scripts/deploy-infomaniak.sh
#
# Les identifiants ne sont JAMAIS écrits dans ce fichier ni dans le dépôt :
# ils sont lus depuis l'environnement, ou demandés à l'exécution.
#
#   export SADITE_FTP_HOST=ftp.infomaniak.com
#   export SADITE_FTP_USER=votre_utilisateur
#   export SADITE_FTP_PASS=votre_mot_de_passe
#   export SADITE_FTP_DIR=/web           # dossier racine du site
#
# Sur l'offre Starter (gratuite avec le domaine), Infomaniak n'accepte que
# le FTP simple sur le port 21 : ni FTPS, ni SFTP. Dans ce cas seulement :
#
#   export SADITE_FTP_PLAIN=1
#
# Le mot de passe circule alors en clair sur le réseau. À n'utiliser que
# sur une offre qui ne propose rien d'autre, et depuis une connexion de
# confiance.
#
set -euo pipefail

cd "$(dirname "$0")/.."

HOST="${SADITE_FTP_HOST:-ftp.infomaniak.com}"
DIR="${SADITE_FTP_DIR:-/web}"

if [ -z "${SADITE_FTP_USER:-}" ]; then
  read -rp "Utilisateur FTP : " SADITE_FTP_USER
fi
if [ -z "${SADITE_FTP_PASS:-}" ]; then
  read -rsp "Mot de passe FTP : " SADITE_FTP_PASS
  echo
fi

command -v lftp >/dev/null 2>&1 || {
  echo "✗ lftp n'est pas installé."
  echo "  macOS   : brew install lftp"
  echo "  Debian  : sudo apt install lftp"
  exit 1
}

echo "→ Construction du site…"
npm run build

[ -f out/index.html ] || { echo "✗ out/index.html manquant : la construction a échoué."; exit 1; }

echo "→ Envoi vers ${HOST}:${DIR}…"
# --delete retire du serveur les fichiers absents de out/ : indispensable
# pour que les anciens bundles JavaScript disparaissent.
# --exclude-glob .well-known/ laisse intact le dossier des certificats.
if [ "${SADITE_FTP_PLAIN:-0}" = "1" ]; then
  echo "⚠ FTP NON CHIFFRÉ (offre Starter) : le mot de passe circule en clair."
  SSL_SETTINGS="set ftp:ssl-allow false"
else
  SSL_SETTINGS="set ftp:ssl-allow true
set ftp:ssl-force true
set ssl:verify-certificate true"
fi

lftp -u "$SADITE_FTP_USER","$SADITE_FTP_PASS" "$HOST" <<LFTP
$SSL_SETTINGS
mirror --reverse --delete --verbose --parallel=4 \
       --exclude-glob .well-known/ \
       out/ "$DIR"
bye
LFTP

echo "✓ Terminé. Vérifiez https://www.sadite.ch"
echo "  — en navigation privée, pour ne pas servir une version en cache."
