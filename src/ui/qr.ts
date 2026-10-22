import { encode } from 'uqr';

/**
 * A QR code as SVG markup (decision 0066). Medium error correction: phones read it off a
 * glossy tablet screen with glare. Dark modules on white with a 4-module quiet zone, the
 * contrast every scanner (and the camera apps) expects.
 */
export function qrSvg(text: string): { svg: string; size: number; version: number } {
  const qr = encode(text, { ecc: 'L', border: 4 });
  let d = '';
  qr.data.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`;
    });
  });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${qr.size} ${qr.size}" ` +
    `shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/>` +
    `<path d="${d}" fill="#0b2231"/></svg>`;
  return { svg, size: qr.size, version: qr.version };
}
