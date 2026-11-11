/* What "saved" means in the browser, as plain functions with no DOM: which form values make up a
   method, how a method is shown without printing the whole account number, and how a server error
   code becomes a message key. Used by lib/saved.svelte.ts and the pages; tested in saved-model.test.mjs. */

export const MAX_METHODS = 20;
export const KEEP_BILLS = 200;

/** The brand names are not translated, so they live here. */
export const FORMAT_NAMES = {
  paypal: 'PayPal.me', cashapp: 'Cash App', venmo: 'Venmo', solana: 'Solana Pay', upi: 'UPI', epc: 'EPC SEPA', promptpay: 'PromptPay', vietqr: 'VietQR'
};

/** The receiver details a method keeps. The amount, note and reference belong to one bill, not to the method. */
export const METHOD_KEYS = {
  paypal: ['user', 'currency'],
  cashapp: ['cashtag'],
  venmo: ['user'],
  solana: ['recipient', 'splToken', 'label'],
  upi: ['vpa', 'name'],
  epc: ['name', 'iban', 'bic'],
  promptpay: ['name', 'phone'],
  vietqr: ['name', 'bin', 'account']
};

/** The field that identifies the receiver of each format. */
export const ID_KEY = { paypal: 'user', cashapp: 'cashtag', venmo: 'user', solana: 'recipient', upi: 'vpa', epc: 'iban', promptpay: 'phone', vietqr: 'account' };

/** "DE89 3704 0044 0532 0130 00" -> "DE••••000": enough to recognise it, not enough to copy it from the screen. */
export function maskId(value) {
  const v = String(value ?? '').replace(/\s+/g, '');
  if (!v) return '';
  if (v.length <= 6) return v.slice(0, 1) + '••••';
  return v.slice(0, 2) + '••••' + v.slice(-3);
}

/** The request body for "save this method": only the receiver keys, only the non-empty ones. */
export function methodBody(format, values, label, consent) {
  const keys = METHOD_KEYS[format];
  if (!keys) throw new Error('unknown format');
  const kept = {};
  for (const k of keys) {
    const v = String(values?.[k] ?? '').trim();
    if (v) kept[k] = v;
  }
  return { format, label: String(label ?? '').trim().slice(0, 60), values: kept, consent: consent === true };
}

/** What a saved method is called in a list: its own name, or the format and the masked id. */
export function methodTitle(m) {
  if (m.label) return m.label;
  const id = maskId(m.values?.[ID_KEY[m.format]]);
  return FORMAT_NAMES[m.format] + (id ? ' · ' + id : '');
}

/** The form values of one format after picking a saved method: its keys filled, the rest left alone. */
export function applyMethod(current, m) {
  const next = { ...current };
  for (const k of METHOD_KEYS[m.format] ?? []) if (m.values?.[k] !== undefined) next[k] = m.values[k];
  return next;
}

/** The request body for "save this bill to my history", from what the generator shows. */
export function billBody(format, display, payload, consent) {
  return {
    format,
    receiver: String(display?.receiverName ?? ''),
    amount: String(display?.amount ?? ''),
    currency: String(display?.currency ?? ''),
    payload: String(payload ?? ''),
    note: '',
    consent: consent === true
  };
}

/** Server error code (or a failed request) -> i18n key. */
export function errorKey(code) {
  switch (code) {
    case 'signin': return 'saved.err_signin';
    case 'storage_off': return 'saved.err_off';
    case 'limit_methods': return 'saved.err_limit';
    case 'consent_required': return 'saved.err_consent';
    default: return 'saved.err_other';
  }
}
