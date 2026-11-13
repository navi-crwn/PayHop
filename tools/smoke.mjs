// One browser smoke test: serve the built app (web/dist), open the home page in a real
// browser and fail on a console error, an empty page or an app that never mounts.
// Component tests cannot catch an initialization-order slip in App.svelte; a page load can.
//
// Usage: npm run build && node tools/smoke.mjs   (needs `npx playwright install chromium` once)
// SMOKE_CHANNEL=msedge node tools/smoke.mjs   uses an installed Edge/Chrome when the bundled Chromium will not start.
// SMOKE_URL=http://127.0.0.1:8307/ node tools/smoke.mjs   runs against an already
// running server (the real Go one) instead of starting `vite preview`.
//
// Without the Go server the account check (fetch /api/v1/me, lib/account.svelte.ts) has
// nothing to talk to, so that one address is allowed to answer 404 under `vite preview`.
// Every other failed request or console error fails the test.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const PORT = 4189; // the port web/package.json's preview script uses
const MOUNT_SELECTOR = '#root header.top'; // App.svelte always draws the top bar once it is mounted
const NO_BACKEND_OK = ['/api/v1/me']; // only when this script serves the build itself

const external = process.env.SMOKE_URL;
const url = external ?? `http://127.0.0.1:${PORT}/`;
const allowed404 = (u) => !external && NO_BACKEND_OK.some((p) => new URL(u).pathname === p);

let preview;
if (!external) {
  if (!existsSync(join(root, 'web', 'dist', 'index.html'))) {
    console.error('smoke: web/dist is missing — run `npm run build` first');
    process.exit(1);
  }
  preview = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: join(root, 'web'),
    stdio: 'ignore'
  });
}
const stop = () => { try { preview?.kill(); } catch { /* already gone */ } };

const up = async () => {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch { /* not listening yet */ }
    await new Promise((res) => setTimeout(res, 500));
  }
  throw new Error('the server did not answer on ' + url);
};

let failed = false;
try {
  await up();
  // CI uses Playwright's own Chromium; SMOKE_CHANNEL=msedge (or chrome) uses an installed browser instead.
  const browser = await chromium.launch(process.env.SMOKE_CHANNEL ? { channel: process.env.SMOKE_CHANNEL } : {});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      if (m.text().includes('Failed to load resource') && allowed404(m.location()?.url ?? '')) return;
      errors.push('console: ' + m.text());
    });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('response', (r) => { if (r.status() >= 400 && !allowed404(r.url())) errors.push(`response ${r.status()}: ${r.url()}`); });
    page.on('requestfailed', (r) => { if (!allowed404(r.url())) errors.push('request failed: ' + r.url()); });
    await page.goto(url, { waitUntil: 'load' });
    try {
      await page.waitForSelector(MOUNT_SELECTOR, { timeout: 20000 });
    } catch {
      errors.push(`the app never mounted: no ${MOUNT_SELECTOR} after 20s`);
    }
    // a page that is mounted but empty is still broken
    const body = await page.evaluate(() => ({
      children: document.getElementById('root')?.childElementCount ?? 0,
      h1: document.querySelector('h1')?.textContent?.trim() ?? '',
      text: document.body.innerText.trim().length
    }));
    if (body.children === 0) errors.push('#root is empty');
    if (!body.h1) errors.push('the page shows no heading');
    if (body.text === 0) errors.push('the page has no visible text');
    if (errors.length) {
      failed = true;
      console.error('smoke: FAIL');
      for (const e of errors) console.error('  ' + e);
    } else {
      console.log(`smoke: the home page mounted with the heading ${JSON.stringify(body.h1)} and no console error`);
    }
  } finally {
    await browser.close();
  }
} catch (e) {
  failed = true;
  console.error('smoke: ' + (e?.message ?? e));
} finally {
  stop();
}
process.exit(failed ? 1 : 0);
