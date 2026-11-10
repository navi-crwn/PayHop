# Changelog

What changed in PayHop, newest first. The `/changelog` page shows the repository history from a snapshot
(`web/changelog.json`, written by `scripts/build-changelog.py`).

## [Unreleased]

### Changed
- hop-assets v9 replaces v8: vendored byte for byte from the hub (`public/hop-assets/v9`), `tools/hop-apps.json` is the hub manifest, the family list in the app is read from it at build time, and the local brand folder, mark, PWA icons, name font file and 3D block map are gone (mark, icons, Unbounded name subset, hero stills and the PayHop map come from v9). The README family table and `scripts/check-hop-family.sh` are the hub's.

### Added
- PromptPay (Thailand, mobile number, optional amount) and VietQR (Vietnam, bank BIN + account, optional amount) in the generator, built from typed identifiers with a small EMVCo module in `hop-pay` (TLV writer, CRC-16/CCITT-FALSE, TLV reader and CRC check for read-back tests). Tag layout is from secondary sources and marked unverified in `docs/WALLET-MATRIX.md`; no official example payload is stored; both are labelled "not tested in a wallet yet". No scanner, no QR pasting, no other EMVCo scheme.
- Saved payment methods (up to 20, one row each) and bill history (the last 200) for signed-in accounts, sealed with AES-256-GCM under `PAYHOP_PROFILE_KEY` (random nonce per row; `PAYHOP_PROFILE_KEY_PREV` and `payhop reencrypt` for rotation). Explicit, unticked-by-default consent for every method and bill, delete one or everything at any time, `account.deleted` from the hub removes it all. Without a key saving is off and the rest of the app works. Nothing saved is written to logs or shown through `/hop/*` (the manifest lists no content types; `/hop/stats` carries accounts and sessions only).
- `/account` lists what is saved with a delete dialog; `/generate` can use a saved method and save the current method or bill. Strings in all nine languages; privacy and terms say what is stored and carry a date.
- `canonical` on every page, `sitemap.xml`, `robots.txt` with the sitemap and the private paths, `noindex` on `/account`.
- README badges and WebP screenshots; `docs/DEPLOY.md` covers the key, rotation and backups.
- First release candidate of PayHop (`pay.hel.ink`): payment QR codes for PayPal.me, Cash App, Venmo, Solana Pay, UPI and EPC SEPA, and a split-bill calculator, both running in the browser tab.
- The receiver name is required, shown next to the code and printed under it in the downloaded PNG; a confirmation tick is needed before download; every format is labelled "not tested in a wallet yet" (`docs/WALLET-MATRIX.md` lists the source and the status of each).
- `web/src/lib/pay` (pure, no DOM): CRC-16, text hygiene (NFC, hidden and bidi characters, mixed alphabets), integer amounts by currency exponent, IBAN and Solana address checks, `splitBill` with exact sums; 29 tests including a QR round trip through a decoder.
- Go server (healthz, CSP without CDN, no COOP/COEP), HOP ID sign-in, signed `/hop/*` protocol, `/api/v1/changelog`.
- Public top bar and family footer, signed-in dashboard chrome (top bar with language, theme, account menu; sidebar with the HOP family), home page with the 3D PayHop mark (hop-assets v8 engine, block map in `src/lib/brand.ts`), nine languages (en, zh-CN, de, id, ja, pt-BR, es, fr, ru), reduced-motion static page, offline service worker.
- `deploy/` (systemd unit, env example, nginx vhost, `install.sh`), CI (web, Go, commit message check), README in nine languages, `SECURITY.md`.

### Fixed
- The name printed on the downloaded PNG is cut on whole characters, never inside an emoji or a surrogate pair.

### Not yet
- QRIS, Pix and other bank-QR schemes; pasting someone else's QR (needs real sample codes and wallet tests).
- hop-assets v9 (mark, name letters and 3D map as shipped assets; today they live in this repository).
