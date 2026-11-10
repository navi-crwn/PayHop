/* A tiny History API router: a path, and a click handler that keeps same-origin links in the app.
   The Go server answers every extension-less path with the shell, so deep links work. */

export const ROUTES = ['/', '/generate', '/split', '/account', '/changelog', '/terms', '/privacy'] as const;

export const route = $state({ path: normalize(location.pathname) });

function normalize(p: string): string {
  const clean = p.replace(/\/+$/, '') || '/';
  return clean;
}

export function known(p: string): boolean {
  return (ROUTES as readonly string[]).includes(p);
}

export function go(path: string): void {
  const url = new URL(path, location.origin);
  history.pushState(null, '', url.pathname + url.search + url.hash);
  route.path = normalize(url.pathname);
  window.scrollTo(0, 0);
}

export function startRouter(): () => void {
  const onPop = () => (route.path = normalize(location.pathname));
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.('a');
    if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin) return;
    if (/^\/(auth|api|hop)\//.test(a.pathname)) return;
    if (!known(normalize(a.pathname))) return;
    e.preventDefault();
    go(a.pathname + a.search + a.hash);
  };
  window.addEventListener('popstate', onPop);
  document.addEventListener('click', onClick);
  return () => {
    window.removeEventListener('popstate', onPop);
    document.removeEventListener('click', onClick);
  };
}
