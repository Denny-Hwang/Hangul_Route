import { CATALOG, LECTURE_MAX_BLOCKS, LectureDeckSchema, decodeDeck, rosterAlias, type LectureBlock, type PlanItem, type WeekMeta } from '@hangul-route/content-schema';
import { LECTURE_MINUTES_DECKS } from '@hangul-route/content-schema/testing/lecture-decks';
import { describe, expect, it } from 'vitest';
import type { PlanView, Roster, RosterLearner, SpaceListItem } from '../api';
import {
  aboutMinutes,
  blockMinutes,
  buildDeck,
  canAdd,
  canComposeIn,
  catalogueTitle,
  classCodeBlock,
  lecturePlanFrom,
  lectureSourceFrom,
  moveBlock,
  outlineProblem,
  pickPlan,
  planOutline,
  presenterLink,
  quizWarnings,
  planBlocks,
  presenterUrl,
  revisitBlock,
  titleProblem,
  updateBlock,
  vocabMinutes,
} from '../lecture';

const learner = (displayName: string, i = 0): RosterLearner => ({
  id: `profile:l${i}`,
  displayName,
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  joinedAt: '2026-09-01T00:00:00.000Z',
  lastActiveAt: '2026-10-01T00:00:00.000Z',
  summary: null,
  lastSyncedAt: null,
});

const roster = (names: string[], anonymizeRoster = false, joinCode: string | null = 'ABC234'): Roster => ({
  space: {
    id: 'space:c',
    kind: 'class',
    name: 'Sunday Class A',
    parentSpaceId: null,
    settings: { consentMode: 'parent', anonymizeRoster },
    archivedAt: null,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  learners: names.map((n, i) => learner(n, i)),
  joinCode,
  joinCodeExpiresAt: null,
});

const AWKWARD = ['Minho Kim', 'José Ruiz', "Siobhán O'Neil", 'Anne-Marie Dupont', '김민호', 'Ünal Yıldız'];
const NOW = new Date('2026-10-11T09:00:00.000Z');
const rng = (): (() => number) => {
  let x = 0.137;
  return () => {
    x = (x * 9301 + 0.49297) % 1;
    return x;
  };
};

describe('deck sources (F-TCH-004 §3.11)', () => {
  it('reads the preselected source from the URL, plan or revisit only', () => {
    expect(lectureSourceFrom(new URLSearchParams('id=s&from=plan'))).toBe('plan');
    expect(lectureSourceFrom(new URLSearchParams('id=s&from=revisit'))).toBe('revisit');
    expect(lectureSourceFrom(new URLSearchParams('id=s&from=other'))).toBeNull();
    expect(lectureSourceFrom(new URLSearchParams('id=s'))).toBeNull();
    expect(lectureSourceFrom(null)).toBeNull();
  });

  it('a plan becomes one block per item, in order', () => {
    expect(
      planBlocks({
        items: [
          { kind: 'episode', id: 'episode:stage1-letters', targetDate: '2026-10-12', note: 'warm up' },
          { kind: 'quest', id: 'quest:stage1-life-q1' },
        ],
      }),
    ).toEqual([
      { kind: 'episode', id: 'episode:stage1-letters' },
      { kind: 'quest', id: 'quest:stage1-life-q1' },
    ]);
  });

  it('a plan item whose id the deck grammar refuses is left out', () => {
    expect(planBlocks({ items: [{ kind: 'quest', id: 'Quest One' }] })).toEqual([]);
  });

  it('revisit chips become one revisit block of compatibility jamo (at most 6)', () => {
    expect(revisitBlock(['ㄱ', 'ㅓ', 'ㅎ'])).toEqual({ kind: 'revisit', chars: ['ㄱ', 'ㅓ', 'ㅎ'] });
    expect(revisitBlock(['ㄱ', 'x', '가', 'ㄱ'])).toEqual({ kind: 'revisit', chars: ['ㄱ'] });
    expect(revisitBlock(['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ'])).toEqual({ kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ'] });
    expect(revisitBlock([])).toBeNull();
    expect(revisitBlock(['a'])).toBeNull();
  });

  it('a class-code block needs a valid join code', () => {
    expect(classCodeBlock('ABC234')).toEqual({ kind: 'class-code', code: 'ABC234' });
    expect(classCodeBlock(null)).toBeNull();
    expect(classCodeBlock('abc')).toBeNull();
  });

  it('moves a block up or down, clamped', () => {
    const blocks: LectureBlock[] = [
      { kind: 'quest', id: 'quest:a' },
      { kind: 'quest', id: 'quest:b' },
      { kind: 'quest', id: 'quest:c' },
    ];
    expect(moveBlock(blocks, 0, 1).map((b) => (b.kind === 'quest' ? b.id : ''))).toEqual(['quest:b', 'quest:a', 'quest:c']);
    expect(moveBlock(blocks, 0, -1)).toEqual(blocks);
    expect(moveBlock(blocks, 2, 3)).toEqual(blocks);
  });
});

/** The shared catalogue's entries, read rather than copied, so a content edit to a quest does not break these tests. */
const Q1 = CATALOG.quests.find((q) => q.id === 'quest:stage1-letters-q1');
const LETTERS_CELL = CATALOG.cells.find((c) => c.episodeId === 'episode:stage1-letters');
if (Q1 === undefined || LETTERS_CELL === undefined) throw new Error('the shared catalogue lost quest:stage1-letters-q1 or episode:stage1-letters');

describe('outline rows', () => {
  it('names content blocks from the catalogue mirrors; an unknown id shows itself', () => {
    expect(catalogueTitle({ kind: 'quest', id: 'quest:stage1-letters-q1' })).toBe(Q1.title);
    expect(Q1.title).not.toBe('quest:stage1-letters-q1');
    expect(catalogueTitle({ kind: 'episode', id: 'episode:stage1-letters' })).toBe(LETTERS_CELL.title);
    expect(LETTERS_CELL.title).not.toBe('episode:stage1-letters');
    expect(catalogueTitle({ kind: 'vocab', topicId: 'vocab-topic:food' })).toBe('Food');
    expect(catalogueTitle({ kind: 'story', storyId: 'story:x', checks: true }, [{ id: 'story:x', titleEn: 'X story', minutes: 5 }])).toBe('X story');
    expect(catalogueTitle({ kind: 'quest', id: 'quest:unknown' })).toBe('quest:unknown');
    expect(catalogueTitle({ kind: 'episode', id: 'episode:unknown' })).toBe('episode:unknown');
    expect(catalogueTitle({ kind: 'story', storyId: 'story:unknown', checks: true })).toBe('story:unknown');
    expect(catalogueTitle({ kind: 'vocab', topicId: 'vocab-topic:unknown' })).toBe('vocab-topic:unknown');
    expect(catalogueTitle({ kind: 'quiz', from: 'all', rounds: 3 })).toBeNull();
  });

  it('replaces one block', () => {
    const blocks: LectureBlock[] = [
      { kind: 'quiz', from: 'previous', rounds: 5 },
      { kind: 'activity', preset: 'air-write', minutes: 3 },
    ];
    expect(updateBlock(blocks, 1, { kind: 'activity', preset: 'stretch-break', minutes: 2 })).toEqual([
      blocks[0],
      { kind: 'activity', preset: 'stretch-break', minutes: 2 },
    ]);
  });
});

describe('about-minutes from the catalogue (F-TCH-004 §3.11)', () => {
  it('quests and episodes from the shared catalogue (cell minutes), stories from the lecture catalogue, letters, cards and words from the block size, quiz and activity from the block', () => {
    expect(blockMinutes({ kind: 'quest', id: 'quest:stage1-letters-q1' })).toBe(Q1.minutes);
    expect(Q1.minutes).toBeGreaterThan(0);
    expect(blockMinutes({ kind: 'episode', id: 'episode:stage1-letters' })).toBe(LETTERS_CELL.minutes);
    expect(LETTERS_CELL.minutes).toBeGreaterThan(0);
    expect(blockMinutes({ kind: 'quiz', from: 'previous', rounds: 5 })).toBe(5);
    expect(blockMinutes({ kind: 'activity', preset: 'air-write', minutes: 3 })).toBe(3);
    // Rule 12 as amended (AMENDMENTS-LECTURE-V2 4.4): ceil(slides / 2) plus 1 per quiz round.
    expect(blockMinutes({ kind: 'revisit', chars: ['ㄱ', 'ㄴ'] })).toBe(3);
    expect(blockMinutes({ kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ', 'ㅏ', 'ㅓ', 'ㅗ'] })).toBe(7);
    expect(blockMinutes({ kind: 'class-code', code: 'ABC234' })).toBe(0);
    expect(blockMinutes({ kind: 'quest', id: 'quest:unknown' })).toBeNull();
    expect(blockMinutes({ kind: 'episode', id: 'episode:unknown' })).toBeNull();
    expect(blockMinutes({ kind: 'story', storyId: 'story:unknown', checks: true })).toBeNull();
    // Rule 12 as amended (LV-M1): a topic counts ceil(word cards / 2) plus its meaning quiz (5 rounds, none under 4 words).
    expect(blockMinutes({ kind: 'vocab', topicId: 'vocab-topic:food' })).toBe(6 + 5);
    expect(blockMinutes({ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['vocab:bap', 'vocab:mul', 'vocab:uyu'] })).toBe(2);
    expect(blockMinutes({ kind: 'vocab', topicId: 'vocab-topic:food', wordIds: ['vocab:bap', 'vocab:mul', 'vocab:uyu', 'vocab:ppang'] })).toBe(2 + 4);
    expect(blockMinutes({ kind: 'vocab', topicId: 'vocab-topic:unknown' })).toBeNull();
    expect(vocabMinutes('vocab-topic:food')).toBe(11);
    expect(vocabMinutes('vocab-topic:unknown', 4)).toBeNull();
    expect(blockMinutes({ kind: 'jamo-set', jamoIds: ['jamo:giyeok', 'jamo:a'] })).toBe(1);
    expect(blockMinutes({ kind: 'jamo-set', jamoIds: ['jamo:giyeok', 'jamo:a', 'jamo:eo'] })).toBe(2);
    expect(blockMinutes({ kind: 'cards', cardIds: ['card:book'] })).toBe(1);
    expect(blockMinutes({ kind: 'cards', cardIds: ['card:book', 'card:hanbok', 'card:kimchi'] })).toBe(2);
    expect(blockMinutes({ kind: 'word-review', questIds: ['quest:stage1-life-q1'], vocabIds: [], rounds: 10 })).toBe(20);
    // v2 (AMENDMENTS-LECTURE-V2 4.4): 10 cards halved plus 5 quiz rounds, as the presets count it.
    expect(blockMinutes({ kind: 'word-review', questIds: ['quest:stage1-life-q1'], vocabIds: [], rounds: 5 })).toBe(10);
  });

  it('a story from the catalogue counts its minutes', () => {
    expect(blockMinutes({ kind: 'story', storyId: 'story:x', checks: true }, [{ id: 'story:x', titleEn: 'X', minutes: 5 }])).toBe(5);
  });

  it('adds what it knows', () => {
    expect(
      aboutMinutes([
        { kind: 'quest', id: 'quest:stage1-letters-q1' },
        { kind: 'quest', id: 'quest:unknown' },
        { kind: 'quiz', from: 'all', rounds: 2 },
      ]),
    ).toBe(Q1.minutes + 2);
  });

  it('is never 0 for an outline with something to show; a class code alone or an empty outline stays 0', () => {
    expect(aboutMinutes([{ kind: 'quest', id: 'quest:unknown' }])).toBe(1);
    expect(aboutMinutes([{ kind: 'class-code', code: 'ABC234' }])).toBe(0);
    expect(aboutMinutes([])).toBe(0);
  });
});

describe('aboutMinutes on the shared fixture decks (rule 12 as amended; the presenter suite gives the same numbers)', () => {
  it.each(LECTURE_MINUTES_DECKS.map((d) => [d.name, d] as const))('%s', (_, fixture) => {
    expect(aboutMinutes(fixture.blocks)).toBe(fixture.aboutMinutes);
  });

  it('every consonant and vowel is about 12 minutes, never about 0 (owner report 2026-10-16)', () => {
    const letters = LECTURE_MINUTES_DECKS.find((d) => d.name === 'consonants and vowels')!;
    expect(letters.blocks.flatMap((b) => (b.kind === 'jamo-set' ? b.jamoIds : []))).toHaveLength(24);
    expect(aboutMinutes(letters.blocks)).toBe(12);
  });
});

describe('deck title guard (F-TCH-004 §3.10, TD8)', () => {
  const r = roster(['Minho Kim', 'Anne-Marie Dupont', "Siobhán O'Neil"]);

  it('accepts a plain title, a Korean title and punctuation from the title class', () => {
    expect(titleProblem('Week 3 letters', r)).toBeNull();
    expect(titleProblem('한글 3주차', r)).toBeNull();
    expect(titleProblem('Review: g, n, d (part 1/2)!', r)).toBeNull();
  });

  it('refuses an empty, too long, emoji or other-script title', () => {
    expect(titleProblem('   ', r)).toBe('empty');
    expect(titleProblem('x'.repeat(61), r)).toBe('chars');
    expect(titleProblem('Letters 🎉', r)).toBe('chars');
    expect(titleProblem('Урок 1', r)).toBe('chars');
  });

  it('refuses a banned word', () => {
    expect(titleProblem('Missed letters', r)).toBe('banned');
  });

  it('refuses a roster first name or alias as a whole token, any case', () => {
    expect(titleProblem("Minho's review", r)).toBe('name');
    expect(titleProblem('review with minho', r)).toBe('name');
    expect(titleProblem('Anne-Marie day', r)).toBe('name');
    expect(titleProblem('Letters for M. K.', r)).toBe('name');
    expect(titleProblem('Minhonest letters', r)).toBeNull();
    expect(titleProblem('Siobhán', r)).toBe('name');
    expect(titleProblem('Letters for M. K.', roster(['M. K.'], true))).toBe('name');
  });

  it('refuses a surname or a later name token too (two letters or more)', () => {
    expect(titleProblem('Kim family week', r)).toBe('name');
    expect(titleProblem('Dupont letters', r)).toBe('name');
    expect(titleProblem("O'Neil review", r)).toBe('name');
    expect(titleProblem('Letters a.m. and p.m.', roster(['A Lee']))).toBeNull();
  });

  it('a Hangul name with a particle attached is still a name', () => {
    const k = roster(['민호', '김지우']);
    expect(titleProblem('민호의 수업', k)).toBe('name');
    expect(titleProblem('민호랑 한글', k)).toBe('name');
    expect(titleProblem('지우와 같이', k)).toBe('name');
    expect(titleProblem('김지우는 최고', k)).toBe('name');
    expect(titleProblem('한글 수업', k)).toBeNull();
    expect(titleProblem('우리 반', k)).toBeNull();
  });
});

describe('the plan on screen, this week only, and the 30-block cap (F-TCH-004 §3.11)', () => {
  const plan = (over: Partial<PlanView>): PlanView => ({
    id: 'plan:1',
    spaceId: 'space:c',
    authorAccountId: 'a',
    title: 'Week 3',
    items: [],
    targetLearnerIds: null,
    publishedAt: '2026-10-01T00:00:00.000Z',
    archivedAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...over,
  });
  const week = (index: number, startDate: string): WeekMeta => ({ index, startDate, kind: 'learn', focus: { episodeId: null, storyIds: [], festival: null }, extras: [] });
  const quests = (n: number, extra: Partial<PlanItem> = {}): PlanItem[] => Array.from({ length: n }, (_, i) => ({ kind: 'quest' as const, id: `quest:q${i}`, ...extra }));

  it('reads the plan id from the URL', () => {
    expect(lecturePlanFrom(new URLSearchParams('id=s&from=plan&plan=plan%3A7'))).toBe('plan:7');
    expect(lecturePlanFrom(new URLSearchParams('id=s&from=plan'))).toBeNull();
    expect(lecturePlanFrom(null)).toBeNull();
  });

  it('presents the plan picked on the plan page when it is still live, else the newest published one', () => {
    const older = plan({ id: 'plan:old', publishedAt: '2026-09-01T00:00:00.000Z' });
    const newer = plan({ id: 'plan:new', publishedAt: '2026-10-05T00:00:00.000Z' });
    const draft = plan({ id: 'plan:draft', publishedAt: null });
    const gone = plan({ id: 'plan:gone', archivedAt: '2026-10-06T00:00:00.000Z' });
    expect(pickPlan([older, newer, draft, gone], 'plan:old')?.id).toBe('plan:old');
    expect(pickPlan([older, newer, draft, gone], null)?.id).toBe('plan:new');
    expect(pickPlan([older, newer, draft, gone], 'plan:draft')?.id).toBe('plan:new');
    expect(pickPlan([older, newer, draft, gone], 'plan:gone')?.id).toBe('plan:new');
    expect(pickPlan([draft], null)).toBeNull();
  });

  it('a classic plan keeps every item, in order', () => {
    expect(planOutline(plan({ items: quests(3) }), '2026-10-11')).toEqual({ blocks: planBlocks({ items: quests(3) }), omitted: 0 });
  });

  it('a 31-item plan is cut to 30 blocks and says how many were left out', () => {
    const out = planOutline(plan({ items: quests(31) }), '2026-10-11');
    expect(out.blocks).toHaveLength(LECTURE_MAX_BLOCKS);
    expect(out.omitted).toBe(1);
  });

  it("a route plan presents this week's items only (by week, or by date), never the whole term", () => {
    const weeks = [week(1, '2026-10-05'), week(2, '2026-10-12'), week(3, '2026-10-19')];
    const items: PlanItem[] = [
      { kind: 'quest', id: 'quest:w1', week: 1, targetDate: '2026-10-06' },
      { kind: 'quest', id: 'quest:w2a', week: 2, targetDate: '2026-10-13' },
      { kind: 'quest', id: 'quest:w2b', targetDate: '2026-10-15' },
      { kind: 'quest', id: 'quest:w3', week: 3, targetDate: '2026-10-20' },
      ...quests(60, { week: 3 }),
    ];
    const meta = { weeks } as unknown as PlanView['meta'];
    const ids = (today: string) => planOutline(plan({ items, meta }), today).blocks.map((b) => (b.kind === 'quest' ? b.id : b.kind));
    expect(ids('2026-10-14')).toEqual(['quest:w2a', 'quest:w2b']);
    expect(ids('2026-10-01')).toEqual(['quest:w1']);
    expect(ids('2026-12-01')).toHaveLength(LECTURE_MAX_BLOCKS);
    expect(planOutline(plan({ items, meta }), '2026-10-20')).toMatchObject({ omitted: 31 });
  });

  it('an outline at the cap takes nothing more; an empty or oversize outline cannot be presented', () => {
    const full: LectureBlock[] = Array.from({ length: LECTURE_MAX_BLOCKS }, () => ({ kind: 'quiz', from: 'all', rounds: 3 }));
    expect(canAdd(full)).toBe(false);
    expect(canAdd(full.slice(1))).toBe(true);
    expect(outlineProblem([])).toBe('empty');
    expect(outlineProblem(full)).toBeNull();
    expect(outlineProblem([...full, { kind: 'quiz', from: 'all', rounds: 3 }])).toBe('too-many');
  });

  it('presenterLink never throws: a 31-block outline is refused, a good one gives the deck and the URL', () => {
    const base = { title: 'Week 3', options: {}, source: 'catalogue' as const, now: NOW, rng: rng() };
    const many: LectureBlock[] = Array.from({ length: LECTURE_MAX_BLOCKS + 1 }, () => ({ kind: 'quiz', from: 'all', rounds: 3 }));
    expect(presenterLink('https://app.hangulroute.com', { ...base, blocks: many })).toEqual({ ok: false });
    expect(presenterLink('https://app.hangulroute.com', { ...base, title: '   ', blocks: many.slice(0, 2) })).toEqual({ ok: false });
    const good = presenterLink('https://app.hangulroute.com', { ...base, blocks: many.slice(0, 2) });
    expect(good.ok).toBe(true);
    if (good.ok) expect(good.url).toBe(presenterUrl('https://app.hangulroute.com', good.deck));
  });
});

describe('quiz scope warnings at compose time (F-TCH-004 §3.3 rule 7)', () => {
  const quest: LectureBlock = { kind: 'quest', id: 'quest:stage1-letters-q1' };
  const prev: LectureBlock = { kind: 'quiz', from: 'previous', rounds: 5 };
  const all: LectureBlock = { kind: 'quiz', from: 'all', rounds: 5 };

  it('a quiz with nothing taught before it is flagged', () => {
    expect(quizWarnings([prev, quest])).toEqual([0]);
    expect(quizWarnings([all, quest])).toEqual([0]);
  });

  it("'previous' looks back to the last quiz; 'all' to the start", () => {
    expect(quizWarnings([quest, prev, prev])).toEqual([2]);
    expect(quizWarnings([quest, prev, all])).toEqual([]);
    expect(quizWarnings([quest, prev, { kind: 'activity', preset: 'air-write', minutes: 3 }, prev])).toEqual([3]);
  });

  it('a scope of letters alone needs 4 distinct ones', () => {
    expect(quizWarnings([{ kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ'] }, prev])).toEqual([1]);
    expect(quizWarnings([{ kind: 'revisit', chars: ['ㄱ', 'ㄴ'] }, { kind: 'revisit', chars: ['ㄴ', 'ㄷ'] }, prev])).toEqual([2]);
    expect(quizWarnings([{ kind: 'revisit', chars: ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ'] }, prev])).toEqual([]);
    expect(quizWarnings([{ kind: 'revisit', chars: ['ㄱ'] }, quest, prev])).toEqual([]);
    expect(quizWarnings([{ kind: 'jamo-set', jamoIds: ['jamo:giyeok', 'jamo:nieun'] }, { kind: 'class-code', code: 'ABC234' }, prev])).toEqual([2]);
  });

  it('no quiz, no warning', () => {
    expect(quizWarnings([quest])).toEqual([]);
    expect(quizWarnings([])).toEqual([]);
  });
});

describe('who can compose (F-TCH-004 §3.11: the plan.write roles)', () => {
  const item = (id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role']): SpaceListItem => ({
    space: { id, kind, name: 'S', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
    role,
    counts: { learners: 0, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  });

  it('a teacher or owner of a class, and a caregiver or owner of a family', () => {
    expect(canComposeIn([item('space:c', 'class', 'teacher')], 'space:c')).toBe(true);
    expect(canComposeIn([item('space:c', 'class', 'owner')], 'space:c')).toBe(true);
    expect(canComposeIn([item('space:f', 'family', 'caregiver')], 'space:f')).toBe(true);
    expect(canComposeIn([item('space:f', 'family', 'owner')], 'space:f')).toBe(true);
  });

  it('not a school role, not a space the account is not a member of, not before the list loads', () => {
    expect(canComposeIn([item('space:s', 'school', 'owner')], 'space:s')).toBe(false);
    expect(canComposeIn([item('space:s', 'school', 'admin')], 'space:s')).toBe(false);
    expect(canComposeIn([item('space:s', 'school', 'admin')], 'space:child')).toBe(false);
    expect(canComposeIn(null, 'space:c')).toBe(false);
  });
});

describe('deck and presenter link (F-TCH-004 §3.2)', () => {
  const blocks: LectureBlock[] = [
    { kind: 'episode', id: 'episode:stage1-letters' },
    { kind: 'quiz', from: 'previous', rounds: 5 },
  ];

  it('builds a valid deck: fresh id, the clock, a seed, the options, and no helper picker (LV-H)', () => {
    const deck = buildDeck({
      title: ' Week 3 ',
      blocks,
      options: { romanization: 'tap', strokeGuide: false, sound: true, uiLocale: 'es' },
      source: 'plan',
      now: NOW,
      rng: rng(),
    });
    expect(LectureDeckSchema.parse(deck)).toEqual(deck);
    expect(deck.id).toMatch(/^lecture:[a-z0-9]{10}$/);
    expect(deck.title).toBe('Week 3');
    expect(deck.createdAt).toBe('2026-10-11T09:00:00.000Z');
    expect(deck.seed).toBeGreaterThanOrEqual(0);
    expect(deck.options).toEqual({ romanization: 'tap', strokeGuide: false, sound: true, quizRounds: 5, uiLocale: 'es' });
    expect(deck.source).toBe('plan');
    expect(deck.picker).toBeNull();
    expect(buildDeck({ title: 'A', blocks, options: {}, source: 'catalogue', now: NOW, rng: rng() }).id).toBe(deck.id);
  });

  it('the presenter URL is the app origin, /present and the deck in the fragment', () => {
    const deck = buildDeck({ title: 'Week 3', blocks, options: {}, source: 'plan', now: NOW, rng: rng() });
    const url = presenterUrl('https://app.hangulroute.com', deck);
    expect(url.startsWith('https://app.hangulroute.com/present#d=1.')).toBe(true);
    const decoded = decodeDeck(url.split('#d=')[1]!);
    expect(decoded.ok && decoded.deck).toEqual(deck);
  });

  it('property: for every title and seed, no roster name or alias is anywhere in the built URL', () => {
    const r = roster(AWKWARD);
    const needles = [...new Set([...AWKWARD.flatMap((n) => n.split(/\s+/)), ...AWKWARD.map((n) => rosterAlias(n)).filter((a) => a.length > 0)])];
    // The title is the only free text in the URL: every needle is refused there.
    for (const needle of needles) expect(titleProblem(`Week 3 ${needle}`, r), needle).toBe('name');
    const titles = ['Week 3 letters', '한글 3주차', 'Review: g, n, d (part 1/2)!', 'Stage 1 day'];
    for (const [k, title] of titles.entries()) {
      expect(titleProblem(title, r)).toBeNull();
      let x = 0.1 + k * 0.17;
      const seeded = (): number => (x = (x * 9301 + 0.49297) % 1);
      const deck = buildDeck({ title, blocks, options: {}, source: 'plan', now: NOW, rng: seeded });
      const parsed = new URL(presenterUrl('https://app.hangulroute.com', deck));
      const decoded = decodeDeck(parsed.hash.replace(/^#d=/, ''));
      expect(decoded.ok).toBe(true);
      const haystacks = [decodeURIComponent(parsed.pathname), decodeURIComponent(parsed.search), JSON.stringify(decoded.ok ? decoded.deck : null)].map((h) => h.toLowerCase());
      for (const needle of needles) for (const hay of haystacks) expect(hay.includes(needle.toLowerCase()), `${title}: ${needle}`).toBe(false);
    }
  });
});
