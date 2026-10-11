import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AUDIT_SCREENS,
  AUDIT_VIEWPORTS,
  isOffender,
  occurrenceKeys,
  offenderKey,
  TARGET_MIN,
  TARGET_ROLES,
  ratchet,
  settleSignature,
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

describe('occurrenceKeys', () => {
  it('keeps a key that appears once as it is', () => {
    expect(occurrenceKeys(['Library | button | All', 'Library | button | Food'])).toEqual([
      'Library | button | All',
      'Library | button | Food',
    ]);
  });

  it('numbers repeats in document order, so a second small control with the same name is its own offender', () => {
    expect(occurrenceKeys(['Profile | button | Go back', 'Library | button | All', 'Profile | button | Go back', 'Profile | button | Go back'])).toEqual([
      'Profile | button | Go back',
      'Library | button | All',
      'Profile | button | Go back #2',
      'Profile | button | Go back #3',
    ]);
  });

  it('makes a second offender with a listed name fail the ratchet', () => {
    const found = occurrenceKeys(['Library | button | All', 'Library | button | All']);
    expect(ratchet(found, ['Library | button | All']).added).toEqual(['Library | button | All #2']);
  });
});

describe('settleSignature', () => {
  const a = { role: 'button' as const, name: 'All', width: 80.2, height: 35.4 };

  it('is the same for two reads of the same layout (sub-pixel noise rounds away)', () => {
    expect(settleSignature([a])).toBe(settleSignature([{ ...a, width: 80.4, height: 35.1 }]));
  });

  it('changes when a control is still growing, even if it is not an offender', () => {
    const big = { role: 'button' as const, name: 'Start', width: 200, height: 64 };
    expect(settleSignature([big])).not.toBe(settleSignature([{ ...big, height: 80 }]));
  });

  it('changes when a control appears, even on a screen with no offenders', () => {
    expect(settleSignature([])).not.toBe(settleSignature([{ role: 'link', name: 'Journey', width: 120, height: 64 }]));
  });
});

describe('the audit walks what the spec names (§3.8)', () => {
  it('at 768x1024, 1180x820 and 375x667', () => {
    expect(AUDIT_VIEWPORTS.map(viewportKey)).toEqual(['768x1024', '1180x820', '375x667']);
  });

  it('on Home, Journey, Library and Profile', () => {
    expect(AUDIT_SCREENS).toEqual(['Home', 'Journey', 'Library', 'Profile']);
  });

  it('measures button, link and checkbox, plus switch (a checkbox per ARIA) and the other tappable roles', () => {
    expect(TARGET_ROLES).toEqual(['button', 'link', 'checkbox', 'switch', 'radio', 'tab', 'menuitem']);
  });
});

describe('touch-target-allowlist.json', () => {
  const entries = Object.entries(allowlist.offenders);

  it('has one list per audited viewport and nothing else', () => {
    expect(Object.keys(allowlist.offenders).sort()).toEqual(AUDIT_VIEWPORTS.map(viewportKey).sort());
  });

  it.each(entries)('%s: every entry is "Screen | role | name" on an audited screen', (_vp, list) => {
    const shape = new RegExp(`^(${AUDIT_SCREENS.join('|')}) \\| (${TARGET_ROLES.join('|')}) \\| \\S.*$`);
    for (const entry of list) expect(entry).toMatch(shape);
  });

  it.each(entries)('%s: entries are sorted and unique, so a diff shows exactly what changed', (_vp, list) => {
    expect([...new Set(list)].sort()).toEqual(list);
  });
});

/**
 * The list only shrinks: every window's entries must be among the offenders
 * recorded when the audit landed. Growing the list therefore takes a visible
 * edit here as well as in the fixture, not just a new JSON line. When an
 * offender is fixed, delete it from the fixture (the e2e fails until you do);
 * deleting it here too is optional tidying.
 */
const BASELINE: readonly string[] = [
  'Journey | button | Dialogue: locked. Opens the unlock page.',
  'Journey | button | Real-use: locked. Opens the unlock page.',
  'Journey | button | Self-expression: locked. Opens the unlock page.',
  'Journey | button | Sentences: locked. Opens the unlock page.',
  'Journey | button | Stories: locked. Opens the unlock page.',
  'Journey | button | Words: locked. Opens the unlock page.',
  'Library | button | All',
  'Library | button | Food',
  'Library | button | Holidays',
  'Library | button | Letters',
  'Library | button | Nature',
  'Library | button | Play',
  'Profile | button | Go back',
];

describe('touch-target-allowlist.json never grows past the recorded baseline', () => {
  it.each(Object.entries(allowlist.offenders))('%s: every entry was an offender when the audit landed', (_vp, list) => {
    expect(list.filter((entry) => !BASELINE.includes(entry))).toEqual([]);
  });
});
