// EMVCo helpers and the two formats built on them (PromptPay, VietQR). No official test vector was available, so none is
// stored: these tests check the tag structure the secondary sources describe, lengths, the CRC, input validation and that a
// QR made from the payload reads back to the same text. See docs/WALLET-MATRIX.md.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as H from './index.js';
import jsQR from 'jsqr';
import qrcode from 'qrcode-generator';

const pp = (o) => H.build('promptpay', { name: 'Somchai Jaidee', phone: '081 234 5678', ...o });
const vn = (o) => H.build('vietqr', { name: 'Nguyen Van A', bin: '970436', account: '0123456789', ...o });
// numeric-looking keys are sorted by JS, so the field ORDER is read from the TLV list
const tags = (p) => H.parseTlv(p).map((f) => f.tag);
const throwsCode = (fn, code, field) => assert.throws(fn, (e) => e.code === code && (!field || e.field === field), code);

test('tlv writes tag, two-digit length, value; emvFinish adds a CRC that checkCrc accepts', () => {
  assert.equal(H.tlv('00', '01'), '000201');
  assert.equal(H.tlv('59', 'ABC'), '5903ABC');
  const s = H.emvFinish([H.tlv('00', '01'), H.tlv('58', 'TH')]);
  assert.match(s, /^0002015802TH6304[0-9A-F]{4}$/);
  assert.ok(H.checkCrc(s));
  assert.ok(!H.checkCrc(s.slice(0, -1) + (s.endsWith('0') ? '1' : '0')), 'a changed CRC digit must fail');
  assert.ok(!H.checkCrc(s.replace('TH', 'VN')), 'a changed field must fail');
  assert.ok(!H.checkCrc('0002016304'), 'no CRC digits');
  assert.throws(() => H.tlv('00', 'x'.repeat(100)));
});

test('parseTlv splits a string and refuses a bad length or trailing bytes', () => {
  assert.deepEqual(H.parseTlv('0002015802TH'), [{ tag: '00', value: '01' }, { tag: '58', value: 'TH' }]);
  assert.throws(() => H.parseTlv('5905AB'), /shorter/);
  assert.throws(() => H.parseTlv('59'), /bad header/);
  assert.throws(() => H.parseTlv('00020'), /shorter|bad header/);
});

test('PromptPay: static code for a mobile number, structure and lengths', () => {
  const r = pp();
  const e = H.parseEmv(r.payload);
  assert.deepEqual(tags(r.payload), ['00', '01', '29', '53', '58', '63']);
  assert.equal(e['00'], '01');
  assert.equal(e['01'], '11', 'no amount means a static code');
  assert.deepEqual(e['29'], { '00': 'A000000677010111', '01': '0066812345678' });
  assert.equal(e['29']['01'].length, 13);
  assert.equal(e['53'], '764');
  assert.equal(e['58'], 'TH');
  assert.equal(e['63'].length, 4);
  assert.equal(r.display.receiverName, 'Somchai Jaidee');
  assert.equal(r.display.currency, 'THB');
  assert.equal(r.display.tested, false);
  assert.ok(r.warnings.includes('name_not_in_code'));
});

test('PromptPay: an amount makes it a dynamic code with tag 54 in two decimals, in tag order', () => {
  const r = pp({ amount: '250' });
  const e = H.parseEmv(r.payload);
  assert.equal(e['01'], '12');
  assert.equal(e['54'], '250.00');
  assert.deepEqual(tags(r.payload), ['00', '01', '29', '53', '54', '58', '63']);
  assert.equal(H.parseEmv(pp({ amount: '12,5' }).payload)['54'], '12.50');
  assert.equal(r.display.amount, '250.00');
});

test('PromptPay: phone numbers are normalised, other shapes refused', () => {
  const want = '0066812345678';
  for (const phone of ['0812345678', '081-234-5678', '+66 81 234 5678', '0066812345678', '66812345678', '(081) 234 5678'])
    assert.equal(H.parseEmv(pp({ phone }).payload)['29']['01'], want, phone);
  for (const phone of ['', '12345', '0212345678', '081234567', '08123456789', 'abcdefghij', '+1 212 555 0100'])
    throwsCode(() => pp({ phone }), 'bad_handle', 'phone');
});

test('PromptPay: name required, amount rules shared with the other formats', () => {
  throwsCode(() => pp({ name: '' }), 'receiver_name_required');
  throwsCode(() => pp({ name: '​‮' }), 'receiver_name_required');
  throwsCode(() => pp({ amount: '0' }), 'amount_not_positive');
  throwsCode(() => pp({ amount: '1,000.50' }), 'amount_separator');
  throwsCode(() => pp({ amount: '-5' }), 'amount_format');
  throwsCode(() => pp({ amount: '1.005' }), 'amount_separator');
  assert.ok(pp({ amount: '1.2345' }).warnings.includes('amount_rounded'));
});

test('VietQR: structure of a transfer to a bank account', () => {
  const r = vn();
  const e = H.parseEmv(r.payload);
  assert.deepEqual(tags(r.payload), ['00', '01', '38', '53', '58', '59', '63']);
  assert.equal(e['01'], '11');
  assert.equal(e['38']['00'], 'A000000727');
  assert.equal(e['38']['02'], 'QRIBFTTA');
  assert.deepEqual(H.parseTlv(e['38']['01']), [{ tag: '00', value: '970436' }, { tag: '01', value: '0123456789' }]);
  assert.equal(e['53'], '704');
  assert.equal(e['58'], 'VN');
  assert.equal(e['59'], 'Nguyen Van A');
  assert.equal(r.display.currency, 'VND');
  assert.equal(r.display.tested, false);
});

test('VietQR: whole dong only, amount makes it dynamic', () => {
  const e = H.parseEmv(vn({ amount: '50000' }).payload);
  assert.equal(e['01'], '12');
  assert.equal(e['54'], '50000');
  assert.deepEqual(tags(vn({ amount: '50000' }).payload), ['00', '01', '38', '53', '54', '58', '59', '63']);
  throwsCode(() => vn({ amount: '50.5' }), 'amount_no_decimals');
  throwsCode(() => vn({ amount: '50.000' }), 'amount_separator'); // the Vietnamese thousands dot is never read as 50
  throwsCode(() => vn({ amount: '50,000' }), 'amount_separator');
});

test('VietQR: the name in the code is plain ASCII, the displayed name stays as typed', () => {
  const r = vn({ name: 'Nguyễn Văn Đức' });
  assert.equal(H.parseEmv(r.payload)['59'], 'Nguyen Van Duc');
  assert.equal(r.display.receiverName, 'Nguyễn Văn Đức');
  assert.ok(r.warnings.includes('name_ascii'));
  assert.ok(!vn().warnings.includes('name_ascii'));
  throwsCode(() => vn({ name: '张伟' }), 'bad_name', 'name');
  throwsCode(() => vn({ name: 'A'.repeat(26) }), 'too_long', 'name');
  throwsCode(() => vn({ name: '' }), 'receiver_name_required');
});

test('VietQR: BIN and account number validation', () => {
  for (const bin of ['', '97043', '9704366', 'abcdef', '97 0436']) throwsCode(() => vn({ bin }), 'bad_bin', 'bin');
  for (const account of ['', 'abc', '1'.repeat(20), '12 34x']) throwsCode(() => vn({ account }), 'bad_account', 'account');
  assert.equal(H.parseTlv(H.parseEmv(vn({ account: '0123-4567 89' }).payload)['38']['01'] || '')[1].value, '0123456789');
});

test('every field length in both formats matches its value, and the CRC covers the whole code', () => {
  for (const r of [pp(), pp({ amount: '9999999.99' }), vn(), vn({ amount: '1' })]) {
    const body = r.payload.slice(0, -4);
    assert.ok(body.endsWith('6304'));
    const fields = H.parseTlv(r.payload); // throws on any wrong length
    assert.equal(fields.at(-1).tag, '63');
    assert.equal(H.parseTlv(r.payload).map((f) => '' + f.tag + String(f.value.length).padStart(2, '0') + f.value).join(''), r.payload);
    assert.ok(H.checkCrc(r.payload));
    assert.ok(r.payload.length <= 200);
  }
});

test('both formats are listed with a confidence below "high" and the right country', () => {
  assert.equal(H.formats.promptpay.country, 'TH');
  assert.equal(H.formats.vietqr.country, 'VN');
  for (const k of ['promptpay', 'vietqr']) assert.notEqual(H.formats[k].confidence, 'high');
});

test('a QR made from each payload reads back to the same text (round trip through a decoder)', () => {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  for (const text of [pp().payload, pp({ amount: '250' }).payload, vn().payload, vn({ amount: '50000' }).payload]) {
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    const n = qr.getModuleCount(), cell = 6, quiet = 4, size = (n + quiet * 2) * cell;
    const px = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c))
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) {
        const o = (((r + quiet) * cell + y) * size + (c + quiet) * cell + x) * 4; px[o] = px[o + 1] = px[o + 2] = 0;
      }
    const got = jsQR(px, size, size);
    assert.ok(got, 'not decodable: ' + text);
    assert.equal(got.data, text);
    assert.ok(H.checkCrc(got.data));
  }
});
