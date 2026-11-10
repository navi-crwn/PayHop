/* The other HOP apps (hop-assets v8 manifest, current app omitted). Written out rather than
   fetched: the page loads nothing from another origin. tools/family.test.mjs checks this list
   against tools/hop-apps.json. */

export interface FamilyApp {
  slug: string;
  name: string;
  url: string;
  host: string;
  mark: string;
  tile: string;
}

const A = '/hop-assets/v8';

export const FAMILY: FamilyApp[] = [
  { slug: 'hub', name: 'HOP ID', url: 'https://hel.ink', host: 'hel.ink', mark: `${A}/apps/hub/hop-id-mark.svg`, tile: 'hub' },
  { slug: 'linkhop', name: 'LinkHop', url: 'https://link.hel.ink', host: 'link.hel.ink', mark: `${A}/apps/linkhop/mark.svg`, tile: 'linkhop' },
  { slug: 'biohop', name: 'BioHop', url: 'https://bio.hel.ink', host: 'bio.hel.ink', mark: `${A}/apps/biohop/mark.svg`, tile: 'biohop' },
  { slug: 'pixelhop', name: 'PixelHop', url: 'https://pixel.hel.ink', host: 'pixel.hel.ink', mark: `${A}/apps/pixelhop/mark.svg`, tile: 'pixelhop' },
  { slug: 'notehop', name: 'NoteHop', url: 'https://note.hel.ink', host: 'note.hel.ink', mark: `${A}/apps/notehop/mark.svg`, tile: 'notehop' },
  { slug: 'filehop', name: 'FileHop', url: 'https://file.hel.ink', host: 'file.hel.ink', mark: `${A}/apps/filehop/mark.svg`, tile: 'filehop' }
];

/** Signed in through the hub, another app opens through the hub's launcher, which signs the person
    in there too; signed out, the public address is the right one. */
export function familyHref(app: FamilyApp, signedIn: boolean, hubUrl: string): string {
  if (!signedIn || !hubUrl) return app.url;
  const hub = hubUrl.replace(/\/+$/, '');
  return app.slug === 'hub' ? `${hub}/dashboard` : `${hub}/apps/${app.slug}`;
}
