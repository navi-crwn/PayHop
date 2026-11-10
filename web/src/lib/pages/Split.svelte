<script lang="ts">
  import { i18n } from '../i18n/index.svelte';
  import en from '../i18n/en.json';
  import { build, splitBill, parseAmount, formatMinor, exponent, formats, HopPayError } from '../pay';
  import { FORMAT_BY_ID, emptyValues } from '../formats';
  import { makeQr } from '../qr';
  import Icon from '../Icon.svelte';

  const t = (k: string, v?: Record<string, string | number>) => i18n.t(k, v);
  const ERR = new Set(Object.keys(en).filter((k) => k.startsWith('err.')));
  const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'IDR', 'AUD', 'CAD'];
  const METHODS = ['paypal', 'cashapp', 'venmo', 'upi', 'epc'];

  interface Person { id: string; name: string }
  interface Item { id: string; name: string; price: string; shares: string[] }

  let seq = 0;
  const uid = (p: string) => p + ++seq;

  let people = $state<Person[]>([]);
  let items = $state<Item[]>([]);
  let newPerson = $state('');
  let newItem = $state('');
  let newPrice = $state('');
  let priceBad = $state(false);
  let tax = $state('');
  let tip = $state('');
  let currency = $state('USD');
  let payerId = $state('');
  let roundTo = $state('0');
  let pick = $state('');
  let method = $state('paypal');
  let mvals = $state(emptyValues());

  const exp = $derived(exponent(currency));
  const payer = $derived(people.find((p) => p.id === payerId) ?? people[0]);

  function minor(price: string): number {
    try {
      const m = parseAmount(price, currency, []);
      return m == null ? 0 : Number(m);
    } catch {
      return 0;
    }
  }
  const bp = (v: string) => {
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  };
  function money(m: number): string {
    try {
      return new Intl.NumberFormat(i18n.locale, { style: 'currency', currency, minimumFractionDigits: exp, maximumFractionDigits: exp }).format(m / 10 ** exp);
    } catch {
      return formatMinor(m, currency) + ' ' + currency;
    }
  }

  const calc = $derived.by(() => {
    if (!people.length || !items.length) return null;
    try {
      const charges = [
        { label: t('split.charge_tax'), percent: bp(tax) },
        { label: t('split.charge_tip'), percent: bp(tip) }
      ].filter((c) => c.percent > 0);
      return splitBill({
        currency,
        people,
        items: items.map((i) => ({ name: i.name, price: minor(i.price), shares: i.shares.length ? i.shares : undefined })),
        charges,
        payerId: payer?.id,
        roundTo: Number(roundTo) * 10 ** exp
      });
    } catch (e) {
      if (e instanceof HopPayError) return null;
      throw e;
    }
  });

  function addPerson() {
    const name = newPerson.trim();
    if (!name) return;
    const id = uid('p');
    people.push({ id, name });
    if (!payerId) payerId = id;
    newPerson = '';
  }
  function removePerson(p: Person) {
    if (people.length < 2) return;
    people = people.filter((x) => x.id !== p.id);
    for (const it of items) it.shares = it.shares.filter((s) => s !== p.id);
    if (payerId === p.id) payerId = people[0].id;
  }
  function addItem() {
    const name = newItem.trim();
    if (!name) return;
    try {
      const m = parseAmount(newPrice, currency, []);
      if (m == null) throw new Error('empty');
      items.push({ id: uid('i'), name, price: newPrice.trim(), shares: [] });
      newItem = '';
      newPrice = '';
      priceBad = false;
    } catch {
      priceBad = true;
    }
  }
  function toggleShare(it: Item, id: string) {
    it.shares = it.shares.includes(id) ? it.shares.filter((s) => s !== id) : [...it.shares, id];
  }

  function errText(code: string): string {
    return t(ERR.has('err.' + code) ? 'err.' + code : 'err.other');
  }

  const share = $derived.by(() => {
    if (!calc || !payer) return null;
    const others = calc.people.filter((p: { id: string; due: number }) => p.id !== calc.payerId && p.due > 0);
    const p = others.find((x: { id: string }) => x.id === pick) ?? others[0];
    if (!p) return null;
    const f = formats[method as keyof typeof formats];
    if (f.currencies && !f.currencies.includes(currency)) return { p, error: t('err.bad_currency') };
    try {
      const params = { ...mvals[method], amount: formatMinor(p.due, currency), currency };
      const out = build(method, params);
      return { p, out, qr: makeQr(out.payload, t('gen.qr_label')) };
    } catch (e) {
      if (e instanceof HopPayError) return { p, error: errText(e.code) };
      throw e;
    }
  });
</script>

<div class="wrap page">
  <div class="page-head"><h1>{t('split.title')}</h1><p>{t('split.sub')}</p></div>
  <div class="two">
    <div>
      <div class="card">
        <h2>{t('split.people')}</h2>
        <div class="people" id="people">
          {#each people as p (p.id)}
            <span class="person">{p.name}<button type="button" aria-label={t('split.remove', { name: p.name })} onclick={() => removePerson(p)}>&times;</button></span>
          {/each}
        </div>
        <form class="row" style="margin-top:14px;align-items:flex-end" onsubmit={(e) => { e.preventDefault(); addPerson(); }}>
          <label class="field field--narrow" style="max-width:14rem"><span class="lbl">{t('split.add_person')}</span><input class="input" id="newPerson" bind:value={newPerson} placeholder={t('split.person_ph')} maxlength="40"></label>
          <button class="btn btn--outline" type="submit" id="addPerson">{t('split.add')}</button>
        </form>
      </div>

      <div class="card">
        <h2>{t('split.items')}</h2>
        {#if items.length}
          <table class="items">
            <thead><tr><th>{t('split.item')}</th><th class="p">{t('split.price')}</th><th>{t('split.shared_by')}</th><th class="del"></th></tr></thead>
            <tbody>
              {#each items as it (it.id)}
                <tr>
                  <td>{it.name}</td>
                  <td class="p num">{money(minor(it.price))}</td>
                  <td>
                    <div class="who-t">
                      <button type="button" class="toggle" aria-pressed={!it.shares.length} onclick={() => (it.shares = [])}>{t('split.everyone')}</button>
                      {#each people as p (p.id)}
                        <button type="button" class="toggle" aria-pressed={it.shares.includes(p.id)} onclick={() => toggleShare(it, p.id)}>{p.name}</button>
                      {/each}
                    </div>
                  </td>
                  <td class="del"><button type="button" class="btn btn--sm btn--ghost btn--icon" style="width:28px;height:28px" aria-label={t('split.remove', { name: it.name })} onclick={() => (items = items.filter((x) => x.id !== it.id))}>&times;</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
        <form class="row" style="margin-top:14px;align-items:flex-end" onsubmit={(e) => { e.preventDefault(); addItem(); }}>
          <label class="field field--narrow" style="max-width:12rem"><span class="lbl">{t('split.item')}</span><input class="input" id="newItem" bind:value={newItem} placeholder={t('split.person_ph')} maxlength="40"></label>
          <label class="field field--short" style="max-width:8rem"><span class="lbl">{t('split.price')}</span><input class="input num" id="newPrice" bind:value={newPrice} inputmode="decimal" placeholder={exp ? '0.00' : '0'} aria-invalid={priceBad ? 'true' : undefined}></label>
          <button class="btn btn--outline" type="submit" id="addItem">{t('split.add_item')}</button>
        </form>
        {#if priceBad}<p class="err">{t('split.bad_price')}</p>{/if}
      </div>

      <div class="card">
        <h2>{t('split.extras')}</h2>
        <div class="row">
          <label class="field field--xs"><span class="lbl">{t('split.tax')}</span><input class="input num" id="tax" bind:value={tax} inputmode="decimal" placeholder="0"></label>
          <label class="field field--xs"><span class="lbl">{t('split.tip')}</span><input class="input num" id="tip" bind:value={tip} inputmode="decimal" placeholder="0"></label>
          <label class="field field--short"><span class="lbl">{t('split.currency')}</span>
            <select class="select" id="cur" bind:value={currency}>{#each CURRENCIES as c}<option>{c}</option>{/each}</select></label>
          <label class="field field--short"><span class="lbl">{t('split.payer')}</span>
            <select class="select" id="payer" bind:value={payerId}>{#each people as p (p.id)}<option value={p.id}>{p.name}</option>{/each}</select></label>
          <label class="field field--short"><span class="lbl">{t('split.round')}</span>
            <select class="select" id="round" bind:value={roundTo}>
              <option value="0">{t('split.round_exact')}</option>
              {#each [1, 5, 10, 100, 1000] as r}<option value={String(r)}>{r}</option>{/each}
            </select></label>
        </div>
        <p class="hint">{t('split.round_hint')}</p>
      </div>
    </div>

    <div>
      <div class="card" aria-live="polite">
        <h2>{t('split.owes')}</h2>
        {#if !calc}
          <p class="hint" id="result">{t('split.empty')}</p>
        {:else}
          <div id="result">
            {#each calc.people as p (p.id)}
              {@const isPayer = p.id === calc.payerId}
              <div class="res-row">
                <div>
                  <div class="n">{p.name}{#if isPayer} <span class="chip chip--brand">{t('split.paid_bill')}</span>{/if}</div>
                  <div class="s num">{t('split.items_amt', { a: money(p.subtotal), b: money(p.charges) })}{#if p.roundingDelta}&nbsp;·&nbsp;{t('split.rounding', { a: (p.roundingDelta > 0 ? '+' : '-') + money(Math.abs(p.roundingDelta)) })}{/if}</div>
                </div>
                <div class="amt num">{money(p.due)}</div>
                {#if isPayer || p.due <= 0}<span></span>{:else}<button class="btn btn--sm btn--outline" onclick={() => (pick = p.id)}><Icon name="qr" />{t('split.qr')}</button>{/if}
              </div>
            {/each}
            <div class="kv" style="margin-top:8px"><span>{t('split.subtotal')}</span><b class="num">{money(calc.subtotal)}</b></div>
            {#each calc.charges as c}<div class="kv"><span>{c.label}</span><b class="num">{money(c.amount)}</b></div>{/each}
            <div class="tot"><span>{t('split.total')}</span><span class="num">{money(calc.total)}</span></div>
            {#if calc.warnings.includes('rounding_needs_payer')}<ul class="warns"><li>{t('split.warn_round')}</li></ul>{/if}
            {#if calc.warnings.includes('rounding_exceeds_total')}<ul class="warns"><li>{t('split.warn_round_over')}</li></ul>{/if}
          </div>

          <div class="method-box">
            <h2 style="margin-bottom:8px">{t('split.method_title')}</h2>
            <p class="hint" style="margin:0 0 10px">{t('split.method_hint', { payer: payer?.name ?? '' })}</p>
            <div class="opts" style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px" role="radiogroup" aria-label={t('split.method_title')}>
              {#each METHODS as m}
                <button type="button" class="toggle" role="radio" aria-checked={m === method} onclick={() => (method = m)}>{FORMAT_BY_ID[m].label}</button>
              {/each}
            </div>
            <div class="form-grid">
              {#each FORMAT_BY_ID[method].fields.filter((f) => f.key !== 'amount' && f.key !== 'currency' && f.key !== 'note') as fd (method + fd.key)}
                <div class="field {fd.size ? 'field--' + fd.size : ''}">
                  <label class="lbl" for={'m_' + fd.key}>{t(fd.label)}</label>
                  <input class="input" id={'m_' + fd.key} bind:value={mvals[method][fd.key]} placeholder={fd.ph} spellcheck="false" autocapitalize="off">
                </div>
              {/each}
            </div>
          </div>

          {#if share}
            <div id="shareQr">
              {#if share.error}
                <p class="note">{t('split.no_qr', { reason: share.error })}</p>
              {:else if share.out && share.qr}
                <div class="mini-qr">
                  <div class="qrcard">{@html share.qr.svg}</div>
                  <div>
                    <div class="n">{t('split.pays', { name: share.p.name, payer: payer?.name ?? '' })}</div>
                    <div class="amt2">{money(share.p.due)}</div>
                    <span class="chip">{share.out.display.scheme}</span> <span class="chip chip--warn">{t('gen.not_tested')}</span>
                  </div>
                </div>
              {/if}
            </div>
          {/if}
        {/if}
      </div>
    </div>
  </div>
</div>
