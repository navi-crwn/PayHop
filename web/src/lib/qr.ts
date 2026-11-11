import qrcode from 'qrcode-generator';
import { clipToFit } from './text.js';

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
}

/** The PNG people share: the code, then the receiver name and amount PRINTED under it. */
export function qrPng(text: string, t: PngText): Promise<Blob> {
  const q = makeQr(text);
  const cell = 8,
    pad = 4 * cell,
    side = q.n * cell + pad * 2,
    capH = 110,
    W = Math.max(side, 380),
    H = side + capH;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#000';
  const ox = Math.round((W - side) / 2) + pad;
  for (let r = 0; r < q.n; r++) for (let c = 0; c < q.n; c++) if (q.isDark(r, c)) g.fillRect(ox + c * cell, pad + r * cell, cell, cell);
  g.textAlign = 'center';
  g.fillStyle = '#12141a';
  g.font = '700 24px Inter, system-ui, sans-serif';
  const name = clipToFit(t.name, (s: string) => g.measureText(s).width <= W - 32);
  g.fillText(name, W / 2, side + 26);
  g.fillStyle = '#566074';
  g.font = '500 17px Inter, system-ui, sans-serif';
  g.fillText((t.amount ? t.amount + '  ·  ' : '') + t.scheme + '  ·  ' + t.made, W / 2, side + 56);
  g.fillText(t.check, W / 2, side + 84);
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'));
}
