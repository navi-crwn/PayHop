<script lang="ts">
  import { onMount } from 'svelte';
  import { i18n, guessLocale, LOCALES, LOCALE_NAMES } from './lib/i18n/index.svelte';
  import { account, loadAccount, initials, takeAuthError, takeRecheckMark, recheckQuietly, signInHref } from './lib/account.svelte';
  import { recheckAction } from './lib/recheck.js';
  import { route, startRouter, known } from './lib/router.svelte';
  import { readTheme as readThemePref, saveTheme, saveLang, langFromQuery, browserCtx } from './lib/prefs.js';
  import { BRAND } from './lib/brand';
  import { FAMILY, familyHref } from './lib/family';
  import Icon from './lib/Icon.svelte';
  import FamilySwitcher from './lib/FamilySwitcher.svelte';
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
    return readThemePref({ ...browserCtx(), prefersDark: matchMedia('(prefers-color-scheme: dark)').matches }) as 'dark' | 'light';
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
    saveTheme(browserCtx(), theme);
  }
  $effect(() => {
    document.documentElement.dataset.theme = theme;
  });

  // the address search engines should keep for this page, and no index for the signed-in page
  $effect(() => {
    const p = known(route.path) ? route.path : '/';
    // English lives at the bare address; a page asked for in another language has its own (?lang=, as the server wrote it)
    const q = langFromQuery(location.search);
    void locale;
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://' + BRAND.host + (p === '/' ? '/' : p) + (q && q !== 'en' ? '?lang=' + q : ''));
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

  // the title and description the server sends for each public page (internal/app/pages.go), in the reader's language
  const PAGE_HEAD: Record<string, [string, string]> = {
    '/generate': ['gen.title', 'gen.sub'],
    '/split': ['split.title', 'split.sub'],
    '/changelog': ['cl.title', 'cl.sub'],
    '/terms': ['terms.t', 'terms.p1'],
    '/privacy': ['priv.t', 'priv.p1']
  };
  $effect(() => {
    const head = PAGE_HEAD[route.path];
    void i18n.load(locale).then(() => {
      document.title = head ? t(head[0]) + ' — ' + BRAND.name : t('app.title');
      document.querySelector('meta[name="description"]')?.setAttribute('content', t(head ? head[1] : 'app.desc'));
    });
  });

  // an address that names its language follows the reader's new choice, so a shared or bookmarked link says what the page shows
  function keepLangInAddress(l: string) {
    if (langFromQuery(location.search) === null) return;
    const u = new URL(location.href);
    u.searchParams.set('lang', l);
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
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
  // signed in, every page but the public home page lives inside the dashboard chrome (the info pages too, so
  // the sidebar is the way back); guests and search engines get the public frame
  const dash = $derived(signedIn && known(path) && path !== '/');
  // the logo and the "back" button lead a signed-in person to the dashboard, a guest to the public start page
  const homeHref = $derived(signedIn ? '/account' : '/');
  const hubHref = $derived(signedIn && account.hubUrl ? account.hubUrl.replace(/\/+$/, '') + '/dashboard' : HUB);
  const others = FAMILY;
  const here = (p: string) => (path === p ? 'page' : undefined);
  // the page title the dashboard bar shows (keys that already exist; each page keeps its own heading below)
  const TITLE: Record<string, string> = { '/account': 'nav.dashboard', '/generate': 'nav.generate', '/split': 'nav.split', '/changelog': 'cl.title', '/terms': 'terms.t', '/privacy': 'priv.t' };
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
  <symbol id="i-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></symbol>
  <symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
  <symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></symbol>
</svg>

{#snippet tools()}
  <div class="menu" id="langMenu">
    <button class="btn btn--sm btn--outline" id="langBtn" bind:this={langBtn} aria-haspopup="listbox" aria-expanded={langOpen} aria-label={t('top.language')} onclick={(e) => { e.stopPropagation(); langOpen ? closeLang() : openLang(); }}>
      <Icon name="globe" /><span>{code(i18n.locale)}</span>
    </button>
    {#if langOpen}
      <div class="menu-pop" id="langPop" role="listbox" aria-label={t('top.language')} tabindex="-1" bind:this={langList} onkeydown={onLangKey}>
        {#each LOCALES as l}
          <button type="button" role="option" aria-selected={l === i18n.locale} onclick={() => { locale = l; saveLang(browserCtx(), l); keepLangInAddress(l); closeLang(true); }}><span>{LOCALE_NAMES[l]}</span><span class="code">{l}</span></button>
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
{/snippet}

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
    <div class="wrap nf"><h1>{t('nf.title')}</h1><a class="btn btn--outline" href={homeHref}>{t('nf.back')}</a></div>
  {/if}
{/snippet}

{#snippet partOf()}
  <div class="ft-part"><img src={FAMILY.find((f) => f.slug === "hub")?.mark} alt="" width="20" height="20"><span>{t('ft.part')} <a href={HUB} rel="noopener">Hop Easy Link</a></span></div>
{/snippet}

{#if dash}
  <div class="shell" class:open={sideOpen}>
    <aside class="shell-side" id="shell-side" aria-label={t('side.menu')}>
      <a class="shell-brand" href={homeHref}><img src={BRAND.mark} alt="" width="26" height="26"><span class="pname hop-name-payhop">{BRAND.name}</span></a>
      <nav class="shell-nav" aria-label={t('side.menu')}>
        <a href="/account" aria-current={here('/account')}><Icon name="home" />{t('nav.dashboard')}</a>
        <a href="/generate" aria-current={here('/generate')}><Icon name="qr" />{t('nav.generate')}</a>
        <a href="/split" aria-current={here('/split')}><Icon name="split" />{t('nav.split')}</a>
      </nav>
      <p class="shell-label">{t('side.family')}</p>
      <nav class="shell-nav" aria-label={t('side.family')}>
        {#each others as f}
          <a href={familyHref(f, true, account.hubUrl)} rel="noopener"><img src={f.mark} alt="" width="18" height="18">{f.name}</a>
        {/each}
      </nav>
      <nav class="shell-side-foot links">
        <ul>
          <li><a href="{HUB}/help" rel="noopener">{t('ft.help')}</a></li>
          <li><a href="/terms" aria-current={here('/terms')}>{t('ft.terms')}</a></li>
          <li><a href="/privacy" aria-current={here('/privacy')}>{t('ft.privacy')}</a></li>
          <li><a href="/changelog" aria-current={here('/changelog')}>{t('nav.changelog')}</a></li>
        </ul>
      </nav>
      {@render partOf()}
    </aside>
    {#if sideOpen}<div class="shell-scrim" onclick={() => (sideOpen = false)} role="presentation"></div>{/if}
    <div class="shell-body">
      <header class="shell-top">
        <button class="btn btn--sm btn--outline btn--icon shell-burger" type="button" style="width:32px" aria-label={t('side.menu')} aria-controls="shell-side" aria-expanded={sideOpen} onclick={() => (sideOpen = !sideOpen)}><Icon name={sideOpen ? 'x' : 'menu'} /></button>
        <p class="shell-title">{t(TITLE[path] ?? 'nav.dashboard')}</p>
        <span class="sp"></span>
        <a class="btn btn--sm btn--primary" href="/generate"><Icon name="qr" /><span class="hide-sm">{t('nav.generate')}</span></a>
        {@render tools()}
      </header>
      <main class="shell-main">{@render page()}</main>
    </div>
  </div>
{:else}
  <header class="top"><div class="wrap">
    <a class="brand" href={homeHref}><img src={BRAND.mark} alt="" width="28" height="28"><span class="pname hop-name-payhop">{BRAND.name}</span></a>
    <nav class="nav" aria-label={t('nav.main')}>
      <a href="/generate" aria-current={here('/generate')}>{t('nav.generate')}</a>
      <a href="/split" aria-current={here('/split')}>{t('nav.split')}</a>
    </nav>
    <span class="sp"></span>
    <FamilySwitcher />
    {@render tools()}
  </div></header>
  <main>{@render page()}</main>
  <footer class="ft" id="footer"><div class="wrap">
    {@render partOf()}
    <div class="ft-cols">
      <div class="ft-brand"><a class="brand" href={homeHref}><img src={BRAND.mark} alt="" width="28" height="28"><span class="pname hop-name-payhop">{BRAND.name}</span></a><p>{t('ft.tagline')}</p></div>
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
