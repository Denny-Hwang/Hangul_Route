import { LectureDeckSchema, decodeDeck, type LectureBlock } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import type { Roster, RosterLearner } from '../api';
import {
  NO_ROSTER_COUNT,
  aboutMinutes,
  blockMinutes,
  buildDeck,
  classCodeBlock,
  firstName,
  lectureSourceFrom,
  moveBlock,
  pickerChoices,
  pickerLabels,
  planBlocks,
  presenterUrl,
  revisitBlock,
  rosterMessage,
  deckPicker,
  titleProblem,
  type PickerChoice,
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

describe('about-minutes from the catalogue (F-TCH-004 §3.11)', () => {
  it('quests and episodes from the Stage 1 mirror, stories from the lecture catalogue, quiz and activity from the block', () => {
    expect(blockMinutes({ kind: 'quest', id: 'quest:stage1-letters-q1' })).toBe(4);
    expect(blockMinutes({ kind: 'episode', id: 'episode:stage1-letters' })).toBe(4 + 4 + 5);
    expect(blockMinutes({ kind: 'quiz', from: 'previous', rounds: 5 })).toBe(5);
    expect(blockMinutes({ kind: 'activity', preset: 'air-write', minutes: 3 })).toBe(3);
    expect(blockMinutes({ kind: 'revisit', chars: ['ㄱ', 'ㄴ'] })).toBe(4);
    expect(blockMinutes({ kind: 'class-code', code: 'ABC234' })).toBe(0);
    expect(blockMinutes({ kind: 'quest', id: 'quest:unknown' })).toBeNull();
    expect(blockMinutes({ kind: 'episode', id: 'episode:unknown' })).toBeNull();
    expect(blockMinutes({ kind: 'story', storyId: 'story:unknown', checks: true })).toBeNull();
    expect(blockMinutes({ kind: 'vocab', topicId: 'vocab-topic:food' })).toBeNull();
    expect(blockMinutes({ kind: 'jamo-set', jamoIds: ['jamo:giyeok', 'jamo:a'] })).toBe(2);
    expect(blockMinutes({ kind: 'cards', cardIds: ['card:book'] })).toBe(1);
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
    ).toBe(6);
  });
});

describe('helper picker (F-TCH-004 §3.10, D12)', () => {
  it('defaults to names, with initials, numbers and none offered', () => {
    expect(pickerChoices(roster(['Minho Kim', 'Suni']))).toEqual({ offered: ['names', 'initials', 'numbers', 'none'], initial: 'names' });
  });

  it('anonymizeRoster forces initials and never offers names', () => {
    expect(pickerChoices(roster(['M. K.', 'S.'], true))).toEqual({ offered: ['initials', 'numbers', 'none'], initial: 'initials' });
  });

  it('a class with no learners yet defaults to numbers (12)', () => {
    expect(pickerChoices(roster([]))).toEqual({ offered: ['numbers', 'none'], initial: 'numbers' });
    expect(deckPicker('numbers', roster([]))).toEqual({ mode: 'numbers', count: NO_ROSTER_COUNT });
    expect(NO_ROSTER_COUNT).toBe(12);
  });

  it('more learners than the picker holds (60) offers numbers only, capped at 60', () => {
    const big = roster(Array.from({ length: 61 }, (_, i) => `Learner${i}`));
    expect(pickerChoices(big)).toEqual({ offered: ['numbers', 'none'], initial: 'numbers' });
    expect(deckPicker('numbers', big)).toEqual({ mode: 'numbers', count: 60 });
  });

  it('first names: the first token of the display name, kept as typed, at most 20 characters', () => {
    expect(firstName('Minho Kim')).toBe('Minho');
    expect(firstName('  José   Ruiz ')).toBe('José');
    expect(firstName('김민호')).toBe('김민호');
    expect(firstName("O'Neil")).toBe("O'Neil");
    expect(firstName('Maximilianalexanderthegreat Smith')).toBe('Maximilianalexandert');
    expect(firstName('Иван')).toBeNull();
    expect(firstName('   ')).toBeNull();
  });

  it('labels follow the chosen mode; a label outside the name class becomes its roster number', () => {
    const r = roster(['Minho Kim', 'Иван Петров', 'Suni']);
    expect(pickerLabels(r, 'names')).toEqual(['Minho', '2', 'Suni']);
    expect(pickerLabels(r, 'initials')).toEqual(['M. K.', '2', 'S.']);
    expect(pickerLabels(roster(['M. K.', 'S.'], true), 'initials')).toEqual(['M. K.', 'S.']);
  });

  it('the anonymized roster never sends names, even if asked', () => {
    expect(pickerLabels(roster(['M. K.'], true), 'names')).toEqual(['M. K.']);
    expect(rosterMessage('lecture:abc123', 'names', roster(['M. K.'], true))?.mode).toBe('initials');
  });

  it('the deck carries the mode and count only', () => {
    const r = roster(['Minho Kim', 'Suni']);
    expect(deckPicker('names', r)).toEqual({ mode: 'names', count: 2 });
    expect(deckPicker('initials', r)).toEqual({ mode: 'initials', count: 2 });
    expect(deckPicker('numbers', r)).toEqual({ mode: 'numbers', count: 2 });
    expect(deckPicker('none', r)).toBeNull();
    expect(deckPicker('names', roster(['M. K.'], true))).toEqual({ mode: 'initials', count: 1 });
  });

  it('the roster message carries only the labels of the chosen mode; numbers and none send none', () => {
    const r = roster(['Minho Kim', 'Suni']);
    expect(rosterMessage('lecture:abc123', 'names', r)).toEqual({
      ns: 'hangul-route.lecture',
      v: 1,
      type: 'roster',
      deckId: 'lecture:abc123',
      mode: 'names',
      labels: ['Minho', 'Suni'],
    });
    expect(rosterMessage('lecture:abc123', 'initials', r)?.labels).toEqual(['M. K.', 'S.']);
    expect(rosterMessage('lecture:abc123', 'numbers', r)).toBeNull();
    expect(rosterMessage('lecture:abc123', 'none', r)).toBeNull();
    expect(rosterMessage('lecture:abc123', 'names', roster([]))).toBeNull();
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
});

describe('deck and presenter link (F-TCH-004 §3.2)', () => {
  const blocks: LectureBlock[] = [
    { kind: 'episode', id: 'episode:stage1-letters' },
    { kind: 'quiz', from: 'previous', rounds: 5 },
  ];

  it('builds a valid deck: fresh id, the clock, a seed, the options and the picker', () => {
    const deck = buildDeck({
      title: ' Week 3 ',
      blocks,
      options: { romanization: 'tap', strokeGuide: false, sound: true, uiLocale: 'es' },
      picker: { mode: 'names', count: 2 },
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
    expect(buildDeck({ title: 'A', blocks, options: {}, picker: null, source: 'catalogue', now: NOW, rng: rng() }).id).toBe(deck.id);
  });

  it('the presenter URL is the app origin, /present and the deck in the fragment', () => {
    const deck = buildDeck({ title: 'Week 3', blocks, options: {}, picker: null, source: 'plan', now: NOW, rng: rng() });
    const url = presenterUrl('https://app.hangulroute.com', deck);
    expect(url.startsWith('https://app.hangulroute.com/present#d=1.')).toBe(true);
    const decoded = decodeDeck(url.split('#d=')[1]!);
    expect(decoded.ok && decoded.deck).toEqual(deck);
  });

  it('property: for every picker mode and an awkward roster, no label or roster name is anywhere in the URL', () => {
    const r = roster(AWKWARD);
    const needles = [...AWKWARD.flatMap((n) => n.split(/\s+/)), ...pickerLabels(r, 'initials'), ...pickerLabels(r, 'names')].map((n) =>
      n.toLowerCase(),
    );
    for (const choice of ['names', 'initials', 'numbers', 'none'] as PickerChoice[]) {
      const deck = buildDeck({ title: 'Week 3 letters', blocks, options: {}, picker: deckPicker(choice, r), source: 'plan', now: NOW, rng: rng() });
      const url = presenterUrl('https://app.hangulroute.com', deck);
      const parsed = new URL(url);
      const fragment = parsed.hash.replace(/^#d=/, '');
      const decoded = decodeDeck(fragment);
      expect(decoded.ok).toBe(true);
      const haystacks = [url, decodeURIComponent(url), parsed.pathname, parsed.search, JSON.stringify(decoded.ok ? decoded.deck : null)].map((h) =>
        h.toLowerCase(),
      );
      for (const needle of needles) for (const hay of haystacks) expect(hay.includes(needle), `${choice}: ${needle}`).toBe(false);
    }
  });
});
