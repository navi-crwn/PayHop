// Browser checks of the signed-in screens, in a real browser against the built app (web/dist) served by
// `vite preview`. The server is not needed: /api/v1/me, /api/v1/saved and the family announcement are
// answered by this script, so the same checks run in CI and on a laptop.
//
// Usage: npm run build && node tools/browser.mjs      (SMOKE_CHANNEL=msedge uses an installed Edge/Chrome)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4190;
const BASE = `http://127.0.0.1:${PORT}`;
const LANGS = ['en', 'zh-CN', 'de', 'id', 'ja', 'pt-BR', 'es', 'fr', 'ru'];

if (!existsSync(join(root, 'web', 'dist', 'index.html'))) {
  console.error('browser: web/dist is missing, run `npm run build` first');
  process.exit(1);
}
const preview = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], { cwd: join(root, 'web'), stdio: 'ignore' });
for (let i = 0; i < 60; i++) {
  try { if ((await fetch(BASE)).ok) break; } catch { /* not listening yet */ }
  await new Promise((r) => setTimeout(r, 500));
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${ok || !detail ? '' : ' :: ' + detail}`);
};

const ME = { sso: true, signed_in: true, name: 'Helena', email: 'helena@example.test', hub_url: 'https://hub.example.test', logout_url: 'https://hub.example.test/logout' };
const SAVED = { enabled: true, max_methods: 20, keep_bills: 200, unreadable: 0, bills: [],
  methods: [{ id: 1, format: 'paypal', label: 'PayPal personal', values: { user: 'helena' }, created_at: 1760000000, consent_at: 1760000000 }] };

const browser = await chromium.launch(process.env.SMOKE_CHANNEL ? { channel: process.env.SMOKE_CHANNEL } : {});
async function open({ width, height = 900, lang = 'en', scheme = 'light', path = '/account', cookies = [], member = true, announcement = null }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
  await ctx.addCookies([{ name: 'hop_lang', value: lang, url: BASE }, { name: 'hop_theme', value: scheme, url: BASE }, ...cookies.map((c) => ({ ...c, url: BASE }))]);
  const page = await ctx.newPage();
  await page.route('**/api/v1/me', (r) => r.fulfill({ json: member ? ME : { sso: true, signed_in: false } }));
  await page.route('**/api/v1/saved', (r) => r.fulfill({ json: SAVED }));
  await page.route('**/api/v1/announcement', (r) => r.fulfill({ json: { item: announcement } }));
  await page.goto(BASE + path, { waitUntil: 'load' });
  await page.waitForSelector(member ? '.shell-side' : 'header.top', { state: 'attached', timeout: 15000 });
  await page.waitForTimeout(250);
  return { ctx, page };
}
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const rect = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
const overlaps = (a, b) => a && b && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;

try {
  // ---- the dashboard frame: sidebar card + floating bar, no overlap, no sideways scroll ----
  {
    const { ctx, page } = await open({ width: 1440 });
    const side = await rect(page, '.shell-side'), top = await rect(page, '.shell-top'), main = await rect(page, '.shell-main');
    check('frame 1440: sidebar is a floating card (12px from the edges, 252px wide)', side && side.x === 12 && side.y === 12 && Math.round(side.w) === 252, JSON.stringify(side));
    check('frame 1440: the bar sits to the right of the sidebar and does not overlap it', top && top.x >= side.r && !overlaps(side, top), JSON.stringify({ side, top }));
    check('frame 1440: the page content starts below the bar and right of the sidebar', main && main.x >= side.r && main.y >= top.b - 1, JSON.stringify(main));
    check('frame 1440: the app name is in the sidebar, not in the bar', await page.evaluate(() => !!document.querySelector('.shell-side .shell-brand') && !document.querySelector('.shell-top .brand')));
    check('frame 1440: the bar holds action, language, theme, account and no app grid', await page.evaluate(() => { const t = document.querySelector('.shell-top'); return !!t.querySelector('a.btn--primary') && !!t.querySelector('#langBtn') && !!t.querySelector('#themeBtn') && !!t.querySelector('#acct') && !t.querySelector('.family-switcher'); }));
    check('frame 1440: the family list omits PayHop and starts with HOP ID', await page.evaluate(() => { const l = [...document.querySelectorAll('.shell-side .shell-nav')[1].querySelectorAll('a')].map((a) => a.textContent.trim()); return l[0] === 'HOP ID' && !l.includes('PayHop') && l.length === 6; }));
    check('frame 1440: no sideways scroll', (await overflowX(page)) <= 0);
    await ctx.close();
  }
  for (const w of [1024, 390, 375, 360]) {
    const { ctx, page } = await open({ width: w, height: 800 });
    const hidden = await page.evaluate(() => getComputedStyle(document.querySelector('.shell-side')).visibility);
    check(`frame ${w}: the sidebar is a closed drawer, the bar spans the screen`, hidden === 'hidden' && (await rect(page, '.shell-top')).w > w - 30, hidden);
    check(`frame ${w}: no sideways scroll`, (await overflowX(page)) <= 0, String(await overflowX(page)));
    await page.click('.shell-burger');
    await page.waitForTimeout(450);
    const s = await rect(page, '.shell-side');
    check(`frame ${w}: the burger opens the drawer fully on screen, with a scrim`, s && s.x >= 0 && s.r <= w && s.b <= 800 && (await page.locator('.shell-scrim').count()) === 1, JSON.stringify(s));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
    check(`frame ${w}: Escape closes the drawer`, (await page.evaluate(() => getComputedStyle(document.querySelector('.shell-side')).visibility)) === 'hidden');
    await ctx.close();
  }
  for (const lang of LANGS) for (const p of ['/account', '/generate', '/split', '/changelog', '/terms']) {
    const { ctx, page } = await open({ width: 360, lang, path: p });
    const ov = await overflowX(page);
    const bar = await page.evaluate(() => [...document.querySelector('.shell-top').children].filter((c) => getComputedStyle(c).display !== 'none' && c.getBoundingClientRect().width > 0).map((c) => { const r = c.getBoundingClientRect(); return { x: r.x, right: r.right }; }));
    let clash = false;
    for (let i = 0; i < bar.length; i++) for (let j = i + 1; j < bar.length; j++) if (bar[i].x < bar[j].right - 0.5 && bar[j].x < bar[i].right - 0.5) clash = true;
    check(`frame 360 ${lang} ${p}: no sideways scroll, bar items do not overlap`, ov <= 0 && !clash, `overflow ${ov}`);
    await ctx.close();
  }
  // ---- /generate: the code right after the form, the save card folded (phones and tablets); two columns on a wide screen ----
  for (const w of [390, 768, 1024]) {
    const { ctx, page } = await open({ width: w, height: 844, path: '/generate' });
    await page.waitForSelector('#qrBox');
    const form = await rect(page, '#formCard'), qr = await rect(page, '#qrBox'), save = await rect(page, '#saveCard');
    check(`generate ${w}: the code sits under the form and above the save card`, form && qr && save && qr.y > form.b - 1 && save.y > qr.b - 1, JSON.stringify({ form, qr, save }));
    check(`generate ${w}: the save card is folded`, await page.evaluate(() => !document.querySelector('#saveCard').open));
    if (w === 390) check('generate 390: the code starts within the first 1200px of the page', qr.y < 1200, String(qr.y));
    check(`generate ${w}: no sideways scroll`, (await overflowX(page)) <= 0);
    await page.click('#saveCard > summary');
    await page.waitForTimeout(150);
    const isOpen = await page.evaluate(() => document.querySelector('#saveCard').open);
    const consent = await rect(page, '#consentMethod');
    check(`generate ${w}: tapping the title opens the card and its fields are on screen`, isOpen && consent && consent.w > 0 && consent.r <= w, JSON.stringify(consent));
    check(`generate ${w}: the open card does not overlap the code or the form`, !overlaps(await rect(page, '#saveCard'), await rect(page, '#qrBox')) && !overlaps(await rect(page, '#saveCard'), await rect(page, '#formCard')));
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ width: 1440, path: '/generate' });
    await page.waitForSelector('#qrBox');
    const form = await rect(page, '#formCard'), qr = await rect(page, '#qrBox'), save = await rect(page, '#saveCard');
    check('generate 1440: the code is in the right column, the save card under the form', qr.x >= form.r && Math.abs(save.x - form.x) < 1 && save.y >= form.b, JSON.stringify({ form, qr, save }));
    await page.click('#saveCard > summary');
    check('generate 1440: the save card is open and stays open', await page.evaluate(() => document.querySelector('#saveCard').open));
    await ctx.close();
  }
  // ---- the family announcement card (the item comes from this app's server; here the script plays the server) ----
  {
    const item = { id: '12', level: 'info', title: 'Planned maintenance', body: 'Sunday <b>02:00</b> UTC.', url: 'https://hel.ink/announcements/12' };
    for (const w of [1440, 390]) {
      const { ctx, page } = await open({ width: w, announcement: item });
      await page.waitForSelector('#announce');
      const card = await rect(page, '#announce'), head = await rect(page, '.page-head');
      check(`announcement ${w}: the card shows above the page heading, inside the screen`, card && head && card.b <= head.y + 1 && card.r <= w && (await overflowX(page)) <= 0, JSON.stringify({ card, head }));
      check(`announcement ${w}: the title links to the hub, the body is plain text (a tag is shown as letters)`, await page.evaluate(() => document.querySelector('#announce a')?.getAttribute('href') === 'https://hel.ink/announcements/12' && document.querySelector('#announce p').textContent === 'Sunday <b>02:00</b> UTC.' && !document.querySelector('#announce p b')));
      await ctx.close();
    }
    const { ctx, page } = await open({ width: 1440, announcement: item });
    await page.waitForSelector('#announce');
    await page.click('#announce button');
    await page.waitForTimeout(100);
    check('announcement: closing hides the card and writes ann-12', (await page.locator('#announce').count()) === 0 && (await page.evaluate(() => !!localStorage.getItem('ann-12'))));
    await page.reload();
    await page.waitForSelector('.shell-side', { state: 'attached' });
    await page.waitForTimeout(500);
    check('announcement: after a reload it stays closed', (await page.locator('#announce').count()) === 0);
    await page.evaluate(() => localStorage.setItem('ann-12', String(Date.now() - 8 * 86400000)));
    await page.reload();
    await page.waitForSelector('#announce', { timeout: 5000 }).catch(() => {});
    check('announcement: after 7 days it comes back', (await page.locator('#announce').count()) === 1);
    await ctx.close();
    const crit = await open({ width: 1440, announcement: { ...item, id: '7', level: 'critical' } });
    await crit.page.waitForSelector('#announce');
    await crit.page.evaluate(() => localStorage.setItem('ann-7', String(Date.now())));
    await crit.page.reload();
    await crit.page.waitForSelector('#announce');
    check('announcement: a critical notice has no close button and shows even with a stored close', (await crit.page.locator('#announce button').count()) === 0);
    await crit.ctx.close();
    const none = await open({ width: 1440, announcement: null });
    await none.page.waitForTimeout(500);
    const h1 = await rect(none.page, '.page-head');
    check('announcement: no item means no card and no gap above the heading', (await none.page.locator('#announce').count()) === 0 && h1.y < 120, JSON.stringify(h1));
    await none.ctx.close();
    const gen = await open({ width: 1440, path: '/generate', announcement: item });
    await gen.page.waitForTimeout(600);
    check('announcement: only the dashboard shows it, not the Payment QR page', (await gen.page.locator('#announce').count()) === 0);
    await gen.ctx.close();
    // a server that answers an error, or the hub being gone: the dashboard is unharmed
    const broke = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const bp = await broke.newPage();
    await bp.route('**/api/v1/me', (r) => r.fulfill({ json: ME }));
    await bp.route('**/api/v1/saved', (r) => r.fulfill({ json: SAVED }));
    await bp.route('**/api/v1/announcement', (r) => r.fulfill({ status: 502, body: '<html>bad gateway</html>', contentType: 'text/html' }));
    const errs = [];
    bp.on('pageerror', (e) => errs.push(e.message));
    await bp.goto(BASE + '/account');
    await bp.waitForSelector('.page-head');
    await bp.waitForTimeout(400);
    check('announcement: a failing server means no card and no page error', errs.length === 0 && (await bp.locator('#announce').count()) === 0);
    await broke.close();
  }
} catch (e) {
  results.push(false);
  console.error('browser: ' + (e?.stack ?? e));
} finally {
  await browser.close();
  preview.kill();
}
const bad = results.filter((r) => !r).length;
console.log(`\nbrowser: ${results.length - bad} passed, ${bad} failed`);
process.exit(bad ? 1 : 0);
