/* The family's preference cookies (theme and language), shared by every HOP app: one cookie on .hel.ink so a choice
   made in one app holds in the next. Plain functions with no DOM of their own: the caller passes `doc` (anything
   with a `cookie` property), `host` and `store` (localStorage). Tested in tools/prefs.test.mjs. */

export const LANGS = ['en', 'zh-CN', 'de', 'id', 'ja', 'pt-BR', 'es', 'fr', 'ru'];

/** On hel.ink and its subdomains the cookie covers the whole family; anywhere else (localhost, a self-hosted copy) it stays on the host. */
export const cookieDomain = (host) => (/(^|\.)hel\.ink$/.test(host) ? '; domain=.hel.ink; Secure' : '');

export function readCookie(jar, name) {
  const m = new RegExp('(?:^|; )' + name + '=([^;]*)').exec(jar || '');
  return m ? m[1] : null;
}

export function writeCookie(doc, host, name, value) {
  try {
    doc.cookie = name + '=' + value + '; path=/; max-age=31536000; SameSite=Lax' + cookieDomain(host);
  } catch { /* cookies blocked: the choice still holds in this app through localStorage */ }
}

const get = (store, key) => {
  try { return store.getItem(key); } catch { return null; }
};
const set = (store, key, value) => {
  try { store.setItem(key, value); } catch { /* private mode */ }
};

/** 'light' | 'dark': cookie, then the old localStorage key (moved into the cookie once), then the system setting. */
export function readTheme({ doc, host, store, prefersDark }) {
  const c = readCookie(doc.cookie, 'hop_theme');
  if (c !== null) return c === 'light' || c === 'dark' ? c : prefersDark ? 'dark' : 'light'; // any other value: follow the system
  const old = get(store, 'hop-theme');
  if (old === 'light' || old === 'dark') {
    writeCookie(doc, host, 'hop_theme', old);
    return old;
  }
  return prefersDark ? 'dark' : 'light';
}

/** Every control that changes the theme calls this: the cookie, and the old key for anything still reading it. */
export function saveTheme({ doc, host, store }, theme) {
  writeCookie(doc, host, 'hop_theme', theme);
  set(store, 'hop-theme', theme);
}

/** The language a ?lang= address names (the server writes that language into the page, internal/app/pages.go pageLang):
 *  one of the nine, in any case, pt or zh for the two with a region; null when there is none or it is not supported. */
export function langFromQuery(search) {
  const q = new URLSearchParams(search || '').get('lang');
  if (q === null) return null;
  const v = q.trim().toLowerCase();
  const hit = LANGS.find((l) => l.toLowerCase() === v);
  return hit ?? (v === 'pt' ? 'pt-BR' : v === 'zh' ? 'zh-CN' : null);
}

/** The language the reader chose before: cookie hop_lang, then localStorage 'hop-lang'; null when neither holds a supported one. */
export function readLang({ doc, store }) {
  const c = readCookie(doc.cookie, 'hop_lang');
  if (c !== null && LANGS.includes(c)) return c;
  const old = get(store, 'hop-lang');
  return old !== null && LANGS.includes(old) ? old : null;
}

/** The reader picked a language. */
export function saveLang({ doc, host, store }, lang) {
  writeCookie(doc, host, 'hop_lang', lang);
  set(store, 'hop-lang', lang);
}

const noStore = { getItem: () => null, setItem: () => {} };
/** The browser's own document, host and localStorage (which can throw when site data is blocked). */
export function browserCtx() {
  let store = noStore;
  try { store = localStorage; } catch { /* blocked */ }
  return { doc: document, host: location.hostname, store };
}
