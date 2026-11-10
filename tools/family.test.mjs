// The family list in the app must equal the hop-assets manifest (tools/hop-apps.json, v8), without PayHop itself
// and without the apps that are not public (Imperium).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const manifest = JSON.parse(readFileSync(new URL('./hop-apps.json', import.meta.url), 'utf8'));
const src = readFileSync(new URL('../web/src/lib/family.ts', import.meta.url), 'utf8');
const listed = [...src.matchAll(/slug: '([^']+)', name: '([^']+)', url: '([^']+)'/g)].map((m) => ({ slug: m[1], name: m[2], url: m[3] }));

test('FAMILY equals the manifest (public apps, PayHop omitted)', () => {
  const want = manifest.apps.filter((a) => a.public !== false && a.slug !== 'payhop').map((a) => ({ slug: a.slug, name: a.name, url: a.url.replace(/\/$/, '') }));
  assert.deepEqual(listed.map((a) => a.slug), want.map((a) => a.slug));
  assert.deepEqual(listed, want);
});

test('every family mark and tile the app links to is vendored', async () => {
  const { existsSync } = await import('node:fs');
  for (const a of listed) {
    const mark = a.slug === 'hub' ? 'apps/hub/hop-id-mark.svg' : `apps/${a.slug}/mark.svg`;
    assert.ok(existsSync(new URL(`../web/public/hop-assets/v8/${mark}`, import.meta.url)), mark);
    for (const th of ['light', 'dark']) assert.ok(existsSync(new URL(`../web/public/hop-assets/v8/home/${a.slug}-${th}.webp`, import.meta.url)), `${a.slug}-${th}`);
  }
});
