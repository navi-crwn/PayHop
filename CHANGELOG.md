# Changelog

What changed in PayHop, newest release first. Each entry says what changed, where you see it, what it means for you and why it was done. Technical notes live in the GitHub release of each version.

## [Unreleased]

## [0.0.6] - 2026-11-14 - The family dashboard frame, colours and language addresses

### Added
- **Dashboard sidebar.** A new "Colours" choice at the bottom of the sidebar lets you pick Classic, Mist or Sand, with a small colour sample for each. Mist and Sand change the accent colour and also give the page, cards and sidebar softer matching backgrounds. Your choice is remembered and written to a cookie shared by the HOP apps, so the other apps can follow it as they get the same choice. Before, the dashboard had one fixed colour. This is a first trial of one look for the whole family, and only the dashboard changes; the public pages stay as they were.
- **Dashboard sidebar.** The links at the bottom now also include GitHub and Announcement, in the same order as in the other HOP apps (Help, Terms, Privacy, Changelog, GitHub, Announcement). Before, the list stopped at Changelog, so the apps did not match.
- **Public pages in every language.** Each public page now has its own address in each of the nine languages, for example the German Payment QR page ends in a language marker, and every page tells search engines about its other languages. A shared link now opens the page in the language it was shared in, and the page can be found in all nine languages. Before, there was one address and the language was chosen only in your browser.

### Changed
- **Dashboard look.** The signed-in pages now have the same frame as the other HOP dashboards: a floating sidebar card with the app name, the menu, the HOP family and the links, and a floating bar above the page with the page name, the Payment QR button, language, theme and your account. Before, PayHop had flat panels that looked different from the other apps. On phones the sidebar opens as a drawer over a dimmed page.
- **Payment QR on phones.** On a phone or tablet the code now appears right under the form, and the "Save this method" card sits below it, folded under its title until you tap it. Before, the code was far down the page, below the save card, and the page was about twice as long. On a wide screen nothing moves.
- **Dashboard announcement.** The announcement card at the top of the dashboard now shows what the site owner publishes for all HOP apps, so one announcement reaches every app. The title opens the full announcement, a closed announcement stays hidden for a week, and a critical notice cannot be closed. When there is nothing to show, or the announcements cannot be reached, no card appears and the dashboard loads as fast as before. Before, the list lived inside PayHop and was always empty.

### Fixed
- **Admin console.** The "sign out everywhere" action offered for a PayHop account now works: it ends that person's sessions here and nothing else. Before, the control center listed the action but PayHop answered that it did not exist, so it did nothing.
- **Payment QR page on narrow phones.** A long button label, such as "Save this bill to my history" in German or French, no longer makes the page wider than the screen; the label wraps onto a second line. Before, the page could be scrolled sideways.

## [0.0.5] - 2026-11-14 - Family menu and a calmer dashboard

### Added
- **Top bar on public pages.** A small grid button now opens a list of the other HOP apps, starting with HOP ID, so you can jump to them without scrolling to the footer. Before, the top bar had no shortcut to the other apps. Once you are signed in, the same list is in the sidebar of your dashboard instead.
- **Dashboard.** An announcement from the site owner can now appear as a card at the top of your dashboard, with a Close button. A closed announcement stays hidden for a week. When there is no announcement, nothing is shown and no empty space is left. This gives every HOP dashboard a place for news.

### Changed
- **Dashboard sidebar.** The line "Part of Hop Easy Link" is now the last line at the bottom of the sidebar, and the sidebar on a phone reaches the bottom of the screen. Before, the line only existed in the public page footer, so it was missing from the dashboard.
- **Logo and Back button.** If you are signed in, the PayHop logo and the Back button on a page that does not exist now take you to your dashboard instead of the public home page. Visitors who are not signed in still go to the home page. People signed in kept landing on the public page and had to find their way back.
- **Terms, Privacy and Changelog.** If you are signed in, these pages now open inside your dashboard, with the sidebar around them, so there is always a way back. Visitors and search engines still see them as public pages.
- **Top bar and home page on phones.** On phones 360 to 390 pixels wide the top bar no longer runs past the right edge in any of the nine languages: on the narrowest screens it shows the logo alone, the language button shows only its globe, and the menus open fully on the screen. The table of payment formats on the home page now scrolls inside its own box instead of making the whole page wider. Reported by the site owner.
- **Changelog page.** The changelog now lists one plain-language entry per release, grouped as added, changed, fixed and so on, with a Technical details link to the full notes. Before, it listed raw code changes, which most people could not read. The page is written from this file and checked by the automatic tests.

## [0.0.4] - 2026-11-14 - Honest 404 pages

### Fixed
- **Addresses PayHop does not have.** A mistyped address now answers "not found" properly instead of showing the app as if the page existed. Search engines and link checkers no longer take such addresses for real pages. Addresses PayHop does own are unchanged.

### Changed
- **Behind the scenes.** The automatic tests now run on Windows too, and a test loads the finished app in a real browser and fails on a blank page or an error. Another test keeps the public pages identical for every visitor language, which is why they can be stored safely by shared caches. Nothing changes on screen.

## [0.0.3] - 2026-11-12 - Sample data and first view

### Added
- **Payment QR and Split a bill.** You can now try the app without any payment details: "Try with sample data" fills the generator and "Load an example bill" fills the bill splitter. A sample is clearly marked "SAMPLE: not a real account. Do not pay." on the code and on the downloaded picture, and the code itself cannot be paid, so nobody can send money to a made-up account by mistake. Only the SEPA euro format has a sample, because it is the only one with an example that belongs to nobody.
- **Theme and language.** Your choice of light or dark and of language is now remembered across the HOP apps, so you do not have to pick it again in each one. It is read before the page appears, so the page does not flash the wrong theme.

### Changed
- **Public pages without JavaScript.** Search engines and readers without scripts now get the real first screen of each page, with the same top bar, heading and look as the app, instead of a hidden block of text.
- **Language.** PayHop now remembers a language only when you pick one, instead of every time a page loads.

## [0.0.2] - 2026-11-12 - Sign-in landing

### Changed
- **Sign in.** Opening PayHop from the HOP ID launcher now lands you on your account page, already signed in, and the Sign in button on any page brings you back to that page. Another account signing in after you sign out sees nothing of yours.

## [0.0.1] - 2026-11-11 - First release

The first release: payment QR codes and a bill splitter that run in your browser, with accounts that can keep payment methods and bills, part of the HOP family.

### Added
- **Payment QR.** Make a payment QR code for PayPal.me, Cash App, Venmo, Solana Pay, UPI, EPC SEPA, PromptPay and VietQR. The receiver name is required, shown next to the code and printed under it, and a tick is needed before download, so a wrong code is less likely to be paid. Every format says it has not been tested in a wallet yet, because that is true.
- **Split a bill.** Add who was there, what each item cost and who shared it; taxes and tips are spread by what each person ordered and the shares add up exactly.
- **Account page.** Signed in with your HOP ID, you can keep up to 20 payment methods and the last 200 bills. They are stored encrypted, only when you tick a box for each one, and you can delete one or all at any time. Without that choice nothing is saved.
- **Nine languages and both themes.** English, Chinese, German, Indonesian, Japanese, Portuguese, Spanish, French and Russian, light and dark, with a calm static page for people who prefer reduced motion. It works offline after the first visit.
- **Search engines and privacy.** Each page has its own address for search engines, the signed-in page is kept out of search results, and the privacy and terms pages say plainly what is stored.

### Fixed
- **Downloaded picture.** The receiver name printed on the picture is cut at a whole character, never in the middle of an emoji.

[Unreleased]: https://github.com/navi-crwn/PayHop/compare/v0.0.6...HEAD
[0.0.6]: https://github.com/navi-crwn/PayHop/compare/v0.0.5...v0.0.6
[0.0.5]: https://github.com/navi-crwn/PayHop/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/navi-crwn/PayHop/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/navi-crwn/PayHop/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/navi-crwn/PayHop/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/navi-crwn/PayHop/releases/tag/v0.0.1
