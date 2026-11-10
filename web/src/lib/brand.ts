/* The PayHop identity in ONE place. The mark, the name letters and the 3D block map may still
   change before hop-assets v9 is cut; when they do, edit this file, web/public/mark.svg,
   web/public/brand/ and nothing else. */

export const BRAND = {
  slug: 'payhop',
  name: 'PayHop',
  host: 'pay.hel.ink',
  /** brand teal for the mark and graphics; buttons use the darker accent from app.css */
  color: '#14b8a6',
  nameFont: "'Unbounded'",
  mark: '/mark.svg',
  /** the 8x8 block map of mark A ("coin with a P"): '.' empty, '#' gradient, 'w' white */
  map: ['..####..', '.#www##.', '##w##w##', '##w##w##', '##www###', '##w#####', '.#w####.', '..####..'],
  /** gradient stops for the 3D mark, 0..1 RGB, same three-point shape as the other apps */
  stops: [
    [0.176, 0.831, 0.749],
    [0.078, 0.722, 0.651],
    [0.545, 0.361, 0.965]
  ] as [number, number, number][]
};
