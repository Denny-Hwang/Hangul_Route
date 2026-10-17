import { joinLinkUrl } from '@hangul-route/content-schema';
import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { QR_QUIET_ZONE, qrModules, qrPath, qrViewSize } from '../join-link';

/**
 * The roster's QR code reads back as the join link (review of #734): the drawn SVG path, rasterized the way a screen
 * shows it (dark modules on a light ground, with the quiet zone), is decoded with a QR reader (jsQR, a pinned dev
 * dependency) and must give the exact link. The matrix-shape tests in join-link.test.ts cannot show that the code
 * scans; this one does, on every CI run (the browser BarcodeDetector check in apps/web/e2e/join-link.spec.ts runs
 * only where the browser has one).
 */

const PX = 4;

/** The join link for a valid code (joinLinkUrl is null only for a code that is not one). */
function linkFor(origin: string, code: string): string {
  const url = joinLinkUrl(origin, code);
  if (url === null) throw new Error(`not a join code: ${code}`);
  return url;
}

/** The dark modules the drawn path paints: each `M x y h n v 1 h -n z` is one run of n modules on row y. */
function modulesOfPath(path: string, view: number): boolean[][] {
  const grid = Array.from({ length: view }, () => Array.from({ length: view }, () => false));
  const run = /M(\d+) (\d+)h(\d+)v1h-(\d+)z/g;
  let matched = '';
  for (let m = run.exec(path); m !== null; m = run.exec(path)) {
    matched += m[0];
    const [x, y, n] = [Number(m[1]), Number(m[2]), Number(m[3])];
    expect(Number(m[4])).toBe(n);
    for (let i = 0; i < n; i += 1) (grid[y] as boolean[])[x + i] = true;
  }
  // Every command of the path is a run of this shape: nothing drawn is left unread.
  expect(matched).toBe(path);
  return grid;
}

/** RGBA pixels of a module grid, `PX` pixels per module: black on white. */
function pixels(grid: readonly (readonly boolean[])[]): { data: Uint8ClampedArray; side: number } {
  const side = grid.length * PX;
  const data = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const dark = grid[Math.floor(y / PX)]?.[Math.floor(x / PX)] === true;
      const at = (y * side + x) * 4;
      const shade = dark ? 0 : 255;
      data[at] = shade;
      data[at + 1] = shade;
      data[at + 2] = shade;
      data[at + 3] = 255;
    }
  }
  return { data, side };
}

function decodeDrawn(url: string): string | null {
  const modules = qrModules(url);
  const view = qrViewSize(modules.length);
  const drawn = modulesOfPath(qrPath(modules), view);
  const { data, side } = pixels(drawn);
  return jsQR(data, side, side, { inversionAttempts: 'dontInvert' })?.data ?? null;
}

describe('the drawn join link QR code scans as the link', () => {
  it.each([
    ['the app host', 'https://app.hangulroute.com', 'ABC234'],
    ['a preview host', 'https://preview-123.hangul-route.pages.dev', 'K7Q2MX'],
    ['a local build', 'http://localhost:8081', 'XYZ789'],
  ])('%s', (_name, origin, code) => {
    const url = linkFor(origin, code);
    expect(decodeDrawn(url)).toBe(url);
  });

  it('the path paints exactly the dark modules, offset by the quiet zone, and the quiet zone stays light', () => {
    const url = linkFor('https://app.hangulroute.com', 'ABC234');
    const modules = qrModules(url);
    const view = qrViewSize(modules.length);
    const drawn = modulesOfPath(qrPath(modules), view);
    for (let y = 0; y < view; y += 1) {
      for (let x = 0; x < view; x += 1) {
        const inside = x >= QR_QUIET_ZONE && y >= QR_QUIET_ZONE && x < QR_QUIET_ZONE + modules.length && y < QR_QUIET_ZONE + modules.length;
        const want = inside ? modules[y - QR_QUIET_ZONE]?.[x - QR_QUIET_ZONE] === true : false;
        expect(drawn[y]?.[x], `${x},${y}`).toBe(want);
      }
    }
  });
});
