import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOG, freeLessonsFacts, freeRouteQuestIds, type FreeLessonsFacts, type ProgressSnapshot } from '@hangul-route/content-schema';
import { LOCALES, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../content';
import { FREE_VOCAB_TOPIC_IDS, freeExtrasCount, questOpenPredicate } from '../content-access';
import { cursorContext } from '../cursor-context';
import { emptySnapshot } from '../my-route/view';
import { classOnlyMember, freeEndOnCursor, planFreeLines, readFreeFacts, type FreePlanContext, type PlanFreeLinesInput } from '../plan-free-lines';
import { placementResult } from '../placement/__tests__/fixtures';

/**
 * F-ENT-003 section 3.9.1 (E3-8; wireframe billing/plan-status-free-lessons): the lines F-ENT-003
 * adds to F-BILL-002's learner Plan screen. The free slot holds the free-plan line with figures
 * from data (replacing "Stage 1 is always free." while the switch is on, OD-9), the What is free
 * list (0-count lines hidden) and at most one situation line (class first, then free-end). The
 * full-route state with no plan adds the guidance line. With the switch off the view is today's.
 */

const en = getMessages('en');
const m = en.caregiver.plan;
const FACTS: Pick<FreeLessonsFacts, 'lessons' | 'letters' | 'minutes'> = { lessons: 15, letters: 24, minutes: 65 };

const ON: FreePlanContext = { gatingActive: true, facts: FACTS, stories: 0, topics: 4, classOnly: false, freeEnd: false, hasPlan: false };

function lines(over: Partial<PlanFreeLinesInput> = {}, ctx: Partial<FreePlanContext> | null = {}): ReturnType<typeof planFreeLines> {
  return planFreeLines(
    { state: 'free', audience: 'family', name: 'Mina', platform: 'web', context: ctx === null ? null : { ...ON, ...ctx }, ...over },
    m,
  );
}

describe('planFreeLines: the free slot with the switch on (section 3.9.1)', () => {
  it('the free-plan line replaces "Stage 1 is always free." and carries the figures (OD-9)', () => {
    expect(lines().free).toEqual({
      line: 'Stage 1 is free: 15 lessons, 24 letters, about 65 minutes. Everything finished stays.',
      list: ['4 word topics'],
      extra: null,
    });
  });

  it('leaves the letters out while the free lessons teach none', () => {
    expect(lines({}, { facts: { lessons: 3, letters: 0, minutes: 12 } }).free?.line).toBe('Stage 1 is free: 3 lessons, about 12 minutes. Everything finished stays.');
  });

  it('hides the line when the catalogue has no free lesson or the facts cannot be read; the slot keeps the rest', () => {
    expect(lines({}, { facts: { lessons: 0, letters: 0, minutes: 0 } }).free).toEqual({ line: null, list: ['4 word topics'], extra: null });
    expect(lines({}, { facts: null }).free).toEqual({ line: null, list: ['4 word topics'], extra: null });
  });

  it('lists stories then word topics; a line whose count is 0 is not shown', () => {
    expect(lines({}, { stories: 6, topics: 4 }).free?.list).toEqual(['6 short stories', '4 word topics']);
    expect(lines({}, { stories: 1, topics: 0 }).free?.list).toEqual(['1 short story']);
    expect(lines({}, { stories: 0, topics: 0 }).free?.list).toEqual([]);
  });

  it('adds at most one situation line: the class line first, then free-end, per audience', () => {
    expect(lines({}, { classOnly: true }).free?.extra).toBe("Mina's teacher can open every lesson for the class.");
    expect(lines({ audience: 'self' }, { classOnly: true }).free?.extra).toBe('Your teacher can open every lesson for the class.');
    expect(lines({}, { freeEnd: true }).free?.extra).toBe('Mina finished the free lessons.');
    expect(lines({ audience: 'self' }, { freeEnd: true }).free?.extra).toBe('You finished the free lessons.');
    expect(lines({}, { classOnly: true, freeEnd: true }).free?.extra).toBe("Mina's teacher can open every lesson for the class.");
  });

  it('adds no guidance line on the free plan', () => {
    expect(lines().guidance).toEqual([]);
  });
});

describe('planFreeLines: the switch off keeps the view unchanged (OD-2, D5)', () => {
  it('the free slot holds only "Stage 1 is always free." with no context or with the switch off', () => {
    const today = { line: 'Stage 1 is always free.', list: [], extra: null };
    expect(lines({}, null).free).toEqual(today);
    expect(lines({}, { gatingActive: false, classOnly: true, freeEnd: true, stories: 6 }).free).toEqual(today);
  });

  it('the full route shows no guidance line, plan or not', () => {
    expect(lines({ state: 'premium' }, null).guidance).toEqual([]);
    expect(lines({ state: 'premium' }, { gatingActive: false, hasPlan: false }).guidance).toEqual([]);
  });
});

describe('planFreeLines: the full route with no plan (section 3.9.4)', () => {
  it('native: "Set a plan to guide what comes next." only', () => {
    expect(lines({ state: 'premium', platform: 'ios' }).guidance).toEqual(['Set a plan to guide what comes next.']);
    expect(lines({ state: 'premium', platform: 'android' }).guidance).toEqual(['Set a plan to guide what comes next.']);
  });

  it('web: the grown-up page is named after it, with no link', () => {
    expect(lines({ state: 'premium' }).guidance).toEqual(['Set a plan to guide what comes next.', 'Plans are made in the grown-up area: Plan the term.']);
  });

  it('nothing once a plan exists, and nothing when covered by a class or school (F-BILL-002 has no guidance slot there)', () => {
    expect(lines({ state: 'premium' }, { hasPlan: true }).guidance).toEqual([]);
    expect(lines({ state: 'covered' }).guidance).toEqual([]);
  });

  it('a premium or covered learner has no free slot', () => {
    expect(lines({ state: 'premium' }).free).toBeNull();
    expect(lines({ state: 'covered' }).free).toBeNull();
  });
});

describe('every locale', () => {
  it('builds the same shape of lines in every locale', () => {
    for (const locale of LOCALES) {
      const p = getMessages(locale).caregiver.plan;
      const out = planFreeLines({ state: 'free', audience: 'family', name: 'Mina', platform: 'web', context: { ...ON, stories: 2, classOnly: true } }, p);
      expect(out.free?.line, locale).toBeTruthy();
      expect(out.free?.list, locale).toHaveLength(2);
      expect(out.free?.extra, locale).toBeTruthy();
    }
  });
});

describe('readFreeFacts, freeExtrasCount and classOnlyMember: the data the lines read', () => {
  it('reads the free-lesson facts from the shared catalogue (all of Stage 1, OD-1)', () => {
    expect(readFreeFacts(() => freeLessonsFacts(CATALOG))).toMatchObject(freeLessonsFacts(CATALOG));
    expect(readFreeFacts(() => freeLessonsFacts(CATALOG))?.lessons).toBe(freeRouteQuestIds(CATALOG).size);
  });

  it('a facts read that throws hides the line (Error state)', () => {
    expect(
      readFreeFacts(() => {
        throw new Error('no catalogue');
      }),
    ).toBeNull();
  });

  it('counts the bundled sampler stories and the free word topics this build lists', () => {
    const counts = freeExtrasCount(['food', 'animals', 'colors', 'numbers', 'family']);
    expect(counts.topics).toBe(FREE_VOCAB_TOPIC_IDS.length);
    expect(freeExtrasCount(['food', 'family']).topics).toBe(1);
    expect(freeExtrasCount([]).topics).toBe(0);
    expect(counts.stories).toBeGreaterThanOrEqual(0);
  });

  it('a learner whose only memberships are classes or schools is class-only; a family membership or none is not', () => {
    expect(classOnlyMember([{ kind: 'class' }])).toBe(true);
    expect(classOnlyMember([{ kind: 'class' }, { kind: 'school' }])).toBe(true);
    expect(classOnlyMember([{ kind: 'class' }, { kind: 'family' }])).toBe(false);
    expect(classOnlyMember([{ kind: 'family' }])).toBe(false);
    expect(classOnlyMember([])).toBe(false);
    expect(classOnlyMember(undefined)).toBe(false);
  });
});

describe('freeEndOnCursor: the learner finished everything open (routeNext steps 3 and 4, cursor half)', () => {
  const FREE = [...freeRouteQuestIds(CATALOG)];
  const done = (ids: readonly string[]): ProgressSnapshot => ({
    ...emptySnapshot('p1'),
    quests: ids.map((questId) => ({ questId, episodeId: 'episode:x', completedAt: '2026-10-01T00:00:00.000Z' })) as ProgressSnapshot['quests'],
  });
  const run = (snapshot: ProgressSnapshot, over: { gatingActive?: boolean; tier?: 'free' | 'premium'; placedOut?: readonly string[] } = {}): boolean => {
    const gating = over.gatingActive ?? true;
    const tier = over.tier ?? 'free';
    const completed = new Set(snapshot.quests.filter((q) => q.completedAt).map((q) => q.questId));
    const cursor = cursorContext({
      tier,
      placements: over.placedOut ? [placementResult({ placedOutQuestIds: [...over.placedOut] })] : undefined,
      quests: questsAll,
      episodes: episodesAll,
      isQuestOpen: questOpenPredicate({ tier, gatingEnabled: gating, completedQuestIds: completed }),
    });
    return freeEndOnCursor({ gatingActive: gating, tier, snapshot, quests: questsAll, episodes: episodesAll, cursor });
  };

  it('false for a new learner, and while one free lesson is left', () => {
    expect(run(emptySnapshot('p1'))).toBe(false);
    expect(run(done(FREE.slice(1)))).toBe(false);
  });

  it('true once every free lesson is finished and a closed lesson exists', () => {
    expect(run(done(FREE))).toBe(true);
  });

  it('true for a placed-out free learner whose only free lessons left are placed out', () => {
    expect(run(done(FREE.slice(3)), { placedOut: FREE.slice(0, 3) })).toBe(true);
  });

  it('false with the switch off, for a premium learner, and when nothing is closed', () => {
    expect(run(done(FREE), { gatingActive: false })).toBe(false);
    expect(run(done(FREE), { tier: 'premium' })).toBe(false);
    const everything = questsAll.map((q) => q.id);
    // Every quest kept: nothing new is open and nothing is closed, so it is rest, not free-end.
    expect(run(done(everything))).toBe(false);
  });

  it('false when the caller gave no access predicate (every quest open)', () => {
    const cursor = cursorContext({ tier: 'free', placements: undefined, quests: questsAll, episodes: episodesAll });
    expect(freeEndOnCursor({ gatingActive: true, tier: 'free', snapshot: done(FREE), quests: questsAll, episodes: episodesAll, cursor })).toBe(false);
  });
});

describe('no figure is typed (section 3.9.1: "never typed")', () => {
  it('the module reads every number from its input', () => {
    const src = readFileSync(join(__dirname, '../plan-free-lines.ts'), 'utf8');
    expect(src).not.toMatch(/\b(11|15|24|50|65)\b/);
  });
});
