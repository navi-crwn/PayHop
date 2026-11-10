// H-22: every public page has a canonical address and is in sitemap.xml; the signed-in page is not.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const router = rd('web/src/lib/router.svelte.ts');
const routes = [...router.match(/ROUTES = \[([^\]]+)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);

test('index.html carries the canonical address of the home page', () => {
  assert.match(rd('web/index.html'), /<link rel="canonical" href="https:\/\/pay\.hel\.ink\/">/);
});

test('sitemap.xml lists every public route once, and not /account', () => {
  const locs = [...rd('web/public/sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const want = routes.filter((r) => r !== '/account').map((r) => 'https://pay.hel.ink' + (r === '/' ? '/' : r));
  assert.deepEqual([...locs].sort(), [...want].sort());
  assert.equal(new Set(locs).size, locs.length);
});

test('robots.txt points at the sitemap and keeps crawlers out of private paths', () => {
  const r = rd('web/public/robots.txt');
  assert.match(r, /^Sitemap: https:\/\/pay\.hel\.ink\/sitemap\.xml$/m);
  for (const p of ['/account', '/api/', '/auth/', '/hop/']) assert.match(r, new RegExp('^Disallow: ' + p + '$', 'm'));
});
