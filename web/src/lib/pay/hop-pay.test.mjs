// Run: npm test (node --test). Pure library tests: no DOM, no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as H from './index.js';
import jsQR from 'jsqr';
import qrcode from 'qrcode-generator';

const U = (...cp) => String.fromCodePoint(...cp);
const throwsCode = (fn, code) => assert.throws(fn, (e) => e instanceof H.HopPayError && e.code === code, 'expected ' + code);

// ---- T1: the one CRC value every CRC-16/CCITT-FALSE implementation must give
test('T1 crc16("123456789") is 0x29B1', () => {
  assert.equal(H.crc16('123456789'), 0x29b1);
  assert.equal(H.crc16(''), 0xffff); // init value, no data
});

// ---- amounts
test('amounts: minor units, rounding with a warning, rejects', () => {
  const w = [];
  assert.equal(H.parseAmount('12.5', 'USD', w), 1250n);
  assert.equal(H.parseAmount('12,5', 'EUR', w), 1250n);
  assert.equal(H.parseAmount('1000', 'IDR', w), 1000n);
  assert.equal(H.parseAmount('1000', 'JPY', w), 1000n);
  assert.equal(H.parseAmount('1.234', 'KWD', w), 1234n);
  assert.deepEqual(w, []);
  assert.equal(H.parseAmount('1.0051', 'USD', w), 101n); // half up
  assert.deepEqual(w, ['amount_rounded']);
  assert.equal(H.parseAmount('', 'USD', []), null);
  throwsCode(() => H.parseAmount('0', 'USD', []), 'amount_not_positive');
  throwsCode(() => H.parseAmount("0.0004", "USD", []), "amount_not_positive"); // rounds to zero
  throwsCode(() => H.parseAmount('-5', 'USD', []), 'amount_format');
  throwsCode(() => H.parseAmount('1e3', 'USD', []), 'amount_format');
  throwsCode(() => H.parseAmount('1,000.50', 'USD', []), 'amount_separator');
  assert.equal(H.parseAmount('12345678901.00', 'USD', []), 1234567890100n); // 13 digits of minor units is the cap
  throwsCode(() => H.parseAmount('123456789012.00', 'USD', []), 'amount_too_large');
  assert.equal(H.formatMinor(5n, 'USD'), '0.05');
  assert.equal(H.formatMinor(123456, 'JPY'), '123456');
});

// ---- IBAN (T11). The two valid ones are the public documentation examples of their national banks.
test('T11 IBAN checksum and length', () => {
  assert.equal(H.ibanValid('DE89 3704 0044 0532 0130 00'), true);
  assert.equal(H.ibanValid('GB82WEST12345698765432'), true);
  assert.equal(H.ibanValid('DE89 3704 0044 0532 0130 01'), false); // last digit changed
  assert.equal(H.ibanValid('DE89 3704 0044 0532 0130 0'), false); // too short
  assert.equal(H.ibanValid('XX00'), false);
  throwsCode(() => H.build('epc', { name: 'A', iban: 'DE89370400440532013001' }), 'bad_iban');
});

// ---- Format groups 1 and 2
test('PayPal.me', () => {
  assert.equal(H.build('paypal', { user: 'jdoe' }).payload, 'https://paypal.me/jdoe');
  const r = H.build('paypal', { user: 'https://paypal.me/jdoe', amount: '12.5', currency: 'usd' });
  assert.equal(r.payload, 'https://paypal.me/jdoe/12.50USD');
  assert.equal(r.display.currency, 'USD');
  throwsCode(() => H.build('paypal', { user: 'j doe' }), 'bad_handle');
  throwsCode(() => H.build('paypal', { user: 'jdoe', amount: '5' }), 'currency_required');
  assert.equal(H.build('paypal', { user: 'jdoe', amount: '500', currency: 'JPY' }).payload, 'https://paypal.me/jdoe/500JPY');
});

test('Cash App', () => {
  assert.equal(H.build('cashapp', { cashtag: '$jdoe', amount: '5' }).payload, 'https://cash.app/$jdoe/5.00');
  throwsCode(() => H.build('cashapp', { cashtag: '12345' }), 'bad_handle'); // needs a letter
  throwsCode(() => H.build('cashapp', { cashtag: 'a/b' }), 'bad_handle');
});

test('Venmo', () => {
  const r = H.build('venmo', { user: '@jane-doe', amount: '3.5', note: 'Lunch & drinks' });
  assert.equal(r.payload, 'https://venmo.com/jane-doe?txn=pay&amount=3.50&note=Lunch%20%26%20drinks');
  assert.equal(H.build('venmo', { user: 'jane-doe', amount: '1', scheme: 'app' }).payload, 'venmo://paycharge?txn=pay&recipients=jane-doe&amount=1.00');
  throwsCode(() => H.build('venmo', { user: 'ab' }), 'bad_handle');
});

test('Solana Pay', () => {
  const sys = '11111111111111111111111111111111'; // the System Program address: 32 zero bytes
  const usdc = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  assert.equal(H.base58Length(sys), 32);
  assert.equal(H.base58Length(usdc), 32);
  const r = H.build('solana', { recipient: sys, amount: '1.5', splToken: usdc, label: 'Cafe Ana', message: 'Order #12' });
  assert.equal(r.payload, 'solana:' + sys + '?amount=1.5&spl-token=' + usdc + '&label=Cafe%20Ana&message=Order%20%2312');
  assert.equal(r.display.currency, 'SPL');
  assert.ok(r.warnings.includes('spl_decimals_unchecked'));
  assert.equal(r.display.token, 'EPjF…Dt1v');
  assert.deepEqual(H.build('solana', { recipient: sys }).warnings, ['no_label']);
  throwsCode(() => H.build('solana', { recipient: sys + 'x' }), 'bad_address');
  throwsCode(() => H.build('solana', { recipient: '0OIl' + sys }), 'bad_address'); // 0, O, I, l are not base58
  throwsCode(() => H.build('solana', { recipient: sys, amount: '1e3' }), 'amount_format');
  throwsCode(() => H.build('solana', { recipient: sys, amount: '0' }), 'amount_format');
});

test('UPI', () => {
  const r = H.build('upi', { vpa: 'shop@okbank', name: 'Warung Sri', amount: '250', note: 'Order 7' });
  assert.equal(r.payload, 'upi://pay?pa=shop@okbank&pn=Warung%20Sri&am=250.00&cu=INR&tn=Order%207');
  assert.equal(r.display.receiverName, 'Warung Sri');
  throwsCode(() => H.build('upi', { vpa: 'shop@okbank', name: '' }), 'receiver_name_required'); // T9
  throwsCode(() => H.build('upi', { vpa: 'shop', name: 'A' }), 'bad_handle');
});

test('EPC SEPA', () => {
  const r = H.build('epc', { name: 'Red Cross Fund', iban: 'DE89 3704 0044 0532 0130 00', amount: '12.34', reference: 'Donation' });
  assert.equal(r.payload, ['BCD', '002', '1', 'SCT', '', 'Red Cross Fund', 'DE89370400440532013000', 'EUR12.34', '', '', 'Donation'].join('\n'));
  assert.equal(r.display.country, 'DE');
  assert.equal(r.display.receiverId, 'DE89…3000');
  // no amount, no reference: the 7 mandatory lines only (trailing empty lines dropped)
  assert.equal(H.build('epc', { name: 'A', iban: 'GB82WEST12345698765432' }).payload.split('\n').length, 7);
  throwsCode(() => H.build('epc', { name: ' ', iban: 'DE89370400440532013000' }), 'receiver_name_required');
  throwsCode(() => H.build('epc', { name: 'A'.repeat(71), iban: 'DE89370400440532013000' }), 'too_long');
  throwsCode(() => H.build('epc', { name: 'A', iban: 'DE89370400440532013000', bic: 'XX' }), 'bad_bic');
  // T8: the 331-byte limit counts UTF-8 bytes, not characters
  const accents = 'Café Ångström Řemeslník';
  assert.ok(H.build('epc', { name: accents, iban: 'DE89370400440532013000' }).warnings.includes('non_sepa_characters'));
  throwsCode(() => H.build('epc', { name: 'A', iban: 'DE89370400440532013000', reference: U(0x2603).repeat(110), info: U(0x2603).repeat(70) }), 'too_long');
});

// ---- Hostile names: controls, RTL override, zero width
test('hidden and bidi characters are stripped and reported', () => {
  const evil = 'Safe' + U(0x202e) + 'ynoM' + U(0x200b) + ' Shop\n';
  const r = H.build('upi', { vpa: 'a1@bank', name: evil });
  assert.equal(r.display.receiverName, 'Safe ynoM Shop');
  assert.ok(r.warnings.some((w) => w.startsWith('hidden_characters_removed')));
  assert.ok(!r.payload.includes('%E2%80%AE'));
  assert.equal(H.mixedScripts('Paypal'), false);
  assert.equal(H.mixedScripts('P' + U(0x0430) + 'ypal'), true); // Cyrillic a inside a Latin word
});

test('T12 every format returns a complete display and tested=false', () => {
  const sys = '11111111111111111111111111111111';
  const cases = {
    paypal: { user: 'jdoe', amount: '5', currency: 'USD' },
    cashapp: { cashtag: 'jdoe', amount: '5' },
    venmo: { user: 'jane-doe', amount: '5' },
    solana: { recipient: sys, amount: '1', label: 'Ana' },
    upi: { vpa: 'ana@okbank', name: 'Ana', amount: '5' },
    epc: { name: 'Ana', iban: 'DE89370400440532013000', amount: '5' },
  };
  assert.deepEqual(Object.keys(cases).sort(), Object.keys(H.formats).sort());
  for (const [f, p] of Object.entries(cases)) {
    const r = H.build(f, p);
    assert.ok(r.payload.length > 0 && r.display.receiverName && r.display.scheme && r.display.currency, f);
    assert.equal(r.display.tested, false, f);
  }
  throwsCode(() => H.build('qris', {}), 'unknown_format');
});

// ---- Split bill
const people = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i }));
const sum = (a) => a.reduce((x, y) => x + y, 0);

test('allocate: largest remainder, exact sum, stable ties', () => {
  assert.deepEqual(H.allocate(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(H.allocate(10, [0, 0, 0]), [4, 3, 3]); // no weights: equal split
  assert.deepEqual(H.allocate(11000, [50000, 40000, 10000]), [5500, 4400, 1100]);
  assert.deepEqual(H.allocate(7, [1, 2]), [2, 5]);
  assert.deepEqual(H.allocate(0, [3, 4]), [0, 0]);
});

test('split: hand-calculated dinner with 11% tax, whole rupiah', () => {
  // A: 40000 own + 10000 of drinks; B: 30000 own + 10000; C: 10000 of drinks. Drinks 30000 shared by all three.
  const r = H.splitBill({
    currency: 'IDR', people: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    items: [{ name: 'Nasi', price: 40000, shares: ['a'] }, { name: 'Mie', price: 30000, shares: ['b'] }, { name: 'Drinks', price: 30000 }],
    charges: [{ label: 'PPN 11%', percent: 1100 }],
  });
  assert.equal(r.subtotal, 100000);
  assert.deepEqual(r.charges, [{ label: 'PPN 11%', amount: 11000 }]);
  assert.deepEqual(r.people.map((p) => p.due), [55500, 44400, 11100]);
  assert.equal(r.total, 111000);
});

test('split: rounding up for everyone but the payer, payer absorbs the difference', () => {
  const r = H.splitBill({
    currency: 'IDR', people: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
    items: [{ name: 'Nasi', price: 40000, shares: ['a'] }, { name: 'Mie', price: 30000, shares: ['b'] }, { name: 'Drinks', price: 30000 }],
    charges: [{ label: 'PPN', percent: 1100 }], payerId: 'c', roundTo: 1000,
  });
  assert.deepEqual(r.people.map((p) => p.due), [56000, 45000, 10000]);
  assert.deepEqual(r.people.map((p) => p.roundingDelta), [500, 600, -1100]);
  assert.equal(sum(r.people.map((p) => p.due)), r.total);
});

test('split: odd units rotate between items, discounts and fixed charges', () => {
  const r = H.splitBill({ currency: 'USD', people: people(3), items: [{ name: 'a', price: 100 }, { name: 'b', price: 100 }, { name: 'c', price: 100 }] });
  assert.deepEqual(r.people.map((p) => p.subtotal), [100, 100, 100]); // 34/33/33, then 33/34/33, then 33/33/34
  const d = H.splitBill({ currency: 'USD', people: people(2), items: [{ name: 'x', price: 1001 }], charges: [{ label: 'tip', fixed: 300 }, { label: 'promo', percent: 1000, kind: 'discount' }] });
  assert.equal(d.total, 1001 + 300 - 100); // 10% of 1001 = 100.1 -> 100
  assert.equal(sum(d.people.map((p) => p.due)), d.total);
  throwsCode(() => H.splitBill({ people: people(2), items: [{ name: 'x', price: 100 }], charges: [{ percent: 20000, kind: 'discount' }] }), 'discount_too_large');
});

test('split: bad input is refused', () => {
  throwsCode(() => H.splitBill({ people: [], items: [] }), 'no_people');
  throwsCode(() => H.splitBill({ people: [{ id: 'a' }, { id: 'a' }], items: [] }), 'duplicate_person');
  throwsCode(() => H.splitBill({ people: people(2), items: [{ name: 'x', price: 10, shares: ['zz'] }] }), 'unknown_person');
  throwsCode(() => H.splitBill({ people: people(2), items: [{ name: 'x', price: 1.5 }] }), 'bad_price');
  const noPayer = H.splitBill({ people: people(2), items: [{ name: 'x', price: 1001 }], roundTo: 100 });
  assert.deepEqual(noPayer.warnings, ['rounding_needs_payer']);
  assert.equal(sum(noPayer.people.map((p) => p.due)), noPayer.total);
});

test('split: property test, the amounts always add up to the total (seeded, 3000 cases)', () => {
  let seed = 12345;
  const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let k = 0; k < 3000; k++) {
    const n = 1 + rnd(8), ppl = people(n);
    const items = Array.from({ length: 1 + rnd(7) }, (_, i) => {
      const shares = rnd(3) === 0 ? undefined : ppl.filter(() => rnd(2)).map((p) => p.id);
      return { name: 'i' + i, price: rnd(5) === 0 ? 0 : 1 + rnd(2000000), shares };
    });
    const charges = [];
    if (rnd(2)) charges.push({ label: 'tax', percent: rnd(3000) });
    if (rnd(2)) charges.push({ label: 'service', fixed: rnd(50000) });
    if (rnd(4) === 0) charges.push({ label: 'promo', percent: rnd(5000), kind: 'discount' });
    const payerId = rnd(2) ? ppl[rnd(n)].id : undefined;
    const r = H.splitBill({ currency: 'IDR', people: ppl, items, charges, payerId, roundTo: [0, 100, 500, 1000][rnd(4)] });
    assert.equal(sum(r.people.map((p) => p.due)), r.total, 'case ' + k);
    assert.equal(sum(r.people.map((p) => p.exact)), r.total, 'case ' + k);
    assert.ok(r.people.every((p) => p.due >= 0), 'case ' + k + ' negative share');
    const itemTotal = items.reduce((a, i) => a + i.price, 0);
    assert.equal(r.subtotal, itemTotal, 'case ' + k);
  }
});

// ---- Round trip: payload -> QR -> bitmap -> decoder gives the same text (a lite I1; no camera, no wallet)
test('QR round trip with a decoder', () => {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  const sys = '11111111111111111111111111111111';
  const payloads = [
    H.build('paypal', { user: 'jdoe', amount: '12.5', currency: 'USD' }).payload,
    H.build('upi', { vpa: 'ana@okbank', name: 'Caf' + U(0xe9) + ' Ana', amount: '99' }).payload,
    H.build('solana', { recipient: sys, amount: '1', label: 'Ana' }).payload,
    H.build('epc', { name: 'Red Cross Fund', iban: 'DE89370400440532013000', amount: '12.34', reference: 'Donation' }).payload,
  ];
  for (const text of payloads) {
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    const n = qr.getModuleCount(), cell = 6, quiet = 4, size = (n + quiet * 2) * cell;
    const px = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) {
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
        const o = (((r + quiet) * cell + y) * size + (c + quiet) * cell + x) * 4; px[o] = px[o + 1] = px[o + 2] = 0;
      }
    }
    const got = jsQR(px, size, size);
    assert.ok(got, 'not decodable: ' + text);
    assert.equal(got.data, text);
  }
});

// ---- Added for the repository (not in the preview)
test('crc16 residue: appending the CRC big-endian gives 0 (a property, not a stored vector)', () => {
  for (const text of ['123456789', 'PayHop', '', 'Caf' + U(0xe9) + ' Ana 00020101']) {
    const c = H.crc16(text);
    const bytes = [...new TextEncoder().encode(text), c >> 8, c & 0xff];
    assert.equal(H.crc16(new Uint8Array(bytes)), 0, text);
  }
});

test('names are NFC-normalised before anything else', () => {
  const decomposed = 'Cafe' + U(0x301); // e + combining acute
  const r = H.build('upi', { vpa: 'a1@bank', name: decomposed });
  assert.equal(r.display.receiverName, 'Caf' + U(0xe9));
});

test('hidden characters in a note or label are removed and reported too', () => {
  const r = H.build('venmo', { user: 'jane-doe', note: 'Hi' + U(0x202e) + 'there' });
  assert.ok(r.warnings.includes('hidden_characters_removed:note'));
  assert.ok(!r.payload.includes('%E2%80%AE'));
  const s = H.build('solana', { recipient: '11111111111111111111111111111111', label: 'A' + U(0x200b) + 'B' });
  assert.equal(s.display.receiverName, 'A B');
});

test('handle limits', () => {
  assert.ok(H.build('paypal', { user: 'a'.repeat(20) }));
  throwsCode(() => H.build('paypal', { user: 'a'.repeat(21) }), 'bad_handle');
  throwsCode(() => H.build('paypal', { user: '' }), 'bad_handle');
  assert.ok(H.build('cashapp', { cashtag: 'a_1' }));
  throwsCode(() => H.build('cashapp', { cashtag: 'a'.repeat(21) }), 'bad_handle');
});

test('exponents: zero, two and three digit currencies', () => {
  assert.equal(H.exponent('JPY'), 0);
  assert.equal(H.exponent('IDR'), 0); // practice, not ISO 4217
  assert.equal(H.exponent('USD'), 2);
  assert.equal(H.exponent('KWD'), 3);
  assert.equal(H.formatMinor(1234, 'KWD'), '1.234');
});

test('amount strings that look like numbers but are not are refused', () => {
  for (const bad of ['.5', '5.', '1 000', '1_000', '+5', '0x10', 'NaN', '١٢']) throwsCode(() => H.parseAmount(bad, 'USD', []), 'amount_format');
});

test('a payload never carries a hidden character from the receiver name', () => {
  const r = H.build('epc', { name: 'Ana' + U(0x2066) + 'Bo' + U(0x2069), iban: 'DE89370400440532013000' });
  assert.equal(r.display.receiverName, 'Ana Bo');
  assert.ok(!/[⁦-⁩]/.test(r.payload));
});

test('every format reports a confidence and is never marked tested', () => {
  for (const [name, f] of Object.entries(H.formats)) {
    assert.ok(['high', 'medium', 'medium-low'].includes(f.confidence), name);
  }
});

test('split: one person and a payer who is alone', () => {
  const r = H.splitBill({ people: [{ id: 'a', name: 'A' }], items: [{ name: 'x', price: 999 }], charges: [{ percent: 1000 }], payerId: 'a', roundTo: 100 });
  assert.equal(r.total, 1099);
  assert.equal(r.people[0].due, 1099);
});

// ---- Audit round: one strict amount parser
test('audit: "50.000" and "50,000" are never read as 50 (the 1000x error)', () => {
  for (const bad of ['50.000', '50,000', '1.000.000', '1,000,000', '12.500']) throwsCode(() => H.parseAmount(bad, 'IDR', []), 'amount_separator');
  assert.equal(H.parseAmount('50000', 'IDR', []), 50000n);
  for (const bad of ['50.5', '50,5', '50.50']) throwsCode(() => H.parseAmount(bad, 'JPY', []), 'amount_no_decimals');
  // the same through the builders, so Generate cannot write a 1000x smaller QR either
  throwsCode(() => H.build('paypal', { user: 'jdoe', amount: '50.000', currency: 'JPY' }), 'amount_separator');
});

test('audit: thousands look-alikes are refused for two-decimal currencies, real decimals are not', () => {
  for (const bad of ['1.000', '1,000', '999.000', '1,000.50']) throwsCode(() => H.parseAmount(bad, 'USD', []), 'amount_separator');
  const w = [];
  assert.equal(H.parseAmount('1,5', 'EUR', w), 150n);
  assert.equal(H.parseAmount('12.50', 'USD', w), 1250n);
  assert.equal(H.parseAmount('1.234', 'KWD', w), 1234n); // three decimals ARE the currency's decimals
  assert.equal(H.parseAmount('0.0051', 'USD', w), 1n);
  assert.deepEqual(w, ['amount_rounded']);
  throwsCode(() => H.parseAmount('.5', 'USD', []), 'amount_format');
  throwsCode(() => H.parseAmount('5.', 'USD', []), 'amount_format');
});

// ---- Audit round: names
test('audit: Hangul fillers, tag characters, variation selectors and CGJ are removed and reported', () => {
  for (const ch of [0x115f, 0x1160, 0x3164, 0xffa0, 0xe0041, 0xe007f, 0xfe0f, 0xe0100, 0x34f]) {
    const r = H.build('upi', { vpa: 'a1@bank', name: 'Ana' + U(ch) + 'Bo' });
    assert.equal(r.display.receiverName, 'Ana Bo', 'U+' + ch.toString(16));
    assert.ok(r.warnings.some((x) => x.startsWith('hidden_characters_removed')), 'U+' + ch.toString(16));
  }
});

test('audit: ZWJ and ZWNJ stay between letters (Persian, Devanagari) and go elsewhere', () => {
  const persian = 'می' + U(0x200c) + 'خواهم'; // ZWNJ inside a word
  const r = H.build('upi', { vpa: 'a1@bank', name: persian });
  assert.equal(r.display.receiverName, persian);
  assert.deepEqual(r.warnings, []);
  const dev = 'क' + U(0x94d) + U(0x200d) + 'ष'; // virama + ZWJ + letter
  assert.equal(H.build('upi', { vpa: 'a1@bank', name: dev }).display.receiverName, dev);
  for (const bad of [U(0x200d) + 'Ana', 'Ana' + U(0x200c), 'A' + U(0x200d) + U(0x200c) + 'B', 'A ' + U(0x200d) + ' B']) {
    const o = H.build('upi', { vpa: 'a1@bank', name: bad });
    assert.ok(!/[‌‍]/.test(o.display.receiverName), JSON.stringify(bad));
    assert.ok(o.warnings.length > 0, JSON.stringify(bad));
  }
});

// ---- Audit round: formats
test('audit: PayPal.me refuses a currency PayPal does not list; IBAN of Andorra and Gibraltar pass', () => {
  throwsCode(() => H.build('paypal', { user: 'jdoe', amount: '5', currency: 'IDR' }), 'currency_unsupported');
  assert.ok(H.build('paypal', { user: 'jdoe', amount: '5', currency: 'EUR' }));
  assert.ok(!H.formats.paypal.currencies.includes('IDR'));
  assert.equal(H.ibanValid('AD1200012030200359100100'), true);
  assert.equal(H.ibanValid('GI75NWBK000000007099453'), true);
});
