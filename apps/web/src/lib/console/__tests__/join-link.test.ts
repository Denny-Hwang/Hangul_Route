import { APP_ORIGIN, parseJoinLink } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { QR_QUIET_ZONE, joinLinkText, qrModules, qrPath, qrViewSize, rosterJoinLink } from '../join-link';

/**
 * The class join link and its QR code on the teacher's roster (owner decision 2026-10-17): the code alone in the
 * address fragment, never a name; a class only.
 */

describe('rosterJoinLink', () => {
  it('a class with a code: the app host /join link with the code in the fragment', () => {
    const url = rosterJoinLink({ kind: 'class', code: 'ABC234', origin: APP_ORIGIN });
    expect(url).toBe('https://app.hangulroute.com/join#c=ABC234');
    const parsed = new URL(url ?? '');
    expect(parseJoinLink({ pathname: parsed.pathname, hash: parsed.hash })).toEqual({ code: 'ABC234' });
  });

  it('none for a family or a school, a class with no code yet, or a value that is not a code', () => {
    expect(rosterJoinLink({ kind: 'family', code: 'ABC234', origin: APP_ORIGIN })).toBeNull();
    expect(rosterJoinLink({ kind: 'school', code: 'ABC234', origin: APP_ORIGIN })).toBeNull();
    expect(rosterJoinLink({ kind: 'class', code: null, origin: APP_ORIGIN })).toBeNull();
    expect(rosterJoinLink({ kind: 'class', code: 'nope', origin: APP_ORIGIN })).toBeNull();
  });

  it('follows the build origin (a preview or a local host)', () => {
    expect(rosterJoinLink({ kind: 'class', code: 'ABC234', origin: 'http://localhost:4173' })).toBe('http://localhost:4173/join#c=ABC234');
  });
});

describe('joinLinkText', () => {
  it('prints the link without https://, and leaves another scheme as it is', () => {
    expect(joinLinkText('https://app.hangulroute.com/join#c=ABC234')).toBe('app.hangulroute.com/join#c=ABC234');
    expect(joinLinkText('http://localhost:4173/join#c=ABC234')).toBe('http://localhost:4173/join#c=ABC234');
  });
});

/** True when the 7 x 7 finder pattern of a QR code sits with its top-left module at (row, col). */
function finderAt(m: boolean[][], row: number, col: number): boolean {
  for (let r = 0; r < 7; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const ring = r === 0 || r === 6 || c === 0 || c === 6;
      const core = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      if (m[row + r]?.[col + c] !== (ring || core)) return false;
    }
  }
  return true;
}

describe('qrModules', () => {
  const link = 'https://app.hangulroute.com/join#c=ABC234';

  it('a square code of version 3 (29 modules) for a join link, with error correction M', () => {
    const m = qrModules(link);
    expect(m).toHaveLength(29);
    for (const row of m) expect(row).toHaveLength(29);
  });

  it('has the three finder patterns and the timing patterns of a QR code', () => {
    const m = qrModules(link);
    const n = m.length;
    expect(finderAt(m, 0, 0)).toBe(true);
    expect(finderAt(m, 0, n - 7)).toBe(true);
    expect(finderAt(m, n - 7, 0)).toBe(true);
    expect(finderAt(m, n - 7, n - 7)).toBe(false);
    for (let i = 8; i < n - 8; i += 1) {
      expect(m[6]?.[i], `row 6, col ${i}`).toBe(i % 2 === 0);
      expect(m[i]?.[6], `col 6, row ${i}`).toBe(i % 2 === 0);
    }
  });

  it('is the same code for the same text, and another code for another code', () => {
    expect(qrModules(link)).toEqual(qrModules(link));
    expect(qrModules(link)).not.toEqual(qrModules('https://app.hangulroute.com/join#c=XYZ789'));
  });
});

describe('qrPath and qrViewSize', () => {
  it('draws each run of dark modules as one rectangle, offset by the quiet zone', () => {
    const m = [
      [true, true, false, true],
      [false, false, false, false],
      [true, true, true, true],
    ];
    expect(qrPath(m)).toBe('M4 4h2v1h-2zM7 4h1v1h-1zM4 6h4v1h-4z');
    expect(qrPath(m, 0)).toBe('M0 0h2v1h-2zM3 0h1v1h-1zM0 2h4v1h-4z');
    expect(qrPath([[false, false]])).toBe('');
  });

  it('a viewBox of the code and four quiet modules on each side', () => {
    expect(QR_QUIET_ZONE).toBe(4);
    expect(qrViewSize(29)).toBe(37);
    expect(qrViewSize(21, 2)).toBe(25);
  });

  it('a real code: one rectangle per dark run, every one inside the viewBox', () => {
    const m = qrModules('https://app.hangulroute.com/join#c=ABC234');
    const path = qrPath(m);
    const runs = m.reduce((sum, row) => sum + row.filter((dark, i) => dark && !row[i - 1]).length, 0);
    expect(path.match(/M/g)).toHaveLength(runs);
    const view = qrViewSize(m.length);
    for (const [, x, y, w] of path.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
      expect(Number(x) + Number(w)).toBeLessThanOrEqual(view - QR_QUIET_ZONE);
      expect(Number(y)).toBeLessThan(view - QR_QUIET_ZONE);
      expect(Number(x)).toBeGreaterThanOrEqual(QR_QUIET_ZONE);
    }
  });
});
