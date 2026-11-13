import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from './pay/index.js';
import { SAMPLES, SAMPLE_NAME, SAMPLE_ID_KEYS, FALLBACK_FORMAT, hasSample, sampleValues, isSample, livePayload, samplePayload, pngText } from './sample.js';
import { methodBody, billBody } from './saved-model.js';
import { qrPng, wrapLines } from './qr.ts';

const rd = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const NL = '\n';

test("every sample value passes the format's own build()", () => {
  assert.ok(Object.keys(SAMPLES).length >= 1);
  for (const [fmt, vals] of Object.entries(SAMPLES)) {
    const out = build(fmt, vals);
    assert.ok(out.payload.length > 0, fmt);
    assert.equal(out.display.receiverName, SAMPLE_NAME, fmt + ' pays "DEMO: do not pay"');
    assert.deepEqual(out.warnings, [], fmt + ' builds without a warning');
  }
});

test('the sample IBAN is a well-formed German IBAN (mod 97) and the name is the DEMO name', () => {
  const iban = SAMPLES.epc.iban.split(' ').join('');
  assert.equal(iban.length, 22);
  assert.ok(iban.startsWith('DE'));
  let rem = 0;
  for (const ch of iban.slice(4) + iban.slice(0, 4)) for (const d of ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch) rem = (rem * 10 + Number(d)) % 97;
  assert.equal(rem, 1);
  assert.equal(SAMPLES.epc.name, 'DEMO: do not pay');
  assert.ok(build('epc', SAMPLES.epc).display.receiverId.startsWith('DE89'));
});

test('a sample payload is never payable: not the EPC service tag, not what build() returns', () => {
  const real = build('epc', sampleValues('epc')).payload;
  assert.ok(real.startsWith('BCD' + NL), 'the real EPC payload starts with the service tag');
  const s = livePayload(true, real);
  assert.ok(!s.startsWith('BCD'));
  assert.notEqual(s, real);
  assert.equal(s.split(NL)[0], 'SAMPLE-NOT-PAYABLE');
  assert.equal(s.split(NL).slice(1).join(NL), real.split(NL).slice(1).join(NL), 'only the first line differs: the screen still shows a realistic code');
  assert.equal(samplePayload('one line'), 'SAMPLE-NOT-PAYABLE' + NL + 'one line');
});

test('leaving sample mode (name and IBAN both replaced) gives the real payload again', () => {
  const vals = { ...sampleValues('epc'), name: 'Ana', iban: 'GB82 WEST 1234 5698 7654 32' };
  const real = build('epc', vals).payload;
  assert.equal(isSample('epc', vals), false);
  assert.equal(livePayload(isSample('epc', vals), real), real);
  assert.ok(livePayload(isSample('epc', vals), real).startsWith('BCD' + NL));
});

test('what the page hands to the PNG: the marker only in sample mode, and the page really uses it', () => {
  const t = (k) => ({ 'gen.png_made': 'made', 'gen.png_check': 'check', 'sample.badge': 'MARK' })[k];
  const d = build('epc', sampleValues('epc')).display;
  assert.deepEqual(pngText(d, '10.00 EUR', true, t), { name: SAMPLE_NAME, amount: '10.00 EUR', scheme: 'EPC SEPA', made: 'made', check: 'check', sample: 'MARK' });
  assert.equal(pngText(d, '10.00 EUR', false, t).sample, undefined);
  const page = rd('./pages/Generate.svelte');
  assert.ok(page.includes('qrPng(payload, pngText(d, amountText(d), sample, t))'), 'download() goes through pngText with the sample flag and the non-payable payload');
  assert.ok(page.includes('writeText(payload)'), 'copy carries the same payload');
  assert.ok(page.includes('id="payload">{payload}'), 'the text box shows the same payload');
  assert.ok(page.includes('makeQr(payload,'), 'the card draws the same payload');
  assert.ok(rd('./pages/Split.svelte').includes('livePayload(exampleOn, out.payload)'), 'each person on /split gets the same');
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

test('in every language the whole marker is drawn, on as many lines as it takes, nothing clipped', () => {
  // CJK characters are twice as wide as the others in the real font; the picture leaves 380 - 32 px
  const width = (str) => [...str].reduce((w, c) => w + (/[　-鿿＀-￯]/.test(c) ? 18 : 10), 0);
  for (const loc of ['en', 'zh-CN', 'de', 'id', 'ja', 'pt-BR', 'es', 'fr', 'ru']) {
    const text = JSON.parse(rd('./i18n/' + loc + '.json'))['sample.badge'];
    const lines = wrapLines(text, (x) => width(x) <= 380 - 32);
    assert.equal(lines.join('').split(' ').join(''), text.split(' ').join(''), loc + ': nothing lost');
    assert.ok(!lines.some((l) => l.includes('…')), loc + ': no ellipsis');
    for (const l of lines) assert.ok(width(l) <= 348, loc + ': line fits: ' + l);
  }
});

test('a marker with no spaces (Japanese) is broken per character and drawn in full in the PNG', async () => {
  const ja = JSON.parse(rd('./i18n/ja.json'))['sample.badge'];
  const r = await png({ sample: ja });
  assert.equal(r.texts.filter((t) => t.y < 80).map((t) => t.s).join(''), ja);
});

test('the format list in formats.ts and the sample table agree: a sample names a real format', () => {
  const src = rd('./formats.ts');
  for (const fmt of Object.keys(SAMPLES)) assert.ok(src.includes("id: '" + fmt + "'"));
});
