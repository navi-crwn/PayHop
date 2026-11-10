<p align="center">🌐 <a href="README.md">English</a> · <a href="README.zh-CN.md">简体中文</a> · <a href="README.de.md">Deutsch</a> · <b>Bahasa Indonesia</b> · <a href="README.ja.md">日本語</a> · <a href="README.pt-BR.md">Português (Brasil)</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.ru.md">Русский</a></p>

<p align="center"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/readme/hero-dark.webp"><img src="docs/readme/hero-light.webp" alt="PayHop" width="720"></picture></p>

<h1 align="center">PayHop</h1>

<p align="center"><b>QR pembayaran dan patungan tagihan, dibuat di perangkatmu.</b><br>PayHop membuat QR pembayaran untuk PayPal.me, Cash App, Venmo, Solana Pay, UPI, EPC SEPA, PromptPay, dan VietQR, serta membagi tagihan antar orang, semuanya di browsermu. Tidak ada yang diunggah.</p>

<p align="center">
  <a href="https://pay.hel.ink"><b>Coba online</b></a> ·
  <a href="#jalankan-sendiri">Jalankan sendiri</a> ·
  <a href="docs/DEPLOY.md">Deploy</a> ·
  <a href="docs/WALLET-MATRIX.md">Wallet matrix</a> ·
  <a href="CHANGELOG.md">Catatan perubahan</a> ·
  <a href="SECURITY.md">Keamanan</a>
</p>

<p align="center"><sub>Go · Svelte 5 · 9 languages · MIT</sub></p>

<p align="center">
  <a href="https://github.com/navi-crwn/PayHop/releases"><img src="https://img.shields.io/github/v/release/navi-crwn/PayHop?include_prereleases&sort=semver" alt="Latest release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT license"></a>
  <a href="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml"><img src="https://github.com/navi-crwn/PayHop/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
</p>

> [!IMPORTANT]
> PayHop tidak memproses uang. Ia membuat kode QR dari yang kamu ketik, menampilkan nama yang akan dibayar kode itu, dan mencetak nama tersebut di PNG. Setiap format masih ditandai **belum diuji di dompet digital** (lihat [docs/WALLET-MATRIX.md](docs/WALLET-MATRIX.md)): pindai dengan jumlah kecil dulu.

## Fungsinya

- Buat QR pembayaran untuk delapan format. Nama penerima wajib, tampil di samping kode dan dicetak di bawahnya pada PNG; kamu mencentang konfirmasi sebelum bisa mengunduh.
- Bagi tagihan: orang, item, siapa yang berbagi, pajak dan tip dibagi menurut pesanan, pembulatan ditanggung yang membayar. Jumlah berupa bilangan bulat pasti, sehingga bagian selalu menjumlah ke total.
- Bekerja offline setelah dimuat, dalam sembilan bahasa, terang dan gelap, dengan halaman statis untuk gerak berkurang.
- Dengan HOP ID Anda bisa menyimpan metode pembayaran (maksimal 20) dan 200 tagihan terakhir, satu per satu dan hanya setelah mencentang kotak persetujuan. Semuanya dienkripsi di server (AES-256-GCM), hanya untuk akun Anda, dan bisa dihapus kapan saja; tamu tidak pernah menulis apa pun ke server. Penyimpanan tetap mati sampai server punya kunci (`PAYHOP_PROFILE_KEY`, lihat [docs/DEPLOY.md](docs/DEPLOY.md)).

## Jalankan sendiri

Satu binary Go dengan aplikasi browser tertanam. Langkah build dan instalasi ada di [docs/DEPLOY.md](docs/DEPLOY.md). Pengembangan: `npm ci && npm test && npm run build`, lalu `go test ./...`.

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

Lisensi MIT. Lihat [LICENSE](LICENSE).
