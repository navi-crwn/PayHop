<p align="center">🌐 <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.de.md">Deutsch</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.ja.md">日本語</a> · <a href="README.pt-BR.md">Português (Brasil)</a> · <a href="README.es.md">Español</a> · <b>Français</b> · <a href="README.ru.md">Русский</a></p>

<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/hero-dark.webp"><img src="docs/readme/hero-light.webp" alt="PayHop" width="720"></picture></p>

<h1 align="center">PayHop</h1>

<p align="center"><b>QR de paiement et partage d’addition, faits sur votre appareil.</b><br>PayHop crée des QR de paiement pour PayPal.me, Cash App, Venmo, Solana Pay, UPI, EPC SEPA, PromptPay et VietQR et partage une addition entre plusieurs personnes, le tout dans votre navigateur. Rien n’est envoyé.</p>

<p align="center">
  <a href="https://pay.hel.ink"><b>Essayer en ligne</b></a> ·
  <a href="#héberger-soi-même">Héberger soi-même</a> ·
  <a href="docs/DEPLOY.md">Déploiement</a> ·
  <a href="docs/WALLET-MATRIX.md">Wallet matrix</a> ·
  <a href="CHANGELOG.md">Journal des modifications</a> ·
  <a href="SECURITY.md">Sécurité</a>
</p>

<p align="center"><sub>Go · Svelte 5 · 9 languages · MIT</sub></p>

<p align="center">
  <a href="https://github.com/navi-crwn/PayHop/releases"><img src="https://img.shields.io/github/v/release/navi-crwn/PayHop?include_prereleases&sort=semver" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
  <a href="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml"><img src="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
</p>

> [!IMPORTANT]
> PayHop ne traite pas d’argent. Il génère un QR à partir de ce que vous saisissez, affiche le nom que ce code paiera et l’imprime sur le PNG. Chaque format reste marqué **pas encore testé dans un portefeuille** (voir [docs/WALLET-MATRIX.md](docs/WALLET-MATRIX.md)) : scannez d’abord avec un petit montant.

## Ce que ça fait

- Crée des QR de paiement pour huit formats. Le nom du bénéficiaire est obligatoire, affiché à côté du code et imprimé dessous dans le PNG ; vous cochez une confirmation avant de télécharger.
- Partage une addition : personnes, articles, qui partage chacun, taxes et pourboire selon la commande, l’arrondi est absorbé par celui qui a payé. Les montants sont des entiers exacts, donc les parts font toujours le total.
- Fonctionne hors ligne une fois chargé, en neuf langues, clair et sombre, avec une page statique pour le mouvement réduit.
- Avec un HOP ID, vous pouvez enregistrer des moyens de paiement (jusqu’à 20) et vos 200 dernières factures, un élément à la fois et seulement après avoir coché une case de consentement. Ils sont chiffrés sur le serveur (AES-256-GCM), privés pour votre compte et supprimables à tout moment ; les invités n’écrivent jamais rien sur le serveur. L’enregistrement reste désactivé tant que le serveur n’a pas de clé (`PAYHOP_PROFILE_KEY`, voir [docs/DEPLOY.md](docs/DEPLOY.md)).

## Héberger soi-même

Un binaire Go avec l’application web intégrée. Les étapes de compilation et d’installation sont dans [docs/DEPLOY.md](docs/DEPLOY.md). Développement : `npm ci && npm test && npm run build`, puis `go test ./...`.

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
| **PayHop** | [pay.hel.ink](https://pay.hel.ink) | [navi-crwn/PayHop](https://github.com/navi-crwn/PayHop) | Make a payment QR and split a bill; nothing leaves your browser. |
| **Imperium** | not public-facing: optional, for admins | [navi-crwn/Imperium](https://github.com/navi-crwn/Imperium) | The HOP control panel. |
<!-- hop-family:end -->

## License

Licence MIT. Voir [LICENSE](LICENSE).
