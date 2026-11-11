// The release number lives in web/package.json only; the changelog, the lock file and the build agree with it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const version = JSON.parse(rd('web/package.json')).version;

test('the changelog has an empty [Unreleased] above the current version, dated, with compare links', () => {
  const log = rd('CHANGELOG.md');
  const heads = [...log.matchAll(/^## (.+)$/gm)].map((m) => m[1]);
  assert.equal(heads[0], '[Unreleased]');
  assert.match(heads[1], new RegExp('^\\[' + version.replace(/\./g, '\\.') + '\\] - \\d{4}-\\d{2}-\\d{2}$'));
  const unreleased = log.split('## [Unreleased]')[1].split('\n## ')[0];
  assert.equal(unreleased.trim(), '', 'nothing may sit under [Unreleased] on a release');
  assert.match(log, new RegExp('^\\[Unreleased\\]: https://github.com/navi-crwn/PayHop/compare/v' + version.replace(/\./g, '\\.') + '\\.\\.\\.HEAD$', 'm'));
});

test('the lock file carries the same version', () => {
  const lock = JSON.parse(rd('package-lock.json'));
  assert.equal(lock.packages.web.version, version);
});

test('no Go source holds a version number: the binary gets it from the tag (-X main.version)', () => {
  const main = rd('cmd/payhop/main.go');
  assert.match(main, /var version = "dev"/);
  assert.doesNotMatch(main, /version\s*=\s*"(?!dev")/, "a version number written into the source");
  assert.match(rd('install.sh'), /-X main\.version=\$VERSION/);
});

test('no text calls a shipped feature unreleased, coming later or a preview', () => {
  const en = rd('web/src/lib/i18n/en.json');
  assert.doesNotMatch(en, /coming later|not part of this release|preview build|release candidate/i);
  for (const f of ['README.md', 'docs/DEPLOY.md', 'docs/WALLET-MATRIX.md']) assert.doesNotMatch(rd(f), /coming later|not part of this release|preview build|release candidate/i, f);
});
