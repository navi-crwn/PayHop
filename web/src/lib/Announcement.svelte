<script lang="ts">
  /* The family announcement card at the top of the signed-in dashboard. The hub is the only source (announce.js);
     the text is drawn as plain text, never as HTML. No item, no card, no gap. A hub that is down means no card. */
  import { onMount } from 'svelte';
  import { i18n } from './i18n/index.svelte';
  import { visibleAnnouncement, canDismiss, dismissAnnouncement } from './announce.js';
  import Icon from './Icon.svelte';

  type Item = { id: string; level: string; title: string; body: string; url: string };
  let { item = undefined }: { item?: Item | null } = $props(); // given in tests; otherwise asked from this server once

  let fetched = $state<Item | null>(null);
  onMount(async () => {
    if (item !== undefined) return;
    try {
      const res = await fetch('/api/v1/announcement', { headers: { accept: 'application/json' }, credentials: 'same-origin' });
      if (res.ok && (res.headers.get('content-type') ?? '').includes('application/json')) fetched = (await res.json())?.item ?? null;
    } catch { /* offline or no server: no card */ }
  });

  const store = (): Storage | null => {
    try { return localStorage; } catch { return null; }
  };
  let tick = $state(0);
  const a = $derived((void tick, visibleAnnouncement(item === undefined ? fetched : item, store(), Date.now())));
  function close() {
    if (!a) return;
    dismissAnnouncement(a.id, store(), Date.now());
    tick++;
  }
</script>

{#if a}
  <section class="announce" id="announce" data-level={a.level} aria-labelledby="announceT">
    <Icon name="spark" />
    <div class="announce-body">
      <b id="announceT">{#if a.url}<a href={a.url} rel="noopener">{a.title}</a>{:else}{a.title}{/if}</b>
      {#if a.body}<p>{a.body}</p>{/if}
    </div>
    {#if canDismiss(a)}<button type="button" class="btn btn--sm btn--outline btn--icon" aria-label={i18n.t('announce.close')} title={i18n.t('announce.close')} onclick={close}><Icon name="x" /></button>{/if}
  </section>
{/if}
