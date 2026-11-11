/* Text helpers with no DOM. */

/** The user-perceived characters of a string (emoji with joiners, accents) so a cut never lands inside one. */
export function graphemes(s) {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s), (x) => x.segment);
  return Array.from(s); // code points: still never half of a surrogate pair
}

/** The longest start of `s` that fits (fits(text) is true), cut on whole characters, with an ellipsis when something was dropped. */
export function clipToFit(s, fits, min = 4) {
  if (fits(s)) return s;
  const g = graphemes(s);
  while (g.length > min && !fits(g.join('') + '…')) g.pop();
  return g.join('') + '…';
}
