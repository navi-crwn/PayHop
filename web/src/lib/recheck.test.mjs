import test from 'node:test';
import assert from 'node:assert/strict';
import { recheckAction } from './recheck.js';

test('a stale session is re-checked once, on load', () => {
  assert.equal(recheckAction({ stale: true, justBack: false }), 'recheck');
});
test('a fresh session or a guest is left alone (the hub being down never sets stale)', () => {
  assert.equal(recheckAction({ stale: false, justBack: false }), 'none');
  assert.equal(recheckAction({ stale: false, justBack: true }), 'none');
});
test('back from the hub and still stale: no second trip, say cookies', () => {
  assert.equal(recheckAction({ stale: true, justBack: true }), 'cookies');
});
