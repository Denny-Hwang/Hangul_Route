import { describe, expect, it, vi } from 'vitest';
import { CATALOG, FREE_ROUTE_STAGES, cellIsReady, freeRouteQuestIds, gridLessonIds, type Story } from '@hangul-route/content-schema';
import { questsAll } from '../../content';
import { storiesAll } from '../../content/stories';
import { VOCAB_TOPICS } from '../../content/__generated__/vocab';
import {
  FREE_STAGE_KEYS,
  FREE_VOCAB_TOPIC_IDS,
  browseQuestOpen,
  isContentLocked,
  isFreeContent,
  isQuestOpen,
  questAccess,
  questOpenPredicate,
  type FreeContentRegistry,
  type QuestAccess,
} from '../content-access';
import { isStageEntitled, type Tier } from '../entitlement';

const registry: FreeContentRegistry = {
  stages: new Set(['stage1', 'stage9']),
  vocabTopics: new Set(['food']),
  samplerStories: new Set(['story:free-one']),
  freeQuests: new Set(['quest:free-one']),
  gridLessons: new Set(['quest:free-one', 'quest:paid-one']),
};

// The expected sets come from the catalogue (F-ENT-003 section 3.1), so they grow with Stage 1 (F-QUEST-002 Q-8).
const LESSON_IDS = new Set(CATALOG.quests.filter((q) => q.kind === 'lesson').map((q) => q.id));
const lessonsOfReadyCells = (stage?: string): string[] =>
  CATALOG.cells
    .filter((c) => cellIsReady(c) && (stage === undefined || c.stage === stage))
    .flatMap((c) => c.questIds.filter((id) => LESSON_IDS.has(id)));
const STAGE1_LESSONS = lessonsOfReadyCells('stage1');
const GRID_LESSONS = lessonsOfReadyCells();
const LATER_LESSONS = GRID_LESSONS.filter((id) => !STAGE1_LESSONS.includes(id));
/** Today's free lessons (`CATALOG_VERSION` 5, all 15 of Stage 1): the free set always includes them. */
const TODAY_STAGE1_LESSONS = [
  'quest:stage1-letters-q1',
  'quest:stage1-letters-q2',
  'quest:stage1-letters-q3',
  'quest:stage1-life-q1',
  'quest:stage1-life-q2',
  'quest:stage1-life-q3',
  'quest:stage1-rites-q1',
  'quest:stage1-rites-q2',
  'quest:stage1-rites-q3',
  'quest:stage1-nature-q1',
  'quest:stage1-nature-q2',
  'quest:stage1-nature-q3',
  'quest:stage1-crafts-q1',
  'quest:stage1-crafts-q2',
  'quest:stage1-crafts-q3',
];
const CHANGED = 'The free lessons changed: check F-ENT-003 section 3.1 (all of Stage 1 is free, OD-1)';

describe('free-set constants', () => {
  it('pins the intended free set', () => {
    expect([...FREE_STAGE_KEYS]).toEqual(['stage1']);
    expect([...FREE_VOCAB_TOPIC_IDS]).toEqual(['food', 'animals', 'colors', 'numbers']);
  });
});

describe('isFreeContent (injected registry)', () => {
  it('reads each kind from its own set', () => {
    expect(isFreeContent('stage', 'stage9', registry)).toBe(true);
    expect(isFreeContent('stage', 'stage2', registry)).toBe(false);
    expect(isFreeContent('vocab-topic', 'food', registry)).toBe(true);
    expect(isFreeContent('vocab-topic', 'animals', registry)).toBe(false);
    expect(isFreeContent('story', 'story:free-one', registry)).toBe(true);
    expect(isFreeContent('story', 'story:other', registry)).toBe(false);
  });

  it('does not mix kinds', () => {
    expect(isFreeContent('story', 'food', registry)).toBe(false);
    expect(isFreeContent('stage', 'story:free-one', registry)).toBe(false);
    expect(isFreeContent('vocab-topic', 'stage1', registry)).toBe(false);
    expect(isFreeContent('quest', 'stage1', registry)).toBe(false);
    expect(isFreeContent('story', 'quest:free-one', registry)).toBe(false);
  });

  it('reads quests from the free quests, never from the grid lessons (F-ENT-003 section 3.3)', () => {
    expect(isFreeContent('quest', 'quest:free-one', registry)).toBe(true);
    expect(isFreeContent('quest', 'quest:paid-one', registry)).toBe(false);
  });
});

describe('isFreeContent (default registry)', () => {
  it('opens stage 1 and the four vocab topics', () => {
    expect(isFreeContent('stage', 'stage1')).toBe(true);
    expect(isFreeContent('stage', 'stage2')).toBe(false);
    for (const id of FREE_VOCAB_TOPIC_IDS) expect(isFreeContent('vocab-topic', id)).toBe(true);
    expect(isFreeContent('vocab-topic', 'family')).toBe(false);
  });

  it('builds the story sampler from the bundle shelf.sampler flags', async () => {
    vi.resetModules();
    const stub = (id: string, shelf?: { sampler: boolean }): Story => ({ id, shelf }) as unknown as Story;
    vi.doMock('../../content/stories', () => ({
      storiesAll: [
        stub('story:in', { sampler: true }),
        stub('story:out', { sampler: false }),
        stub('story:no-shelf'),
      ],
    }));
    const mod = await import('../content-access');
    expect(mod.isFreeContent('story', 'story:in')).toBe(true);
    expect(mod.isFreeContent('story', 'story:out')).toBe(false);
    expect(mod.isFreeContent('story', 'story:no-shelf')).toBe(false);
    vi.doUnmock('../../content/stories');
  });

  it('opens every Stage 1 lesson and no later lesson: all of Stage 1 is free (OD-1)', () => {
    for (const id of STAGE1_LESSONS) expect(isFreeContent('quest', id), id).toBe(true);
    for (const id of LATER_LESSONS) expect(isFreeContent('quest', id), id).toBe(false);
  });

  it('builds the free quests and the grid lessons from the shared catalogue', () => {
    const free = questsAll.filter((q) => isFreeContent('quest', q.id)).map((q) => q.id);
    expect(new Set(free)).toEqual(freeRouteQuestIds(CATALOG));
    expect([...freeRouteQuestIds(CATALOG)].sort(), CHANGED).toEqual([...STAGE1_LESSONS].sort());
    expect([...gridLessonIds(CATALOG)].sort()).toEqual([...GRID_LESSONS].sort());
  });

  it("the free lessons are exactly Stage 1's lesson quests, all fifteen (OD-1)", () => {
    const free = freeRouteQuestIds(CATALOG);
    for (const id of TODAY_STAGE1_LESSONS) expect(free.has(id), `${CHANGED}: ${id}`).toBe(true);
    expect(free.size, CHANGED).toBe(15);
    for (const id of free) expect(id.startsWith('quest:stage1-'), `${CHANGED}: ${id}`).toBe(true);
    // A later stage always has lessons to close, or the switch would have nothing to do.
    expect(LATER_LESSONS.length).toBeGreaterThan(0);
  });

  it('reads the sampler from the bundle: the six shelf stories flagged sampler (F-STORY-005 §3.3)', () => {
    for (const id of [
      'story:sejong-new-letters',
      'story:hangeul-day',
      'story:cheugugi-rain-gauge',
      'story:seollal-new-year',
      'story:chuseok-ganggangsullae',
      'story:sun-and-moon',
    ]) {
      expect(isFreeContent('story', id), id).toBe(true);
    }
    expect(isFreeContent('story', 'story:tripitaka-koreana')).toBe(false);
  });
});

describe('isContentLocked', () => {
  const base = { kind: 'story' as const, id: 'story:other', tier: 'free' as Tier, registry };

  it('is never locked while gating is off', () => {
    expect(isContentLocked({ ...base, gatingEnabled: false })).toBe(false);
    expect(isContentLocked({ ...base, kind: 'vocab-topic', id: 'animals', gatingEnabled: false })).toBe(false);
    expect(isContentLocked({ kind: 'story', id: 'story:any', tier: 'free', gatingEnabled: false })).toBe(false);
  });

  it('locks non-free content for the free tier when gating is on', () => {
    expect(isContentLocked({ ...base, gatingEnabled: true })).toBe(true);
    expect(isContentLocked({ ...base, kind: 'vocab-topic', id: 'animals', gatingEnabled: true })).toBe(true);
  });

  it('keeps sampler stories and free topics open', () => {
    expect(isContentLocked({ ...base, id: 'story:free-one', gatingEnabled: true })).toBe(false);
    expect(isContentLocked({ ...base, kind: 'vocab-topic', id: 'food', gatingEnabled: true })).toBe(false);
  });

  it('never locks premium', () => {
    expect(isContentLocked({ ...base, tier: 'premium', gatingEnabled: true })).toBe(false);
  });

  it('uses the default registry when none is injected', () => {
    expect(
      isContentLocked({ kind: 'vocab-topic', id: 'food', tier: 'free', gatingEnabled: true }),
    ).toBe(false);
    expect(
      isContentLocked({ kind: 'vocab-topic', id: 'family', tier: 'free', gatingEnabled: true }),
    ).toBe(true);
  });
});

describe('isContentLocked golden: stories and word topics keep their D5 answer (F-ENT-003 section 3.3)', () => {
  // The D5 rule before F-ENT-003: locked only with the switch on, for the free tier, outside the free set.
  const samplers = new Set(storiesAll.filter((s) => s.shelf?.sampler === true).map((s) => s.id));
  const legacy = (kind: 'story' | 'vocab-topic', id: string, tier: Tier, gatingEnabled: boolean): boolean =>
    gatingEnabled && tier === 'free' && !(kind === 'story' ? samplers.has(id) : FREE_VOCAB_TOPIC_IDS.includes(id));
  const items = [
    ...storiesAll.map((s) => ['story', s.id] as const),
    ...VOCAB_TOPICS.map((t) => ['vocab-topic', t.key] as const),
  ];

  it('covers every bundled story and word topic', () => {
    expect(items.length).toBeGreaterThan(FREE_VOCAB_TOPIC_IDS.length);
  });

  it.each(items.flatMap(([kind, id]) => (['free', 'premium'] as const).flatMap((tier) => [true, false].map((on) => [kind, id, tier, on] as const))))(
    '%s %s x %s x switch %s is unchanged',
    (kind, id, tier, gatingEnabled) => {
      expect(isContentLocked({ kind, id, tier, gatingEnabled })).toBe(legacy(kind, id, tier, gatingEnabled));
    },
  );
});

describe('questAccess (F-ENT-003 section 3.3)', () => {
  const none: ReadonlySet<string> = new Set();
  const kept = (id: string): ReadonlySet<string> => new Set([id]);

  it('applies the six rules in order, first match wins', () => {
    const at = (questId: string, tier: Tier, gatingEnabled: boolean, done: ReadonlySet<string>): QuestAccess =>
      questAccess({ questId, tier, gatingEnabled, completedQuestIds: done, registry });
    // 1. premium beats everything, even the switch.
    expect(at('quest:paid-one', 'premium', true, none)).toBe('open-premium');
    expect(at('quest:paid-one', 'premium', false, none)).toBe('open-premium');
    // 2. switch off: today's access.
    expect(at('quest:paid-one', 'free', false, none)).toBe('open-switch-off');
    expect(at('quest:free-one', 'free', false, kept('quest:free-one'))).toBe('open-switch-off');
    // 3. a finished quest stays open, before the free set is asked.
    expect(at('quest:paid-one', 'free', true, kept('quest:paid-one'))).toBe('open-kept');
    expect(at('quest:free-one', 'free', true, kept('quest:free-one'))).toBe('open-kept');
    // 4. the free lessons.
    expect(at('quest:free-one', 'free', true, none)).toBe('open-free');
    // 5. not a grid lesson: a story quest or an unknown id is never closed here.
    expect(at('quest:story-x', 'free', true, none)).toBe('open-not-a-lesson');
    expect(at('quest:unknown', 'free', true, none)).toBe('open-not-a-lesson');
    // 6. a grid lesson past the free ones.
    expect(at('quest:paid-one', 'free', true, none)).toBe('closed');
    expect(at('quest:paid-one', 'free', true, kept('quest:other'))).toBe('closed');
  });

  it('isQuestOpen is every answer but closed', () => {
    const base = { tier: 'free' as Tier, gatingEnabled: true, completedQuestIds: none, registry };
    expect(isQuestOpen({ ...base, questId: 'quest:free-one' })).toBe(true);
    expect(isQuestOpen({ ...base, questId: 'quest:story-x' })).toBe(true);
    expect(isQuestOpen({ ...base, questId: 'quest:paid-one' })).toBe(false);
    expect(isQuestOpen({ ...base, questId: 'quest:paid-one', completedQuestIds: kept('quest:paid-one') })).toBe(true);
  });

  it('questOpenPredicate binds everything but the quest', () => {
    const open = questOpenPredicate({ tier: 'free', gatingEnabled: true, completedQuestIds: none, registry });
    expect(open('quest:free-one')).toBe(true);
    expect(open('quest:paid-one')).toBe(false);
    expect(questOpenPredicate({ tier: 'premium', gatingEnabled: true, completedQuestIds: none, registry })('quest:paid-one')).toBe(true);
  });

  it('every bundled quest x tier x switch x kept, on the default registry', () => {
    const story = questsAll.filter((q) => !STAGE1_LESSONS.includes(q.id) && !LATER_LESSONS.includes(q.id));
    for (const quest of questsAll) {
      for (const tier of ['free', 'premium'] as const) {
        for (const gatingEnabled of [false, true]) {
          for (const done of [false, true]) {
            const access = questAccess({ questId: quest.id, tier, gatingEnabled, completedQuestIds: done ? kept(quest.id) : none });
            const expected: QuestAccess =
              tier === 'premium'
                ? 'open-premium'
                : !gatingEnabled
                  ? 'open-switch-off'
                  : done
                    ? 'open-kept'
                    : STAGE1_LESSONS.includes(quest.id)
                      ? 'open-free'
                      : LATER_LESSONS.includes(quest.id)
                        ? 'closed'
                        : 'open-not-a-lesson';
            expect(access, `${quest.id} ${tier} ${gatingEnabled} ${done}`).toBe(expected);
          }
        }
      }
    }
    // Story quests ride the bundle and are decided by isContentLocked, never closed here.
    for (const quest of story) expect(gridLessonIds(CATALOG).has(quest.id)).toBe(false);
  });

  it('golden: the Festival Sentences quests are paid grid lessons (F-CURR-001 S3-3, section 3.13)', () => {
    for (const questId of ['quest:stage3-rites-q1', 'quest:stage3-rites-q2', 'quest:stage3-rites-q3']) {
      expect(questsAll.some((q) => q.id === questId), questId).toBe(true);
      const at = (tier: Tier, gatingEnabled: boolean, done: boolean): QuestAccess =>
        questAccess({ questId, tier, gatingEnabled, completedQuestIds: done ? kept(questId) : none });
      expect(at('free', true, false), questId).toBe('closed');
      expect(at('premium', true, false), questId).toBe('open-premium');
      expect(at('free', false, false), questId).toBe('open-switch-off');
      expect(at('free', true, true), questId).toBe('open-kept');
    }
  });

  it('golden: the Playdate Talk quests are paid grid lessons (F-CURR-001 S4-4, section 3.13)', () => {
    for (const questId of ['quest:stage4-crafts-q1', 'quest:stage4-crafts-q2', 'quest:stage4-crafts-q3']) {
      expect(questsAll.some((q) => q.id === questId), questId).toBe(true);
      const at = (tier: Tier, gatingEnabled: boolean, done: boolean): QuestAccess =>
        questAccess({ questId, tier, gatingEnabled, completedQuestIds: done ? kept(questId) : none });
      expect(at('free', true, false), questId).toBe('closed');
      expect(at('premium', true, false), questId).toBe('open-premium');
      expect(at('free', false, false), questId).toBe('open-switch-off');
      expect(at('free', true, true), questId).toBe('open-kept');
    }
  });

  it('golden: the Daily Mini-Sentences quests (F-CURR-001 S3-2) are grid lessons past the free ones (section 3.13)', () => {
    const ids = ['quest:stage3-life-q1', 'quest:stage3-life-q2', 'quest:stage3-life-q3'];
    for (const id of ids) {
      expect(questsAll.some((q) => q.id === id), id).toBe(true);
      const at = (tier: Tier, gatingEnabled: boolean, done: boolean) => questAccess({ questId: id, tier, gatingEnabled, completedQuestIds: done ? kept(id) : none });
      expect([at('free', true, false), at('premium', true, false), at('free', false, false), at('free', true, true)], id).toEqual([
        'closed',
        'open-premium',
        'open-switch-off',
        'open-kept',
      ]);
    }
    // The free figures do not move: the free lessons are still Stage 1's fifteen.
    expect([...freeRouteQuestIds(CATALOG)].filter((id) => ids.includes(id))).toEqual([]);
  });

  it('golden: with the switch off every bundled quest is open for every learner, finished or not', () => {
    for (const quest of questsAll) {
      for (const tier of ['free', 'premium'] as const) {
        for (const done of [false, true]) {
          expect(isQuestOpen({ questId: quest.id, tier, gatingEnabled: false, completedQuestIds: done ? kept(quest.id) : none })).toBe(true);
        }
      }
    }
  });
});

describe('browseQuestOpen (F-BROWSE-001 item 14, F-ENT-003 section 3.3)', () => {
  it('full: every lesson open, switch on or off', () => {
    for (const on of [false, true]) {
      const open = browseQuestOpen('full', on);
      for (const id of [...STAGE1_LESSONS, ...LATER_LESSONS]) expect(open(id)).toBe(true);
    }
  });

  it('sampler: everything with the switch off, all of Stage 1 with it on', () => {
    const off = browseQuestOpen('sampler', false);
    for (const id of [...STAGE1_LESSONS, ...LATER_LESSONS]) expect(off(id)).toBe(true);
    const on = browseQuestOpen('sampler', true);
    for (const id of STAGE1_LESSONS) expect(on(id)).toBe(true);
    for (const id of LATER_LESSONS) expect(on(id)).toBe(false);
  });
});

describe('the free stages agree (F-ENT-003 section 3.3)', () => {
  it('FREE_STAGE_KEYS equals FREE_ROUTE_STAGES since OD-1', () => {
    expect([...FREE_STAGE_KEYS]).toEqual([...FREE_ROUTE_STAGES]);
  });
});

describe('isStageEntitled golden parity (D5)', () => {
  // The pre-delegation behavior: premium sees everything, free sees stage1 only.
  const legacy = (stageKey: string, tier: Tier): boolean => tier === 'premium' || stageKey === 'stage1';
  const stages = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'];

  it.each(stages.flatMap((s) => (['free', 'premium'] as const).map((t) => [s, t] as const)))(
    '%s x %s is unchanged',
    (stage, tier) => {
      expect(isStageEntitled(stage, tier)).toBe(legacy(stage, tier));
    },
  );
});
