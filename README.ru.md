<p align="center">🌐 <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.de.md">Deutsch</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.ja.md">日本語</a> · <a href="README.pt-BR.md">Português (Brasil)</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <b>Русский</b></p>

<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/hero-dark.webp"><img src="docs/readme/hero-light.webp" alt="PayHop" width="720"></picture></p>

<h1 align="center">PayHop</h1>

<p align="center"><b>QR-коды для оплаты и раздел счёта на вашем устройстве.</b><br>PayHop создаёт платёжные QR-коды для PayPal.me, Cash App, Venmo, Solana Pay, UPI, EPC SEPA, PromptPay и VietQR и делит счёт между людьми — всё в вашем браузере. Ничего не загружается.</p>

<p align="center">
  <a href="https://pay.hel.ink"><b>Попробовать онлайн</b></a> ·
  <a href="#запустить-у-себя">Запустить у себя</a> ·
  <a href="docs/DEPLOY.md">Развёртывание</a> ·
  <a href="docs/WALLET-MATRIX.md">Wallet matrix</a> ·
  <a href="CHANGELOG.md">История изменений</a> ·
  <a href="SECURITY.md">Безопасность</a>
</p>

<p align="center"><sub>Go · Svelte 5 · 9 languages · MIT</sub></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
  <a href="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml"><img src="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
</p>

> [!IMPORTANT]
> PayHop не обрабатывает деньги. Он строит QR из введённых вами данных, показывает имя, которому заплатит этот код, и печатает его на PNG. Каждый формат по-прежнему помечен как **ещё не проверен в кошельке** (см. [docs/WALLET-MATRIX.md](docs/WALLET-MATRIX.md)): сначала сканируйте с небольшой суммой.

## Что умеет

- Создаёт платёжные QR в восьми форматах. Имя получателя обязательно, показывается рядом с кодом и печатается под ним на PNG; перед скачиванием нужно поставить отметку подтверждения.
- Делит счёт: люди, позиции, кто какую делит, налог и чаевые по заказу каждого, округление берёт на себя заплативший. Суммы — точные целые числа, поэтому доли всегда дают итог.
- После загрузки работает офлайн, на девяти языках, светлая и тёмная темы, статичная страница при уменьшенной анимации.
- С HOP ID можно сохранять способы оплаты (до 20) и последние 200 счетов — по одному и только после того, как вы поставили галочку согласия. Они шифруются на сервере (AES-256-GCM), видны только вашему аккаунту и удаляются в любой момент; гости ничего не записывают на сервер. Пока у сервера нет ключа (`PAYHOP_PROFILE_KEY`, см. [docs/DEPLOY.md](docs/DEPLOY.md)), сохранение остаётся выключенным.

## Запустить у себя

Один бинарник Go со встроенным веб-приложением. Шаги сборки и установки — в [docs/DEPLOY.md](docs/DEPLOY.md). Разработка: `npm ci && npm test && npm run build`, затем `go test ./...`.

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

Лицензия MIT, см. [LICENSE](LICENSE).
