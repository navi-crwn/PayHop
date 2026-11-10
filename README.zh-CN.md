<p align="center">🌐 <a href="README.md">English</a> · <b>简体中文</b> · <a href="README.de.md">Deutsch</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.ja.md">日本語</a> · <a href="README.pt-BR.md">Português (Brasil)</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.ru.md">Русский</a></p>

<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/hero-dark.webp"><img src="docs/readme/hero-light.webp" alt="PayHop" width="720"></picture></p>

<h1 align="center">PayHop</h1>

<p align="center"><b>在你的设备上生成收款二维码并分摊账单。</b><br>PayHop 在浏览器中为 PayPal.me、Cash App、Venmo、Solana Pay、UPI、EPC SEPA、PromptPay 和 VietQR 生成收款二维码，并在多人之间分摊账单。不会上传任何内容。</p>

<p align="center">
  <a href="https://pay.hel.ink"><b>在线试用</b></a> ·
  <a href="#自行部署">自行部署</a> ·
  <a href="docs/DEPLOY.md">部署说明</a> ·
  <a href="docs/WALLET-MATRIX.md">Wallet matrix</a> ·
  <a href="CHANGELOG.md">更新日志</a> ·
  <a href="SECURITY.md">安全</a>
</p>

<p align="center"><sub>Go · Svelte 5 · 9 languages · MIT</sub></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
  <a href="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml"><img src="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
</p>

> [!IMPORTANT]
> PayHop 不处理资金。它根据你输入的内容生成二维码，显示该二维码将付款给谁，并把名字印在 PNG 上。所有格式仍标注为**尚未在钱包中测试**（见 [docs/WALLET-MATRIX.md](docs/WALLET-MATRIX.md)）：请先用小额扫码试付。

## 功能

- 为八种格式生成收款二维码。收款人姓名必填，显示在二维码旁并印在 PNG 下方；下载前需勾选确认。
- 分摊账单：人员、项目、各项目由谁分摊，税费和小费按每人点的金额比例分配，舍入差额由付款人承担。金额使用精确整数，各人份额之和始终等于总额。
- 页面加载后可离线使用，支持九种语言、浅色和深色，并为减少动态效果提供静态页面。
- 用 HOP ID 登录后可以保存付款方式（最多 20 个）和最近 200 张账单，逐项保存，并且只有在勾选同意框之后才会保存。它们在服务器上加密（AES-256-GCM），仅属于你的账户，可随时删除；访客不会向服务器写入任何内容。服务器没有设置密钥（`PAYHOP_PROFILE_KEY`，见 [docs/DEPLOY.md](docs/DEPLOY.md)）时，保存功能保持关闭。

## 自行部署

单个内嵌浏览器应用的 Go 程序。构建和安装步骤见 [docs/DEPLOY.md](docs/DEPLOY.md)。开发：`npm ci && npm test && npm run build`，然后 `go test ./...`。

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

MIT 许可证，见 [LICENSE](LICENSE)。
