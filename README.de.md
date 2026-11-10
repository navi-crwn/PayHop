<p align="center">🌐 <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <b>Deutsch</b> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.ja.md">日本語</a> · <a href="README.pt-BR.md">Português (Brasil)</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.ru.md">Русский</a></p>

<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/hero-dark.webp"><img src="docs/readme/hero-light.webp" alt="PayHop" width="720"></picture></p>

<h1 align="center">PayHop</h1>

<p align="center"><b>Zahlungs-QR-Codes und geteilte Rechnungen, direkt auf deinem Gerät.</b><br>PayHop erstellt im Browser Zahlungs-QR-Codes für PayPal.me, Cash App, Venmo, Solana Pay, UPI, EPC SEPA, PromptPay und VietQR und teilt eine Rechnung unter mehreren Personen auf. Es wird nichts hochgeladen.</p>

<p align="center">
  <a href="https://pay.hel.ink"><b>Online ausprobieren</b></a> ·
  <a href="#selbst-betreiben">Selbst betreiben</a> ·
  <a href="docs/DEPLOY.md">Deployment</a> ·
  <a href="docs/WALLET-MATRIX.md">Wallet matrix</a> ·
  <a href="CHANGELOG.md">Änderungsprotokoll</a> ·
  <a href="SECURITY.md">Sicherheit</a>
</p>

<p align="center"><sub>Go · Svelte 5 · 9 languages · MIT</sub></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
  <a href="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml"><img src="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
</p>

> [!IMPORTANT]
> PayHop verarbeitet kein Geld. Es erzeugt aus deinen Eingaben einen QR-Code, zeigt den Namen, den der Code bezahlt, und druckt ihn in das PNG. Jedes Format ist noch als **noch nicht in einer Wallet getestet** gekennzeichnet (siehe [docs/WALLET-MATRIX.md](docs/WALLET-MATRIX.md)): Scanne zuerst mit einem kleinen Betrag.

## Was es kann

- Zahlungs-QR für acht Formate. Der Name des Empfängers ist Pflicht, steht neben dem Code und wird unter ihn ins PNG gedruckt; vor dem Download setzt du einen Bestätigungshaken.
- Rechnung teilen: Personen, Positionen, wer sie teilt, Steuer und Trinkgeld nach Bestellwert, Rundung trägt, wer bezahlt hat. Beträge sind exakte ganze Zahlen, die Anteile ergeben immer die Summe.
- Funktioniert nach dem Laden offline, in neun Sprachen, hell und dunkel, mit statischer Seite bei reduzierter Bewegung.
- Mit einer HOP-ID kannst du Zahlungsmethoden (bis zu 20) und deine letzten 200 Rechnungen speichern, einzeln und erst nach dem Ankreuzen eines Einwilligungskästchens. Sie sind auf dem Server verschlüsselt (AES-256-GCM), nur für dein Konto sichtbar und jederzeit löschbar; Gäste schreiben nie etwas auf den Server. Das Speichern bleibt aus, bis der Server einen Schlüssel hat (`PAYHOP_PROFILE_KEY`, siehe [docs/DEPLOY.md](docs/DEPLOY.md)).

## Selbst betreiben

Eine Go-Binärdatei mit eingebetteter Browser-App. Bau- und Installationsschritte stehen in [docs/DEPLOY.md](docs/DEPLOY.md). Entwicklung: `npm ci && npm test && npm run build`, dann `go test ./...`.

<!-- hop-family:start -->
<!-- Generated from HEL.ink resources/hop-assets/apps.source.json; edit there, then run scripts/hop_assets.py build. -->
| App | Address | Repository | What it does |
| --- | --- | --- | --- |
| **HOP ID** | [hel.ink](https://hel.ink) · accounts at `hub.hel.ink` | [navi-crwn/HEL.ink](https://github.com/navi-crwn/HEL.ink) | One account for every HOP app. |
| **LinkHop** | [link.hel.ink](https://link.hel.ink) · `hel.ink/l/…` | [navi-crwn/LinkHop](https://github.com/navi-crwn/LinkHop) | Short links, QR codes and click analytics. |
| **BioHop** | [bio.hel.ink](https://bio.hel.ink) · `hel.ink/b/…` | [navi-crwn/BioHop](https://github.com/navi-crwn/BioHop) | One link-in-bio page for everything you do. |
| **PixelHop** | [pixel.hel.ink](https://pixel.hel.ink) · `p.hel.ink/…` | [navi-crwn/PixelHop](https://github.com/navi-crwn/PixelHop) | Image hosting with albums and direct links. |
| **NoteHop** | [note.hel.ink](https://note.hel.ink) · `n.hel.ink/…` | [navi-crwn/NoteHop](https://github.com/navi-crwn/NoteHop) | Encrypted notes you share with a link. |
| **FileHop** | [file.hel.ink](https://file.hel.ink) | [navi-crwn/FileHop](https://github.com/navi-crwn/FileHop) | Convert files in your browser; nothing is uploaded. |
| **Imperium** | not public-facing: optional, for admins | [navi-crwn/Imperium](https://github.com/navi-crwn/Imperium) | The HOP control panel. |
<!-- hop-family:end -->

## License

MIT-Lizenz, siehe [LICENSE](LICENSE).
