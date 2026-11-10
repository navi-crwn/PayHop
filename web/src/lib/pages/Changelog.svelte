<script lang="ts">
  import { onMount } from 'svelte';
  import { i18n } from '../i18n/index.svelte';

  interface Entry { kind: 'pr' | 'commit' | 'tag'; date: string; title: string; url: string; id: string }
  const t = (k: string) => i18n.t(k);
  const PAGE = 40;

  let entries = $state<Entry[]>([]);
  let shown = $state(PAGE);
  let ready = $state(false);

  onMount(async () => {
    try {
      const res = await fetch('/api/v1/changelog', { headers: { accept: 'application/json' } });
      const j = await res.json();
      entries = Array.isArray(j.entries) ? j.entries : [];
    } catch {
      /* offline before the first visit: nothing to show */
    } finally {
      ready = true;
    }
  });

  const date = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(i18n.locale, { dateStyle: 'medium' }).format(new Date(iso));
    } catch {
      return iso.slice(0, 10);
    }
  };
  const kind = (k: string) => t(k === 'pr' ? 'cl.pr' : k === 'tag' ? 'cl.release' : 'cl.commit');
</script>

<div class="wrap page">
  <div class="page-head"><h1>{t('cl.title')}</h1><p>{t('cl.sub')}</p></div>
  {#if ready && !entries.length}
    <p class="hint">{t('cl.empty')}</p>
  {:else}
    <ul class="cl">
      {#each entries.slice(0, shown) as e}
        <li><time datetime={e.date}>{date(e.date)}</time><a href={e.url} rel="noopener">{e.title}</a><span class="id">{kind(e.kind)} {e.id}</span></li>
      {/each}
    </ul>
    {#if entries.length > shown}<button class="btn btn--outline cl-more" onclick={() => (shown += PAGE)}>{t('cl.more')}</button>{/if}
  {/if}
</div>
