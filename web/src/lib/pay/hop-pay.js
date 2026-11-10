/*
 * hop-pay: payment QR payloads, pure functions, no DOM.
 *
 *   HopPay.build(format, params) -> { payload, display, warnings, confidence }
 *   HopPay.splitBill(spec)       -> per-person amounts in minor units, exact sum
 *   HopPay.crc16(text)           -> CRC-16/CCITT-FALSE (anchor: crc16("123456789") === 0x29B1)
 *
 * Formats here: paypal, cashapp, venmo, solana, upi, epc. No EMVCo (QRIS, Pix, ...) until real fixtures exist.
 * Every format is untested in a real wallet: `display.tested` is always false.
 */

class HopPayError extends Error {
  constructor(code, message, field) {
    super(message || code);
    this.name = 'HopPayError';
    this.code = code;
    this.field = field || null;
  }
}
const fail = (code, field, message) => { throw new HopPayError(code, message || code, field); };

// ---------------------------------------------------------------- CRC-16/CCITT-FALSE
function crc16(input) {
  const bytes = typeof input === 'string' ? utf8(input) : input;
  let crc = 0xffff;
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc;
}
function utf8(s) { return Array.from(new TextEncoder().encode(s)); }
const byteLength = (s) => new TextEncoder().encode(s).length;

// ---------------------------------------------------------------- text hygiene
// Control characters, bidi overrides/isolates, zero-width and format characters never belong in a payee name.
const HIDDEN = new RegExp('[' + [[0,31],[127,159],[173,173],[1564,1564],[6158,6158],[8203,8207],[8234,8238],[8288,8303],[65279,65279],[65529,65531]].map(function (r) { return String.fromCharCode(r[0]) + '-' + String.fromCharCode(r[1]); }).join('') + ']', 'g'); // C0/C1 controls, soft hyphen, bidi marks and overrides, zero-width and format characters

const HIDDEN_TEST = new RegExp(HIDDEN.source);
function cleanText(value, field, warnings, max) {
  let s = String(value == null ? '' : value).normalize('NFC');
  if (HIDDEN_TEST.test(s)) warnings.push('hidden_characters_removed:' + field);
  s = s.replace(HIDDEN, ' ').replace(/\s+/g, ' ').trim();
  if (max && [...s].length > max) fail('too_long', field, field + ' is longer than ' + max + ' characters');
  return s;
}
function mixedScripts(s) {
  let n = 0;
  if (/\p{Script=Latin}/u.test(s)) n++;
  if (/\p{Script=Cyrillic}/u.test(s)) n++;
  if (/\p{Script=Greek}/u.test(s)) n++;
  return n > 1;
}
function needName(name, field) { if (!name) fail('receiver_name_required', field || 'name'); return name; }

// ---------------------------------------------------------------- amounts (integer minor units)
// Exponent by ISO 4217 (0 and 3 digits listed; everything else 2). IDR: ISO says 2, payments use whole rupiah.
const EXP0 = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'UGX', 'XAF', 'XOF', 'XPF', 'PYG', 'RWF', 'KMF', 'DJF', 'GNF', 'VUV', 'IDR']);
const EXP3 = new Set(['BHD', 'KWD', 'OMR', 'JOD', 'TND', 'IQD', 'LYD']);
const exponent = (cur) => EXP0.has(cur) ? 0 : EXP3.has(cur) ? 3 : 2;
const MAX_DIGITS = 13;

function parseCurrency(cur, field) {
  const c = String(cur || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) fail('bad_currency', field || 'currency');
  return c;
}

/** "12.5", "12,5", 12.5 -> BigInt minor units. Rejects zero, negative, exponent notation, thousands separators. */
function parseAmount(raw, cur, warnings) {
  if (raw === '' || raw == null) return null;
  let s = String(raw).trim();
  if (/[eE]/.test(s)) fail('amount_format', 'amount');
  if (/^\d+,\d{1,}$/.test(s) && !s.includes('.')) s = s.replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) fail('amount_format', 'amount');
  const exp = exponent(cur);
  let [int, frac = ''] = s.split('.');
  let minor;
  if (frac.length > exp) {
    // Round half up to the smallest unit and say so.
    const keep = frac.slice(0, exp), rest = frac.slice(exp);
    minor = BigInt(int + keep.padEnd(exp, '0'));
    if (rest.charCodeAt(0) >= 53) minor += 1n;
    warnings.push('amount_rounded');
  } else {
    minor = BigInt(int + frac.padEnd(exp, '0'));
  }
  if (minor <= 0n) fail('amount_not_positive', 'amount');
  if (minor.toString().length > MAX_DIGITS) fail('amount_too_large', 'amount');
  return minor;
}
function formatMinor(minor, cur) {
  const exp = exponent(cur), s = BigInt(minor).toString().padStart(exp + 1, '0');
  return exp ? s.slice(0, -exp) + '.' + s.slice(-exp) : s;
}
const mask = (id) => id.length <= 8 ? id : id.slice(0, 4) + '…' + id.slice(-4);
const enc = encodeURIComponent;

function display(scheme, o) {
  return Object.assign({ scheme, receiverName: '', receiverNameKind: 'handle', receiverId: '', amount: null, currency: '', country: '', tested: false }, o);
}

// ---------------------------------------------------------------- format builders
const FORMATS = {};

FORMATS.paypal = {
  group: 1, confidence: 'high', country: '', currencies: null,
  build(p, w) {
    const user = String(p.user || '').trim().replace(/^.*paypal\.me\//i, '').replace(/^@/, '');
    if (!/^[A-Za-z0-9]{1,20}$/.test(user)) fail('bad_handle', 'user', 'PayPal.me names are 1-20 letters or digits');
    const cur = p.currency ? parseCurrency(p.currency) : '';
    const minor = parseAmount(p.amount, cur || 'USD', w);
    if (minor && !cur) fail('currency_required', 'currency');
    const amount = minor ? formatMinor(minor, cur) : null;
    return {
      payload: 'https://paypal.me/' + user + (amount ? '/' + amount + cur : ''),
      display: display('PayPal.me', { receiverName: user, receiverId: 'paypal.me/' + user, amount, currency: cur }),
    };
  },
};

FORMATS.cashapp = {
  group: 1, confidence: 'medium', country: 'US', currencies: ['USD'],
  build(p, w) {
    const tag = String(p.cashtag || '').trim().replace(/^.*cash\.app\//i, '').replace(/^\$/, '');
    if (!/^[A-Za-z0-9_]{1,20}$/.test(tag) || !/[A-Za-z]/.test(tag)) fail('bad_handle', 'cashtag');
    const minor = parseAmount(p.amount, 'USD', w);
    const amount = minor ? formatMinor(minor, 'USD') : null;
    return {
      payload: 'https://cash.app/$' + tag + (amount ? '/' + amount : ''),
      display: display('Cash App', { receiverName: '$' + tag, receiverId: '$' + tag, amount, currency: 'USD', country: 'US' }),
    };
  },
};

FORMATS.venmo = {
  group: 1, confidence: 'medium-low', country: 'US', currencies: ['USD'],
  build(p, w) {
    const user = String(p.user || '').trim().replace(/^@/, '');
    if (!/^[A-Za-z0-9_-]{5,30}$/.test(user)) fail('bad_handle', 'user');
    const note = cleanText(p.note, 'note', w, 200);
    const minor = parseAmount(p.amount, 'USD', w);
    const amount = minor ? formatMinor(minor, 'USD') : null;
    const q = ['txn=pay'];
    if (amount) q.push('amount=' + amount);
    if (note) q.push('note=' + enc(note));
    const payload = p.scheme === 'app'
      ? 'venmo://paycharge?txn=pay&recipients=' + enc(user) + (amount ? '&amount=' + amount : '') + (note ? '&note=' + enc(note) : '')
      : 'https://venmo.com/' + enc(user) + '?' + q.join('&');
    return { payload, display: display('Venmo', { receiverName: '@' + user, receiverId: '@' + user, amount, currency: 'USD', country: 'US' }) };
  },
};

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Length(s) {
  if (!s || [...s].some((ch) => !B58.includes(ch))) return -1;
  let n = 0n;
  for (const ch of s) n = n * 58n + BigInt(B58.indexOf(ch));
  let len = 0;
  while (n > 0n) { len++; n >>= 8n; }
  let zeros = 0;
  for (const ch of s) { if (ch === '1') zeros++; else break; }
  return len + zeros;
}

FORMATS.solana = {
  group: 1, confidence: 'medium', country: '', currencies: ['SOL'],
  build(p, w) {
    const recipient = String(p.recipient || '').trim();
    if (base58Length(recipient) !== 32) fail('bad_address', 'recipient', 'a Solana address is 32 bytes in base58');
    const mint = String(p.splToken || '').trim();
    if (mint && base58Length(mint) !== 32) fail('bad_address', 'splToken');
    let amount = null;
    if (p.amount !== '' && p.amount != null) {
      amount = String(p.amount).trim();
      // Solana Pay: a plain non-negative decimal in whole units, never scientific notation.
      if (!/^\d+(\.\d{1,9})?$/.test(amount) || /^0+(\.0+)?$/.test(amount)) fail('amount_format', 'amount');
    }
    const label = cleanText(p.label, 'label', w, 80), message = cleanText(p.message, 'message', w, 140), memo = cleanText(p.memo, 'memo', w, 80);
    const q = [];
    if (amount) q.push('amount=' + amount);
    if (mint) q.push('spl-token=' + mint);
    if (label) q.push('label=' + enc(label));
    if (message) q.push('message=' + enc(message));
    if (memo) q.push('memo=' + enc(memo));
    if (!label) w.push('no_label');
    return {
      payload: 'solana:' + recipient + (q.length ? '?' + q.join('&') : ''),
      display: display('Solana Pay', { receiverName: label || mask(recipient), receiverNameKind: label ? 'label' : 'address', receiverId: mask(recipient), amount, currency: mint ? 'SPL' : 'SOL' }),
    };
  },
};

FORMATS.upi = {
  group: 1, confidence: 'medium', country: 'IN', currencies: ['INR'],
  build(p, w) {
    const vpa = String(p.vpa || '').trim();
    if (!/^[A-Za-z0-9._-]{2,256}@[A-Za-z]{2,64}$/.test(vpa)) fail('bad_handle', 'vpa', 'a UPI ID looks like name@bank');
    const name = needName(cleanText(p.name, 'name', w, 99), 'name');
    const note = cleanText(p.note, 'note', w, 80);
    const minor = parseAmount(p.amount, 'INR', w);
    const amount = minor ? formatMinor(minor, 'INR') : null;
    const q = ['pa=' + vpa.replace('@', '%40'), 'pn=' + enc(name)];
    if (amount) q.push('am=' + amount);
    q.push('cu=INR');
    if (note) q.push('tn=' + enc(note));
    if (mixedScripts(name)) w.push('mixed_scripts');
    return {
      payload: 'upi://pay?' + q.join('&'),
      display: display('UPI', { receiverName: name, receiverNameKind: 'legal', receiverId: vpa, amount, currency: 'INR', country: 'IN' }),
    };
  },
};

// IBAN length by country (SEPA area plus a few neighbours).
const IBAN_LEN = { AT: 20, BE: 16, BG: 22, CH: 21, CY: 28, CZ: 24, DE: 22, DK: 18, EE: 20, ES: 24, FI: 18, FR: 27, GB: 22, GR: 27, HR: 21, HU: 28, IE: 22, IS: 26, IT: 27, LI: 21, LT: 20, LU: 20, LV: 21, MC: 27, MT: 31, NL: 18, NO: 15, PL: 28, PT: 25, RO: 24, SE: 24, SI: 19, SK: 24, SM: 27, VA: 22 };

function ibanValid(raw) {
  const iban = String(raw || '').replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (IBAN_LEN[iban.slice(0, 2)] !== iban.length) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  let rem = 0;
  for (const ch of moved) {
    const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rem = (rem * 10 + Number(d)) % 97;
  }
  return rem === 1;
}

// The SEPA character set is Latin letters, digits and a few signs; accents are allowed by UTF-8 (charset 1) but banks may reject them.
FORMATS.epc = {
  group: 2, confidence: 'medium', country: 'EU', currencies: ['EUR'],
  build(p, w) {
    const name = needName(cleanText(p.name, 'name', w, 70), 'name');
    const iban = String(p.iban || '').replace(/\s+/g, '').toUpperCase();
    if (!ibanValid(iban)) fail('bad_iban', 'iban', 'IBAN checksum or length is wrong');
    const bic = String(p.bic || '').replace(/\s+/g, '').toUpperCase();
    if (bic && !/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)) fail('bad_bic', 'bic');
    const minor = parseAmount(p.amount, 'EUR', w);
    if (minor && minor > 99999999999n) fail('amount_too_large', 'amount');
    const amount = minor ? formatMinor(minor, 'EUR') : null;
    const ref = cleanText(p.reference, 'reference', w, 140);
    const info = cleanText(p.info, 'info', w, 70);
    const purpose = String(p.purpose || '').trim().toUpperCase();
    if (purpose && !/^[A-Z]{4}$/.test(purpose)) fail('bad_purpose', 'purpose');
    // BCD / version / charset (1 = UTF-8) / SCT / BIC / name / IBAN / amount / purpose / structured ref / free-text ref / info
    const lines = ['BCD', '002', '1', 'SCT', bic, name, iban, amount ? 'EUR' + amount : '', purpose, '', ref, info];
    while (lines.length > 7 && lines[lines.length - 1] === '') lines.pop();
    const payload = lines.join('\n');
    if (byteLength(payload) > 331) fail('too_long', 'payload', 'an EPC QR holds at most 331 bytes');
    if (!/^[\x20-\x7e]*$/.test(name + ref + info)) w.push('non_sepa_characters');
    return {
      payload,
      display: display('EPC SEPA', { receiverName: name, receiverNameKind: 'legal', receiverId: mask(iban), amount, currency: 'EUR', country: iban.slice(0, 2) }),
    };
  },
};

/** Build a payload. Throws HopPayError. The result's display.receiverName is never empty. */
function build(format, params) {
  const f = FORMATS[format];
  if (!f) fail('unknown_format', 'format');
  const warnings = [];
  const out = f.build(params || {}, warnings);
  if (!out.display.receiverName) fail('receiver_name_required', 'name');
  if (HIDDEN_TEST.test(out.display.receiverName)) fail('hidden_characters', 'name');
  return { payload: out.payload, display: out.display, warnings, confidence: f.confidence, group: f.group };
}

// ---------------------------------------------------------------- split bill
/**
 * Largest-remainder allocation of an integer `total` over integer `weights`. The parts always sum to total.
 * Ties go to the lower index; with all weights zero the total is split equally.
 */
function allocate(total, weights) {
  const n = weights.length;
  if (!n) return [];
  const T = BigInt(total), sign = T < 0n ? -1n : 1n, A = T * sign;
  let W = 0n;
  for (const w of weights) W += BigInt(w);
  const ws = W === 0n ? weights.map(() => 1n) : weights.map((w) => BigInt(w));
  if (W === 0n) W = BigInt(n);
  const parts = ws.map((w) => (A * w) / W);
  let left = A - parts.reduce((a, b) => a + b, 0n);
  const order = ws.map((w, i) => ({ i, r: (A * w) % W })).sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (let k = 0; left > 0n; k = (k + 1) % n, left--) parts[order[k].i] += 1n;
  return parts.map((p) => Number(p * sign));
}

/** basis points of an integer, rounded half up, exact for any size. */
const bps = (amount, bp) => Number((BigInt(amount) * BigInt(bp) * 2n + 10000n) / 20000n);

/**
 * spec = {
 *   currency: 'IDR',
 *   people: [{ id, name }],
 *   items: [{ name, price, shares?: [ids] }],           // price in minor units; no shares = everyone
 *   charges?: [{ label, percent? (basis points), fixed? (minor), kind?: 'charge'|'discount' }],
 *   payerId?: id, roundTo?: minor-unit step (needs payerId)
 * }
 * Charges apply to the item subtotal and are shared in proportion to what each person ordered.
 * Rounding: everyone except the payer is rounded UP to the step; the payer pays the exact rest, so the sum
 * of all amounts is always the bill total.
 */
function splitBill(spec) {
  const warnings = [];
  const people = spec.people || [];
  if (!people.length) fail('no_people', 'people');
  const ids = people.map((p) => p.id);
  if (new Set(ids).size !== ids.length) fail('duplicate_person', 'people');
  const idx = new Map(ids.map((id, i) => [id, i]));
  const sub = people.map(() => 0);

  (spec.items || []).forEach((it, k) => {
    if (!Number.isSafeInteger(it.price) || it.price < 0) fail('bad_price', 'items');
    const who = (it.shares && it.shares.length ? it.shares : ids).map((id) => {
      if (!idx.has(id)) fail('unknown_person', 'items');
      return idx.get(id);
    });
    const uniq = [...new Set(who)];
    // equal shares; the leftover units rotate with the item number so nobody always gets the extra unit
    const base = Math.floor(it.price / uniq.length), extra = it.price - base * uniq.length;
    uniq.forEach((pi, j) => { sub[pi] += base + (((j - k) % uniq.length + uniq.length) % uniq.length < extra ? 1 : 0); });
  });
  const subtotal = sub.reduce((a, b) => a + b, 0);

  const per = people.map((p, i) => ({ id: p.id, name: p.name, subtotal: sub[i], charges: 0, exact: sub[i], due: 0, roundingDelta: 0 }));
  const charges = [];
  for (const c of spec.charges || []) {
    let amount = c.percent != null ? bps(subtotal, c.percent) : c.fixed || 0;
    if (!Number.isSafeInteger(amount) || amount < 0) fail('bad_charge', 'charges');
    if (c.kind === 'discount') {
      if (amount > subtotal) fail('discount_too_large', 'charges');
      amount = -amount;
    }
    const shares = allocate(amount, sub);
    shares.forEach((s, i) => { per[i].charges += s; });
    charges.push({ label: c.label || '', amount });
  }
  per.forEach((p) => { p.exact = p.subtotal + p.charges; p.due = p.exact; });
  const total = per.reduce((a, p) => a + p.exact, 0);

  let payerId = spec.payerId == null ? null : spec.payerId;
  if (payerId != null && !idx.has(payerId)) fail('unknown_person', 'payerId');
  if (spec.roundTo && spec.roundTo > 1) {
    if (payerId == null) { warnings.push('rounding_needs_payer'); }
    else {
      const step = spec.roundTo;
      let others = 0;
      per.forEach((p) => { if (p.id !== payerId) { p.due = Math.ceil(p.exact / step) * step; others += p.due; } });
      const payer = per[idx.get(payerId)];
      payer.due = total - others;
      if (payer.due < 0) {
        warnings.push('rounding_exceeds_total');
        per.forEach((p) => { p.due = p.exact; });
      }
    }
  }
  per.forEach((p) => { p.roundingDelta = p.due - p.exact; });
  const dueSum = per.reduce((a, p) => a + p.due, 0);
  if (dueSum !== total) throw new HopPayError('internal_sum_mismatch', 'amounts do not add up to the total');
  return { currency: spec.currency || '', subtotal, charges, total, people: per, payerId, warnings };
}

export {
  HopPayError, build, splitBill, allocate, crc16, parseAmount, formatMinor, exponent, ibanValid, base58Length, cleanText, mixedScripts,
};
export const formats = Object.fromEntries(Object.entries(FORMATS).map(([k, v]) => [k, { group: v.group, confidence: v.confidence, country: v.country, currencies: v.currencies }]));
