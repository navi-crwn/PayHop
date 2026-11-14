// Announcements shown as a card at the top of the signed-in dashboard (/account).
// The list lives here in the code and is empty by default: with no entry there is no card and no gap.
// To announce something, add an entry; the text may carry one string per language ("en" is the fallback):
//   { id: '2026-11-maintenance', text: { en: '...', id: '...' }, href: 'https://hel.ink/status', link: { en: 'Details' } }
// Closing a card hides it for 7 days, kept in this browser under a key that holds the announcement's id.

export const ANNOUNCEMENTS = [];

export const HIDE_DAYS = 7;
const KEY = (id) => 'payhop.announce.' + id;

const pick = (m, locale) => (typeof m === 'string' ? m : m?.[locale] ?? m?.[String(locale).split('-')[0]] ?? m?.en ?? '');

/** The first announcement that has not been closed within the last 7 days, with its text in `locale`; or null. */
export function activeAnnouncement(list, store, now, locale = 'en') {
  for (const a of list) {
    let hiddenAt = 0;
    try { hiddenAt = Number(store?.getItem(KEY(a.id))) || 0; } catch { /* storage blocked: show it */ }
    if (hiddenAt && now - hiddenAt < HIDE_DAYS * 86400000) continue;
    const text = pick(a.text, locale);
    if (!text) continue;
    return { id: a.id, text, href: a.href ?? '', link: a.href ? pick(a.link, locale) : '' };
  }
  return null;
}

export function dismissAnnouncement(id, store, now) {
  try { store?.setItem(KEY(id), String(now)); } catch { /* storage blocked: it comes back on the next visit */ }
}
