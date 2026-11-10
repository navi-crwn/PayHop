<p align="center">🌐 <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.de.md">Deutsch</a> · <a href="README.id.md">Bahasa Indonesia</a> · <a href="README.ja.md">日本語</a> · <b>Português (Brasil)</b> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.ru.md">Русский</a></p>

<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/hero-dark.webp"><img src="docs/readme/hero-light.webp" alt="PayHop" width="720"></picture></p>

<h1 align="center">PayHop</h1>

<p align="center"><b>QR codes de pagamento e divisão de contas, feitos no seu dispositivo.</b><br>O PayHop cria QR codes de pagamento para PayPal.me, Cash App, Venmo, Solana Pay, UPI, EPC SEPA, PromptPay e VietQR e divide uma conta entre pessoas, tudo no seu navegador. Nada é enviado.</p>

<p align="center">
  <a href="https://pay.hel.ink"><b>Experimente online</b></a> ·
  <a href="#hospede-você-mesmo">Hospede você mesmo</a> ·
  <a href="docs/DEPLOY.md">Implantação</a> ·
  <a href="docs/WALLET-MATRIX.md">Wallet matrix</a> ·
  <a href="CHANGELOG.md">Histórico de alterações</a> ·
  <a href="SECURITY.md">Segurança</a>
</p>

<p align="center"><sub>Go · Svelte 5 · 9 languages · MIT</sub></p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
  <a href="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml"><img src="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
</p>

> [!IMPORTANT]
> O PayHop não processa dinheiro. Ele gera um QR code a partir do que você digita, mostra o nome que o código vai pagar e imprime esse nome no PNG. Todo formato ainda aparece como **ainda não testado em carteira** (veja [docs/WALLET-MATRIX.md](docs/WALLET-MATRIX.md)): escaneie primeiro com um valor pequeno.

## O que faz

- Cria QR de pagamento em oito formatos. O nome do destinatário é obrigatório, aparece ao lado do código e é impresso sob ele no PNG; você marca uma confirmação antes de baixar.
- Divide uma conta: pessoas, itens, quem dividiu cada um, imposto e gorjeta pelo que cada um pediu, arredondamento absorvido por quem pagou. Valores são inteiros exatos, então as partes sempre somam o total.
- Funciona offline depois de carregar, em nove idiomas, claro e escuro, com página estática para movimento reduzido.
- Com um HOP ID você pode salvar métodos de pagamento (até 20) e suas últimas 200 cobranças, um item por vez e só depois de marcar uma caixa de consentimento. Eles são criptografados no servidor (AES-256-GCM), privados para a sua conta e podem ser excluídos a qualquer momento; visitantes nunca gravam nada no servidor. O salvamento fica desligado até o servidor ter uma chave (`PAYHOP_PROFILE_KEY`, veja [docs/DEPLOY.md](docs/DEPLOY.md)).

## Hospede você mesmo

Um binário Go com o app de navegador embutido. Os passos de build e instalação estão em [docs/DEPLOY.md](docs/DEPLOY.md). Desenvolvimento: `npm ci && npm test && npm run build`, depois `go test ./...`.

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

Licença MIT. Veja [LICENSE](LICENSE).
