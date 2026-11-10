# Wallet matrix

What each PayHop format builds, which public source describes it, and how far it has been checked.
**No format has been scanned by a real wallet yet**: every format shows "Not tested yet" in the app
(`display.tested` is always `false` in `web/src/lib/pay`). This table is the place that changes first when
someone tests one with a small real payment.

Status words: **sourced** = the structure matches a public document that was read on 2026-11-10;
**unverified** = written from the maintainers' memory or secondary sources, no primary document read;
**tested** = a real wallet accepted a scan (none yet).

| Format | Payload built | Source | Structure | Wallet test |
|---|---|---|---|---|
| PayPal.me | `https://paypal.me/<name>[/<amount><CUR>]` | PayPal help, "What is PayPal.Me?" (<https://www.paypal.com/uk/cshelp/article/what-is-paypalme-help432>): amount appended to the link, currency code after the amount, e.g. `PayPal.Me/DiaRusso/25AUD` | **sourced** (link shape). The 1-20 letters/digits limit for `<name>` is **unverified** | not tested |
| Cash App | `https://cash.app/$<cashtag>[/<amount>]` | Cash App help pages answered 403 to automated reading; secondary sources only | **unverified** (cashtag rules: letters, digits, `_`, at most 20, at least one letter, are the maintainers' reading) | not tested |
| Venmo | web: `https://venmo.com/<user>?txn=pay[&amount=..][&note=..]`; app: `venmo://paycharge?txn=pay&recipients=<user>[&amount][&note]` | Venmo payment links page (<https://venmo.com/paymentlinks>): `txn=pay`/`charge`, decimal `amount` without `$`, URL-escaped `note`, `recipients` list | web link **sourced**; the `venmo://paycharge` app scheme and the 5-30 character username rule are **unverified** | not tested |
| Solana Pay | `solana:<recipient>[?amount=..&spl-token=..&label=..&message=..&memo=..]` | Solana Pay specification (github.com/solana-foundation/solana-pay). The page was unreachable on 2026-11-10 (HTTP 503/404), so it was **not read** | **unverified**. Built from memory: 32-byte base58 recipient, plain decimal amount (no scientific notation), URL-encoded text fields | not tested |
| UPI | `upi://pay?pa=<vpa>&pn=<name>[&am=..]&cu=INR[&tn=..]` | NPCI UPI linking specification; a copy hosted by a third party and several developer guides agree on `pa`, `pn`, `am`, `cu`, `tn`. The NPCI PDF itself was not found | **unverified** (one source calls `pn` mandatory, another optional; PayHop requires it, which is the safer reading and is what the "name is always shown" rule needs) | not tested |
| EPC SEPA | 12 lines: `BCD`, `002`, `1`, `SCT`, BIC, name, IBAN, `EUR<amount>`, purpose, structured reference, free reference, information; at most 331 bytes | EPC069-12 v3.0, 13 Sep 2022 (<https://europeanpaymentscouncil.eu/sites/default/files/kb/file/2022-09/EPC069-12%20v3.0%20Quick%20Response%20Code%20-%20Guidelines%20to%20Enable%20the%20Data%20Capture%20for%20the%20Initiation%20of%20an%20SCT_0.pdf>). Search results quoted the 331-byte limit and UTF-8 byte counting; the PDF text could not be extracted by the tool | 331-byte limit **sourced** (via the EPC document's indexed text). Line order, version `002` (BIC optional), 70/140/70 character limits, and the 0.01..999999999.99 amount range are **unverified** (recalled; the PDF was binary to the reader) | not tested |

## What the tests prove (and do not)

`npm test` checks that the builders give the exact strings above, that amounts are exact integers, that names
are cleaned, that IBAN and Solana addresses are validated, and that a payload round-trips through QR drawing and
a QR decoder (jsQR). That proves PayHop writes what this table says. It does **not** prove a wallet accepts it.

`crc16("123456789") = 0x29B1` is the only CRC value stored (it is the standard check value of CRC-16/CCITT-FALSE);
no EMVCo test vectors are included because none were supplied (QRIS, Pix and the other bank-QR schemes are out of
scope until real sample codes exist).

## How to move a format to "tested"

1. Build a code for a small amount to an account you own.
2. Scan it with the real wallet app and complete or cancel at the confirmation screen; note the wallet, its version,
   the country and the date.
3. Record it here, then change that format's `tested` flag and the label in the app in one pull request.
