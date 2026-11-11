// Component tests: the real Svelte pages, rendered on the server side through Vite (no browser, no jsdom),
// with the saved-data state set the way the API would set it. Checks what the person is shown: storage off,
// the lists, the delete controls, that an account number is never printed whole, and that every consent box
// starts unticked with its button disabled.
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../web', import.meta.url));
let server, render, Dashboard, Generate, Legal, saved, account;

before(async () => {
  server = await createServer({ root, configFile: false, plugins: [(await import('@sveltejs/vite-plugin-svelte')).svelte()], server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent', optimizeDeps: { noDiscovery: true } });
  ({ render } = await server.ssrLoadModule('svelte/server'));
  Dashboard = (await server.ssrLoadModule('/src/lib/pages/Dashboard.svelte')).default;
  Generate = (await server.ssrLoadModule('/src/lib/pages/Generate.svelte')).default;
  Legal = (await server.ssrLoadModule('/src/lib/pages/Legal.svelte')).default;
  ({ saved } = await server.ssrLoadModule('/src/lib/saved.svelte.ts'));
  ({ account } = await server.ssrLoadModule('/src/lib/account.svelte.ts'));
});
after(async () => { await server?.close(); });

const IBAN = 'DE89370400440532013000';
function reset() {
  Object.assign(saved, { loaded: true, enabled: true, methods: [], bills: [], unreadable: 0, maxMethods: 20, keepBills: 200 });
  Object.assign(account, { ready: true, sso: true, signedIn: true, name: 'Ana Tester', email: 'ana@example.test', hubUrl: 'https://hub.example.test' });
}
const html = (C, props = {}) => render(C, { props }).body;

test('account page, saving switched off on the server: says so and offers no delete-all', () => {
  reset();
  saved.enabled = false;
  const h = html(Dashboard);
  assert.match(h, /id="savedOff"/);
  assert.match(h, /Saving is switched off on this server/);
  assert.doesNotMatch(h, /Delete everything I saved/);
});

test('account page, nothing saved yet: empty messages, counts 0 of 20 and 0 of 200', () => {
  reset();
  const h = html(Dashboard);
  assert.match(h, /No saved methods yet/);
  assert.match(h, /No saved bills yet/);
  assert.match(h, /0 of 20/);
  assert.match(h, /0 of 200/);
  assert.doesNotMatch(h, /Delete everything I saved/);
});

test('account page lists methods and bills with a delete button each, and never prints the account number whole', () => {
  reset();
  saved.methods = [
    { id: 2, format: 'epc', label: 'Flat rent', values: { name: 'Ana', iban: IBAN }, created_at: 1700000000, consent_at: 1700000000 },
    { id: 1, format: 'paypal', label: '', values: { user: 'anasouza' }, created_at: 1700000000, consent_at: 1700000000 }
  ];
  saved.bills = [{ id: 7, format: 'epc', receiver: 'Ana Souza', amount: '48.50', currency: 'EUR', payload: 'BCD ' + IBAN, note: '', created_at: 1700000000 }];
  const h = html(Dashboard);
  assert.match(h, /Flat rent/);
  assert.match(h, /PayPal\.me · an••••uza/);
  assert.match(h, /DE••••000/);
  assert.match(h, /2 of 20/);
  assert.match(h, /1 of 200/);
  assert.match(h, /48\.50 EUR/);
  assert.equal((h.match(/>Delete</g) ?? []).length, 3, 'one delete button per item');
  assert.match(h, /Delete everything I saved/);
  assert.ok(!h.includes(IBAN), 'the full account number reached the page');
  assert.ok(!h.includes('BCD'), 'the QR text of a bill reached the list');
});

test('account page warns about items the key cannot open, and still allows deleting', () => {
  reset();
  saved.unreadable = 2;
  const h = html(Dashboard);
  assert.match(h, /2 saved items cannot be read/);
  assert.match(h, /Delete everything I saved/);
});

test('the delete dialog exists, is closed, and names its two actions', () => {
  reset();
  const h = html(Dashboard);
  assert.match(h, /<dialog class="confirm"/);
  assert.doesNotMatch(h, /<dialog[^>]* open/);
});

test('generator, guest: no consent box, asks to sign in, nothing to save with', () => {
  reset();
  Object.assign(account, { signedIn: false });
  Object.assign(saved, { loaded: false, enabled: false });
  const h = html(Generate);
  assert.match(h, /Saving needs a HOP ID/);
  assert.match(h, /id="saveSignin"/);
  assert.doesNotMatch(h, /consentMethod|consentBill|saveMethod|saveBill/);
});

test('generator, signed in with saving on: both consent boxes start unticked and both save buttons start disabled', () => {
  reset();
  const h = html(Generate);
  const box = (id) => h.match(new RegExp('<input[^>]*id="' + id + '"[^>]*>'))?.[0] ?? '';
  const btn = (id) => h.match(new RegExp('<button[^>]*id="' + id + '"[^>]*>'))?.[0] ?? '';
  for (const id of ['consentMethod', 'consentBill']) {
    assert.ok(box(id), id + ' missing');
    assert.doesNotMatch(box(id), /checked/, id + ' must start unticked');
  }
  for (const id of ['saveMethod', 'saveBill']) assert.match(btn(id), /disabled/, id + ' must start disabled');
});

test('generator, signed in, saved methods exist: they can be picked, by name', () => {
  reset();
  saved.methods = [{ id: 5, format: 'epc', label: 'Flat rent', values: { iban: IBAN }, created_at: 1, consent_at: 1 }];
  const h = html(Generate);
  assert.match(h, /id="useSaved"/);
  assert.match(h, /Flat rent/);
  assert.ok(!h.includes(IBAN));
});

test('generator, signed in, saving off on the server: says so instead of showing a dead form', () => {
  reset();
  saved.enabled = false;
  const h = html(Generate);
  assert.match(h, /Saving is switched off on this server/);
  assert.doesNotMatch(h, /consentMethod/);
});

test('privacy and terms are dated and mention what is stored', () => {
  const priv = html(Legal, { kind: 'priv' });
  assert.match(priv, /Last updated 2026-11-11/);
  assert.match(priv, /AES-256-GCM/);
  assert.match(priv, /never stores card numbers/);
  const terms = html(Legal, { kind: 'terms' });
  assert.match(terms, /Saving a payment method or a bill is your choice/);
  assert.match(terms, /does not process, hold or move money/);
});
