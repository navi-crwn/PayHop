import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { maskId, methodBody, methodTitle, applyMethod, billBody, errorKey, METHOD_KEYS, ID_KEY, MAX_METHODS, KEEP_BILLS } from './saved-model.js';

// the form fields per format live in formats.ts (TypeScript, not importable here): read the keys out of its source
const src = readFileSync(new URL('./formats.ts', import.meta.url), 'utf8');
const FIELDS = {};
for (const m of src.matchAll(/\{ id: '(\w+)', label: '[^']+', group: '\w+', fields: \[([\s\S]*?)\] \}/g)) {
  FIELDS[m[1]] = [...m[2].matchAll(/key: '(\w+)'/g)].map((x) => x[1]);
}

test('an account number is masked, never printed whole', () => {
  assert.equal(maskId('DE89 3704 0044 0532 0130 00'), 'DE••••000');
  assert.equal(maskId('abc'), 'a••••');
  assert.equal(maskId(''), '');
  assert.ok(!maskId('DE89370400440532013000').includes('0532'));
});

test('a method keeps only the receiver fields, trimmed, and never the amount or note', () => {
  const b = methodBody('epc', { name: ' Ana ', iban: 'DE89 3704 0044 0532 0130 00', bic: '', amount: '12.34', reference: 'rent' }, ' Rent ', true);
  assert.deepEqual(b, { format: 'epc', label: 'Rent', values: { name: 'Ana', iban: 'DE89 3704 0044 0532 0130 00' }, consent: true });
  assert.equal(methodBody('upi', { vpa: 'a@b', note: 'x' }, '', false).consent, false);
  assert.equal(methodBody('paypal', { user: 'ana' }, undefined, undefined).consent, false, 'no consent unless it is exactly true');
  assert.throws(() => methodBody('visa', {}, '', true));
});

test('every saved key is a real form field of that format, and every format has an id field', () => {
  assert.deepEqual(Object.keys(FIELDS).sort(), Object.keys(METHOD_KEYS).sort());
  for (const id of Object.keys(FIELDS)) {
    for (const k of METHOD_KEYS[id]) assert.ok(FIELDS[id].includes(k), `${id}.${k}`);
    assert.ok(METHOD_KEYS[id].includes(ID_KEY[id]), `${id} id key`);
    assert.ok(!METHOD_KEYS[id].includes('amount'), `${id} must not save the amount`);
  }
});

test('a list shows the name, or the format and the masked id', () => {
  assert.equal(methodTitle({ format: 'epc', label: 'Rent', values: {} }), 'Rent');
  assert.equal(methodTitle({ format: 'epc', label: '', values: { iban: 'DE89370400440532013000' } }), 'EPC SEPA · DE••••000');
  assert.equal(methodTitle({ format: 'paypal', label: '', values: {} }), 'PayPal.me');
});

test('picking a saved method fills its fields and leaves the amount alone', () => {
  const cur = { name: '', iban: '', bic: '', amount: '5', reference: 'x' };
  const next = applyMethod(cur, { format: 'epc', values: { name: 'Ana', iban: 'DE89' } });
  assert.deepEqual(next, { name: 'Ana', iban: 'DE89', bic: '', amount: '5', reference: 'x' });
  assert.equal(cur.name, '', 'the old values object is not mutated');
});

test('a bill body carries what the generator shows and the consent', () => {
  const b = billBody('epc', { receiverName: 'Ana', amount: '12.34', currency: 'EUR' }, 'BCD\n002', true);
  assert.deepEqual(b, { format: 'epc', receiver: 'Ana', amount: '12.34', currency: 'EUR', payload: 'BCD\n002', note: '', consent: true });
  assert.equal(billBody('epc', {}, 'x', undefined).consent, false);
});

test('server errors map to messages that exist in every language file', () => {
  const dir = new URL('./i18n/', import.meta.url);
  for (const loc of ['en', 'zh-CN', 'de', 'id', 'ja', 'pt-BR', 'es', 'fr', 'ru']) {
    const d = JSON.parse(readFileSync(new URL(loc + '.json', dir), 'utf8'));
    for (const c of ['signin', 'storage_off', 'limit_methods', 'consent_required', 'server_error', undefined]) assert.ok(d[errorKey(c)], `${loc} ${c}`);
  }
});

test('the limits match the server', () => {
  const go = readFileSync(new URL('../../../internal/app/account.go', import.meta.url), 'utf8');
  assert.equal(Number(/MaxMethods = (\d+)/.exec(go)[1]), MAX_METHODS);
  assert.equal(Number(/KeepBills\s+= (\d+)/.exec(go)[1]), KEEP_BILLS);
});
