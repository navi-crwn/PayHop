import en from './en.json';

/* Nine languages, no Arabic, per the family rule. A missing key falls back to
   English and warns once, so the UI never shows a raw key. `dict` is a $state so
   that t() inside markup is reactive: switching the language repaints every string. */

export const LOCALES = ['en', 'zh-CN', 'de', 'id', 'ja', 'pt-BR', 'es', 'fr', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_NAMES: Record<string, string> = {
  en: 'English',
  'zh-CN': '简体中文',
  de: 'Deutsch',
  id: 'Bahasa Indonesia',
  ja: '日本語',
  'pt-BR': 'Português (Brasil)',
  es: 'Español',
  fr: 'Français',
  ru: 'Русский'
};

type Dict = Record<string, string>;

const LOADERS: Record<string, () => Promise<{ default: Dict }>> = {
  en: async () => ({ default: en as Dict }),
  'zh-CN': () => import('./zh-CN.json') as Promise<{ default: Dict }>,
  de: () => import('./de.json') as Promise<{ default: Dict }>,
  id: () => import('./id.json') as Promise<{ default: Dict }>,
  ja: () => import('./ja.json') as Promise<{ default: Dict }>,
  'pt-BR': () => import('./pt-BR.json') as Promise<{ default: Dict }>,
  es: () => import('./es.json') as Promise<{ default: Dict }>,
  fr: () => import('./fr.json') as Promise<{ default: Dict }>,
  ru: () => import('./ru.json') as Promise<{ default: Dict }>
};

const FALLBACK = en as Dict;

export function isLocale(v: string): v is Locale {
  return (LOCALES as readonly string[]).includes(v);
}

function readStored(): string | null {
  try {
    return localStorage.getItem('hop-lang');
  } catch {
    return null;
  }
}

function storeLocale(l: string): void {
  try {
    localStorage.setItem('hop-lang', l);
  } catch {
    /* private mode: the choice just does not survive a reload */
  }
}

export function guessLocale(): Locale {
  const stored = readStored();
  if (stored && isLocale(stored)) return stored;
  const tags = navigator.languages ?? [navigator.language];
  for (const tag of tags) {
    const exact = LOCALES.find((l) => l.toLowerCase() === tag.toLowerCase());
    if (exact) return exact;
    const base = tag.split('-')[0].toLowerCase();
    const byBase = LOCALES.find((l) => l.split('-')[0].toLowerCase() === base);
    if (byBase) return byBase;
  }
  return 'en';
}

class I18nState {
  locale = $state<Locale>('en');
  dict = $state<Dict>(FALLBACK);
  private cache = new Map<string, Dict>();
  private missing = new Set<string>();

  async load(locale: Locale): Promise<void> {
    let d = this.cache.get(locale);
    if (!d) {
      d = (await (LOADERS[locale] ?? LOADERS.en)()).default;
      this.cache.set(locale, d);
    }
    this.dict = d;
    this.locale = locale;
    document.documentElement.lang = locale;
    storeLocale(locale);
  }

  t(key: string, vars?: Record<string, string | number>): string {
    const s = this.dict[key] ?? FALLBACK[key];
    if (s === undefined) {
      if (!this.missing.has(key)) {
        this.missing.add(key);
        console.warn(`[i18n] missing key: ${key}`);
      }
      return key;
    }
    if (!vars) return s;
    return s.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
  }
}

export const i18n = new I18nState();
