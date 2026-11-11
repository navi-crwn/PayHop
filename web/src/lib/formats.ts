/* The form for each payment format: which fields, their labels (i18n keys), placeholders and
   widths. The payloads themselves are built by lib/pay (pure, no DOM). */

export interface Field {
  key: string;
  label: string; // i18n key
  hint?: string; // i18n key
  ph?: string;
  select?: string[];
  size?: 'narrow' | 'short' | '';
  num?: boolean;
}

export interface FormatDef {
  id: string;
  label: string;
  group: 'links' | 'bank';
  fields: Field[];
}

const CUR = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'];

export const FORMAT_DEFS: FormatDef[] = [
  { id: 'paypal', label: 'PayPal.me', group: 'links', fields: [
    { key: 'user', label: 'f.paypal_user', hint: 'f.paypal_user_hint', ph: 'yourname', size: 'narrow' },
    { key: 'currency', label: 'f.currency', select: CUR, size: 'short' },
    { key: 'amount', label: 'f.amount', ph: '12.50', size: 'short', num: true }
  ] },
  { id: 'cashapp', label: 'Cash App', group: 'links', fields: [
    { key: 'cashtag', label: 'f.cashtag', ph: '$yourname', size: 'narrow' },
    { key: 'amount', label: 'f.amount_usd', ph: '12.50', size: 'short', num: true }
  ] },
  { id: 'venmo', label: 'Venmo', group: 'links', fields: [
    { key: 'user', label: 'f.venmo_user', ph: 'your-name', size: 'narrow' },
    { key: 'amount', label: 'f.amount_usd', ph: '12.50', size: 'short', num: true },
    { key: 'note', label: 'f.note', ph: '', size: '' }
  ] },
  { id: 'solana', label: 'Solana Pay', group: 'links', fields: [
    { key: 'recipient', label: 'f.recipient', hint: 'f.recipient_hint', ph: '', size: '' },
    { key: 'amount', label: 'f.amount', ph: '1.5', size: 'short', num: true },
    { key: 'splToken', label: 'f.spl', ph: '', size: '' },
    { key: 'label', label: 'f.label', ph: '', size: 'narrow' },
    { key: 'message', label: 'f.message', ph: '', size: '' }
  ] },
  { id: 'upi', label: 'UPI', group: 'links', fields: [
    { key: 'vpa', label: 'f.vpa', ph: 'name@bank', size: 'narrow' },
    { key: 'name', label: 'f.name', hint: 'f.name_hint', ph: '', size: 'narrow' },
    { key: 'amount', label: 'f.amount_inr', ph: '250', size: 'short', num: true },
    { key: 'note', label: 'f.note', ph: '', size: '' }
  ] },
  { id: 'epc', label: 'EPC SEPA', group: 'bank', fields: [
    { key: 'name', label: 'f.name', hint: 'f.name_hint', ph: '', size: '' },
    { key: 'iban', label: 'f.iban', ph: 'DE89 3704 0044 0532 0130 00', size: '' },
    { key: 'bic', label: 'f.bic', ph: '', size: 'short' },
    { key: 'amount', label: 'f.amount_eur', ph: '12.34', size: 'short', num: true },
    { key: 'reference', label: 'f.reference', ph: '', size: '' }
  ] },
  { id: 'promptpay', label: 'PromptPay', group: 'bank', fields: [
    { key: 'name', label: 'f.name', hint: 'f.name_hint', ph: '', size: '' },
    { key: 'phone', label: 'f.phone_th', hint: 'f.phone_th_hint', ph: '081 234 5678', size: 'narrow' },
    { key: 'amount', label: 'f.amount_thb', ph: '250', size: 'short', num: true }
  ] },
  { id: 'vietqr', label: 'VietQR', group: 'bank', fields: [
    { key: 'name', label: 'f.name', hint: 'f.name_hint', ph: '', size: '' },
    { key: 'bin', label: 'f.bin', hint: 'f.bin_hint', ph: '970436', size: 'short' },
    { key: 'account', label: 'f.account', ph: '', size: 'narrow' },
    { key: 'amount', label: 'f.amount_vnd', ph: '50000', size: 'short', num: true }
  ] }
];

export const FORMAT_BY_ID = Object.fromEntries(FORMAT_DEFS.map((f) => [f.id, f]));

export function emptyValues(): Record<string, Record<string, string>> {
  const v: Record<string, Record<string, string>> = {};
  for (const f of FORMAT_DEFS) {
    v[f.id] = {};
    for (const fd of f.fields) v[f.id][fd.key] = fd.select ? fd.select[0] : '';
  }
  return v;
}

/** The message for an error code from lib/pay, in the current language. */
export function errKey(code: string, known: (k: string) => boolean): string {
  return known('err.' + code) ? 'err.' + code : 'err.other';
}
