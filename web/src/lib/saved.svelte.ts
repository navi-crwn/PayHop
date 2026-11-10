/* What the signed-in account has saved on the server (payment methods, bill history) and the calls that
   change it. A guest never gets here: nothing is requested or written unless someone is signed in, and
   every write is a button the person pressed after ticking the consent box. Nothing is cached in the browser. */

import { MAX_METHODS, KEEP_BILLS } from './saved-model.js';

export interface SavedMethod {
  id: number;
  format: string;
  label: string;
  values: Record<string, string>;
  created_at: number;
  consent_at: number;
}
export interface SavedBill {
  id: number;
  format: string;
  receiver: string;
  amount: string;
  currency: string;
  payload: string;
  note: string;
  created_at: number;
}

export const saved = $state({
  loaded: false,
  enabled: false,
  methods: [] as SavedMethod[],
  bills: [] as SavedBill[],
  unreadable: 0,
  maxMethods: MAX_METHODS,
  keepBills: KEEP_BILLS
});

export type Result = { ok: true } | { ok: false; code: string };

async function call(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  const init: RequestInit = { method, credentials: 'same-origin', headers: { accept: 'application/json' } };
  if (method !== 'GET') {
    (init.headers as Record<string, string>)['X-Requested-With'] = 'payhop';
    if (body !== undefined) {
      (init.headers as Record<string, string>)['content-type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
  }
  const res = await fetch(path, init);
  let data: any = null;
  try { data = await res.json(); } catch { /* an error page, not JSON */ }
  return { status: res.status, data };
}

function fail(r: { status: number; data: any }): Result {
  return { ok: false, code: typeof r.data?.error === 'string' ? r.data.error : 'other' };
}

export async function loadSaved(): Promise<Result> {
  try {
    const r = await call('GET', '/api/v1/saved');
    if (r.status !== 200 || !r.data) return fail(r);
    saved.enabled = r.data.enabled === true;
    saved.methods = Array.isArray(r.data.methods) ? r.data.methods : [];
    saved.bills = Array.isArray(r.data.bills) ? r.data.bills : [];
    saved.unreadable = Number(r.data.unreadable) || 0;
    saved.maxMethods = Number(r.data.max_methods) || MAX_METHODS;
    saved.keepBills = Number(r.data.keep_bills) || KEEP_BILLS;
    saved.loaded = true;
    return { ok: true };
  } catch {
    return { ok: false, code: 'other' };
  }
}

async function change(method: string, path: string, body?: unknown): Promise<Result> {
  try {
    const r = await call(method, path, body);
    if (r.status >= 200 && r.status < 300) {
      await loadSaved();
      return { ok: true };
    }
    return fail(r);
  } catch {
    return { ok: false, code: 'other' };
  }
}

export const saveMethod = (body: unknown) => change('POST', '/api/v1/methods', body);
export const saveBill = (body: unknown) => change('POST', '/api/v1/bills', body);
export const deleteMethod = (id: number) => change('DELETE', '/api/v1/methods/' + id);
export const deleteBill = (id: number) => change('DELETE', '/api/v1/bills/' + id);

/** Everything this account saved, both lists. */
export async function deleteEverything(): Promise<Result> {
  const a = await change('DELETE', '/api/v1/methods');
  if (!a.ok) return a;
  return change('DELETE', '/api/v1/bills');
}
