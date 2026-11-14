<script lang="ts">
  /* A small button in the public top bar that opens the other HOP apps: HOP ID first, then the rest
     (the current app is left out, see family.ts). Same look and keys as the picker in NoteHop and PixelHop.
     Signed in, the family list lives in the dashboard sidebar instead, so App.svelte does not draw this. */
  import { i18n } from './i18n/index.svelte';
  import { account } from './account.svelte';
  import { FAMILY, familyHref } from './family';
  import Icon from './Icon.svelte';

  let box = $state<HTMLDetailsElement>();

  const signedIn = $derived(account.ready && account.signedIn);

  function close(refocus = false) {
    if (!box?.open) return;
    box.open = false;
    if (refocus) box.querySelector<HTMLElement>('summary')?.focus();
  }
  function onKey(e: KeyboardEvent) {
    if (!box?.open) return;
    if (e.key === 'Escape') {
      close(true);
      e.preventDefault();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key) || !box.contains(e.target as Node)) return;
    const links = [...box.querySelectorAll<HTMLElement>('a')];
    let i = links.indexOf(document.activeElement as HTMLElement);
    i = e.key === 'Home' ? 0 : e.key === 'End' ? links.length - 1 : e.key === 'ArrowDown' ? (i + 1) % links.length : (i <= 0 ? links.length : i) - 1;
    links[i]?.focus();
    e.preventDefault();
  }
  function onDocClick(e: MouseEvent) {
    if (box?.open && !box.contains(e.target as Node)) close();
  }
</script>

<svelte:document onclick={onDocClick} onkeydown={onKey} />

<details class="family-switcher" bind:this={box}>
  <summary class="btn btn--sm btn--outline btn--icon" aria-label={i18n.t('side.family')} title={i18n.t('side.family')}><Icon name="grid" /></summary>
  <nav aria-label={i18n.t('side.family')}>
    {#each FAMILY as f}
      <a href={familyHref(f, signedIn, account.hubUrl)} rel="noopener" data-app={f.slug}><img src={f.mark} alt="" width="28" height="28">{f.name}</a>
    {/each}
  </nav>
</details>
