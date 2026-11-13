<script lang="ts">
  import { onMount } from 'svelte';
  import { i18n } from '../i18n/index.svelte';
  import { account } from '../account.svelte';
  import { BRAND } from '../brand';
  import { FAMILY, familyHref, tileSrc } from '../family';
  import Icon from '../Icon.svelte';

  const t = (k: string) => i18n.t(k);
  const FORMATS = [
    ['PayPal.me', 'world', 'paypal'],
    ['Cash App', 'us', 'cashapp'],
    ['Venmo', 'us', 'venmo'],
    ['Solana Pay', 'world', 'solana'],
    ['UPI', 'in', 'upi'],
    ['EPC SEPA', 'eu', 'epc'],
    ['PromptPay', 'th', 'promptpay'],
    ['VietQR', 'vn', 'vietqr']
  ];
  const LATER = ['QRIS', 'Pix', 'PayNow'];
  const TILES = FAMILY.filter((f) => f.slug !== 'hub');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let canvas: HTMLCanvasElement | undefined = $state();
  // the hero says "no JS 3D yet" until the engine has really drawn; the still image shows until then
  let live = $state(false);

  /** Bento boxes fade in once, and their scene runs only while on screen (reduced motion: shown still). */
  function reveal(node: HTMLElement) {
    if (reduce || !('IntersectionObserver' in window)) {
      node.classList.add('in');
      return;
    }
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) node.classList.add('in');
          if (node.hasAttribute('data-scene')) node.classList.toggle('is-live', e.isIntersecting);
        }
      },
      { threshold: 0.25 }
    );
    io.observe(node);
    return { destroy: () => io.disconnect() };
  }

  onMount(() => {
    if (reduce) return;
    let cancelled = false;
    const start = () => {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const H = (window as any).HopHero3D;
          if (cancelled || !H || !canvas) return;
          try {
            H.mount(canvas, { preset: BRAND.slug, interactive: true }); // the block map and colours are in the v9 engine
            live = true;
          } catch {
            /* the still image stays */
          }
        })
      );
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener('load', start);
    };
  });
</script>

<section class="hero"><div class="wrap">
  <div>
    <h1 class="big">{t('hero.h1_pre')} <em>{t('hero.h1_accent')}</em></h1>
    <p class="lede">{t('hero.lede')}</p>
    <div class="cta">
      <a class="btn btn--primary btn--lg" href="/generate"><Icon name="qr" />{t('hero.cta_qr')}</a>
      <a class="btn btn--outline btn--lg" href="/split"><Icon name="split" />{t('hero.cta_split')}</a>
    </div>
    <p class="proof"><Icon name="shield" />{t('hero.proof')}</p>
    <p class="sample-line" id="sampleLine">{t('home.sample_pre')} <a href="/generate?sample=1">{t('home.sample_link')}</a></p>
  </div>
  <figure class="hero-art" aria-hidden="true" style="margin:0">
    <img class="still lt" src={BRAND.still.light} alt="" width="380" height="380"><img class="still dk" src={BRAND.still.dark} alt="" width="380" height="380">
    <canvas bind:this={canvas} class:on={live}></canvas>
  </figure>
</div></section>

<section class="blk"><div class="wrap">
  <div class="sec-head"><h2 class="sec">{t('home.s1_pre')} <em>{t('home.s1_accent')}</em> {t('home.s1_post')}</h2><p class="sec-sub">{t('home.s1_sub')}</p></div>
  <div class="bento">
    <article class="box" data-rv data-scene use:reveal style="--i:0"><div class="scene"><div class="sc-fmt">
      {#each FORMATS as f, k}<span class="chip" style="--k:{k}">{f[0]}</span>{/each}</div></div>
      <h3>{t('home.b1_t')}</h3><p>{t('home.b1_p')}</p></article>
    <article class="box" data-rv data-scene use:reveal style="--i:1"><div class="scene"><div class="sc-name"><div class="nm">Café Ana<s> &lrm;moc.xyz</s></div><span class="chip chip--brand">{t('home.b2_chip')}</span></div></div>
      <h3>{t('home.b2_t')}</h3><p>{t('home.b2_p')}</p></article>
    <article class="box" data-rv data-scene use:reveal style="--i:2"><div class="scene"><div class="sc-split">
      <div class="br"><span>A</span><div class="track"><i style="--w:100%;--k:0"></i></div><span class="num mono">34.00</span></div>
      <div class="br"><span>B</span><div class="track"><i style="--w:97%;--k:1"></i></div><span class="num mono">33.00</span></div>
      <div class="br"><span>C</span><div class="track"><i style="--w:97%;--k:2"></i></div><span class="num mono">33.00</span></div>
      <div class="sum num">= 100.00</div></div></div>
      <h3>{t('home.b3_t')}</h3><p>{t('home.b3_p')}</p></article>
    <article class="box" data-rv data-scene use:reveal style="--i:3"><div class="scene"><div class="sc-net"><span class="node">{t('home.b4_tab')}</span><span class="wire"><i class="dot"></i></span><span class="wall"></span><span class="node">{t('home.b4_server')}</span></div></div>
      <h3>{t('home.b4_t')}</h3><p>{t('home.b4_p')}</p></article>
    <article class="box" data-rv data-scene use:reveal style="--i:4"><div class="scene"><div class="sc-fields">
      <div class="f"><span>{t('home.b5_name')}</span><span class="chip chip--brand">{t('home.b5_asked')}</span></div>
      <div class="f x" style="--k:0"><span>{t('home.b5_card')}</span><span>{t('home.b5_never')}</span></div>
      <div class="f x" style="--k:1"><span>CVV</span><span>{t('home.b5_never')}</span></div></div></div>
      <h3>{t('home.b5_t')}</h3><p>{t('home.b5_p')}</p></article>
    <article class="box" data-rv data-scene use:reveal style="--i:5"><div class="scene"><div class="sc-honest"><div class="dots"><i style="--k:0"></i><i style="--k:1"></i><i style="--k:2"></i><i style="--k:3"></i><i style="--k:4"></i><i style="--k:5"></i></div><span class="cap">{t('home.b6_cap')}</span></div></div>
      <h3>{t('home.b6_t')}</h3><p>{t('home.b6_p')}</p></article>
  </div>
</div></section>

<section class="blk" style="padding-top:8px"><div class="wrap">
  <div class="sec-head"><h2 class="sec">{t('home.s2_pre')} <em>{t('home.s2_accent')}</em></h2></div>
  <table class="tbl">
    <thead><tr><th>{t('home.th_format')}</th><th>{t('home.th_where')}</th><th>{t('home.th_holds')}</th><th>{t('home.th_test')}</th></tr></thead>
    <tbody>
      {#each FORMATS as f}
        <tr><td>{f[0]}</td><td>{t('home.where_' + f[1])}</td><td>{t('home.holds_' + f[2])}</td><td><span class="chip chip--warn">{t('home.untested')}</span></td></tr>
      {/each}
    </tbody>
  </table>
  <p class="later"><span>{t('home.later')}</span>{#each LATER as l}<span class="chip">{l}</span>{/each}</p>
</div></section>

<section class="blk" style="padding-top:8px"><div class="wrap">
  <div class="sec-head"><h2 class="sec">{t('home.s3_pre')} <em>{t('home.s3_accent')}</em></h2><p class="sec-sub">{t('home.s3_sub')}</p></div>
  <div class="fam">
    {#each TILES as f}
      <a class="tile" href={familyHref(f, account.signedIn, account.hubUrl)} rel="noopener">
        <img class="lt" src={tileSrc(f, 'light')} alt="" width="168" height="168" loading="lazy">
        <img class="dk" src={tileSrc(f, 'dark')} alt="" width="168" height="168" loading="lazy">
        <span class="nm">{f.name}</span><span class="host">{f.host}</span>
      </a>
    {/each}
  </div>
</div></section>
