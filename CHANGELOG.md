# Changelog

What changed in PayHop, newest first. The `/changelog` page shows the repository history from a snapshot
(`web/changelog.json`, written by `scripts/build-changelog.py`).

## [Unreleased]

### Added
- First release candidate of PayHop (`pay.hel.ink`): payment QR codes for PayPal.me, Cash App, Venmo, Solana Pay, UPI and EPC SEPA, and a split-bill calculator, both running in the browser tab.
- The receiver name is required, shown next to the code and printed under it in the downloaded PNG; a confirmation tick is needed before download; every format is labelled "not tested in a wallet yet" (`docs/WALLET-MATRIX.md` lists the source and the status of each).
- `web/src/lib/pay` (pure, no DOM): CRC-16, text hygiene (NFC, hidden and bidi characters, mixed alphabets), integer amounts by currency exponent, IBAN and Solana address checks, `splitBill` with exact sums; 29 tests including a QR round trip through a decoder.
- Go server (healthz, CSP without CDN, no COOP/COEP), HOP ID sign-in, signed `/hop/*` protocol, `/api/v1/changelog`.
- Public top bar and family footer, signed-in dashboard chrome (top bar with language, theme, account menu; sidebar with the HOP family), home page with the 3D PayHop mark (hop-assets v8 engine, block map in `src/lib/brand.ts`), nine languages (en, zh-CN, de, id, ja, pt-BR, es, fr, ru), reduced-motion static page, offline service worker.
- `deploy/` (systemd unit, env example, nginx vhost, `install.sh`), CI (web, Go, commit message check), README in nine languages, `SECURITY.md`.

### Not yet
- Saved payment methods and bill history for accounts (a later pull request).
- QRIS, Pix and other bank-QR schemes; pasting someone else's QR (needs real sample codes and wallet tests).
- hop-assets v9 (mark, name letters and 3D map as shipped assets; today they live in this repository).
