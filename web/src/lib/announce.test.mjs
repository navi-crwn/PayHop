import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleAnnouncement, canDismiss, dismissAnnouncement, dismissKey, HIDE_DAYS } from './announce.js';

const mem = () => { const m = new Map(); return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const DAY = 86400000;
const info = { id: '12', level: 'info', title: 'Maintenance', body: 'Sunday.', url: 'https://hel.ink/announcements/12' };

test('no data means no card', () => {
  for (const none of [null, undefined, {}, { id: '', title: 'x' }, { id: '1', title: '' }, { id: 1, title: 'x' }]) assert.equal(visibleAnnouncement(none, mem(), 1e12), null);
});

test('an item shows; closing hides it for 7 days under the key ann-<id>, then it comes back', () => {
  const s = mem(), t0 = 1e12;
  assert.equal(visibleAnnouncement(info, s, t0), info);
  dismissAnnouncement('12', s, t0);
  assert.ok(s.m.has('ann-12') && dismissKey('12') === 'ann-12');
  assert.equal(visibleAnnouncement(info, s, t0 + 1000), null);
  assert.equal(visibleAnnouncement(info, s, t0 + (HIDE_DAYS - 0.01) * DAY), null);
  assert.equal(visibleAnnouncement(info, s, t0 + (HIDE_DAYS + 0.01) * DAY), info);
});

test('closing one notice does not hide another', () => {
  const s = mem();
  dismissAnnouncement('12', s, 1e12);
  assert.equal(visibleAnnouncement({ ...info, id: '13' }, s, 1e12 + 1000)?.id, '13');
});

test('a critical notice cannot be closed: it shows even when a key exists, and has no close button', () => {
  const s = mem(), crit = { ...info, id: '7', level: 'critical' };
  dismissAnnouncement('7', s, 1e12);
  assert.equal(visibleAnnouncement(crit, s, 1e12 + 1000), crit);
  assert.equal(canDismiss(crit), false);
  assert.equal(canDismiss(info), true);
  assert.equal(canDismiss({ ...info, level: 'warning' }), true);
});

test('blocked storage still shows the card and closing does not throw', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(visibleAnnouncement(info, blocked, 1e12), info);
  assert.doesNotThrow(() => dismissAnnouncement('12', blocked, 1e12));
});
