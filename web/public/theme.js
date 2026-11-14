/* Runs before first paint so the saved theme never flashes. An external file, not an inline
   script: the CSP has no 'unsafe-inline' for scripts. The family rule (one theme across every HOP app):
   cookie hop_theme, then this app's old localStorage key, then the system setting. The same order is in
   src/lib/prefs.js; tools/prefs.test.mjs runs both. */
try {
  var jar = document.cookie, old = null, t;
  var m = /(?:^|; )hop_theme=([^;]*)/.exec(jar);
  try { old = localStorage.getItem('hop-theme'); } catch (e) { /* no storage */ }
  if (old !== 'light' && old !== 'dark') old = null;
  if (m) t = m[1];
  else {
    t = old;
    // one-time move of an older choice into the family cookie
    if (t) document.cookie = 'hop_theme=' + t + '; path=/; max-age=31536000; SameSite=Lax' + (/(^|\.)hel\.ink$/.test(location.hostname) ? '; domain=.hel.ink; Secure' : '');
  }
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  if (/(?:^|; )hop_ui=clean(?:;|$)/.test(jar)) document.documentElement.dataset.ui = 'clean';
  // the family colour set (cookie hop_palette): classic is no attribute at all, mist and sand set data-palette. data-theme is untouched.
  var pal = /(?:^|; )hop_palette=([^;]*)/.exec(jar);
  if (pal && (pal[1] === 'mist' || pal[1] === 'sand')) document.documentElement.dataset.palette = pal[1];
} catch (e) {
  document.documentElement.dataset.theme = 'light';
}
