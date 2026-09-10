#!/usr/bin/env bash
# Deploy: builds dist/ (website/ + configuration + the private overlay) and
# mirrors it to the webspace over FTP.
# Credentials come from .env (never commit it) - template: .env.example
#
#   ./deploy.sh           build and mirror (deletes on the server what is gone)
#   ./deploy.sh --dry-run build and only show what would happen
#
# Before the first deploy: switch the SSL certificate on at the host -
# without HTTPS there is no service worker and no PWA.
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v lftp >/dev/null; then
    echo "lftp is missing. Install it with: brew install lftp" >&2
    exit 1
fi

if [[ ! -f .env ]]; then
    echo ".env is missing. Copy .env.example to .env and fill in the FTP credentials." >&2
    exit 1
fi
set -a; source .env; set +a

# Always build fresh: dist/ comes out of website/ plus site/site.json and
# site/overlay/ (name, imprint, logo, palette). Without this step the
# placeholders would go up as they are.
python3 tools/opensource/build.py

: "${FTP_HOST:?FTP_HOST missing in .env}"
: "${FTP_USER:?FTP_USER missing in .env}"
: "${FTP_PASS:?FTP_PASS missing in .env}"
FTP_DIR="${FTP_DIR:-/}"

DRY=""
if [[ "${1:-}" == "--dry-run" || "${1:-}" == "--probe" ]]; then
    DRY="--dry-run"
    echo "== dry run - nothing is uploaded =="
fi

# --delete keeps the server exactly at the state of dist/.
# FTPS with encryption forced; most hosts speak explicit FTPS.
lftp -u "$FTP_USER","$FTP_PASS" "ftp://$FTP_HOST" <<EOF
set ftp:ssl-force true
set ftp:ssl-protect-data true
set ssl:verify-certificate yes
mirror --reverse --delete --verbose $DRY ./dist "$FTP_DIR"
bye
EOF

echo "Done. Remember: when cached files change, count VERSION in website/sw.js up."
