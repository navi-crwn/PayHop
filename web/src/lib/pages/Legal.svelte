<script lang="ts">
  import { i18n } from '../i18n/index.svelte';
  import { account } from '../account.svelte';
  import { hubBase } from '../feedback.js';

  let { kind }: { kind: 'terms' | 'priv' } = $props();
  const t = (k: string, v?: Record<string, string>) => i18n.t(k, v);
  // the text changed on this date; bump it whenever the terms or the privacy text change
  const UPDATED = '2026-11-16';
  // the Feedback sentence is shown only where the Feedback link is: with a hub address
  const hub = $derived(kind === 'priv' ? hubBase(account.hubUrl) : '');
  const parts = $derived(t('priv.p6').split('{link}'));
</script>

<div class="wrap page legal">
  <div class="page-head"><h1>{t(kind + '.t')}</h1><p>{t('legal.updated', { date: UPDATED })}</p></div>
  <div class="card">
    {#each kind === 'priv' ? [1, 2, 5, 3, 4] : [1, 2, 3, 5, 4] as n}<p>{t(kind + '.p' + n)}</p>{/each}
    {#if hub}<p id="feedbackNote">{parts[0]}<a href="{hub}/privacy" rel="noopener">{t('priv.p6_link')}</a>{parts[1] ?? ''}</p>{/if}
  </div>
</div>
