import {
  CATALOG,
  LECTURE_PRESETS,
  PRESET_DEFAULT_MINUTES,
  PRESET_LENGTHS,
  applyChooserSelection,
  classPosition,
  decodeDeck,
  deckVersion,
  questIdsOfBlocks,
  resolvePreset,
  selectionBlocks,
  toggleLesson,
  toggleRow,
  type ChooserEpisodeRow,
  type LectureBlock,
  type LecturePreset,
  type PresetContext,
  type WeekMeta,
} from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { PlanView, Roster, RosterLearner } from '../api';
import { LECTURE_V2_LINKS_FROM, buildDeck, presenterLink, v2LinksAllowed } from '../lecture';
import {
  V2_PRESETS,
  consolePresetContext,
  consolePresetOrder,
  consolePresets,
  consoleRevisitChars,
  defaultPresetStage,
  needsV2,
  planWeekQuests,
  presetCardWords,
  presetFallbackLine,
  presetFrom,
  presetMinutes,
  presetSource,
  presetStages,
  presetTitle,
  resolveConsolePreset,
  somethingToFollow,
} from '../lecture-presets';
import { applyToOutline, chooserKeys, consoleChooserGroups, lessonLocked, outlineSelection } from '../lesson-picker';

/**
 * The console's ready-made lessons (AMENDMENTS-LECTURE-V2 sections 4.1 to 4.6 and 14, row LV-4): the rollout rule for
 * v2 links pinned on both sides of `LECTURE_V2_LINKS_FROM` with an injected clock, the presets the page offers and
 * their order, the console context builder (N1, N2, W1, U) with awkward roster names kept out of every link and title,
 * the words of a card, `?from=`, and the chooser's tri-state on the outline.
 */

const BEFORE = new Date('2026-10-30T23:59:59.999Z');
const ON = new Date('2026-10-31T00:00:00.000Z');
const TODAY = '2026-10-15';
const NOW = new Date('2026-10-15T12:00:00.000Z');
const APP = 'https://app.hangulroute.com';

const journey = (here: string, done: number, known = 0) => ({ v: 1 as const, here, stages: [{ stage: here, state: 'open', done, known, total: 15 }] });
const vocab = (needsPractice: string[]) => ({ collected: 10, strong: 2, topicsStarted: 1, topicsPracticed7d: 1, needsPractice });

const learner = (displayName: string, i: number, summary: Record<string, unknown> | null = {}): RosterLearner => ({
  id: `profile:l${i}`,
  displayName,
  ageGroup: '8-9',
  avatar: 'hoya-orange',
  joinedAt: '2026-09-01T00:00:00.000Z',
  lastActiveAt: '2026-10-14T00:00:00.000Z',
  lastSyncedAt: null,
  summary:
    summary === null
      ? null
      : ({
          lastActiveAt: '2026-10-14T00:00:00.000Z',
          streakDays: 1,
          stage1: { questsDone: 3, questsTotal: 15, anchorAccuracy: null },
          cardsUnlocked: 1,
          minutesLast7d: 10,
          jamoRecognized: [],
          needsPractice: [],
          planProgress: {},
          ...summary,
        } as RosterLearner['summary']),
});

const roster = (learners: RosterLearner[], kind: 'class' | 'family' = 'class', joinCode: string | null = 'ABC234'): Roster => ({
  space: { id: 'space:c', kind, name: 'Sunday Class A', parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: null, createdAt: '2026-09-01T00:00:00.000Z' },
  learners,
  joinCode,
  joinCodeExpiresAt: null,
});

const plan = (over: Partial<PlanView> = {}): PlanView => ({
  id: 'plan:1',
  spaceId: 'space:c',
  authorAccountId: 'teacher-kim',
  title: 'Week three',
  items: [
    { kind: 'quest', id: 'quest:stage1-life-q1' },
    { kind: 'quest', id: 'quest:stage1-life-q2' },
  ],
  targetLearnerIds: null,
  publishedAt: '2026-10-10T09:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-09T09:00:00.000Z',
  updatedAt: '2026-10-10T09:00:00.000Z',
  ...over,
});

const rng = (): (() => number) => {
  let x = 0.137;
  return () => {
    x = (x * 9301 + 0.49297) % 1;
    return x;
  };
};

const words = (locale: UiLocale = 'en') => getMessages(locale).console.lecture.presets;
const empty = (): PresetContext => consolePresetContext({ roster: roster([]), plan: null, today: TODAY, now: NOW });

describe('the rollout rule for v2 links (section 4.5): no v2 link before LECTURE_V2_LINKS_FROM', () => {
  it('is 14 days after LV-2 reached production (2026-10-17)', () => {
    expect(LECTURE_V2_LINKS_FROM).toBe('2026-10-31');
    expect((Date.parse(`${LECTURE_V2_LINKS_FROM}T00:00:00Z`) - Date.parse('2026-10-17T00:00:00Z')) / 86_400_000).toBe(14);
  });

  it('pins both sides of the day, in UTC', () => {
    expect(v2LinksAllowed(BEFORE)).toBe(false);
    expect(v2LinksAllowed(NOW)).toBe(false);
    expect(v2LinksAllowed(ON)).toBe(true);
    expect(v2LinksAllowed(new Date('2027-01-01T00:00:00Z'))).toBe(true);
  });

  it('before the day the page offers no Word review; from the day it offers all six', () => {
    expect(consolePresets(BEFORE)).toEqual(LECTURE_PRESETS.filter((p) => p !== 'word-review'));
    expect(consolePresets(ON)).toEqual([...LECTURE_PRESETS]);
    expect(consolePresetOrder(empty(), BEFORE)).not.toContain('word-review');
    expect(consolePresetOrder(empty(), ON)).toContain('word-review');
  });

  it('Word review is the only preset whose deck needs v2 (LV-D6), so it is the only one held back', () => {
    const rich = consolePresetContext({
      roster: roster([learner('a', 0, { journey: journey('stage1', 7), vocab: vocab(['vocab:uyu']) }), learner('b', 1, { journey: journey('stage1', 4), vocab: vocab(['vocab:uyu']) })], 'family'),
      plan: plan(),
      today: TODAY,
      now: NOW,
    });
    expect(V2_PRESETS).toEqual(['word-review']);
    for (const ctx of [rich, empty()]) {
      for (const preset of LECTURE_PRESETS) {
        for (const minutes of PRESET_LENGTHS[preset]) {
          const resolved = resolveConsolePreset(preset, minutes, 'stage2', ctx);
          expect(deckVersion(resolved) === 2, `${preset} ${minutes}`).toBe(resolved.preset === 'word-review');
          if (deckVersion(resolved) === 2) expect(V2_PRESETS).toContain(preset);
        }
      }
    }
  });

  it('a Word review link is refused before the day and is a v2 deck naming its preset from the day', () => {
    const ctx = consolePresetContext({ roster: roster([]), plan: plan(), today: TODAY, now: NOW });
    const resolved = resolveConsolePreset('word-review', 10, 'stage1', ctx);
    expect(resolved.preset).toBe('word-review');
    expect(needsV2(resolved.blocks)).toBe(true);
    const input = (now: Date) => ({ title: presetTitle(resolved, words()), blocks: resolved.blocks, options: {}, source: presetSource(resolved, ctx), now, rng: rng(), preset: resolved.preset });
    expect(presenterLink(APP, input(BEFORE))).toEqual({ ok: false });
    const link = presenterLink(APP, input(ON));
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(link.deck.v).toBe(2);
    expect(link.deck.preset).toBe('word-review');
    expect(link.deck.picker).toBeNull();
    const decoded = decodeDeck(link.url.split('#d=')[1] ?? '');
    expect(decoded.ok && decoded.deck.v).toBe(2);
  });

  it('every other preset is an ordinary v1 link on both sides of the day, with no preset id and no picker', () => {
    const ctx = consolePresetContext({ roster: roster([learner('a', 0, { journey: journey('stage1', 7) })]), plan: plan(), today: TODAY, now: NOW });
    for (const preset of LECTURE_PRESETS.filter((p) => p !== 'word-review')) {
      for (const now of [BEFORE, ON]) {
        const resolved = resolveConsolePreset(preset, PRESET_DEFAULT_MINUTES[preset], 'stage3', ctx);
        const link = presenterLink(APP, { title: presetTitle(resolved, words()), blocks: resolved.blocks, options: {}, source: presetSource(resolved, ctx), now, rng: rng(), preset: resolved.preset });
        expect(link.ok, preset).toBe(true);
        if (!link.ok) continue;
        expect(link.deck.v).toBe(1);
        expect(link.deck.preset).toBeUndefined();
        expect(link.deck.picker).toBeNull();
        expect(link.url.split('#d=')[1]?.startsWith('1.')).toBe(true);
      }
    }
  });

  it('buildDeck writes the version the blocks need and the preset only into a v2 deck', () => {
    const base = { title: 'Lesson', options: {}, source: 'catalogue' as const, now: ON, rng: rng() };
    expect(buildDeck({ ...base, blocks: [{ kind: 'quest', id: 'quest:stage1-life-q1' }], preset: 'hangul-week-1' })).toMatchObject({ v: 1, picker: null });
    expect(buildDeck({ ...base, blocks: [{ kind: 'quest', id: 'quest:stage1-life-q1' }], preset: 'hangul-week-1' }).preset).toBeUndefined();
    const v2 = buildDeck({ ...base, blocks: [{ kind: 'word-review', questIds: ['quest:stage1-life-q1'], vocabIds: [], rounds: 5 }], preset: 'word-review' });
    expect(v2).toMatchObject({ v: 2, preset: 'word-review', picker: null });
    expect(buildDeck({ ...base, blocks: [{ kind: 'word-review', questIds: ['quest:stage1-life-q1'], vocabIds: [], rounds: 5 }] }).preset).toBeUndefined();
  });
});

describe('the order and the stages (section 4.1)', () => {
  it('Next lesson is first with something to follow, else last', () => {
    const following = consolePresetContext({ roster: roster([learner('a', 0, { journey: journey('stage1', 2) })]), plan: null, today: TODAY, now: NOW });
    expect(somethingToFollow(following)).toBe(true);
    expect(consolePresetOrder(following, ON)).toEqual(['next-lesson', 'hangul-week-1', 'by-stage', 'story-time', 'word-review', 'warm-up']);
    expect(somethingToFollow(empty())).toBe(false);
    expect(consolePresetOrder(empty(), BEFORE)).toEqual(['hangul-week-1', 'by-stage', 'story-time', 'warm-up', 'next-lesson']);
  });

  it('a plan this week is something to follow too', () => {
    const ctx = consolePresetContext({ roster: roster([]), plan: plan(), today: TODAY, now: NOW });
    expect(consolePresetOrder(ctx, BEFORE)[0]).toBe('next-lesson');
  });

  it('Stage by stage offers the stages with a ready cell and opens on the class stage, else the first', () => {
    expect(presetStages()).toEqual(['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7']);
    expect(defaultPresetStage(empty())).toBe('stage1');
    const stage3 = consolePresetContext({ roster: roster([learner('a', 0, { journey: journey('stage3', 1) })]), plan: null, today: TODAY, now: NOW });
    expect(defaultPresetStage(stage3)).toBe('stage3');
    expect(defaultPresetStage(stage3, ['stage1', 'stage2'])).toBe('stage1');
    expect(defaultPresetStage(empty(), [])).toBe('stage1');
  });

  it('a card builds its chosen length when the preset offers it, else its default', () => {
    expect(presetMinutes('hangul-week-1', {})).toBe(20);
    expect(presetMinutes('hangul-week-1', { 'hangul-week-1': 30 })).toBe(30);
    expect(presetMinutes('word-review', { 'word-review': 30 })).toBe(10);
    expect(presetMinutes('warm-up', { 'warm-up': 20 })).toBe(10);
  });
});

describe('the console context (sections 4.2 and 4.3)', () => {
  it('N1: this week\'s plan outline, its title only when the roster check accepts it', () => {
    const ctx = consolePresetContext({ roster: roster([learner('Minho Kim', 0)]), plan: plan(), today: TODAY, now: NOW });
    expect(ctx.plan).toEqual({ title: 'Week three', blocks: [{ kind: 'quest', id: 'quest:stage1-life-q1' }, { kind: 'quest', id: 'quest:stage1-life-q2' }] });
    const next = resolveConsolePreset('next-lesson', 20, 'stage1', ctx);
    expect(next.blocks.slice(0, 2)).toEqual(ctx.plan?.blocks);
    expect(presetTitle(next, words())).toBe('Week three');
    expect(presetSource(next, ctx)).toBe('plan');
    const named = consolePresetContext({ roster: roster([learner('Minho Kim', 0)]), plan: plan({ title: "Minho's week" }), today: TODAY, now: NOW });
    expect(presetTitle(resolveConsolePreset('next-lesson', 20, 'stage1', named), words())).toBe('Next lesson');
    // No roster: the plan title is never used.
    const noRoster = consolePresetContext({ roster: null, plan: plan(), today: TODAY, now: NOW });
    expect(noRoster.planTitleOk).toBeUndefined();
    expect(presetTitle(resolveConsolePreset('next-lesson', 20, 'stage1', noRoster), words())).toBe('Next lesson');
  });

  it('N2: the class position from the roster summaries (two numbers, nobody named)', () => {
    const rows = [learner('a', 0, { journey: journey('stage1', 7) }), learner('b', 1, { journey: journey('stage1', 9) }), learner('c', 2, { journey: journey('stage2', 1) }), learner('d', 3, null)];
    const ctx = consolePresetContext({ roster: roster(rows), plan: null, today: TODAY, now: NOW });
    expect(ctx.position).toEqual(classPosition([{ journey: journey('stage1', 7) }, { journey: journey('stage1', 9) }, { journey: journey('stage2', 1) }], CATALOG));
    expect(ctx.position).toEqual({ questId: 'quest:stage1-rites-q2', stage: 'stage1' });
    expect(resolveConsolePreset('next-lesson', 20, 'stage1', ctx).blocks[0]).toEqual({ kind: 'quest', id: 'quest:stage1-rites-q2' });
    expect(presetSource(resolveConsolePreset('next-lesson', 20, 'stage1', ctx), ctx)).toBe('catalogue');
    expect(consolePresetContext({ roster: roster([learner('a', 0)]), plan: null, today: TODAY, now: NOW }).position).toBeNull();
  });

  it('W1: the plan\'s quests, and the class words only with two or more vocab summaries', () => {
    const one = consolePresetContext({ roster: roster([learner('a', 0, { vocab: vocab(['vocab:uyu']) })], 'family'), plan: plan(), today: TODAY, now: NOW });
    expect(one.recentWords).toEqual({ questIds: ['quest:stage1-life-q1', 'quest:stage1-life-q2'], vocabIds: [] });
    const two = consolePresetContext({ roster: roster([learner('a', 0, { vocab: vocab(['vocab:uyu']) }), learner('b', 1, { vocab: vocab(['vocab:uyu', 'vocab:ppang']) })], 'family'), plan: null, today: TODAY, now: NOW });
    expect(two.recentWords).toEqual({ questIds: [], vocabIds: ['vocab:uyu', 'vocab:ppang'] });
    // No plan and no words: Word review falls back to the warm-up with its line.
    const fallback = resolveConsolePreset('word-review', 10, 'stage1', empty());
    expect(fallback.preset).toBe('warm-up');
    expect(presetFallbackLine(fallback.fallback, words())).toBe(words().fallback.warmUp);
  });

  it('W1 on a route plan: this week\'s items first, then last week\'s', () => {
    const weeks: WeekMeta[] = [
      { index: 1, startDate: '2026-10-05', goals: [] },
      { index: 2, startDate: '2026-10-12', goals: [] },
    ] as unknown as WeekMeta[];
    const route = plan({
      items: [
        { kind: 'quest', id: 'quest:stage1-letters-q1', week: 1, targetDate: '2026-10-06' },
        { kind: 'episode', id: 'episode:stage1-life', week: 2, targetDate: '2026-10-13' },
      ],
      meta: { weeks } as unknown as PlanView['meta'],
    });
    expect(planWeekQuests(route, TODAY)).toEqual({ thisWeek: ['quest:stage1-life-q1', 'quest:stage1-life-q2', 'quest:stage1-life-q3'], lastWeek: ['quest:stage1-letters-q1'] });
    // Before the route: its first week, and no week before it.
    expect(planWeekQuests(route, '2026-09-01')).toEqual({ thisWeek: ['quest:stage1-letters-q1'], lastWeek: [] });
    // After it: the last week and the one before.
    expect(planWeekQuests(route, '2026-12-01').lastWeek).toEqual(['quest:stage1-letters-q1']);
    expect(planWeekQuests(plan(), TODAY)).toEqual({ thisWeek: ['quest:stage1-life-q1', 'quest:stage1-life-q2'], lastWeek: [] });
    expect(planWeekQuests(null, TODAY)).toEqual({ thisWeek: [], lastWeek: [] });
    expect(planWeekQuests(plan({ meta: { weeks: [] } as unknown as PlanView['meta'] }), TODAY).lastWeek).toEqual([]);
  });

  it('U: the roll-up letters (at most 3) topped up from the plan\'s taught letters to 6, plain jamo only', () => {
    expect(consoleRevisitChars(['ㅂ', 'ㅅ', 'ㅈ', 'ㅊ'], [{ kind: 'quest', id: 'quest:stage1-letters-q1' }])).toEqual(['ㅂ', 'ㅅ', 'ㅈ', 'ㅏ', 'ㅓ', 'ㄱ']);
    expect(consoleRevisitChars([], [{ kind: 'episode', id: 'episode:stage1-life' }])).toEqual(['ㅈ', 'ㅊ', 'ㅂ', 'ㅅ', 'ㅋ', 'ㅌ']);
    expect(consoleRevisitChars(['ㄴ/final', 'ㄱ'], [])).toEqual(['ㄱ']);
    // A rollup of one letter and no plan: the warm-up tops up to four letters (section 4.2 U).
    const ctx = consolePresetContext({ roster: roster([learner('a', 0, { needsPractice: ['ㅎ'] })]), plan: null, today: TODAY, now: NOW });
    expect(ctx.revisitChars).toEqual(['ㅎ']);
    const warm = resolveConsolePreset('warm-up', 10, 'stage1', ctx);
    expect(warm.blocks[0]).toEqual({ kind: 'revisit', chars: ['ㅎ', 'ㄱ', 'ㄴ', 'ㄷ'] });
    expect(presetSource(warm, ctx)).toBe('revisit');
    expect(presetSource(resolveConsolePreset('warm-up', 10, 'stage1', empty()), empty())).toBe('catalogue');
  });

  it('is the same context the presenter\'s resolver reads: the same preset and length give the same blocks', () => {
    const ctx = consolePresetContext({ roster: roster([learner('a', 0, { journey: journey('stage2', 3) })]), plan: null, today: TODAY, now: NOW });
    for (const preset of LECTURE_PRESETS) {
      for (const minutes of PRESET_LENGTHS[preset]) {
        expect(resolveConsolePreset(preset, minutes, 'stage4', ctx)).toEqual(resolvePreset(preset, minutes, { ...ctx, stage: 'stage4' }));
      }
    }
  });
});

/** The texts a block carries into the link: its ids, letters and code (not its grammar words such as `kind`). */
function textsOf(block: LectureBlock): string[] {
  switch (block.kind) {
    case 'quest':
    case 'episode':
      return [block.id];
    case 'story':
      return [block.storyId];
    case 'vocab':
      return [block.topicId, ...(block.wordIds ?? [])];
    case 'revisit':
      return [...block.chars];
    case 'jamo-set':
      return [...block.jamoIds];
    case 'cards':
      return [...block.cardIds];
    case 'word-review':
      return [...block.questIds, ...block.vocabIds];
    case 'class-code':
      return [block.code];
    default:
      return [];
  }
}

describe('no learner name reaches a link or a title (sections 8 and 14)', () => {
  // Accents, Hangul, apostrophes, a hyphen, one- and two-letter names and a very long one. (Names are chosen so that
  // no three letters of them are also three letters of a shipped title or id, or the check below could not tell.)
  const AWKWARD = ['José Ruiz', "Siobhán O'Neil", 'Renée-Lou Vuković', '김민호', '서윤', 'Ünal Yıldız', 'Łucja Wąż', 'Bo', 'A', 'Wolfeschlegelsteinhausenbergerdorff', 'Ngozi Okafor', "Zoë D'Wyx"];
  const learners = AWKWARD.map((name, i) => learner(name, i, { journey: journey('stage1', i), needsPractice: ['ㅂ'], vocab: vocab(['vocab:uyu']) }));
  /** Every 3-letter piece of every name, lower-cased (the "no substring" check of section 14). */
  const pieces = [...new Set(AWKWARD.flatMap((n) => {
    const lower = n.toLowerCase();
    const out: string[] = [];
    for (let i = 0; i + 3 <= lower.length; i += 1) {
      const piece = lower.slice(i, i + 3);
      if (!/\s/.test(piece)) out.push(piece);
    }
    return out;
  }))];

  it.each(['en', 'es', 'ko'] as const)('%s: every preset at every length, on a class and a family space: the names change nothing in the link', (locale) => {
    // The same rows with plain stand-in names: what the names alone could add to a link shows as a difference.
    const plain = learners.map((l, i) => ({ ...l, displayName: `Zq${i}` }));
    for (const kind of ['class', 'family'] as const) {
      const named = consolePresetContext({ roster: roster(learners, kind), plan: plan({ title: 'Week three' }), today: TODAY, now: NOW });
      const control = consolePresetContext({ roster: roster(plain, kind), plan: plan({ title: 'Week three' }), today: TODAY, now: NOW });
      for (const preset of LECTURE_PRESETS) {
        for (const minutes of PRESET_LENGTHS[preset]) {
          for (const stage of presetStages()) {
            const link = (ctx: PresetContext) => {
              const resolved = resolveConsolePreset(preset, minutes, stage, ctx);
              return presenterLink(APP, { title: presetTitle(resolved, words(locale)), blocks: resolved.blocks, options: {}, source: presetSource(resolved, ctx), now: ON, rng: rng(), preset: resolved.preset });
            };
            const withNames = link(named);
            const without = link(control);
            expect(withNames.ok, `${preset} ${minutes} ${stage}`).toBe(true);
            if (!withNames.ok || !without.ok) continue;
            // The encoded fragment is the one a roster without these names gives, byte for byte.
            expect(withNames.url, `${locale} ${kind} ${preset} ${minutes} ${stage}`).toBe(without.url);
            // What the fragment carries as text: the title and every id, letter and code (the grammar's own words aside).
            const decoded = decodeDeck(withNames.url.split('#d=')[1] ?? '');
            expect(decoded.ok).toBe(true);
            const carried = decoded.ok ? [decoded.deck.title, ...decoded.deck.blocks.flatMap(textsOf)].map((t) => t.toLowerCase()) : [];
            for (const piece of pieces) {
              for (const text of carried) expect(text.includes(piece), `${locale} ${preset} carries "${piece}" in "${text}"`).toBe(false);
            }
          }
        }
      }
    }
  });

  it('a plan title that holds a learner name never becomes the deck title', () => {
    for (const name of ['Siobhán', 'Vuković', '김민호', '민호']) {
      const ctx = consolePresetContext({ roster: roster(learners), plan: plan({ title: `${name} week` }), today: TODAY, now: NOW });
      expect(presetTitle(resolveConsolePreset('next-lesson', 20, 'stage1', ctx), words())).toBe('Next lesson');
    }
  });

  it('reads every text a block carries', () => {
    expect(textsOf({ kind: 'word-review', questIds: ['quest:a'], vocabIds: ['vocab:b'], rounds: 5 })).toEqual(['quest:a', 'vocab:b']);
    expect(textsOf({ kind: 'class-code', code: 'ABC234' })).toEqual(['ABC234']);
    expect(textsOf({ kind: 'quiz', from: 'previous', rounds: 4 })).toEqual([]);
  });

  it('the context holds no name, no learner id and no summary', () => {
    const ctx = consolePresetContext({ roster: roster(learners), plan: plan(), today: TODAY, now: NOW });
    const text = JSON.stringify({ ...ctx, catalog: undefined });
    for (const name of AWKWARD.filter((n) => n.length >= 3)) expect(text).not.toContain(name);
    expect(text).not.toContain('profile:');
    expect(text).not.toContain('minutesLast7d');
  });
});

describe('the words of a card (section 12.2)', () => {
  it('Next lesson names this week\'s plan, else the class or the family', () => {
    const w = words();
    expect(presetCardWords('next-lesson', w, { planTitle: 'Week three', family: false }).line).toBe("From this week's plan: Week three");
    expect(presetCardWords('next-lesson', w, { planTitle: null, family: false }).line).toBe(w.next.class);
    expect(presetCardWords('next-lesson', w, { planTitle: null, family: true }).line).toBe(w.next.family);
    expect(LECTURE_PRESETS.map((p) => presetCardWords(p, w, { planTitle: null, family: false }).title)).toEqual([w.next.title, w.zero.title, w.stage.title, w.story.title, w.words.title, w.warmup.title]);
    expect(LECTURE_PRESETS.map((p) => presetCardWords(p, w, { planTitle: null, family: false }).line).slice(1)).toEqual([w.zero.body, w.stage.body, w.story.body, w.words.body, w.warmup.body]);
  });

  it('every deck title is a preset name in the console language (never a story title)', () => {
    const ko = words('ko');
    expect(presetTitle({ titleKey: 'zero.short' }, ko)).toBe('한글 1주차');
    expect(presetTitle({ titleKey: 'stage.chip', stageNumber: 4 }, ko)).toBe('4단계');
    expect(presetTitle({ titleKey: 'stage.chip' }, words())).toBe('Stage 1');
    expect(presetTitle({ titleKey: 'words.title' }, ko)).toBe('낱말 복습');
    expect(presetTitle({ titleKey: 'warmup.short' }, words('es'))).toBe('Calentamiento rápido');
    expect(presetTitle({ titleKey: 'story.title' }, words('es'))).toBe('Hora del cuento');
    expect(presetTitle({ titleKey: 'next.title' }, words())).toBe('Next lesson');
    expect(presetTitle({ titleKey: 'plan', planTitle: 'Week 3' }, words())).toBe('Week 3');
    expect(presetTitle({ titleKey: 'plan' }, words())).toBe('Next lesson');
    const story = resolveConsolePreset('story-time', 20, 'stage1', empty());
    expect(presetTitle(story, words())).toBe('Story time');
  });

  it('the fallback lines', () => {
    const w = words();
    expect(presetFallbackLine('zero', w)).toBe(w.fallback.zero);
    expect(presetFallbackLine('warm-up', w)).toBe(w.fallback.warmUp);
    expect(presetFallbackLine('restart', w)).toBe(w.fallback.restart);
    expect(presetFallbackLine(null, w)).toBeNull();
    // Nothing to follow: Next lesson starts with Hangul week 1 and says so.
    expect(resolveConsolePreset('next-lesson', 20, 'stage1', empty()).fallback).toBe('zero');
  });

  it('?from=plan opens Next lesson, ?from=revisit the warm-up', () => {
    expect(presetFrom('plan')).toBe('next-lesson');
    expect(presetFrom('revisit')).toBe('warm-up');
    expect(presetFrom(null)).toBeNull();
  });
});

describe('the chooser on the outline: one tri-state choice per episode (sections 14 and 18.3)', () => {
  const groups = consoleChooserGroups('en', 'lecture');
  const keys = chooserKeys(groups);
  const rows = groups.flatMap((g) => g.rows);
  const episodes = rows.filter((r): r is ChooserEpisodeRow => r.kind === 'episode');

  /** Quests of the outline counted with repeats (a quest block, or the cell of an episode block). */
  const questsWithRepeats = (blocks: readonly LectureBlock[]): string[] => blocks.flatMap((b) => (b.kind === 'quest' ? [b.id] : b.kind === 'episode' ? questIdsOfBlocks([b], CATALOG) : []));

  it('checking an episode adds one block and locks its lessons; checking a mixed episode merges its lessons at the first one\'s place', () => {
    const row = episodes.find((r) => r.key === 'episode:stage2-letters') as ChooserEpisodeRow;
    let blocks: LectureBlock[] = [{ kind: 'quiz', from: 'previous', rounds: 4 }];
    const press = (next: (s: readonly string[]) => string[]): void => {
      blocks = applyToOutline(blocks, groups, keys, next(outlineSelection(blocks, keys)));
    };
    press((s) => toggleLesson(s, row, 'quest:stage2-letters-q3'));
    press((s) => toggleLesson(s, row, 'quest:stage2-letters-q1'));
    expect(blocks).toEqual([{ kind: 'quiz', from: 'previous', rounds: 4 }, { kind: 'quest', id: 'quest:stage2-letters-q3' }, { kind: 'quest', id: 'quest:stage2-letters-q1' }]);
    press((s) => toggleRow(s, row));
    expect(blocks).toEqual([{ kind: 'quiz', from: 'previous', rounds: 4 }, { kind: 'episode', id: 'episode:stage2-letters' }]);
    expect(lessonLocked(outlineSelection(blocks, keys), row)).toBe(true);
    press((s) => toggleRow(s, row));
    expect(blocks).toEqual([{ kind: 'quiz', from: 'previous', rounds: 4 }]);
    expect(lessonLocked(outlineSelection(blocks, keys), row)).toBe(false);
  });

  it('no quest is ever twice in the deck, whatever the presses (seeded random walk)', () => {
    let seed = 7;
    const next = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    let blocks: LectureBlock[] = [];
    for (let step = 0; step < 1500; step += 1) {
      const selection = outlineSelection(blocks, keys);
      const row = rows[next(rows.length)]!;
      let chosen: string[];
      if (row.kind === 'episode' && next(2) === 0) {
        if (lessonLocked(selection, row)) continue;
        chosen = toggleLesson(selection, row, row.lessons[next(row.lessons.length)]!.key);
      } else {
        chosen = toggleRow(selection, row);
      }
      if (selectionBlocks(chosen, groups).length > 30) continue;
      blocks = applyToOutline(blocks, groups, keys, chosen);
      const quests = questsWithRepeats(blocks);
      expect(new Set(quests).size, `step ${step}`).toBe(quests.length);
      expect(blocks.length).toBeLessThanOrEqual(30);
    }
  });

  it('applyChooserSelection keeps what the chooser does not hold in its place', () => {
    const quiz: LectureBlock = { kind: 'quiz', from: 'previous', rounds: 4 };
    const out = applyChooserSelection<LectureBlock>([quiz], () => null, ['episode:stage1-letters'], () => [{ kind: 'episode', id: 'episode:stage1-letters' }]);
    expect(out).toEqual([quiz, { kind: 'episode', id: 'episode:stage1-letters' }]);
  });
});
