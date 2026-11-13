import qrcode from 'qrcode-generator';
import { clipToFit, graphemes } from './text.js';

export interface Qr {
  n: number;
  svg: string;
  isDark(r: number, c: number): boolean;
}

/** One QR as an inline SVG string (white card with a 4-module quiet zone, merged horizontal runs). */
export function makeQr(text: string, label = 'QR code'): Qr {
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (qr.isDark(r, c)) {
        const s = c;
        while (c < n && qr.isDark(r, c)) c++;
        d += `M${s + 4} ${r + 4}h${c - s}v1h-${c - s}z`;
      } else c++;
    }
  }
  const t = n + 8;
  const safe = label.replace(/[<>&"]/g, '');
  const svg = `<svg viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges" role="img" aria-label="${safe}"><rect width="${t}" height="${t}" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  return { n, svg, isDark: (r, c) => qr.isDark(r, c) };
}

export interface PngText {
  name: string;
  amount: string;
  scheme: string;
  made: string;
  check: string;
  /** set for a sample: the marker printed across the top of the picture, in the reader's language */
  sample?: string;
}

/** `s` broken into lines that fit: at spaces, and a word wider than the picture (Japanese and Chinese have no spaces) per character. Nothing is dropped. */
export function wrapLines(s: string, fits: (x: string) => boolean): string[] {
  const out: string[] = [];
  let line = '';
  for (const w of s.split(/\s+/).filter(Boolean)) {
    const next = line ? line + ' ' + w : w;
    if (fits(next)) {
      line = next;
      continue;
    }
    if (line) {
      out.push(line);
      line = '';
    }
    if (fits(w)) {
      line = w;
      continue;
    }
    for (const g of graphemes(w)) {
      if (!line || fits(line + g)) line += g;
      else {
        out.push(line);
        line = g;
      }
    }
  }
  if (line) out.push(line);
  return out;
}

/** The PNG people share: the code, then the receiver name and amount PRINTED under it. */
export function qrPng(text: string, t: PngText): Promise<Blob> {
  const q = makeQr(text);
  const cell = 8,
    pad = 4 * cell,
    side = q.n * cell + pad * 2,
    capH = 110,
    W = Math.max(side, 380);
  const cv = document.createElement('canvas');
  const g = cv.getContext('2d')!;
  // a sample carries its marker in a band above the code, wrapped to the width
  let band: string[] = [];
  if (t.sample) {
    g.font = '700 18px Inter, system-ui, sans-serif';
    band = wrapLines(t.sample, (s: string) => g.measureText(s).width <= W - 32);
  }
  const bandH = band.length ? band.length * 24 + 20 : 0,
    H = bandH + side + capH;
  cv.width = W;
  cv.height = H;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.textAlign = 'center';
  if (band.length) {
    g.fillStyle = '#b91c1c';
    g.fillRect(0, 0, W, bandH);
    g.fillStyle = '#fff';
    g.font = '700 18px Inter, system-ui, sans-serif';
    band.forEach((line, i) => g.fillText(line, W / 2, 10 + 18 + i * 24));
  }
  g.fillStyle = '#000';
  const ox = Math.round((W - side) / 2) + pad;
  const oy = bandH + pad;
  for (let r = 0; r < q.n; r++) for (let c = 0; c < q.n; c++) if (q.isDark(r, c)) g.fillRect(ox + c * cell, oy + r * cell, cell, cell);
  const top = bandH + side;
  g.fillStyle = '#12141a';
  g.font = '700 24px Inter, system-ui, sans-serif';
  const name = clipToFit(t.name, (s: string) => g.measureText(s).width <= W - 32);
  g.fillText(name, W / 2, top + 26);
  g.fillStyle = '#566074';
  g.font = '500 17px Inter, system-ui, sans-serif';
  g.fillText((t.amount ? t.amount + '  ·  ' : '') + t.scheme + '  ·  ' + t.made, W / 2, top + 56);
  g.fillText(t.check, W / 2, top + 84);
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}
