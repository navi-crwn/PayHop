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
| PayPal.me | `https://paypal.me/<name>[/<amount><CUR>]` | PayPal help, "What is PayPal.Me?" (<https://www.paypal.com/uk/cshelp/article/what-is-paypalme-help432>): amount appended to the link, currency code after the amount, e.g. `PayPal.Me/DiaRusso/25AUD` | **sourced** (link shape). The 1-20 letters/digits limit for `<name>` and the list of 24 currencies PayHop allows (AUD, BRL, CAD, CHF, CNY, CZK, DKK, EUR, GBP, HKD, HUF, ILS, JPY, MXN, MYR, NOK, NZD, PHP, PLN, SEK, SGD, THB, TWD, USD) are **unverified** (recalled; the PayPal page that lists them was not read). IDR is not in the list, so PayHop refuses it (`currency_unsupported`) instead of writing a link PayPal may reject | not tested |
| Cash App | `https://cash.app/$<cashtag>[/<amount>]` | Cash App help pages answered 403 to automated reading; secondary sources only | **unverified** (cashtag rules: letters, digits, `_`, at most 20, at least one letter, are the maintainers' reading; the `/<amount>` path segment has no primary source read, so a wallet may ignore the amount and show only the profile) | not tested |
| Venmo | web: `https://venmo.com/<user>?txn=pay[&amount=..][&note=..]`; app: `venmo://paycharge?txn=pay&recipients=<user>[&amount][&note]` | Venmo payment links page (<https://venmo.com/paymentlinks>): `txn=pay`/`charge`, decimal `amount` without `$`, URL-escaped `note`, `recipients` list | web link **sourced**; the `venmo://paycharge` app scheme and the 5-30 character username rule are **unverified** | not tested |
| Solana Pay | `solana:<recipient>[?amount=..&spl-token=..&label=..&message=..&memo=..]` | Solana Pay specification (github.com/solana-foundation/solana-pay). The page was unreachable on 2026-11-10 (HTTP 503/404), so it was **not read** | **unverified**. Built from memory: 32-byte base58 recipient, plain decimal amount (no scientific notation), URL-encoded text fields. With `spl-token` the amount may have at most 9 decimals but the token's own decimals (e.g. 6 for USDC) are not checked, because that needs the mint's data from the network; PayHop warns (`spl_decimals_unchecked`) and shows the masked mint next to "SPL" | not tested |
| UPI | `upi://pay?pa=<vpa>&pn=<name>[&am=..]&cu=INR[&tn=..]` (`pa` with a literal `@`) | NPCI UPI linking specification; a copy hosted by a third party and several developer guides agree on `pa`, `pn`, `am`, `cu`, `tn`. The NPCI PDF itself was not found | **unverified**. `pa` is written with a literal `@` (changed in the audit round: the NPCI examples quoted by the guides use it; `%40` is the same in URI terms but some apps parse the raw string) (one source calls `pn` mandatory, another optional; PayHop requires it, which is the safer reading and is what the "name is always shown" rule needs) | not tested |
| EPC SEPA | 12 lines: `BCD`, `002`, `1`, `SCT`, BIC, name, IBAN, `EUR<amount>`, purpose, structured reference, free reference, information; at most 331 bytes | EPC069-12 v3.0, 13 Sep 2022 (<https://europeanpaymentscouncil.eu/sites/default/files/kb/file/2022-09/EPC069-12%20v3.0%20Quick%20Response%20Code%20-%20Guidelines%20to%20Enable%20the%20Data%20Capture%20for%20the%20Initiation%20of%20an%20SCT_0.pdf>). Search results quoted the 331-byte limit and UTF-8 byte counting; the PDF text could not be extracted by the tool | 331-byte limit **sourced** (via the EPC document's indexed text). Line order, version `002` (BIC optional), 70/140/70 character limits, and the 0.01..999999999.99 amount range are **unverified** (recalled; the PDF was binary to the reader) | not tested |
| PromptPay (TH, mobile number) | EMVCo TLV: `00` 01, `01` 11 (no amount) or 12 (amount), `29` { `00` `A000000677010111`, `01` `0066` + the 9 digits after the leading 0 }, `53` 764, `54` amount in two decimals, `58` TH, `63` CRC-16/CCITT-FALSE | **unverified, secondary source**: the open-source library documentation <https://thai-qr-payment.js.org/reference/spec/> (read 2026-11-11). The Bank of Thailand standard (<https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2562/EngPDF/25620084.pdf>) and the EMVCo specification were not read. The library page states the mobile field as 13 characters but writes its template as 14; PayHop follows the 13-character rule (`0066` + 9 digits), which is how the leading 0 of a Thai number is dropped | tag order, lengths and CRC are tested; **no official example payload was available and none is stored**. PayHop writes no merchant name or city (the code holds only the number; the wallet shows the name the bank has on file, and PayHop says so). National ID, e-wallet and bank-account proxies and bill payment (tag 30) are not built | not tested |
| VietQR (VN, to a bank account) | EMVCo TLV: `00` 01, `01` 11 or 12, `38` { `00` `A000000727`, `01` { `00` 6-digit bank BIN, `01` account number }, `02` `QRIBFTTA` }, `53` 704, `54` whole dong, `58` VN, `59` name (ASCII, 25 at most), `63` CRC | **unverified, secondary source**: the open-source libraries <https://github.com/xuannghia/vietnam-qr-pay> (constants: tag 38, AID `A000000727`, services `QRIBFTTA`/`QRIBFTTC`, consumer sub-tags BIN/number) and Odoo's `l10n_vn` module (<https://github.com/odoo/odoo/blob/master/addons/l10n_vn/models/res_bank.py>, `account_qr_code_emv`: the same nesting, VND only, CRC-16 with 0x1021/0xFFFF, uppercase hex). The NAPAS specification (QR switching v1.5.2) was not read. PayHop leaves out tags 52 and 60 (Odoo writes them; whether a bank app needs them is **unknown**) and the card service `QRIBFTTC`; the 1-19 digit account rule and the 25-character name limit are **unverified**. No bank list is shipped: the person types the 6-digit BIN | same as above: structure, lengths, CRC, input validation and a QR round trip are tested; no official example payload exists in the tests | not tested |

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
