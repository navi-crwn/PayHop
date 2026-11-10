<script lang="ts">
  import { i18n } from '../i18n/index.svelte';

  let { kind }: { kind: 'terms' | 'priv' } = $props();
  const t = (k: string) => i18n.t(k);
</script>

<div class="wrap page legal">
  <div class="page-head"><h1>{t(kind + '.t')}</h1></div>
  <div class="card">
    {#each [1, 2, 3, 4] as n}<p>{t(kind + '.p' + n)}</p>{/each}
  </div>
</div>
