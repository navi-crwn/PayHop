// hop-assets v9 in PayHop: the manifest copy, the vendored files and the family list in the app agree, and nothing of the
// identity is kept locally any more. (Byte-identity with the hub itself is checked by scripts/check-vendored-assets.sh and
// scripts/check-hop-family.sh against a HEL.ink ref; this test needs no network.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const rd = (p) => readFileSync(join(root, p), 'utf8');
const manifest = JSON.parse(rd('tools/hop-apps.json'));
const V = manifest.version;
const vendored = (rel) => join(root, 'web/public/hop-assets', V, rel);
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
const urls = (o) => (o && typeof o === 'object' ? (typeof o.url === 'string' && o.integrity ? [o] : Object.values(o).flatMap(urls)) : []);

test('the manifest is v9 and the only vendored version', () => {
  assert.equal(V, 'v9');
  assert.deepEqual(readdirSync(join(root, 'web/public/hop-assets')), ['v9']);
});

test('every asset and icon in the manifest is vendored, with the integrity hash the manifest gives', () => {
  const all = urls(manifest);
  assert.ok(all.length > 60, 'expected the whole manifest, got ' + all.length);
  for (const { url, integrity } of all) {
    assert.ok(url.startsWith(manifest.base), url);
    const f = vendored(url.slice(manifest.base.length));
    assert.ok(existsSync(f), 'not vendored: ' + url);
    const got = 'sha384-' + createHash('sha384').update(readFileSync(f)).digest('base64');
    assert.equal(got, integrity, url);
  }
});

test('the family list is built from the manifest, not written out', () => {
  const src = rd('web/src/lib/family.ts');
  assert.match(src, /from '\.\.\/\.\.\/\.\.\/tools\/hop-apps\.json'/);
  assert.doesNotMatch(src, /slug: '/, 'a hand-written app entry');
  assert.doesNotMatch(src, /https:\/\/[a-z]+\.hel\.ink/, 'a hand-written address');
});

test('every public app other than PayHop has its mark and both home tiles vendored', () => {
  const listed = manifest.apps.filter((a) => a.public !== false && a.slug !== 'payhop');
  assert.deepEqual(listed.map((a) => a.slug), ['hub', 'linkhop', 'biohop', 'pixelhop', 'notehop', 'filehop']);
  for (const a of listed) {
    assert.ok(existsSync(vendored(new URL(a.icons.mark.url).pathname.replace(/^\/hop-assets\/v\d+\//, ''))), a.slug + ' mark');
    for (const th of ['light', 'dark']) assert.ok(existsSync(vendored(`home/${a.slug}-${th}.webp`)), `${a.slug}-${th}`);
  }
  assert.equal(manifest.apps.find((a) => a.slug === 'imperium').public, false, 'Imperium must stay out of the public list');
});

test('PayHop uses its mark, icons, name font and hero from v9 only', () => {
  const index = rd('web/index.html');
  for (const p of ['apps/payhop/mark.svg', 'apps/payhop/icon-192.png', 'apps/payhop/apple-touch-icon.png', 'fonts-amnesia.css', 'hop-brand.css', 'hop-hero3d.js'])
    assert.ok(index.includes(`/hop-assets/${V}/${p}`), p);
  const pwa = JSON.parse(rd('web/public/manifest.webmanifest'));
  for (const i of pwa.icons) assert.ok(i.src.startsWith(`/hop-assets/${V}/apps/payhop/`), i.src);
  for (const p of ['apps/payhop/mark.svg', 'apps/payhop/icon-512.png', 'home/payhop-light.webp', 'home/payhop-dark.webp', 'fonts/brand/payhop-name.woff2'])
    assert.ok(existsSync(vendored(p)), p);
  assert.match(readFileSync(vendored('hop-brand.css'), 'utf8'), /\.hop-name-payhop/);
});

test('no local copy of the identity is left: no brand folder, no own mark or icons, no v8, no block map', () => {
  for (const p of ['web/public/brand', 'web/public/mark.svg', 'web/public/icon-192.png', 'web/public/icon-512.png', 'web/public/apple-touch-icon.png', 'web/public/home'])
    assert.ok(!existsSync(join(root, p)), p + ' still exists');
  const own = [...walk(join(root, 'web/src')), join(root, 'web/index.html'), join(root, 'web/public/manifest.webmanifest')];
  for (const f of own) {
    if (!/\.(ts|js|svelte|html|css|webmanifest)$/.test(f)) continue;
    const s = readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /hop-assets\/v[0-8]\b/, f);
    assert.doesNotMatch(s, /unbounded-latin/i, f);
  }
  assert.doesNotMatch(rd('web/src/lib/brand.ts'), /map:|stops:/, 'the 3D block map belongs to the v9 engine');
  assert.doesNotMatch(rd('web/src/lib/pages/Home.svelte'), /\.maps\[/, 'the page must not add its own map to the engine');
  assert.match(readFileSync(vendored('hop-hero3d.js'), 'utf8'), /payhop:\s*\[/, 'the v9 engine carries the PayHop map');
});
