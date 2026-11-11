/* The PayHop identity as far as this app owns it. The mark, the name letters, the app icons and the 3D block map
   are part of hop-assets v9 (public/hop-assets/v9, vendored byte for byte from the hub): this file only points at
   them. Nothing about the mark or the name font is kept anywhere else in the repository. */

export const BRAND = {
  slug: 'payhop',
  name: 'PayHop',
  host: 'pay.hel.ink',
  /** brand teal for the mark and graphics; buttons use the darker accent from app.css */
  color: '#14b8a6',
  mark: '/hop-assets/v9/apps/payhop/mark.svg',
  /** the still the hero shows until the 3D engine has drawn (light and dark) */
  still: { light: '/hop-assets/v9/home/payhop-light.webp', dark: '/hop-assets/v9/home/payhop-dark.webp' }
};
