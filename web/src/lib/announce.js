// The family announcement card at the top of the signed-in dashboard (/account).
// The text comes from the hub through this app's own server (GET /api/v1/announcement, see internal/app/announce.go):
// one source for every HOP app, nothing written in this code. No item, no card, no gap.
// Closing a card hides it for 7 days in this browser, under the key "ann-<id>"; a critical notice cannot be closed.

export const HIDE_DAYS = 7;
export const dismissKey = (id) => 'ann-' + id;

/** The card to draw, or null: nothing from the hub, or a closed one within the last 7 days (never for a critical one). */
export function visibleAnnouncement(item, store, now) {
  if (!item || typeof item.id !== 'string' || !item.id || typeof item.title !== 'string' || !item.title) return null;
  if (item.level === 'critical') return item;
  let hiddenAt = 0;
  try { hiddenAt = Number(store?.getItem(dismissKey(item.id))) || 0; } catch { /* storage blocked: show it */ }
  return hiddenAt && now - hiddenAt < HIDE_DAYS * 86400000 ? null : item;
}

export const canDismiss = (item) => item?.level !== 'critical';

export function dismissAnnouncement(id, store, now) {
  try { store?.setItem(dismissKey(id), String(now)); } catch { /* storage blocked: it comes back on the next visit */ }
}
