# Deploying PayHop

PayHop is one Go binary with the browser app embedded. It listens on `127.0.0.1:8105` behind nginx at
`pay.hel.ink`, with the same layout as FileHop. It stores only HOP ID accounts and sessions in SQLite; guests
leave nothing on the server. It never moves or processes money.

## 1. Build (as a normal user)

```bash
npm ci
npm run build                       # web/dist, embedded by the Go build
export PATH=$HOME/sdk/go/bin:$PATH
go build -trimpath -ldflags "-s -w -X main.version=$(git describe --tags --always)" -o payhop ./cmd/payhop
./payhop -version
```

`-X main.version` is correct because the variable is `version` in package `main` (`cmd/payhop/main.go`).

## 2. Install (needs sudo)

```bash
sudo bash deploy/install.sh ./payhop
```

First run: creates the `payhop` system user, `/etc/payhop/payhop.env` (0640, root:payhop) with a fresh
`PAYHOP_SSO_SECRET` that is never printed, the systemd unit and the nginx vhost. Later runs replace the
binary (the old one is kept as `payhop.prev`) and restart. Check before running: `bash -n deploy/install.sh` and
`ss -ltn | grep 8105` (nothing should listen on 8105).

## 3. Connect HOP ID (hub side, owner)

1. Copy the secret to the hub as `HOP_SSO_SECRET_PAYHOP` without printing it
   (`sudo grep ^PAYHOP_SSO_SECRET= /etc/payhop/payhop.env | cut -d= -f2-` into the hub env).
2. In HEL.ink: add the app to `config/hop.php`, run
   `php artisan db:seed --class='Database\Seeders\HopAppsSeeder'`, then `php artisan config:cache`.
   The checklist is `MASTER-APP-BARU.md` in the planning documents.
3. Add `pay.hel.ink` to `trusted_hosts` in hop-auth so chained sign-out comes back here.

## 4. Settings (`/etc/payhop/payhop.env`)

See `deploy/payhop.env.example`. `PAYHOP_HOP_CLIENTS=imperium,helink` are the apps allowed to call `/hop/*`.
Saved payment methods and bill history are **not** part of this release, so there is no `PAYHOP_PROFILE_KEY` yet.

## 5. Checks

```bash
curl -fsS http://127.0.0.1:8105/healthz
curl -sI https://pay.hel.ink/ | grep -i content-security-policy    # no CDN host, no unsafe-eval
```

PayHop sends no COOP/COEP headers (it needs no SharedArrayBuffer). Do not add a second
`Content-Security-Policy` in nginx. **HSTS** is not sent by the Go server or by this nginx vhost: like FileHop (which has none
in its code or vhost), PayHop leaves it to the edge. Turn it on in Cloudflare (SSL/TLS > Edge Certificates > HSTS) for
`hel.ink` once, which covers every HOP app.

## Rollback and removal

`sudo cp /usr/local/bin/payhop.prev /usr/local/bin/payhop && sudo systemctl restart payhop`. To remove,
stop and disable the unit, delete `/etc/systemd/system/payhop.service`, the nginx vhost and `/etc/payhop`;
the database in `/var/lib/payhop` holds only accounts that signed in.
