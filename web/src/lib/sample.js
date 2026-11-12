/* Sample data: values for trying the app without a payment method of your own.

   A sample must never be able to send money to a real person, so a format has one only when its own public
   documentation gives an example value that belongs to nobody:

     epc  name "DEMO: do not pay" (ours), IBAN DE89 3704 0044 0532 0130 00: the example the SWIFT IBAN Registry
          prints for Germany (valid checksum, not an account). No BIC: the field is optional.

   No other format has a sample. PayPal.me, Cash App, Venmo, UPI, PromptPay and VietQR name a person's handle, number
   or account, and the documentation gives only placeholders ("yourusername", "0066xxxxxxxxxx") or none; the Solana
   Pay specification's example address is a real person's wallet. Those stay empty. Everything here is plain data
   and plain functions with no DOM; tested in sample.test.mjs. */

export const SAMPLE_NAME = 'DEMO: do not pay';

export const SAMPLES = {
  epc: { name: SAMPLE_NAME, iban: 'DE89 3704 0044 0532 0130 00', bic: '', amount: '10.00', reference: 'SAMPLE' }
};

/** The fields that say who gets paid. The amount and the reference do not, so typing them does not leave sample mode. */
export const SAMPLE_ID_KEYS = { epc: ['name', 'iban'] };

/** The format the sample button uses when the chosen format has no sample. */
export const FALLBACK_FORMAT = 'epc';

export const hasSample = (format) => Object.prototype.hasOwnProperty.call(SAMPLES, format);

/** A copy of the sample values of a format (empty when it has none). */
export const sampleValues = (format) => ({ ...(SAMPLES[format] ?? {}) });

const norm = (v) => String(v ?? '').replace(/\s+/g, '').toLowerCase();

/**
 * True while the form still holds any sample value that says who gets paid. It stays true for a half-edited form
 * (a real IBAN under the sample name, or the other way round), so a mixed code is never shown as a real one; it
 * ends only when every one of those values has been replaced or cleared.
 */
export function isSample(format, values) {
  const ids = SAMPLE_ID_KEYS[format];
  if (!ids || !values) return false;
  return ids.some((k) => norm(values[k]) !== '' && norm(values[k]) === norm(SAMPLES[format][k]));
}
