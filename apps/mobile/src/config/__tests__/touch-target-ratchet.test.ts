import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUDIT_SCREENS,
  AUDIT_VIEWPORTS,
  isOffender,
  offenderKey,
  TARGET_MIN,
  ratchet,
  viewportKey,
  type TouchTargetAllowlist,
} from '../../../e2e/web/target-audit';

/**
 * F-LAYOUT-001 §3.8 / PR 7: the touch-target ratchet. The web e2e
 * `target-size.spec.ts` measures every button, link and checkbox on Home,
 * Journey, Library and Profile and compares the ones under 64 pt with
 * `e2e/web/fixtures/touch-target-allowlist.json`. A new offender fails; a fixed
 * one must leave the list, so the list can only shrink. These tests pin the
 * comparison and the list's shape without a browser.
 */
const ROOT = join(__dirname, '..', '..', '..');
const allowlist = JSON.parse(
  readFileSync(join(ROOT, 'e2e', 'web', 'fixtures', 'touch-target-allowlist.json'), 'utf8'),
) as TouchTargetAllowlist;

describe('ratchet', () => {
  it('passes when the offenders are exactly the allowed ones, in any order and with repeats', () => {
    expect(ratchet(['b', 'a', 'a'], ['a', 'b'])).toEqual({ added: [], gone: [] });
  });

  it('reports a new offender as added', () => {
    expect(ratchet(['a', 'c'], ['a'])).toEqual({ added: ['c'], gone: [] });
  });

  it('reports a fixed offender that is still listed as gone, so the list shrinks', () => {
    expect(ratchet(['a'], ['a', 'b'])).toEqual({ added: [], gone: ['b'] });
  });

  it('sorts both lists so the failure message is stable', () => {
    expect(ratchet(['z', 'y'], ['x', 'w'])).toEqual({ added: ['y', 'z'], gone: ['w', 'x'] });
  });
});

describe('isOffender', () => {
  it('uses touchTarget.min (64) as the floor', () => {
    expect(TARGET_MIN).toBe(64);
  });

  it('is an offender when either side is under the floor', () => {
    expect(isOffender({ width: 720, height: 43 })).toBe(true);
    expect(isOffender({ width: 36, height: 36 })).toBe(true);
    expect(isOffender({ width: 54, height: 120 })).toBe(true);
  });

  it('is not an offender at exactly the floor, or a sub-pixel under it', () => {
    expect(isOffender({ width: 64, height: 64 })).toBe(false);
    expect(isOffender({ width: 76, height: 63.6 })).toBe(false);
    expect(isOffender({ width: 76, height: 63.4 })).toBe(true);
  });
});

describe('offenderKey and viewportKey', () => {
  it('joins screen, role and name', () => {
    expect(offenderKey({ screen: 'Library', role: 'button', name: 'Letters' })).toBe('Library | button | Letters');
  });

  it('names a viewport WIDTHxHEIGHT', () => {
    expect(viewportKey({ width: 768, height: 1024 })).toBe('768x1024');
  });
});

describe('the audit walks what the spec names (§3.8)', () => {
  it('at 768x1024, 1180x820 and 375x667', () => {
    expect(AUDIT_VIEWPORTS.map(viewportKey)).toEqual(['768x1024', '1180x820', '375x667']);
  });

  it('on Home, Journey, Library and Profile', () => {
    expect(AUDIT_SCREENS).toEqual(['Home', 'Journey', 'Library', 'Profile']);
  });
});

describe('touch-target-allowlist.json', () => {
  const entries = Object.entries(allowlist.offenders);

  it('has one list per audited viewport and nothing else', () => {
    expect(Object.keys(allowlist.offenders).sort()).toEqual(AUDIT_VIEWPORTS.map(viewportKey).sort());
  });

  it.each(entries)('%s: every entry is "Screen | role | name" on an audited screen', (_vp, list) => {
    const shape = new RegExp(`^(${AUDIT_SCREENS.join('|')}) \\| (button|link|checkbox) \\| \\S.*$`);
    for (const entry of list) expect(entry).toMatch(shape);
  });

  it.each(entries)('%s: entries are sorted and unique, so a diff shows exactly what changed', (_vp, list) => {
    expect([...new Set(list)].sort()).toEqual(list);
  });
});
