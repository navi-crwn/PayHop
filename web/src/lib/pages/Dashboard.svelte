<script lang="ts">
  import { i18n } from '../i18n/index.svelte';
  import { account } from '../account.svelte';
  import Icon from '../Icon.svelte';

  const t = (k: string, v?: Record<string, string | number>) => i18n.t(k, v);
</script>

<div class="wrap page">
  <div class="page-head"><h1>{t('dash.welcome', { name: account.name || account.email })}</h1><p>{t('dash.sub')}</p></div>
  <div class="qa">
    <a href="/generate"><Icon name="qr" /><b>{t('nav.generate')}</b><span>{t('gen.sub')}</span></a>
    <a href="/split"><Icon name="split" /><b>{t('nav.split')}</b><span>{t('split.sub')}</span></a>
  </div>
  <div class="cards">
    <div class="card"><h2>{t('dash.methods_t')}</h2><p class="hint" style="margin:0">{t('dash.methods_p')}</p></div>
    <div class="card"><h2>{t('dash.history_t')}</h2><p class="hint" style="margin:0">{t('dash.history_p')}</p></div>
  </div>
</div>
