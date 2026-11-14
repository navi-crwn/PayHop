import test from 'node:test';
import assert from 'node:assert/strict';
import { ANNOUNCEMENTS, activeAnnouncement, dismissAnnouncement, HIDE_DAYS } from './announce.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const DAY = 86400000;
const list = [{ id: 'a1', text: { en: 'Maintenance on Sunday.', id: 'Pemeliharaan hari Minggu.' }, href: 'https://hel.ink/status', link: { en: 'Details', id: 'Rincian' } }];

test('the shipped list is empty: no announcement means no card', () => {
  assert.deepEqual(ANNOUNCEMENTS, []);
  assert.equal(activeAnnouncement(ANNOUNCEMENTS, mem(), 1e12), null);
});

test('an announcement shows in the reader\'s language, falls back to English, and carries its link', () => {
  assert.equal(activeAnnouncement(list, mem(), 1e12, 'id').text, 'Pemeliharaan hari Minggu.');
  assert.equal(activeAnnouncement(list, mem(), 1e12, 'de').text, 'Maintenance on Sunday.');
  assert.equal(activeAnnouncement(list, mem(), 1e12, 'en').link, 'Details');
});

test('closing hides it for 7 days, then it comes back', () => {
  const s = mem(), t0 = 1e12;
  dismissAnnouncement('a1', s, t0);
  assert.equal(activeAnnouncement(list, s, t0 + 1000), null);
  assert.equal(activeAnnouncement(list, s, t0 + (HIDE_DAYS - 0.01) * DAY), null);
  assert.equal(activeAnnouncement(list, s, t0 + (HIDE_DAYS + 0.01) * DAY)?.id, 'a1');
});

test('a different announcement is not hidden by closing another; blocked storage still shows the card', () => {
  const s = mem();
  dismissAnnouncement('a1', s, 1e12);
  assert.equal(activeAnnouncement([...list, { id: 'a2', text: 'Next.' }], s, 1e12 + 1000)?.id, 'a2');
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(activeAnnouncement(list, blocked, 1e12)?.id, 'a1');
  assert.doesNotThrow(() => dismissAnnouncement('a1', blocked, 1e12));
});
