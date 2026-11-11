<script lang="ts">
  import { i18n } from '../i18n/index.svelte';
  import en from '../i18n/en.json';
  import { build, HopPayError } from '../pay';
  import { FORMAT_DEFS, FORMAT_BY_ID, emptyValues } from '../formats';
  import { makeQr, qrPng } from '../qr';
  import { account, signInHref } from '../account.svelte';
  import { saved, loadSaved, saveMethod, saveBill } from '../saved.svelte';
  import { methodBody, methodTitle, applyMethod, billBody, errorKey } from '../saved-model.js';
  import Icon from '../Icon.svelte';

  const t = (k: string, v?: Record<string, string | number>) => i18n.t(k, v);
  const ERR = new Set(Object.keys(en).filter((k) => k.startsWith('err.')));

  let fmt = $state('paypal');
  let vals = $state(emptyValues());
  let touched = $state<Record<string, boolean>>({});
  let confirmed = $state(false);
  let copied = $state(false);

  // saving: only for a signed-in account, one item at a time, after its own ticked box
  let consentMethod = $state(false);
  let consentBill = $state(false);
  let saveLabel = $state('');
  let saveMsg = $state<{ ok: boolean; text: string } | null>(null);
  let saving = $state(false);
  const canSave = $derived(account.ready && account.signedIn);
  $effect(() => {
    if (canSave && !saved.loaded) void loadSaved();
  });

  const def = $derived(FORMAT_BY_ID[fmt]);

  type Built = ReturnType<typeof build>;
  const result = $derived.by((): { ok: true; out: Built } | { ok: false; code: string; field: string | null } => {
    try {
      return { ok: true, out: build(fmt, vals[fmt]) };
    } catch (e) {
      if (e instanceof HopPayError) return { ok: false, code: e.code, field: e.field };
      throw e;
    }
  });

  const qr = $derived(result.ok ? makeQr(result.out.payload, t('gen.qr_label')) : null);

  // a new payload means a new thing to confirm
  let lastPayload = '';
  $effect(() => {
    const p = result.ok ? result.out.payload : '';
    if (p !== lastPayload) {
      lastPayload = p;
      confirmed = false;
    }
  });

  function errText(code: string): string {
    return t(ERR.has('err.' + code) ? 'err.' + code : 'err.other');
  }
  function warnText(w: string): string {
    const [k, arg] = w.split(':');
    if (k === 'hidden_characters_removed') return t('warn.hidden', { field: arg });
    return t('warn.' + k);
  }
  function fieldError(key: string): string {
    if (result.ok || result.field !== key) return '';
    if (!touched[fmt + key] && !vals[fmt][key]) return '';
    return errText(result.code);
  }
  function amountText(d: Built['display']): string {
    return d.amount ? `${d.amount} ${d.currency}${d.token ? ' (' + d.token + ')' : ''}` : '';
  }

  function slug(s: string): string {
    return s.normalize('NFKD').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 32) || 'code';
  }

  function pickSaved(e: Event) {
    const id = Number((e.currentTarget as HTMLSelectElement).value);
    const m = saved.methods.find((x) => x.id === id);
    if (!m || !vals[m.format]) return;
    fmt = m.format;
    vals[m.format] = applyMethod(vals[m.format], m);
    touched = {};
    (e.currentTarget as HTMLSelectElement).value = '';
  }

  async function keep(kind: 'method' | 'bill') {
    if (!result.ok || saving) return;
    saving = true;
    saveMsg = null;
    const r =
      kind === 'method'
        ? await saveMethod(methodBody(fmt, vals[fmt], saveLabel, consentMethod))
        : await saveBill(billBody(fmt, result.out.display, result.out.payload, consentBill));
    saving = false;
    if (r.ok) {
      saveMsg = { ok: true, text: t('gen.saved_ok') };
      if (kind === 'method') { consentMethod = false; saveLabel = ''; } else consentBill = false;
    } else {
      saveMsg = { ok: false, text: t(errorKey(r.code), { n: saved.maxMethods }) };
    }
  }

  async function download() {
    if (!result.ok || !confirmed) return;
    const d = result.out.display;
    const blob = await qrPng(result.out.payload, {
      name: d.receiverName,
      amount: amountText(d),
      scheme: d.scheme,
      made: t('gen.png_made'),
      check: t('gen.png_check')
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `payhop-${fmt}-${slug(d.receiverName)}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function copy() {
    if (!result.ok) return;
    try {
      await navigator.clipboard.writeText(result.out.payload);
      copied = true;
      setTimeout(() => (copied = false), 1600);
    } catch {
      /* clipboard blocked: the text is on screen anyway */
    }
  }
</script>

<div class="wrap page">
  <div class="page-head"><h1>{t('gen.title')}</h1><p>{t('gen.sub')}</p></div>
  <div class="two">
    <div>
      <div class="card">
        <div class="fmt-groups">
          {#each ['links', 'bank'] as g}
            <div class="g">
              <b>{t('fmt.' + g)}</b>
              <div class="opts" role="radiogroup" aria-label={t('fmt.' + g)}>
                {#each FORMAT_DEFS.filter((f) => f.group === g) as f}
                  <button type="button" class="toggle" role="radio" aria-checked={f.id === fmt} data-fmt={f.id} onclick={() => (fmt = f.id)}>{f.label}</button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
        <form class="form-grid" autocomplete="off" onsubmit={(e) => e.preventDefault()}>
          {#each def.fields as fd (fmt + fd.key)}
            {@const err = fieldError(fd.key)}
            <div class="field {fd.size ? 'field--' + fd.size : ''}">
              <label class="lbl" for={'f_' + fd.key}>{t(fd.label)}</label>
              {#if fd.select}
                <select class="select" id={'f_' + fd.key} bind:value={vals[fmt][fd.key]}>
                  {#each fd.select as o}<option>{o}</option>{/each}
                </select>
              {:else}
                <input class="input" class:num={fd.num} id={'f_' + fd.key} bind:value={vals[fmt][fd.key]} placeholder={fd.ph} spellcheck="false" autocapitalize="off"
                  inputmode={fd.num ? 'decimal' : undefined} aria-invalid={err ? 'true' : undefined} onblur={() => (touched[fmt + fd.key] = true)}>
              {/if}
              {#if fd.hint}<p class="hint">{t(fd.hint)}</p>{/if}
              {#if err}<p class="err">{err}</p>{/if}
            </div>
          {/each}
        </form>
      </div>
      <div class="card" id="saveCard">
        <h2>{t('gen.save_title')}</h2>
        {#if canSave && saved.loaded && saved.enabled}
          {#if saved.methods.length}
            <div class="field field--narrow" style="margin-bottom:14px">
              <label class="lbl" for="useSaved">{t('gen.use_saved')}</label>
              <select class="select" id="useSaved" onchange={pickSaved}>
                <option value="">{t('gen.use_saved_pick')}</option>
                {#each saved.methods as m (m.id)}<option value={m.id}>{methodTitle(m)}</option>{/each}
              </select>
            </div>
          {/if}
          <div class="field field--narrow" style="margin-bottom:12px">
            <label class="lbl" for="saveLabel">{t('gen.save_label')}</label>
            <input class="input" id="saveLabel" maxlength="60" bind:value={saveLabel} autocomplete="off">
          </div>
          <label class="check"><input type="checkbox" id="consentMethod" bind:checked={consentMethod}><span>{t('gen.save_consent')}</span></label>
          <div class="actions"><button class="btn btn--outline" id="saveMethod" disabled={!result.ok || !consentMethod || saving} onclick={() => keep('method')}>{t('gen.save_btn')}</button></div>
          <hr class="sep">
          <label class="check"><input type="checkbox" id="consentBill" bind:checked={consentBill}><span>{t('gen.hist_consent')}</span></label>
          <div class="actions"><button class="btn btn--outline" id="saveBill" disabled={!result.ok || !consentBill || saving} onclick={() => keep('bill')}>{t('gen.hist_btn')}</button></div>
          {#if saveMsg}<p class={saveMsg.ok ? 'hint' : 'err'} role="status" id="saveMsg">{saveMsg.text}</p>{/if}
          <p class="hint">{t('saved.encrypted')}</p>
        {:else if canSave && saved.loaded}
          <p class="hint" style="margin:0">{t('saved.off')}</p>
        {:else if canSave}
          <p class="hint" style="margin:0">…</p>
        {:else}
          <p class="hint" style="margin:0 0 12px">{t('gen.save_hint')}</p>
          {#if account.ready && account.sso}<a class="btn btn--outline" id="saveSignin" href={signInHref('/generate')}>{t('top.signin')}</a>{/if}
        {/if}
      </div>
    </div>

    <div>
      <div class="card" aria-live="polite">
        {#if result.ok && qr}
          {@const d = result.out.display}
          <div class="qrcard" id="qrBox">
            {@html qr.svg}
            <div class="cap">{d.receiverName}</div>
            {#if d.amount}<div class="cap2 num">{amountText(d)}</div>{:else}<div class="cap2">{t('gen.any_amount')}</div>{/if}
          </div>
          <div class="who" id="who">
            <span class="k">{t('gen.pays')}</span>
            <span class="v">{d.receiverName}</span>
            <span class="k mono">{d.receiverId}</span>
            <div class="m">
              <span class="chip chip--brand">{d.scheme}</span>
              {#if d.amount}<span class="chip num">{amountText(d)}</span>{:else}<span class="chip">{t('gen.no_amount')}</span>{/if}
              <span class="chip chip--warn">{t('gen.not_tested')}</span>
            </div>
          </div>
          {#if result.out.warnings.length}
            <ul class="warns">{#each result.out.warnings as w}<li>{warnText(w)}</li>{/each}</ul>
          {/if}
          <label class="check consent"><input type="checkbox" id="confirm" bind:checked={confirmed}><span>{t('gen.confirm')}</span></label>
          <div class="actions">
            <button class="btn btn--primary" id="dl" disabled={!confirmed} onclick={download}><Icon name="down" />{t('gen.download')}</button>
            <button class="btn btn--outline" id="cp" onclick={copy}><Icon name="copy" />{copied ? t('gen.copied') : t('gen.copy')}</button>
          </div>
          <div class="payload mono" id="payload">{result.out.payload}</div>
          <p class="note">{t('gen.png_note')}</p>
        {:else}
          <div class="qrcard off" id="qrBox">{t('gen.fix')}</div>
        {/if}
      </div>
    </div>
  </div>
</div>
