import { CHOOSER_RESUME_MS, GROWN_UP_BACKGROUND_MS, OA_TELEMETRY_PAYLOADS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  TILE_TINTS,
  chooserTrigger,
  grownUpRows,
  isSharedDevice,
  learnersBucket,
  pickLanding,
  tileOrder,
  tileTints,
  whoPickedEvent,
  whoShownEvent,
  type ChooserEvent,
} from '../who';

// [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS row OA-4a, section 20: the chooser's pure rules (sections 6.1 to 6.4).

const p = (n: number, avatar = 'hoya-orange', displayName = `L${n}`) => ({ id: `profile:p${n}`, displayName, avatar });

describe('isSharedDevice (section 6.2, OA-D6)', () => {
  const one = [p(1)];
  it('two or more learner profiles make a device shared', () => {
    expect(isSharedDevice({ profiles: [p(1), p(2)], locks: [], uses: [], marker: 'nopin' })).toBe(true);
    expect(isSharedDevice({ profiles: [p(1), p(2), p(3)], locks: [], uses: [], marker: 'none' })).toBe(true);
  });

  it('one learner with no lock and no known use is not shared; no profile never is', () => {
    expect(isSharedDevice({ profiles: one, locks: [], uses: [], marker: 'pin' })).toBe(false);
    expect(isSharedDevice({ profiles: [], locks: [], uses: ['family'], marker: 'pin' })).toBe(false);
  });

  it('a locked profile makes it shared; a lock on an id that is not here counts for nothing', () => {
    expect(isSharedDevice({ profiles: one, locks: ['profile:p1'], uses: [], marker: 'pin' })).toBe(true);
    expect(isSharedDevice({ profiles: one, locks: ['profile:gone'], uses: [], marker: 'pin' })).toBe(false);
  });

  it('a known grown-up use makes a single-learner device shared, except with the marker none', () => {
    expect(isSharedDevice({ profiles: one, locks: [], uses: ['teacher'], marker: 'pin' })).toBe(true);
    expect(isSharedDevice({ profiles: one, locks: [], uses: ['family'], marker: 'nopin' })).toBe(true);
    // A lone adult learner who also teaches, with no PIN: not asked at every launch.
    expect(isSharedDevice({ profiles: one, locks: [], uses: ['teacher', 'school'], marker: 'none' })).toBe(false);
    // The exclusion is about a known use alone: a lock still makes it shared.
    expect(isSharedDevice({ profiles: one, locks: ['profile:p1'], uses: ['teacher'], marker: 'none' })).toBe(true);
  });
});

describe('chooserTrigger (section 6.2)', () => {
  const base = { shared: true, activeLocked: false, profiles: 2, backgroundMs: 0, joinHeld: false, flag: true };
  const at = (event: ChooserEvent, over: Partial<typeof base> = {}) => chooserTrigger({ ...base, ...over, event });

  it('the flag off: no trigger at all, who=1 and Switch included', () => {
    for (const event of ['launch', 'return', 'resume', 'manual'] as const) {
      expect(at(event, { flag: false, backgroundMs: CHOOSER_RESUME_MS, activeLocked: true, joinHeld: true })).toBeNull();
    }
  });

  it('an empty device never shows it', () => {
    for (const event of ['launch', 'return', 'resume', 'manual'] as const) expect(at(event, { profiles: 0, backgroundMs: CHOOSER_RESUME_MS })).toBeNull();
  });

  it('launch: a shared device, or a locked active profile (CS-19); a single-learner device is not asked', () => {
    expect(at('launch')).toBe('launch');
    expect(at('launch', { shared: false })).toBeNull();
    expect(at('launch', { shared: false, profiles: 1, activeLocked: true })).toBe('launch');
  });

  it('a join held at launch: join on a shared device, else Join as today', () => {
    expect(at('launch', { joinHeld: true })).toBe('join');
    expect(at('launch', { joinHeld: true, shared: false, profiles: 1 })).toBeNull();
    expect(at('launch', { joinHeld: true, shared: false, profiles: 1, activeLocked: true })).toBeNull();
  });

  it('who=1 opens it with one profile; a join that arrives with it wins (OA-D20)', () => {
    expect(at('return', { shared: false, profiles: 1 })).toBe('return');
    expect(at('return', { joinHeld: true })).toBe('join');
    expect(at('return', { joinHeld: true, shared: false, profiles: 1 })).toBeNull();
  });

  it('resume: 30 minutes on a shared device, 5 minutes with a locked active profile', () => {
    expect(at('resume', { backgroundMs: CHOOSER_RESUME_MS - 1 })).toBeNull();
    expect(at('resume', { backgroundMs: CHOOSER_RESUME_MS })).toBe('resume');
    expect(at('resume', { shared: false, profiles: 1, backgroundMs: CHOOSER_RESUME_MS * 4 })).toBeNull();
    expect(at('resume', { shared: false, profiles: 1, activeLocked: true, backgroundMs: GROWN_UP_BACKGROUND_MS - 1 })).toBeNull();
    expect(at('resume', { shared: false, profiles: 1, activeLocked: true, backgroundMs: GROWN_UP_BACKGROUND_MS })).toBe('resume');
    expect(at('resume', { shared: true, activeLocked: true, backgroundMs: GROWN_UP_BACKGROUND_MS })).toBe('resume');
  });

  it('a clock that ran backwards counts no time away', () => {
    expect(at('resume', { activeLocked: true, backgroundMs: -CHOOSER_RESUME_MS })).toBeNull();
  });

  it('manual: always, with any number of profiles', () => {
    expect(at('manual', { shared: false, profiles: 1 })).toBe('manual');
    expect(at('manual', { joinHeld: true })).toBe('manual');
  });
});

describe('tileOrder (OA-D17)', () => {
  const names = ['Zoe', 'ana', 'Émile', 'Bo', 'Chloe', 'Dami', 'Eli', 'Farah', 'Gus', 'Hana', 'Ivan', 'Jun'];

  it('12 profiles keep creation order, whatever their names', () => {
    const list = names.map((n, i) => p(i, 'hoya-blue', n));
    expect(tileOrder(list, 'en').map((x) => x.displayName)).toEqual(names);
    expect(tileOrder(list, 'en')).not.toBe(list);
  });

  it('from 13 profiles, by name in the UI language, case and accents aside, ties in creation order', () => {
    const list = [...names, 'Ana'].map((n, i) => p(i, 'hoya-blue', n));
    const ordered = tileOrder(list, 'en');
    expect(ordered.map((x) => x.displayName)).toEqual(['ana', 'Ana', 'Bo', 'Chloe', 'Dami', 'Eli', 'Émile', 'Farah', 'Gus', 'Hana', 'Ivan', 'Jun', 'Zoe']);
    expect(ordered[0]!.id).toBe('profile:p1');
    expect(list.map((x) => x.displayName)[0]).toBe('Zoe');
  });

  it('Spanish collation puts ñ after n', () => {
    const list = ['Ñoño', 'Nora', 'Oscar', ...names.slice(0, 10)].map((n, i) => p(i, 'hoya-blue', n));
    const ordered = tileOrder(list, 'es').map((x) => x.displayName);
    expect(ordered.indexOf('Nora')).toBeLessThan(ordered.indexOf('Ñoño'));
    expect(ordered.indexOf('Ñoño')).toBeLessThan(ordered.indexOf('Oscar'));
  });

  it('Korean collation orders Hangul names in dictionary order (가 나 다), and digits numerically', () => {
    const ko = ['하나', '다은', '가온', '나래', '민준', '서연', '지우', '도윤', '하준', '수아', '예준', '시우', '학생 10', '학생 9'];
    const ordered = tileOrder(ko.map((n, i) => p(i, 'hoya-green', n)), 'ko').map((x) => x.displayName);
    expect(ordered.slice(0, 4)).toEqual(['가온', '나래', '다은', '도윤']);
    expect(ordered.indexOf('학생 9')).toBeLessThan(ordered.indexOf('학생 10'));
  });
});

describe('tileTints (section 6.1)', () => {
  it('a cub nobody else has gets no tint', () => {
    expect(tileTints([p(1, 'hoya-orange'), p(2, 'hoya-blue')])).toEqual({ 'profile:p1': null, 'profile:p2': null });
  });

  it('a shared cub tints each tile of its group in creation order: letters, crafts, nature, rites, life, then again', () => {
    const list = [p(1, 'hoya-orange'), p(2, 'hoya-blue'), p(3, 'hoya-orange'), ...[4, 5, 6, 7, 8].map((n) => p(n, 'hoya-orange'))];
    const tints = tileTints(list);
    expect(tints['profile:p2']).toBeNull();
    expect([1, 3, 4, 5, 6, 7, 8].map((n) => tints[`profile:p${n}`])).toEqual(['letters', 'crafts', 'nature', 'rites', 'life', 'letters', 'crafts']);
  });

  it('only colors.theme keys, and the same answer for the same avatars whatever else a profile holds (no progress read)', () => {
    expect([...TILE_TINTS].sort()).toEqual(['crafts', 'letters', 'life', 'nature', 'rites']);
    const plain = [p(1), p(2)];
    const rich = plain.map((x, i) => ({ ...x, stars: i * 10, level: 'adult', lastActiveAt: `2026-10-${10 + i}` }));
    expect(tileTints(rich)).toEqual(tileTints(plain));
  });
});

describe('grownUpRows (sections 6.1, 12, OA-D21; row OA-4a: the Grown-up area only)', () => {
  const input = { os: 'web' as const, uses: ['family', 'teacher'] as const, online: true, marker: 'pin' as const, resetPending: null };

  it('emits only the Grown-up area, locked behind the PIN', () => {
    expect(grownUpRows(input)).toEqual({ pending: null, rows: [{ use: 'area', locked: true, disabled: false, caption: null }] });
    expect(grownUpRows({ ...input, os: 'ios', uses: [] }).rows).toHaveLength(1);
  });

  it('nopin: the caption A grown-up sets a PIN here.', () => {
    expect(grownUpRows({ ...input, marker: 'nopin' }).rows[0]).toEqual({ use: 'area', locked: true, disabled: false, caption: 'nopin' });
  });

  it('none: no lock glyph (the row opens directly)', () => {
    expect(grownUpRows({ ...input, marker: 'none' }).rows[0]!.locked).toBe(false);
  });

  it('offline: the Grown-up area stays enabled', () => {
    expect(grownUpRows({ ...input, online: false }).rows[0]!.disabled).toBe(false);
  });

  it('a running Forgot PIN wait puts the pending line first, with its end time', () => {
    expect(grownUpRows({ ...input, resetPending: 1_800_000_000_000 }).pending).toEqual({ readyAt: 1_800_000_000_000 });
  });
});

describe('who.shown and who.picked (section 15)', () => {
  it('buckets the learners and bounds the grown-up count', () => {
    expect([0, 1, 2, 3, 4, 5, 12, 13, 40].map(learnersBucket)).toEqual(['1', '1', '2', '3-4', '3-4', '5-12', '5-12', '13+', '13+']);
    const shown = whoShownEvent({ trigger: 'launch', learners: 3, grownUps: 9, anyLocked: false, resetPending: true });
    expect(shown).toEqual({ name: 'who.shown', payload: { trigger: 'launch', learners: '3-4', grownUps: 4, anyLocked: false, resetPending: true } });
    expect(OA_TELEMETRY_PAYLOADS['who.shown'].safeParse(shown.payload).success).toBe(true);
    expect(whoShownEvent({ trigger: 'manual', learners: 1, grownUps: -1, anyLocked: true, resetPending: false }).payload.grownUps).toBe(0);
  });

  it('who.picked carries a use only for a grown-up row, and parses against the shared payload rule', () => {
    expect(whoPickedEvent('learner')).toEqual({ name: 'who.picked', payload: { kind: 'learner' } });
    expect(whoPickedEvent('learner', 'area').payload).toEqual({ kind: 'learner' });
    expect(whoPickedEvent('grown_up', 'area').payload).toEqual({ kind: 'grown_up', use: 'area' });
    for (const event of [whoPickedEvent('add'), whoPickedEvent('cancel_reset'), whoPickedEvent('grown_up', 'area')]) {
      expect(OA_TELEMETRY_PAYLOADS['who.picked'].safeParse(event.payload).success).toBe(true);
    }
  });
});

describe('pickLanding (section 6.2, OA-D20)', () => {
  it('the same learner over a learner screen goes back to it; over nothing, a PIN screen or the grown-up area, Home', () => {
    expect(pickLanding({ same: true, under: 'learner', join: null })).toEqual({ kind: 'back' });
    expect(pickLanding({ same: true, under: null, join: null })).toEqual({ kind: 'home' });
    expect(pickLanding({ same: true, under: 'area', join: null })).toEqual({ kind: 'home' });
    expect(pickLanding({ same: true, under: 'gate', join: null })).toEqual({ kind: 'home' });
  });

  it('another learner lands on Home, whatever is under', () => {
    expect(pickLanding({ same: false, under: 'learner', join: null })).toEqual({ kind: 'home' });
  });

  it('a held join sends the picked learner to Join with the code', () => {
    expect(pickLanding({ same: true, under: 'learner', join: { code: 'ABC234' } })).toEqual({ kind: 'join', code: 'ABC234' });
    expect(pickLanding({ same: false, under: null, join: { code: null } })).toEqual({ kind: 'join', code: null });
  });
});
