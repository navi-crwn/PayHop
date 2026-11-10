# Deploying PayHop

PayHop is one Go binary with the browser app embedded. It listens on `127.0.0.1:8105` behind nginx at
`pay.hel.ink`, with the same layout as FileHop. It stores HOP ID accounts and sessions in SQLite and, only for accounts that choose it, saved
payment methods and bills (encrypted, see section 4a); guests leave nothing on the server. It never moves or processes money.

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

### 4a. The key for saved methods and bills (`PAYHOP_PROFILE_KEY`)

Saved payment methods (up to 20 per account) and bill history (the last 200) are encrypted with AES-256-GCM
before they reach the database, one random nonce per row, with the account and the kind bound in. The key is
32 random bytes, base64, in `/etc/payhop/payhop.env` (0640). The installer never creates or prints it; the owner makes it once:

```bash
openssl rand -base64 32          # put the output in PAYHOP_PROFILE_KEY=, nowhere else
```

- **Not set:** the app runs; sign-in, the generator and the split calculator work; saving shows "switched off" and
  the API answers 503 `storage_off`. Setting it later turns saving on at the next restart.
- **Malformed** (not base64 of 32 bytes): the server refuses to start and says which variable is wrong, never what it holds.
- **Back it up separately from the database.** The database holds only ciphertext. Lose the key and the saved items
  cannot be read (the account page hides them and still lets the person delete them). Back up the env file, not
  the database, as the place the key lives.
- **Rotation** (two steps, no downtime beyond two restarts):
  1. Put the new key in `PAYHOP_PROFILE_KEY` and the old one in `PAYHOP_PROFILE_KEY_PREV`; restart. Old rows still open.
  2. Run `sudo -u payhop bash -c 'set -a; . /etc/payhop/payhop.env; set +a; /usr/local/bin/payhop reencrypt'`.
     It rewrites every row under the new key in one transaction and prints how many.
     If a row cannot be opened it changes nothing and says so. Then remove `PAYHOP_PROFILE_KEY_PREV` and restart.
- **Never in logs or Imperium:** nothing saved is logged and `/hop/*` only counts rows (`methods_saved`, `bills_saved`).
  When a HOP ID is deleted the hub's `account.deleted` event removes the account's rows with it.

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
the database in `/var/lib/payhop` holds the accounts that signed in and, encrypted, what they chose to save.
