import test from 'node:test';
import assert from 'node:assert/strict';
import { feedbackUrl, screenName, hubBase } from './feedback.js';

test('the link carries the app, the screen name and the version', () => {
  assert.equal(feedbackUrl('https://hel.ink', '/account', '0.0.7'), 'https://hel.ink/feedback?app=payhop&from=dashboard&v=0.0.7');
  assert.equal(feedbackUrl('https://hel.ink/', '/generate', '0.0.7'), 'https://hel.ink/feedback?app=payhop&from=generate&v=0.0.7');
});

test('without a usable hub address there is no link', () => {
  for (const h of ['', undefined, null, 'hel.ink', 'javascript:alert(1)', 'ftp://hel.ink', '//hel.ink']) assert.equal(feedbackUrl(h, '/account', '0.0.7'), '', String(h));
});

test('every route has a fixed screen name and the real address never reaches the link', () => {
  assert.equal(screenName('/'), 'home');
  assert.equal(screenName('/split/'), 'split');
  assert.equal(screenName('/account?saved=42#bill-7'), 'dashboard');
  assert.equal(screenName('/generate?sample=1'), 'generate');
  // a path that is not a route (an id, a query, a key) becomes "other", not itself
  for (const p of ['/n/abc123', '/x?token=SECRET', '/account/42', '/#frag', undefined]) {
    const u = feedbackUrl('https://hel.ink', p, '0.0.7');
    assert.doesNotMatch(u, /abc123|SECRET|42|frag/, String(p));
  }
  assert.equal(screenName('/n/abc123'), 'other');
});

test('the version is cleaned to the contract and may be empty', () => {
  assert.equal(feedbackUrl('https://hel.ink', '/', 'dev'), 'https://hel.ink/feedback?app=payhop&from=home&v=dev');
  assert.equal(feedbackUrl('https://hel.ink', '/', ''), 'https://hel.ink/feedback?app=payhop&from=home');
  assert.equal(feedbackUrl('https://hel.ink', '/', undefined), 'https://hel.ink/feedback?app=payhop&from=home');
  assert.match(feedbackUrl('https://hel.ink', '/', '0.0.7 <b>&x=1'), /&v=0.0.7bx1$/);
  assert.ok(feedbackUrl('https://hel.ink', '/', 'x'.repeat(60)).endsWith('&v=' + 'x'.repeat(24)));
});

test('the hub base keeps its origin and drops a trailing slash', () => {
  assert.equal(hubBase('https://hub.example.test/'), 'https://hub.example.test');
  assert.equal(hubBase('http://127.0.0.1:8611'), 'http://127.0.0.1:8611');
});
