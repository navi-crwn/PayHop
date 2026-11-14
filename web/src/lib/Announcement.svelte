<script lang="ts">
  /* The announcement card at the top of the signed-in dashboard. No entry, no card, no gap (see announce.js). */
  import { i18n } from './i18n/index.svelte';
  import { ANNOUNCEMENTS, activeAnnouncement, dismissAnnouncement } from './announce.js';
  import Icon from './Icon.svelte';

  let { items = ANNOUNCEMENTS }: { items?: typeof ANNOUNCEMENTS } = $props();

  const store = (): Storage | null => {
    try { return localStorage; } catch { return null; }
  };
  let tick = $state(0);
  const a = $derived((void tick, activeAnnouncement(items, store(), Date.now(), i18n.locale)));
  function close() {
    if (!a) return;
    dismissAnnouncement(a.id, store(), Date.now());
    tick++;
  }
</script>

{#if a}
  <section class="announce" id="announce" aria-labelledby="announceT">
    <Icon name="spark" />
    <div class="announce-body">
      <b id="announceT">{i18n.t('announce.title')}</b>
      <p>{a.text}{#if a.href && a.link}{' '}<a href={a.href} rel="noopener">{a.link}</a>{/if}</p>
    </div>
    <button type="button" class="btn btn--sm btn--outline btn--icon" aria-label={i18n.t('announce.close')} title={i18n.t('announce.close')} onclick={close}><Icon name="x" /></button>
  </section>
{/if}
