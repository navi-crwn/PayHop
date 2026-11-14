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
async function open({ width, height = 900, lang = 'en', scheme = 'light', path = '/account', cookies = [], member = true }) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme });
  await ctx.addCookies([{ name: 'hop_lang', value: lang, url: BASE }, { name: 'hop_theme', value: scheme, url: BASE }, ...cookies.map((c) => ({ ...c, url: BASE }))]);
  const page = await ctx.newPage();
  await page.route('**/api/v1/me', (r) => r.fulfill({ json: member ? ME : { sso: true, signed_in: false } }));
  await page.route('**/api/v1/saved', (r) => r.fulfill({ json: SAVED }));
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
