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
  // ---- one address per language: ?lang= in the address picks the language, the canonical follows, the menu keeps them in step ----
  {
    const canonical = (page) => page.evaluate(() => document.querySelector('link[rel="canonical"]')?.getAttribute('href'));
    const { ctx, page } = await open({ width: 1024, path: '/generate?lang=de', member: false });
    await page.waitForTimeout(400);
    check('lang: /generate?lang=de shows German, sets <html lang> and the hop_lang cookie', await page.evaluate(() => document.documentElement.lang) === 'de' && (await ctx.cookies()).some((c) => c.name === 'hop_lang' && c.value === 'de'));
    check('lang: its canonical is the German address', (await canonical(page)) === 'https://pay.hel.ink/generate?lang=de', String(await canonical(page)));
    await page.click('#langBtn');
    await page.click('#langPop [role="option"]:has(.code:text-is("es"))');
    await page.waitForTimeout(300);
    check('lang: picking Spanish in the menu moves the address and the canonical to ?lang=es', page.url().endsWith('/generate?lang=es') && (await canonical(page)) === 'https://pay.hel.ink/generate?lang=es', page.url() + ' ' + (await canonical(page)));
    await page.click('header.top nav a[href="/split"]');
    await page.waitForTimeout(300);
    check('lang: following a link inside the app keeps Spanish (the cookie) and gives the bare split address as canonical', (await page.evaluate(() => document.documentElement.lang)) === 'es' && (await canonical(page)) === 'https://pay.hel.ink/split', String(await canonical(page)));
    await ctx.close();
    for (const [q, want] of [['?lang=en', 'https://pay.hel.ink/split'], ['?lang=xx', 'https://pay.hel.ink/split'], ['?lang=pt', 'https://pay.hel.ink/split?lang=pt-BR']]) {
      const c = await open({ width: 1024, path: '/split' + q, member: false });
      await c.page.waitForTimeout(300);
      check('lang: /split' + q + ' has the canonical ' + want, (await canonical(c.page)) === want, String(await canonical(c.page)));
      await c.ctx.close();
    }
  }
  // ---- the uniform sidebar footer (family contract L-9): Help, Terms, Privacy, Changelog, GitHub, Announcement, then "Part of" ----
  for (const [w, h] of [[1440, 900], [390, 560]]) {
    for (const lang of ['en', 'de', 'ja', 'ru']) {
      const { ctx, page } = await open({ width: w, height: h, lang });
      if (w < 1024) { await page.click('.shell-burger'); await page.waitForTimeout(450); }
      const foot = await page.evaluate(() => {
        const a = [...document.querySelectorAll('.shell-side-foot a')].map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent.trim(), href: e.getAttribute('href'), top: r.top, left: r.left, h: r.height }; });
        const part = document.querySelector('.shell-side .ft-part');
        return { a, part: part ? { top: part.getBoundingClientRect().top, text: part.textContent.trim(), href: part.querySelector('a')?.getAttribute('href') } : null };
      });
      check(`footer ${w} ${lang}: six items in the family order`, foot.a.length === 6 && foot.a[4].text === 'GitHub' && foot.a[0].href === 'https://hel.ink/help' && foot.a[1].href === '/terms' && foot.a[2].href === '/privacy' && foot.a[3].href === '/changelog' && foot.a[4].href === 'https://github.com/navi-crwn/PayHop' && foot.a[5].href === 'https://hel.ink/announcements', JSON.stringify(foot.a.map((x) => x.text + ' ' + x.href)));
      check(`footer ${w} ${lang}: stacked downward in one column, rows 28 to 32px, "Part of Hop Easy Link" under them`, foot.a.every((x, i) => (i === 0 || x.top > foot.a[i - 1].top) && x.left === foot.a[0].left && x.h >= 28 && x.h <= 32) && foot.part && foot.part.top > foot.a[5].top && foot.part.href === 'https://hel.ink' && foot.part.text.includes('Hop Easy Link'), JSON.stringify(foot));
      if (w < 1024) {
        const reach = await page.evaluate(() => { const s = document.querySelector('.shell-side'); s.scrollTop = s.scrollHeight; const p = document.querySelector('.shell-side .ft-part').getBoundingClientRect(); const sr = s.getBoundingClientRect(); return { top: p.top, bottom: p.bottom, sideBottom: sr.bottom, vh: innerHeight, scrolls: s.scrollHeight > s.clientHeight }; });
        check(`footer ${w} ${lang}: the drawer scrolls with the footer inside it, down to "Part of" on screen`, reach.scrolls && reach.bottom <= reach.vh + 1 && reach.bottom <= reach.sideBottom + 1 && reach.top >= 0, JSON.stringify(reach));
        check(`footer ${w} ${lang}: no sideways scroll`, (await overflowX(page)) <= 0);
      }
      await ctx.close();
    }
  }
  // ---- the family colour set picker (cookie hop_palette, attribute data-palette) and its contrast ----
  {
    const ann = { id: '12', level: 'info', title: 'Planned maintenance', body: 'Sunday 02:00 UTC.', url: 'https://hel.ink/announcements/12' };
    const attrs = (page) => page.evaluate(() => ({ pal: document.documentElement.dataset.palette ?? null, theme: document.documentElement.dataset.theme }));
    const cookie = async (ctx, name) => (await ctx.cookies()).find((c) => c.name === name)?.value ?? null;
    let { ctx, page } = await open({ width: 1440, announcement: ann });
    check('palette: classic is the default: no attribute, three choices, Classic ticked', (await attrs(page)).pal === null && await page.evaluate(() => [...document.querySelectorAll('.pal-opt')].map((b) => b.dataset.pal + ':' + b.getAttribute('aria-checked')).join() === 'classic:true,mist:false,sand:false'));
    const before = await page.evaluate(() => getComputedStyle(document.querySelector('.shell-top a.btn--primary')).backgroundColor);
    await page.click('.pal-opt[data-pal="mist"]');
    const a1 = await attrs(page);
    check('palette: choosing Mist writes hop_palette=mist and data-palette="mist", and leaves data-theme alone', (await cookie(ctx, 'hop_palette')) === 'mist' && a1.pal === 'mist' && a1.theme === 'light', JSON.stringify(a1));
    await page.waitForTimeout(350);
    check('palette: the colour really changes', await page.evaluate((b) => getComputedStyle(document.querySelector('.shell-top a.btn--primary')).backgroundColor !== b, before));
    await page.reload();
    await page.waitForSelector('.shell-side', { state: 'attached' });
    check('palette: after a reload it stays (the first-paint script sets the attribute) and Mist is ticked', (await attrs(page)).pal === 'mist' && (await page.evaluate(() => document.querySelector('.pal-opt[aria-checked="true"]').dataset.pal)) === 'mist');
    await page.focus('.pal-opt[aria-checked="true"]');
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
    check('palette: the arrow keys move the choice and the focus (Mist to Sand)', (await attrs(page)).pal === 'sand' && (await page.evaluate(() => document.activeElement?.dataset?.pal)) === 'sand' && (await cookie(ctx, 'hop_palette')) === 'sand');
    await page.keyboard.press('Home');
    await page.waitForTimeout(100);
    check('palette: Home returns to Classic (the attribute is removed, the cookie says classic)', (await attrs(page)).pal === null && (await cookie(ctx, 'hop_palette')) === 'classic');
    check('palette: the picker is at the foot of the sidebar, above the links', await page.evaluate(() => { const p = document.querySelector('.pal').getBoundingClientRect(), f = document.querySelector('.shell-side-foot').getBoundingClientRect(), n = document.querySelectorAll('.shell-side .shell-nav')[1].getBoundingClientRect(); return p.top >= n.bottom - 1 && p.bottom <= f.top + 1; }));
    await ctx.close();
    for (const junk of ['purple', 'MIST', '']) {
      const c = await open({ width: 1440, cookies: [{ name: 'hop_palette', value: junk }] });
      check(`palette: a cookie of "${junk}" is classic`, (await attrs(c.page)).pal === null);
      await c.ctx.close();
    }
    // public pages stay classic (the colour set is for the dashboard in this stage)
    const pub = await open({ width: 1440, path: '/generate', member: false, cookies: [{ name: 'hop_palette', value: 'sand' }, { name: 'hop_palette_depth', value: 'surface' }] });
    const pubBg = await pub.page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector('.btn--primary, .card')).backgroundColor].join());
    const pubRef = await open({ width: 1440, path: '/generate', member: false });
    check('palette: a guest page looks the same with a cookie of sand and the surface trial as without', pubBg === (await pubRef.page.evaluate(() => [getComputedStyle(document.body).backgroundColor, getComputedStyle(document.querySelector('.btn--primary, .card')).backgroundColor].join())), pubBg);
    await pub.ctx.close(); await pubRef.ctx.close();

    // contrast: text and the primary button, every set, light and dark, both depths
    const lum = (rgb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
    const PAIRS = [
      ['primary button', '.shell-top a.btn--primary', 'self'],
      ['heading on the page', '.page-head h1', 'body'],
      ['muted text on the page', '.page-head p', 'body'],
      ['heading on a card', '.cards .card h2', '.cards .card'],
      ['muted text on a card', '.cards .card p', '.cards .card'],
      ['current menu item', '.shell-nav a[aria-current="page"]', 'self'],
      ['menu item', '.shell-nav a:not([aria-current])', '.shell-side'],
      ['footer link', '.shell-side-foot a', '.shell-side'],
      ['link in the announcement', '#announce a', '#announce'],
      ['chip on a card', '.chip--brand', 'self'],
      ['ticked colour choice', '.pal-opt[aria-checked="true"]', 'self'],
      ['colour choice', '.pal-opt[aria-checked="false"]', '.shell-side']
    ];
    const worst = [];
    for (const pal of ['classic', 'mist', 'sand']) for (const scheme of ['light', 'dark']) for (const depth of ['accent', 'surface']) {
      if (pal === 'classic' && depth === 'surface') continue;
      const ck = [{ name: 'hop_palette', value: pal }, ...(depth === 'surface' ? [{ name: 'hop_palette_depth', value: 'surface' }] : [])];
      const c = await open({ width: 1440, scheme, cookies: ck, announcement: ann });
      await c.page.waitForSelector('#announce');
      const got = await c.page.evaluate((pairs) => {
        const cv = document.createElement('canvas'); cv.width = cv.height = 1;
        const g = cv.getContext('2d', { willReadFrequently: true });
        const px = (css) => { g.clearRect(0, 0, 1, 1); g.fillStyle = '#000'; g.fillStyle = css; g.fillRect(0, 0, 1, 1); return [...g.getImageData(0, 0, 1, 1).data].slice(0, 3); };
        const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor; if (b && !/rgba\(\s*0,\s*0,\s*0,\s*0\)|transparent/.test(b)) return b; } return getComputedStyle(document.body).backgroundColor; };
        return pairs.map(([name, sel, bgSel]) => {
          const el = document.querySelector(sel);
          if (!el) return [name, null, null];
          const bg = bgSel === 'self' ? bgOf(el) : bgSel === 'body' ? getComputedStyle(document.body).backgroundColor : bgOf(document.querySelector(bgSel));
          return [name, px(getComputedStyle(el).color), px(bg)];
        });
      }, PAIRS);
      for (const [name, fg, bg] of got) {
        if (!fg) { check(`contrast ${pal}/${depth}/${scheme}: ${name} exists`, false); continue; }
        const r = ratio(fg, bg);
        worst.push([r, `${pal}/${depth}/${scheme} ${name}`]);
        check(`contrast ${pal}/${depth}/${scheme}: ${name} ${r.toFixed(2)}:1 (at least 4.5)`, r >= 4.5);
      }
      await c.ctx.close();
    }
    worst.sort((a, b) => a[0] - b[0]);
    console.log('lowest contrast ratios: ' + worst.slice(0, 5).map(([r, n]) => `${r.toFixed(2)} ${n}`).join(' | '));
  }
  // ---- short desktop screens: the whole sidebar can be reached (it scrolls by itself when it does not fit) ----
  for (const [w, h] of [[1440, 900], [1280, 720], [1280, 600]]) {
    const { ctx, page } = await open({ width: w, height: h });
    const r = await page.evaluate(() => {
      const s = document.querySelector('.shell-side');
      const fits = s.scrollHeight <= s.clientHeight;
      s.scrollTop = s.scrollHeight;
      const p = document.querySelector('.shell-side .ft-part').getBoundingClientRect(), sr = s.getBoundingClientRect();
      const a = document.querySelector('.shell-side-foot a:last-child, .shell-side-foot li:last-child a').getBoundingClientRect();
      return { fits, scrolls: getComputedStyle(s).overflowY, partBottom: p.bottom, sideBottom: sr.bottom, partTop: p.top, sideTop: sr.top, vh: innerHeight, annBottom: a.bottom };
    });
    check(`short screen ${w}x${h}: the sidebar scrolls by itself if needed and "Part of" ends inside it and on screen`, (r.fits || r.scrolls === 'auto') && r.partBottom <= r.sideBottom + 1 && r.partBottom <= r.vh && r.partTop >= r.sideTop && r.annBottom <= r.partTop + 1, JSON.stringify(r));
    await ctx.close();
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
