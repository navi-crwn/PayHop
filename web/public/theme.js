/* Runs before first paint so the saved theme never flashes. An external file, not an inline
   script: the CSP has no 'unsafe-inline' for scripts. */
try {
  var t = localStorage.getItem('hop-theme');
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
} catch (e) {
  document.documentElement.dataset.theme = 'light';
}
