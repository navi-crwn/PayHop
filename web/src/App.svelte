<script lang="ts">
  import { onMount } from 'svelte';
  import { i18n, guessLocale, LOCALES, LOCALE_NAMES } from './lib/i18n/index.svelte';
  import { account, loadAccount, initials, takeAuthError, takeRecheckMark, recheckQuietly, signInHref } from './lib/account.svelte';
  import { recheckAction } from './lib/recheck.js';
  import { route, startRouter, known } from './lib/router.svelte';
  import { BRAND } from './lib/brand';
  import { FAMILY, familyHref } from './lib/family';
  import Icon from './lib/Icon.svelte';
  import Home from './lib/pages/Home.svelte';
  import Generate from './lib/pages/Generate.svelte';
  import Split from './lib/pages/Split.svelte';
  import Dashboard from './lib/pages/Dashboard.svelte';
  import Changelog from './lib/pages/Changelog.svelte';
  import Legal from './lib/pages/Legal.svelte';

  const t = (k: string, v?: Record<string, string | number>) => i18n.t(k, v);
  const HUB = 'https://hel.ink';
  const REPO = 'https://github.com/navi-crwn/PayHop';

  let locale = $state(guessLocale());
  let theme = $state<'dark' | 'light'>(readTheme());
  let langOpen = $state(false);
  let langBtn = $state<HTMLButtonElement>();
  let langList = $state<HTMLElement>();
  let acctEl = $state<HTMLDetailsElement>();
  let sideOpen = $state(false);
  let toast = $state('');
  let toastTimer: number | undefined;

  function readTheme(): 'dark' | 'light' {
    try {
      const v = localStorage.getItem('hop-theme');
      if (v === 'light' || v === 'dark') return v;
    } catch { /* ignore */ }
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  // optional Clean style: one cookie on .hel.ink, so the choice holds in every HOP app
  let ui = $state<'hop' | 'clean'>(document.documentElement.dataset.ui === 'clean' ? 'clean' : 'hop');
  function setUi(v: 'hop' | 'clean') {
    ui = v;
    const dom = /(^|\.)hel\.ink$/.test(location.hostname) ? '; domain=.hel.ink; Secure' : '';
    document.cookie = 'hop_ui=' + v + '; path=/; max-age=31536000; SameSite=Lax' + dom;
    if (v === 'clean') document.documentElement.dataset.ui = 'clean';
    else delete document.documentElement.dataset.ui;
  }
  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('hop-theme', theme); } catch { /* ignore */ }
  }
  $effect(() => {
    document.documentElement.dataset.theme = theme;
  });

  // the address search engines should keep for this page, and no index for the signed-in page
  $effect(() => {
    const p = known(route.path) ? route.path : '/';
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://' + BRAND.host + (p === '/' ? '/' : p));
    let robots = document.querySelector('meta[name="robots"]');
    if (route.path === '/account') {
      if (!robots) {
        robots = document.createElement('meta');
        robots.setAttribute('name', 'robots');
        document.head.appendChild(robots);
      }
      robots.setAttribute('content', 'noindex');
    } else robots?.remove();
  });

  $effect(() => {
    void i18n.load(locale).then(() => {
      document.title = t('app.title');
      document.querySelector('meta[name="description"]')?.setAttribute('content', t('app.desc'));
    });
  });

  const code = (l: string) => l.split('-')[0].toUpperCase();
  function openLang() {
    langOpen = true;
    queueMicrotask(() => (langList?.querySelector<HTMLElement>('[aria-selected="true"]') ?? langList?.querySelector<HTMLElement>('[role="option"]'))?.focus());
  }
  function closeLang(refocus = false) {
    langOpen = false;
    if (refocus) langBtn?.focus();
  }
  function onLangKey(e: KeyboardEvent) {
    const items = [...(langList?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length]?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1]?.focus(); }
    else if (e.key === 'Tab') closeLang();
  }

  onMount(() => {
    const stop = startRouter();
    const justBack = takeRecheckMark();
    void loadAccount().then(() => {
      // a session the hub has not vouched for lately: ask it once, quietly, on this page load only
      const act = recheckAction({ stale: account.stale, justBack });
      if (act === 'recheck') recheckQuietly(location.pathname);
      else if (act === 'cookies') showToast(t('auth.err_cookies'));
    });
    const err = takeAuthError();
    if (err) showToast(t('auth.err_' + err));
    return stop;
  });

  function showToast(msg: string) {
    toast = msg;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toast = ''), 3200);
  }

  function onDocClick(e: MouseEvent) {
    const n = e.target as Node;
    if (langOpen && !(n as Element).closest?.('#langMenu')) closeLang();
    if (acctEl?.open && !acctEl.contains(n)) acctEl.open = false;
  }
  function onDocKey(e: KeyboardEvent) {
    if (e.key !== 'Escape') return;
    if (langOpen) closeLang(true);
    if (acctEl?.open) acctEl.open = false;
    sideOpen = false;
  }

  $effect(() => {
    void route.path;
    sideOpen = false;
    if (acctEl) acctEl.open = false;
  });

  const path = $derived(route.path);
  const signedIn = $derived(account.ready && account.signedIn);
  // signed in, the tools live inside the dashboard chrome; the home page and changelog stay public pages
  const dash = $derived(signedIn && known(path) && path !== '/' && path !== '/changelog' && path !== '/terms' && path !== '/privacy');
  const hubHref = $derived(signedIn && account.hubUrl ? account.hubUrl.replace(/\/+$/, '') + '/dashboard' : HUB);
  const others = FAMILY;
  const here = (p: string) => (path === p ? 'page' : undefined);
</script>

<svelte:document onclick={onDocClick} onkeydown={onDocKey} />

<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
  <symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8Z"/></symbol>
  <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3Z"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3 4.5 6v5.5c0 4.5 3.1 8 7.5 9.5 4.4-1.5 7.5-5 7.5-9.5V6L12 3Z"/><path d="m9 12 2.2 2.2L15.5 10"/></symbol>
  <symbol id="i-qr" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h3M20 17v4"/></symbol>
  <symbol id="i-split" viewBox="0 0 24 24"><path d="M12 3v18M5 7h4M5 12h4M15 7h4M15 12h4M5 17h4M15 17h4"/></symbol>
  <symbol id="i-down" viewBox="0 0 24 24"><path d="M12 4v12m0 0-4.5-4.5M12 16l4.5-4.5M5 20h14"/></symbol>
  <symbol id="i-copy" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></symbol>
  <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
</svg>

<header class="top"><div class="wrap" class:full={dash}>
  {#if dash}<button class="btn btn--sm btn--outline btn--icon menu-btn" style="width:32px" aria-label={t('side.menu')} aria-expanded={sideOpen} onclick={() => (sideOpen = !sideOpen)}><Icon name="menu" /></button>{/if}
  <a class="brand" href="/"><img src={BRAND.mark} alt="" width="28" height="28"><span class="pname hop-name-payhop">{BRAND.name}</span></a>
  {#if !dash}
    <nav class="nav" aria-label={t('nav.main')}>
      <a href="/generate" aria-current={here('/generate')}>{t('nav.generate')}</a>
      <a href="/split" aria-current={here('/split')}>{t('nav.split')}</a>
    </nav>
  {/if}
  <span class="sp"></span>
  {#if dash}<a class="btn btn--sm btn--primary" href="/generate"><Icon name="qr" /><span class="hide-sm">{t('nav.generate')}</span></a>{/if}
  <div class="menu" id="langMenu">
    <button class="btn btn--sm btn--outline" id="langBtn" bind:this={langBtn} aria-haspopup="listbox" aria-expanded={langOpen} aria-label={t('top.language')} onclick={(e) => { e.stopPropagation(); langOpen ? closeLang() : openLang(); }}>
      <Icon name="globe" /><span>{code(i18n.locale)}</span>
    </button>
    {#if langOpen}
      <div class="menu-pop" id="langPop" role="listbox" aria-label={t('top.language')} tabindex="-1" bind:this={langList} onkeydown={onLangKey}>
        {#each LOCALES as l}
          <button type="button" role="option" aria-selected={l === i18n.locale} onclick={() => { locale = l; closeLang(true); }}><span>{LOCALE_NAMES[l]}</span><span class="code">{l}</span></button>
        {/each}
      </div>
    {/if}
  </div>
  <button class="btn btn--sm btn--outline btn--icon" id="themeBtn" aria-label={t('top.theme')} style="width:32px" onclick={toggleTheme}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>
  {#if signedIn}
    <details class="acct" id="acct" bind:this={acctEl}>
      <summary aria-label={t('top.account')}><span class="av">{initials(account.name, account.email)}</span><span class="acct-name">{account.name || account.email}</span></summary>
      <div class="acct-menu">
        <span class="em">{account.email}</span>
        <a href="/account">{t('nav.dashboard')}</a>
        <a href={hubHref} rel="noopener">{t('top.hub')}</a>
        <a href={account.logoutUrl || '/auth/sso/logout'}>{t('top.signout')}</a>
      </div>
    </details>
  {:else if account.ready && account.sso}
    <a class="btn btn--sm btn--outline" id="signin" href={signInHref(path)}>{t('top.signin')}</a>
  {/if}
</div></header>

{#snippet page()}
  {#if path === '/'}<Home />
  {:else if path === '/generate'}<Generate />
  {:else if path === '/split'}<Split />
  {:else if path === '/changelog'}<Changelog />
  {:else if path === '/terms'}<Legal kind="terms" />
  {:else if path === '/privacy'}<Legal kind="priv" />
  {:else if path === '/account'}
    {#if signedIn}<Dashboard />{:else if account.ready}
      <div class="wrap nf"><h1>{t('top.signin')}</h1><a class="btn btn--primary" href={signInHref('/account')}>{t('top.signin')}</a></div>
    {/if}
  {:else}
    <div class="wrap nf"><h1>{t('nf.title')}</h1><a class="btn btn--outline" href="/">{t('nf.back')}</a></div>
  {/if}
{/snippet}

{#if dash}
  <div class="dash">
    <aside class="side" class:open={sideOpen} aria-label={t('side.menu')}>
      <nav>
        <h2>{t('side.menu')}</h2>
        <ul>
          <li><a href="/account" aria-current={here('/account')}><Icon name="home" />{t('nav.dashboard')}</a></li>
          <li><a href="/generate" aria-current={here('/generate')}><Icon name="qr" />{t('nav.generate')}</a></li>
          <li><a href="/split" aria-current={here('/split')}><Icon name="split" />{t('nav.split')}</a></li>
        </ul>
      </nav>
      <nav>
        <h2>{t('side.family')}</h2>
        <ul>
          {#each others as f}
            <li><a href={familyHref(f, true, account.hubUrl)} rel="noopener"><img src={f.mark} alt="" width="18" height="18">{f.name}</a></li>
          {/each}
        </ul>
      </nav>
      <nav class="links">
        <ul>
          <li><a href="{HUB}/help" rel="noopener">{t('ft.help')}</a></li>
          <li><a href="/terms">{t('ft.terms')}</a></li>
          <li><a href="/privacy">{t('ft.privacy')}</a></li>
          <li><a href="/changelog">{t('nav.changelog')}</a></li>
        </ul>
      </nav>
    </aside>
    <main class="dash-main">{@render page()}</main>
  </div>
{:else}
  <main>{@render page()}</main>
  <footer class="ft" id="footer"><div class="wrap">
    <div class="ft-part"><img src={FAMILY.find((f) => f.slug === "hub")?.mark} alt="" width="20" height="20"><span>{t('ft.part')} <a href={HUB} rel="noopener">Hop Easy Link</a></span></div>
    <div class="ft-cols">
      <div class="ft-brand"><a class="brand" href="/"><img src={BRAND.mark} alt="" width="28" height="28"><span class="pname hop-name-payhop">{BRAND.name}</span></a><p>{t('ft.tagline')}</p></div>
      <div><h2 class="ft-h">{t('ft.support')}</h2><ul>
        <li><a href="{HUB}/help" rel="noopener">{t('ft.help')}</a></li>
        <li><a href="{HUB}/contact" rel="noopener">{t('ft.contact')}</a></li>
        <li><a href="{HUB}/status" rel="noopener">{t('ft.status')}</a></li>
        <li><a href="/changelog">{t('nav.changelog')}</a></li>
      </ul></div>
      <div><h2 class="ft-h">{t('ft.policies')}</h2><ul>
        <li><a href="/terms">{t('ft.terms')}</a></li>
        <li><a href="/privacy">{t('ft.privacy')}</a></li>
        <li><a href="{HUB}/security" rel="noopener">{t('ft.security')}</a></li>
        <li><a href={REPO} rel="noopener">{t('ft.source')}</a></li>
      </ul></div>
      <div><h2 class="ft-h">{t('ft.family')}</h2><ul>
        {#each others as f}
          <li><a href={familyHref(f, signedIn, account.hubUrl)} rel="noopener" data-app={f.slug}><img src={f.mark} alt="" width="16" height="16">{f.name}</a></li>
        {/each}
      </ul></div>
    </div>
    <div class="ft-bottom">
      <span class="ui-switch" role="group" aria-label={t('ui.style')}>{t('ui.style')}
        <button type="button" class="toggle" aria-pressed={ui === 'hop'} onclick={() => setUi('hop')}>{t('ui.default')}</button>
        <button type="button" class="toggle" id="uiClean" aria-pressed={ui === 'clean'} onclick={() => setUi('clean')}>{t('ui.clean')}</button>
      </span>
      <p class="ft-copy">© 2026 navi-crwn · MIT License</p>
    </div>
  </div></footer>
{/if}

{#if toast}<div class="toast" role="status">{toast}</div>{/if}
