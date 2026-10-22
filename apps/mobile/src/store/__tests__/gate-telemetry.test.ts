import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { Profile } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 15 (row OA-2): `parent.gate.opened` from every gate. A gate that
 * sends the PIN screen reports from there (`via: 'pin'`); a gate that opens directly reports through `passGate`
 * (`via: 'session'` or `'open'`). The sweep below finds every gate decision in the screens and the navigator, so a
 * new gate cannot skip the event.
 */
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
}));
const tracked = vi.hoisted(() => [] as { name: string; payload?: Record<string, unknown> }[]);
vi.mock('../../platform/telemetry', () => ({
  track: vi.fn(async (event: { name: string; payload?: Record<string, unknown> }) => {
    tracked.push(event);
    return true;
  }),
}));

import { useAccountStore } from '../account-store';
import { passGate } from '../gate-telemetry';
import { useProfileStore } from '../profile-store';

const learner = (learnerType: 'child' | 'self'): Profile =>
  ({ id: 'profile:a', displayName: 'A', ageGroup: '10-11', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType }) as Profile;

beforeEach(() => {
  tracked.length = 0;
  useProfileStore.setState({ profiles: [learner('child')], activeId: 'profile:a' });
  useAccountStore.setState({ parentPinHash: 'h:1' });
});

describe('passGate', () => {
  it('returns the decision; a gate that does not open directly sends nothing', () => {
    expect(passGate('Paywall', false)).toBe(false);
    expect(tracked).toEqual([]);
  });

  it('a gate the open session opened sends via session, with codes only', () => {
    expect(passGate('LearnerReport', true)).toBe(true);
    expect(tracked).toEqual([{ name: 'parent.gate.opened', payload: { dest: 'area', via: 'session', marker: 'pin' } }]);
  });

  it('a device whose gate needs no PIN (self-only, no PIN set) sends via open', () => {
    useProfileStore.setState({ profiles: [learner('self')] });
    useAccountStore.setState({ parentPinHash: null });
    passGate('ExternalLink', true);
    expect(tracked[0]?.payload).toMatchObject({ dest: 'action', via: 'open' });
    expect(tracked[0] && 'profileId' in tracked[0]).toBe(false);
  });
});

// Every call of a gate decision (the helpers that pick the PIN screen or the destination) sits inside `passGate`, on
// the same line. The few that are not gates into a surface are listed with the reason.
const DECISIONS = /\b(askGate|lockedStoryGate|reportEntry|openLinkStep|gateLessonsStep|billingPressStep|moveEntry|homeCardLock)\(/;
const NOT_A_GATE: Record<string, string> = {
  // The report re-checks its own gate on render and hands over to the PIN screen when the session lapsed.
  'screens/parent/LearnerReportScreen.tsx': 'reportEntry(profileId, gateOpen)',
  // The locked card's gate is reported on the next line, once the card is known to be locked.
  'screens/home/HomeScreen.tsx': 'homeCardLock({',
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('every gate in the screens and the navigator reports through passGate', () => {
  const root = join(__dirname, '..', '..');
  const files = [...sources(join(root, 'screens')), ...sources(join(root, 'navigation'))];

  it('finds the gate decisions it guards', () => {
    const found = files.filter((f) => DECISIONS.test(readFileSync(f, 'utf8')));
    expect(found.length).toBeGreaterThanOrEqual(12);
  });

  it('wraps each one in passGate, or names why it is not a gate', () => {
    const unwrapped: string[] = [];
    for (const file of files) {
      const rel = relative(root, file);
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (!DECISIONS.test(line) || line.trim().startsWith('//') || line.trim().startsWith('*')) return;
          if (line.includes('passGate(')) return;
          if (NOT_A_GATE[rel] !== undefined && line.includes(NOT_A_GATE[rel]!)) return;
          unwrapped.push(`${rel}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(unwrapped).toEqual([]);
  });

  it('the locked Home card reports right after its decision', () => {
    const home = readFileSync(join(root, 'screens/home/HomeScreen.tsx'), 'utf8');
    expect(home).toMatch(/homeCardLock\(\{[^\n]*\n\s*if \(!lock\) return false;\n\s*if \(lock\.gate\.route === 'Paywall'\) passGate\('Paywall', true\);/);
  });
});
