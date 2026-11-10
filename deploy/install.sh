#!/usr/bin/env bash
# Installs or updates PayHop on the VPS. Run as root (sudo), from the
# repository root, after building the binary as a normal user:
#
#   npm ci && npm run build
#   ~/sdk/go/bin/go build -trimpath -ldflags "-s -w -X main.version=$(git describe --tags --always)" -o payhop ./cmd/payhop
#   sudo bash deploy/install.sh ./payhop
#
# First run: creates the payhop user, /etc/payhop/payhop.env (with a fresh
# secret that is never printed), the systemd unit and
# the nginx vhost. Later runs: replace the binary and restart. Never overwrites
# an existing env file.
set -euo pipefail

bin=${1:?usage: sudo bash deploy/install.sh ./payhop}
here=$(cd "$(dirname "$0")" && pwd)

[ "$(id -u)" = 0 ] || { echo "run with sudo" >&2; exit 1; }
"$bin" -version >/dev/null || { echo "$bin does not run" >&2; exit 1; }

id payhop >/dev/null 2>&1 || useradd --system --home /var/lib/payhop --shell /usr/sbin/nologin payhop

if [ ! -f /etc/payhop/payhop.env ]; then
  install -d -m 0750 -o root -g payhop /etc/payhop
  ( umask 0137
    sed "s|^PAYHOP_SSO_SECRET=.*|PAYHOP_SSO_SECRET=$(openssl rand -hex 32)|" "$here/payhop.env.example" > /etc/payhop/payhop.env )
  chown root:payhop /etc/payhop/payhop.env
  chmod 0640 /etc/payhop/payhop.env
  echo "Created /etc/payhop/payhop.env with a fresh PAYHOP_SSO_SECRET (not printed)."
  echo "Copy it to the hub as HOP_SSO_SECRET_PAYHOP without showing it: see docs/DEPLOY.md, step 3."
fi

# keep the previous binary for a quick rollback
[ -f /usr/local/bin/payhop ] && cp -p /usr/local/bin/payhop /usr/local/bin/payhop.prev
install -m 0755 "$bin" /usr/local/bin/payhop

install -m 0644 "$here/payhop.service" /etc/systemd/system/payhop.service
systemctl daemon-reload
systemctl enable payhop >/dev/null
systemctl restart payhop

if [ ! -f /etc/nginx/sites-available/pay.hel.ink ]; then
  install -m 0644 "$here/nginx/pay.hel.ink.conf" /etc/nginx/sites-available/pay.hel.ink
  ln -sf /etc/nginx/sites-available/pay.hel.ink /etc/nginx/sites-enabled/pay.hel.ink
fi
nginx -t
systemctl reload nginx

sleep 1
systemctl --no-pager --lines=3 status payhop | head -5
curl -fsS http://127.0.0.1:8105/healthz && echo "PayHop $(/usr/local/bin/payhop -version) is up"
