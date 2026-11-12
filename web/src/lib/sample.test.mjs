import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build, HopPayError } from './pay/index.js';
import { SAMPLES, SAMPLE_NAME, SAMPLE_ID_KEYS, FALLBACK_FORMAT, hasSample, sampleValues, isSample } from './sample.js';
import { methodBody, billBody } from './saved-model.js';
import { qrPng } from './qr.ts';

test('every sample value passes the format\'s own build()', () => {
  assert.ok(Object.keys(SAMPLES).length >= 1);
  for (const [fmt, vals] of Object.entries(SAMPLES)) {
    const out = build(fmt, vals);
    assert.ok(out.payload.length > 0, fmt);
    assert.equal(out.display.receiverName, SAMPLE_NAME, fmt + ' pays "DEMO: do not pay"');
    assert.deepEqual(out.warnings, [], fmt + ' builds without a warning');
  }
});

test('the sample IBAN is the SWIFT registry example for Germany, nothing else', () => {
  assert.equal(SAMPLES.epc.iban, 'DE89 3704 0044 0532 0130 00');
  assert.equal(SAMPLES.epc.name, 'DEMO: do not pay');
});

test('only formats with a documented example have a sample; the sample button falls back to a format that has one', () => {
  assert.deepEqual(Object.keys(SAMPLES), ['epc']);
  assert.ok(hasSample(FALLBACK_FORMAT));
  for (const f of ['paypal', 'cashapp', 'venmo', 'solana', 'upi', 'promptpay', 'vietqr']) assert.equal(hasSample(f), false, f);
  assert.equal(hasSample('constructor'), false);
  assert.deepEqual(sampleValues('paypal'), {});
  const c = sampleValues('epc');
  c.iban = 'changed';
  assert.equal(SAMPLES.epc.iban, 'DE89 3704 0044 0532 0130 00', 'a copy, not the table');
});

test('sample mode: on for the sample, on while any identity value remains, off when all are replaced or cleared', () => {
  const s = sampleValues('epc');
  assert.equal(isSample('epc', s), true);
  assert.equal(isSample('epc', { ...s, iban: 'de89370400440532013000' }), true, 'spaces and case do not matter');
  assert.equal(isSample('epc', { ...s, amount: '99', reference: 'x' }), true, 'the amount is not an identity value');
  assert.equal(isSample('epc', { ...s, iban: 'GB82 WEST 1234 5698 7654 32' }), true, 'real IBAN under the sample name stays marked');
  assert.equal(isSample('epc', { ...s, name: 'Ana' }), true, 'real name over the sample IBAN stays marked');
  assert.equal(isSample('epc', { ...s, name: 'Ana', iban: 'GB82 WEST 1234 5698 7654 32' }), false, 'every identity value replaced');
  assert.equal(isSample('epc', { name: '', iban: '', bic: '', amount: '', reference: '' }), false, 'cleared');
  assert.equal(isSample('epc', { name: 'Ana', iban: '', amount: '10.00', reference: 'SAMPLE' }), false, 'only the amount and reference match');
  assert.equal(isSample('paypal', { user: SAMPLE_NAME }), false);
  assert.deepEqual(SAMPLE_ID_KEYS.epc, ['name', 'iban']);
});

test('a sample can never be saved as a method or a bill', () => {
  const s = sampleValues('epc');
  assert.throws(() => methodBody('epc', s, '', true), /sample/);
  assert.throws(() => methodBody('epc', { ...s, name: 'Ana' }, '', true), /sample/, 'still the sample IBAN');
  assert.doesNotThrow(() => methodBody('epc', { name: 'Ana', iban: 'GB82 WEST 1234 5698 7654 32' }, '', true));
  const out = build('epc', s);
  assert.throws(() => billBody('epc', out.display, out.payload, true), /sample/);
});

// A recording canvas: what is drawn is what the PNG would show.
function fakeCanvas(log) {
  const g = {
    textAlign: '', fillStyle: '', font: '',
    fillRect() {},
    measureText: (s) => ({ width: s.length * 9 }),
    fillText: (s, x, y) => log.texts.push({ s, y })
  };
  return { width: 0, height: 0, getContext: () => g, toBlob: (cb) => cb(new Blob(['png'])) };
}
async function png(extra) {
  const log = { texts: [], canvas: null };
  globalThis.document = { createElement: () => (log.canvas = fakeCanvas(log)) };
  await qrPng('hello', { name: SAMPLE_NAME, amount: '10.00 EUR', scheme: 'EPC SEPA', made: 'made', check: 'check', ...extra });
  delete globalThis.document;
  return log;
}

test('a sample PNG carries the marker, above the code; a normal PNG does not', async () => {
  const marker = 'SAMPLE: not a real account. Do not pay.';
  const withMark = await png({ sample: marker });
  const band = withMark.texts.filter((t) => t.y < 60).map((t) => t.s).join(' ');
  assert.equal(band, marker, 'the marker is printed in the band above the code');
  assert.ok(withMark.texts.some((t) => t.s === SAMPLE_NAME), 'the recipient name "DEMO: do not pay" is printed too');
  const plain = await png({});
  assert.equal(plain.texts.some((t) => /SAMPLE/.test(t.s)), false);
  assert.ok(withMark.canvas.height > plain.canvas.height, 'the band adds height');
});

test('a long marker (another language) wraps and every line stays inside the picture', async () => {
  const long = 'ПРИМЕР: не настоящий счёт. Не платите. ПРИМЕР: не настоящий счёт. Не платите.';
  const r = await png({ sample: long });
  const lines = r.texts.filter((t) => t.y < 80).map((t) => t.s);
  assert.ok(lines.length >= 2);
  for (const l of lines) assert.ok(l.length * 9 <= 380 - 32, l);
});

test('the format list in formats.ts and the sample table agree: a sample names a real format', () => {
  const src = readFileSync(new URL('./formats.ts', import.meta.url), 'utf8');
  for (const fmt of Object.keys(SAMPLES)) assert.match(src, new RegExp("id: '" + fmt + "'"));
  assert.ok(HopPayError);
});
