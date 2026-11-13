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
  // pages.go answers every other extension-less address with a real 404; only ROUTES stays 200
  assert.ok(routes.includes('/account'), '/account stays a route of the app: pages.go serves it the bare shell with a 200');
});

test('robots.txt points at the sitemap and keeps crawlers out of private paths', () => {
  const r = rd('web/public/robots.txt');
  assert.match(r, /^Sitemap: https:\/\/pay\.hel\.ink\/sitemap\.xml$/m);
  for (const p of ['/account', '/api/', '/auth/', '/hop/']) assert.match(r, new RegExp('^Disallow: ' + p + '$', 'm'));
});

// ---- round 2: the page the server writes (internal/app/pages.go) and the app (App.svelte, Home, Legal, brand.ts) must not drift apart
const goSrc = rd('internal/app/pages.go');
const table = goSrc.slice(goSrc.indexOf('var publicPages = []publicPage{'), goSrc.indexOf('// privatePrefixes'));
// per route: the dictionary keys the Go table uses for the title and the description
const goHead = {};
for (const chunk of table.split(/\bPath:\s*"/).slice(1)) {
  const path = chunk.slice(0, chunk.indexOf('"'));
  goHead[path] = { title: /\bTitle:\s*"([^"]+)"/.exec(chunk)?.[1], desc: /\bDesc:\s*"([^"]*)"/.exec(chunk)?.[1] ?? '' };
}
const appHead = {};
for (const m of rd('web/src/App.svelte').match(/const PAGE_HEAD[^{]*\{([\s\S]*?)\n  \};/)[1].matchAll(/'([^']+)':\s*\['([^']+)',\s*'([^']+)'\]/g)) appHead[m[1]] = { title: m[2], desc: m[3] };

test('the title table in App.svelte and the one in pages.go name the same keys for every public route', () => {
  assert.deepEqual(Object.keys(goHead).sort(), routes.filter((r) => r !== '/account').sort(), 'pages.go writes every public route');
  for (const [path, g] of Object.entries(goHead)) {
    if (path === '/') {
      // the home page: the app sets app.title and app.desc, and the server keeps what index.html says, which must be the same words
      const en = JSON.parse(rd('web/src/lib/i18n/en.json'));
      assert.equal(g.title, 'app.title');
      assert.match(rd('web/src/App.svelte'), /t\('app\.title'\)/);
      assert.match(rd('web/src/App.svelte'), /t\(head \? head\[1\] : 'app\.desc'\)/);
      assert.ok(rd('web/index.html').includes('<title>' + en['app.title'] + '</title>'));
      assert.ok(rd('web/index.html').includes('<meta name="description" content="' + en['app.desc'] + '">'));
      continue;
    }
    assert.ok(appHead[path], path + ' has a title in App.svelte');
    assert.equal(appHead[path].title, g.title, path + ' title key');
    assert.equal(appHead[path].desc, g.desc, path + ' description key');
  }
  assert.deepEqual(Object.keys(appHead).sort(), Object.keys(goHead).filter((p) => p !== '/').sort(), 'App.svelte has no title for a route the server does not write');
  assert.match(rd('web/src/App.svelte'), /' — ' \+ BRAND\.name/);
  assert.match(goSrc, /" — " \+ string\(site\[1\]\)/);
});

test('what pages.go copies from the app is what the app says', () => {
  const brand = rd('web/src/lib/brand.ts');
  for (const name of ['brandMark', 'brandStillLight', 'brandStillDark']) {
    const v = new RegExp(name + String.raw`\s*=\s*"([^"]+)"`).exec(goSrc)[1];
    assert.ok(brand.includes("'" + v + "'"), name + ' ' + v + ' is in brand.ts');
  }
  assert.equal(/legalUpdated\s*=\s*"([^"]+)"/.exec(goSrc)[1], /UPDATED = '([^']+)'/.exec(rd('web/src/lib/pages/Legal.svelte'))[1]);
  const home = rd('web/src/lib/pages/Home.svelte');
  assert.match(home, /t\('hero\.h1_pre'\)\} <em>\{t\('hero\.h1_accent'\)\}<\/em>/, 'the hero heading the server writes (h1_pre <em>h1_accent</em>)');
});

test('the dark tokens for readers without scripts equal the dark theme tokens', () => {
  const css = rd('web/src/app.css');
  const tokens = (s) => [...s.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => m[1] + ':' + m[2].trim()).sort();
  const dark = /:root\[data-theme="dark"\] \{([^}]*)\}/.exec(css)[1];
  const media = /:root:not\(\[data-theme\]\) \{([^}]*)\}/.exec(css)[1];
  assert.deepEqual(tokens(media), tokens(dark));
});
