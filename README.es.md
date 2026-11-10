<p align="center">🌐 <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.de.md">Deutsch</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.ja.md">日本語</a> · <a href="README.pt-BR.md">Português (Brasil)</a> · <b>Español</b> · <a href="README.fr.md">Français</a> · <a href="README.ru.md">Русский</a></p>

<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/hero-dark.webp"><img src="docs/readme/hero-light.webp" alt="PayHop" width="720"></picture></p>

<h1 align="center">PayHop</h1>

<p align="center"><b>Códigos QR de pago y cuentas compartidas, hechos en tu dispositivo.</b><br>PayHop crea códigos QR de pago para PayPal.me, Cash App, Venmo, Solana Pay, UPI, EPC SEPA, PromptPay y VietQR y divide una cuenta entre personas, todo en tu navegador. No se sube nada.</p>

<p align="center">
  <a href="https://pay.hel.ink"><b>Pruébalo en línea</b></a> ·
  <a href="#aloja-el-tuyo">Aloja el tuyo</a> ·
  <a href="docs/DEPLOY.md">Despliegue</a> ·
  <a href="docs/WALLET-MATRIX.md">Wallet matrix</a> ·
  <a href="CHANGELOG.md">Registro de cambios</a> ·
  <a href="SECURITY.md">Seguridad</a>
</p>

<p align="center"><sub>Go · Svelte 5 · 9 languages · MIT</sub></p>

<p align="center">
  <a href="https://github.com/navi-crwn/PayHop/releases"><img src="https://img.shields.io/github/v/release/navi-crwn/PayHop?include_prereleases&sort=semver" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
  <a href="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml"><img src="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
</p>

> [!IMPORTANT]
> PayHop no procesa dinero. Genera un código QR con lo que escribes, muestra el nombre al que pagará ese código y lo imprime en el PNG. Cada formato sigue marcado como **aún no probado en una cartera** (consulta [docs/WALLET-MATRIX.md](docs/WALLET-MATRIX.md)): escanea primero con un importe pequeño.

## Qué hace

- Crea QR de pago en ocho formatos. El nombre del destinatario es obligatorio, se muestra junto al código y se imprime bajo él en el PNG; marcas una confirmación antes de descargar.
- Divide una cuenta: personas, artículos, quién comparte cada uno, impuesto y propina según lo pedido, el redondeo lo asume quien pagó. Los importes son enteros exactos, así las partes siempre suman el total.
- Funciona sin conexión una vez cargado, en nueve idiomas, claro y oscuro, con página estática para movimiento reducido.
- Con un HOP ID puedes guardar métodos de pago (hasta 20) y tus últimas 200 facturas, de una en una y solo después de marcar una casilla de consentimiento. Se cifran en el servidor (AES-256-GCM), son privados para tu cuenta y se pueden eliminar en cualquier momento; los invitados nunca escriben nada en el servidor. El guardado sigue desactivado hasta que el servidor tenga una clave (`PAYHOP_PROFILE_KEY`, ver [docs/DEPLOY.md](docs/DEPLOY.md)).

## Aloja el tuyo

Un binario de Go con la aplicación del navegador incluida. Los pasos de compilación e instalación están en [docs/DEPLOY.md](docs/DEPLOY.md). Desarrollo: `npm ci && npm test && npm run build`, luego `go test ./...`.

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

Licencia MIT. Consulta [LICENSE](LICENSE).
