import test from 'node:test';
import assert from 'node:assert/strict';
import { graphemes, clipToFit } from './text.js';

const width = (n) => (s) => Array.from(s).length <= n;

test('a name that fits is left alone', () => {
  assert.equal(clipToFit('Café Ana', width(20)), 'Café Ana');
});

test('a long name is cut with an ellipsis', () => {
  assert.equal(clipToFit('abcdefghijkl', width(6)), 'abcde…');
});

test('an emoji is never cut in half', () => {
  const s = '😀'.repeat(10);
  const out = clipToFit(s, (t) => t.length <= 9); // length counts UTF-16 units, like measuring a string
  assert.ok(out.endsWith('…'));
  for (const ch of out.slice(0, -1)) assert.ok(ch.codePointAt(0) >= 0x1f600, 'a lone surrogate was left behind');
  assert.equal(out.slice(0, -1).length % 2, 0);
});

test('a family emoji (ZWJ sequence) stays whole or goes whole', () => {
  const fam = '👩‍👩‍👧‍👦';
  const out = clipToFit('ab' + fam + fam + 'cd', (t) => t.length <= 14);
  const rest = out.slice(0, -1).replace('ab', '');
  assert.ok(rest === '' || rest === fam || rest === fam + fam, JSON.stringify(rest));
});

test('graphemes keeps an accent with its letter', () => {
  assert.deepEqual(graphemes('e\u0301a'), ['e\u0301', 'a']);
});
