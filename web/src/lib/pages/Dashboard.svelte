<script lang="ts">
  import { onMount } from 'svelte';
  import { i18n } from '../i18n/index.svelte';
  import { account } from '../account.svelte';
  import { saved, loadSaved, deleteMethod, deleteBill, deleteEverything } from '../saved.svelte';
  import { methodTitle, FORMAT_NAMES, maskId, ID_KEY } from '../saved-model.js';
  import Icon from '../Icon.svelte';
  import Announcement from '../Announcement.svelte';

  const t = (k: string, v?: Record<string, string | number>) => i18n.t(k, v);

  type Target = { kind: 'method' | 'bill' | 'all'; id?: number; name?: string };
  let target = $state<Target | null>(null);
  let dlg = $state<HTMLDialogElement>();
  let failed = $state(false);
  let busy = $state(false);

  onMount(async () => {
    const r = await loadSaved();
    failed = !r.ok;
  });

  const date = (s: number) => new Date(s * 1000).toLocaleDateString(i18n.locale, { year: 'numeric', month: 'short', day: 'numeric' });
  const hasAny = $derived(saved.methods.length + saved.bills.length + saved.unreadable > 0);
  const fmtName = (f: string) => (FORMAT_NAMES as Record<string, string>)[f] ?? f;

  function ask(tg: Target) {
    target = tg;
    queueMicrotask(() => dlg?.showModal());
  }
  function close() {
    dlg?.close();
    target = null;
  }
  async function confirmDelete() {
    if (!target || busy) return;
    busy = true;
    const tg = target;
    const r = tg.kind === 'all' ? await deleteEverything() : tg.kind === 'method' ? await deleteMethod(tg.id!) : await deleteBill(tg.id!);
    busy = false;
    failed = !r.ok;
    close();
  }
</script>

<div class="wrap page">
  <Announcement />
  <div class="page-head"><h1>{t('dash.welcome', { name: account.name || account.email })}</h1><p>{t('dash.sub')}</p></div>
  <div class="qa">
    <a href="/generate"><Icon name="qr" /><b>{t('nav.generate')}</b><span>{t('gen.sub')}</span></a>
    <a href="/split"><Icon name="split" /><b>{t('nav.split')}</b><span>{t('split.sub')}</span></a>
  </div>

  {#if saved.loaded && !saved.enabled}
    <p class="note" role="status" id="savedOff">{t('saved.off')}</p>
  {:else if failed}
    <p class="note" role="alert">{t('saved.err_other')}</p>
  {/if}
  {#if saved.unreadable > 0}<p class="note" role="status">{t('saved.unreadable', { n: saved.unreadable })}</p>{/if}

  <div class="cards">
    <section class="card" id="methods" aria-labelledby="methodsT">
      <div class="card-h"><h2 id="methodsT">{t('dash.methods_t')}</h2>{#if saved.enabled}<span class="chip">{t('dash.count', { n: saved.methods.length, max: saved.maxMethods })}</span>{/if}</div>
      <p class="hint" style="margin:0 0 12px">{t('dash.methods_p')}</p>
      {#if saved.enabled && saved.methods.length}
        <ul class="srows">
          {#each saved.methods as m (m.id)}
            <li>
              <div class="s-main">
                <b>{methodTitle(m)}</b>
                <span class="s-sub"><span class="chip chip--brand">{fmtName(m.format)}</span>{#if m.label}<span class="mono">{maskId(m.values[(ID_KEY as Record<string, string>)[m.format]])}</span>{/if}<span>{t('dash.saved_on', { date: date(m.created_at) })}</span></span>
              </div>
              <button class="btn btn--sm btn--outline" type="button" onclick={() => ask({ kind: 'method', id: m.id, name: methodTitle(m) })}>{t('dash.delete')}</button>
            </li>
          {/each}
        </ul>
      {:else if saved.enabled && saved.loaded}
        <p class="empty">{t('dash.methods_empty')}</p>
      {/if}
    </section>

    <section class="card" id="history" aria-labelledby="historyT">
      <div class="card-h"><h2 id="historyT">{t('dash.history_t')}</h2>{#if saved.enabled}<span class="chip">{t('dash.count', { n: saved.bills.length, max: saved.keepBills })}</span>{/if}</div>
      <p class="hint" style="margin:0 0 12px">{t('dash.history_p', { n: saved.keepBills })}</p>
      {#if saved.enabled && saved.bills.length}
        <ul class="srows">
          {#each saved.bills as b (b.id)}
            <li>
              <div class="s-main">
                <b>{b.receiver || fmtName(b.format)}</b>
                <span class="s-sub"><span class="chip chip--brand">{fmtName(b.format)}</span><span class="num">{b.amount ? `${b.amount} ${b.currency}` : t('gen.no_amount')}</span><span>{t('dash.saved_on', { date: date(b.created_at) })}</span></span>
              </div>
              <button class="btn btn--sm btn--outline" type="button" onclick={() => ask({ kind: 'bill', id: b.id, name: b.receiver || fmtName(b.format) })}>{t('dash.delete')}</button>
            </li>
          {/each}
        </ul>
      {:else if saved.enabled && saved.loaded}
        <p class="empty">{t('dash.history_empty')}</p>
      {/if}
    </section>
  </div>

  {#if saved.enabled}
    <p class="hint">{t('saved.encrypted')}</p>
    {#if hasAny}<div class="actions"><button class="btn btn--outline" type="button" id="deleteAll" onclick={() => ask({ kind: 'all' })}>{t('dash.delete_all')}</button></div>{/if}
  {/if}
</div>

<dialog class="confirm" bind:this={dlg} aria-labelledby="delT" onclose={() => (target = null)}>
  {#if target}
    <h2 id="delT">{target.kind === 'all' ? t('dash.del_title_all') : t('dash.del_title_one')}</h2>
    <p>{target.kind === 'all' ? t('dash.del_body_all') : t('dash.del_body_one', { name: target.name ?? '' })}</p>
    <div class="actions">
      <button class="btn btn--outline" type="button" onclick={close}>{t('dash.cancel')}</button>
      <button class="btn btn--danger" type="button" id="confirmDelete" disabled={busy} onclick={confirmDelete}>{t('dash.delete')}</button>
    </div>
  {/if}
</dialog>
