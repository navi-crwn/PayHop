/* The other HOP apps, read from the hop-assets manifest (tools/hop-apps.json, a byte copy of the hub's
   apps.json) when the app is built: no list is written out by hand here. The current app and the apps that are
   not public (Imperium) are left out. Marks and tiles point at the files vendored under /hop-assets/<version>/;
   tools/family.test.mjs checks that every one of them exists. */

import manifest from '../../../tools/hop-apps.json';

export interface FamilyApp {
  slug: string;
  name: string;
  url: string;
  host: string;
  mark: string;
  tile: string;
}

interface ManifestApp {
  slug: string;
  name: string;
  url: string;
  public?: boolean;
  icons: { mark: { url: string } };
}

/** https://hel.ink/hop-assets/v9/apps/x/mark.svg -> /hop-assets/v9/apps/x/mark.svg (the vendored copy). */
const local = (url: string) => new URL(url).pathname;

export const ASSET_VERSION: string = manifest.version;

export const FAMILY: FamilyApp[] = (manifest.apps as unknown as ManifestApp[])
  .filter((a) => a.public !== false && a.slug !== 'payhop')
  .map((a) => ({
    slug: a.slug,
    name: a.name,
    url: a.url.replace(/\/$/, ''),
    host: new URL(a.url).hostname,
    mark: local(a.icons.mark.url),
    tile: a.slug
  }));

/** The tile image of an app on the home page: `light` or `dark`. */
export const tileSrc = (f: FamilyApp, scheme: 'light' | 'dark') => `/hop-assets/${ASSET_VERSION}/home/${f.tile}-${scheme}.webp`;

/** Signed in through the hub, another app opens through the hub's launcher, which signs the person
    in there too; signed out, the public address is the right one. */
export function familyHref(app: FamilyApp, signedIn: boolean, hubUrl: string): string {
  if (!signedIn || !hubUrl) return app.url;
  const hub = hubUrl.replace(/\/+$/, '');
  return app.slug === 'hub' ? `${hub}/dashboard` : `${hub}/apps/${app.slug}`;
}
