// Family preference cookies (theme, language): the reader that runs before first paint (web/public/theme.js) and the
// functions the app uses (web/src/lib/prefs.js) must agree, and write the cookie by the family rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { readTheme, saveTheme, readLang, saveLang, cookieDomain, readCookie, langFromQuery } from '../web/src/lib/prefs.js';

const themeJs = readFileSync(new URL('../web/public/theme.js', import.meta.url), 'utf8');

function env({ cookie = '', old = null, dark = false, host = 'localhost' } = {}) {
  const store = new Map(old === null ? [] : [['hop-theme', old]]);
  const doc = {
    jar: cookie,
    get cookie() { return this.jar; },
    set cookie(v) { this.writes = [...(this.writes || []), v]; const [kv] = v.split(';'); const [k] = kv.split('='); this.jar = this.jar.split('; ').filter((c) => c && !c.startsWith(k + '=')).concat(kv).join('; '); },
    documentElement: { dataset: {} }
  };
  const localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, v) };
  return { doc, localStorage, store, host, dark };
}
function runThemeJs(e) {
  vm.runInContext(themeJs, vm.createContext({ document: e.doc, localStorage: e.localStorage, location: { hostname: e.host }, matchMedia: () => ({ matches: e.dark }) }));
  return e.doc.documentElement.dataset.theme;
}
const viaLib = (e) => readTheme({ doc: e.doc, host: e.host, store: e.localStorage, prefersDark: e.dark });

const cases = [
  ['cookie wins over the old key', { cookie: 'hop_theme=dark', old: 'light' }, 'dark'],
  ['cookie light, system dark', { cookie: 'hop_theme=light', dark: true }, 'light'],
  ['no cookie: the old key', { old: 'dark' }, 'dark'],
  ['no cookie, no key: the system setting (dark)', { dark: true }, 'dark'],
  ['no cookie, no key: the system setting (light)', {}, 'light'],
  ['cookie "system" follows the system, not the old key', { cookie: 'hop_theme=system', old: 'dark', dark: false }, 'light'],
  ['a junk old key is ignored', { old: 'purple', dark: true }, 'dark'],
  ['other cookies around it', { cookie: 'a=1; hop_theme=dark; b=2' }, 'dark']
];
for (const [name, opts, want] of cases) {
  test('theme: ' + name + ' (first-paint script and app code agree)', () => {
    assert.equal(runThemeJs(env(opts)), want);
    assert.equal(viaLib(env(opts)), want);
  });
}

test('theme: an old key with no cookie is moved into the cookie once, host-only on localhost', () => {
  for (const run of [runThemeJs, viaLib]) {
    const e = env({ old: 'dark' });
    run(e);
    assert.deepEqual(e.doc.writes, ['hop_theme=dark; path=/; max-age=31536000; SameSite=Lax']);
    assert.doesNotMatch(e.doc.writes[0], /domain=|HttpOnly/i);
  }
});

test('theme: on a *.hel.ink host the cookie is Domain=.hel.ink and Secure; a cookie that is there is not rewritten', () => {
  for (const host of ['pay.hel.ink', 'hel.ink']) {
    for (const run of [runThemeJs, viaLib]) {
      const e = env({ old: 'light', host });
      run(e);
      assert.equal(e.doc.writes[0], 'hop_theme=light; path=/; max-age=31536000; SameSite=Lax; domain=.hel.ink; Secure');
      const f = env({ cookie: 'hop_theme=light', old: 'light', host });
      run(f);
      assert.equal(f.doc.writes, undefined);
    }
  }
  assert.equal(cookieDomain('notel.ink'), '', 'only hel.ink itself and its subdomains');
  assert.equal(cookieDomain('hel.ink.example.com'), '');
});

test('theme: toggling writes the cookie and keeps the old key', () => {
  const e = env({});
  saveTheme({ doc: e.doc, host: 'pay.hel.ink', store: e.localStorage }, 'dark');
  assert.equal(e.doc.writes[0], 'hop_theme=dark; path=/; max-age=31536000; SameSite=Lax; domain=.hel.ink; Secure');
  assert.equal(e.store.get('hop-theme'), 'dark');
});

test('language: cookie, then the old key, never an unsupported value; picking writes both, plain text', () => {
  const e = env({ cookie: 'hop_lang=pt-BR' });
  assert.equal(readLang({ doc: e.doc, store: e.localStorage }), 'pt-BR');
  e.store.set('hop-lang', 'de');
  assert.equal(readLang({ doc: e.doc, store: e.localStorage }), 'pt-BR', 'cookie first');
  const f = env({});
  f.store.set('hop-lang', 'de');
  assert.equal(readLang({ doc: f.doc, store: f.localStorage }), 'de');
  const g = env({ cookie: 'hop_lang=ar' });
  assert.equal(readLang({ doc: g.doc, store: g.localStorage }), null, 'Arabic is not a family language');
  saveLang({ doc: f.doc, host: 'pay.hel.ink', store: f.localStorage }, 'zh-CN');
  assert.equal(f.doc.writes[0], 'hop_lang=zh-CN; path=/; max-age=31536000; SameSite=Lax; domain=.hel.ink; Secure');
  assert.equal(f.store.get('hop-lang'), 'zh-CN');
  assert.equal(readCookie('a=1; hop_lang=ja', 'hop_lang'), 'ja');
});

test('language in the address: ?lang= names one of the nine (any case, pt and zh for the two with a region); anything else is none', () => {
  for (const [q, want] of [['?lang=de', 'de'], ['?lang=DE', 'de'], ['?a=1&lang=ja&b=2', 'ja'], ['?lang=pt-BR', 'pt-BR'], ['?lang=pt', 'pt-BR'], ['?lang=zh', 'zh-CN'], ['?lang=zh-cn', 'zh-CN'], ['?lang=en', 'en'],
    ['?lang=xx', null], ['?lang=ar', null], ['?lang=', null], ['', null], [undefined, null], ['?sample=1', null]]) assert.equal(langFromQuery(q), want, String(q));
});
