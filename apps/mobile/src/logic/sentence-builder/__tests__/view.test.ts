import { getMessages } from '@hangul-route/i18n';
import type { Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { buildRound, type SbRound } from '../progression';
import { startFlow, stepFlow, type SbState } from '../reducer';
import {
  doneView,
  headerView,
  hintView,
  instructionOf,
  lineView,
  noteParts,
  placedAnnouncement,
  patternNoteOf,
  showSkip,
  trayView,
  widestTile,
  wordLabel,
} from '../view';
import { BOOK_PARTICLE, EAT_RICE, LIKE_TTEOKGUK } from './fixtures';

const m = getMessages('en');
const copy = m.learner.minigame;
const a11y = m.a11y.minigame;
const always = { romanizationMode: 'always' as const };
const tap = { romanizationMode: 'tap' as const };

const eat = buildRound(EAT_RICE, 1)!;
const like = buildRound(LIKE_TTEOKGUK, 2)!;
const book = buildRound(BOOK_PARTICLE, 3)!;
const idOf = (round: SbRound, ko: string): string => round.tray.find((t) => t.ko === ko)!.id;

function tapAll(round: SbRound, kos: readonly string[], state: SbState = startFlow(1)): SbState {
  let at = (state.lastTapAt ?? 0) + 1000;
  for (const ko of kos) {
    state = stepFlow(state, [round], { type: 'tap', tileId: idOf(round, ko), at }).state;
    if (state.returning !== null) state = stepFlow(state, [round], { type: 'settle' }).state;
    at += 500;
  }
  return state;
}

describe('headerView', () => {
  it('practice: a bar and "n / N"', () => {
    expect(headerView('quest', { ...startFlow(5), roundIdx: 1 }, copy)).toEqual({ kind: 'bar', title: undefined, value: 2, max: 5, label: '2 / 5' });
  });

  it('the Check: fill-only dots and Quick check, filled once a round is built', () => {
    const state = startFlow(2);
    expect(headerView('check', state, copy)).toEqual({ kind: 'dots', title: 'Quick check', value: 0, max: 2, label: undefined });
    expect(headerView('check', { ...state, status: 'complete' }, copy).value).toBe(1);
    expect(headerView('check', { ...state, roundIdx: 1, status: 'done' }, copy).value).toBe(2);
  });

  it('offers Skip everywhere but the Check', () => {
    expect(showSkip('quest')).toBe(true);
    expect(showSkip('check')).toBe(false);
  });
});

describe('instructionOf', () => {
  it('asks for the words in order, or for the piece that fits', () => {
    expect(instructionOf(eat, copy)).toBe('Tap the words in order.');
    expect(instructionOf(book, copy)).toBe('Tap the piece that fits.');
  });
});

describe('lineView', () => {
  it('starts with one empty place per word, the first one next', () => {
    const line = lineView(eat, startFlow(1), always, a11y);
    expect(line).toEqual([
      { kind: 'slot', key: 'word-0', next: true, attached: false, stem: undefined, accessibilityLabel: 'Place 1 of 2, empty, next' },
      { kind: 'slot', key: 'word-1', next: false, attached: false, stem: undefined, accessibilityLabel: 'Place 2 of 2, empty' },
    ]);
  });

  it('shows a placed word with its romanization (always) and names it with the romanization (tap)', () => {
    const state = tapAll(eat, ['밥을']);
    expect(lineView(eat, state, always, a11y)[0]).toEqual({
      kind: 'placed',
      key: 'word-0',
      ko: '밥을',
      romanization: 'babeul',
      accessibilityLabel: 'Place 1 of 2: 밥을, babeul',
    });
    expect(lineView(eat, state, tap, a11y)[0]).toMatchObject({ romanization: '', accessibilityLabel: 'Place 1 of 2: 밥을, babeul' });
    expect(lineView(eat, state, always, a11y)[1]).toMatchObject({ kind: 'slot', next: true, accessibilityLabel: 'Place 2 of 2, empty, next' });
  });

  it('a particle round: the other words are given, the particle place sits against its stem', () => {
    const line = lineView(book, startFlow(1), always, a11y);
    expect(line[0]).toEqual({
      kind: 'slot',
      key: 'word-0',
      next: true,
      attached: true,
      stem: '책',
      accessibilityLabel: 'Place 1 of 2, joins the word before it, empty',
    });
    expect(line[1]).toMatchObject({ kind: 'fixed', ko: '있어요', romanization: 'isseoyo' });
    const joined = lineView(book, tapAll(book, ['이']), always, a11y);
    expect(joined[0]).toMatchObject({ kind: 'placed', ko: '책이', romanization: 'chaegi' });
  });

  it('marks no place next once the sentence is built', () => {
    const built = tapAll(eat, ['밥을', '먹어요']);
    expect(lineView(eat, built, always, a11y).every((u) => u.kind === 'placed')).toBe(true);
    const half = { ...tapAll(eat, ['밥을']), status: 'complete' as const };
    expect(lineView(eat, half, always, a11y)[1]).toMatchObject({ kind: 'slot', next: false, accessibilityLabel: 'Place 2 of 2, empty' });
  });
});

describe('placedAnnouncement', () => {
  it('names the place a right tile just filled, and nothing before the first one', () => {
    expect(placedAnnouncement(eat, startFlow(1), a11y)).toBe('');
    expect(placedAnnouncement(eat, tapAll(eat, ['밥을']), a11y)).toBe('Place 1 of 2: 밥을, babeul');
    expect(placedAnnouncement(eat, tapAll(eat, ['밥을', '먹어요']), a11y)).toBe('Place 2 of 2: 먹어요, meogeoyo');
    // A particle round announces the joined word.
    expect(placedAnnouncement(book, tapAll(book, ['이']), a11y)).toBe('Place 1 of 2: 책이, chaegi');
  });
});

describe('widestTile', () => {
  it('is the tile with the most syllables, then the longest romanization', () => {
    expect(widestTile(like, always)?.ko).toBe('좋아해요');
    expect(widestTile(eat, always)).toMatchObject({ ko: '먹어요', romanization: 'meogeoyo' });
    expect(widestTile({ ...eat, tray: [] }, always)).toBeUndefined();
  });

  it('carries the romanization line only when the tiles show one (tap mode: none)', () => {
    expect(widestTile(eat, tap)).toMatchObject({ ko: '먹어요', romanization: '' });
  });
});

describe('trayView', () => {
  it('lists the tiles still in the tray with their romanization (always) or none (tap)', () => {
    const tray = trayView(eat, startFlow(1), always, a11y);
    expect(tray.map((t) => t.id)).toEqual(eat.tray.map((t) => t.id));
    expect(tray.find((t) => t.ko === '밥을')).toEqual({
      id: idOf(eat, '밥을'),
      ko: '밥을',
      romanization: 'babeul',
      look: 'idle',
      returning: false,
      accessibilityLabel: '밥을, babeul',
    });
    expect(trayView(eat, startFlow(1), tap, a11y).every((t) => t.romanization === '')).toBe(true);
  });

  it('marks a tried tile, names it tried, and shows it sliding back', () => {
    const missed = stepFlow(startFlow(1), [eat], { type: 'tap', tileId: 'd0', at: 1000 }).state;
    const tile = trayView(eat, missed, always, a11y).find((t) => t.id === 'd0')!;
    expect(tile).toMatchObject({ look: 'tried', returning: true, accessibilityLabel: '물을, mureul, tried' });
  });

  it('rings the right tile after the second miss, and drops placed tiles', () => {
    const state = tapAll(like, ['좋아해요', '떡국을']);
    const tray = trayView(like, state, always, a11y);
    expect(tray.find((t) => t.ko === '저는')).toMatchObject({ look: 'ring', accessibilityLabel: '저는, jeoneun, comes next' });
    expect(tray.find((t) => t.ko === '좋아해요')?.look).toBe('tried');
    const after = tapAll(like, ['저는'], state);
    expect(trayView(like, after, always, a11y).map((t) => t.ko).sort()).toEqual(['떡국을', '좋아해요']);
  });

  it('is empty once the sentence is built', () => {
    expect(trayView(eat, tapAll(eat, ['밥을', '먹어요']), always, a11y)).toEqual([]);
  });
});

describe('hintView', () => {
  const note = 'Use {ko:이} after a final consonant, {ko:가} after a vowel.';

  it('says nothing before a miss or once the sentence is built', () => {
    expect(hintView(startFlow(1), copy, note)).toBeNull();
    expect(hintView({ ...startFlow(1), hint: 'miss', status: 'complete' }, copy, note)).toBeNull();
  });

  it('gives the miss line, the verb-last line and the look-here line', () => {
    expect(hintView({ ...startFlow(1), hint: 'miss' }, copy, note)).toEqual({ line: 'Not that one yet. Try another word.', note: undefined });
    expect(hintView({ ...startFlow(1), hint: 'lastWord' }, copy, note)?.line).toBe('In Korean, the doing or describing word comes last.');
    expect(hintView({ ...startFlow(1), hint: 'lookHere' }, copy, note)?.line).toBe('This one comes next.');
  });

  it("shows the quest's Discover note again under a particle miss, or the line alone", () => {
    const hint = hintView({ ...startFlow(1), hint: 'particle' }, copy, note)!;
    expect(hint.line).toBe('Look at how the word before it ends.');
    expect(hint.note).toEqual([
      { text: 'Use ' },
      { ko: '이', romanization: 'i' },
      { text: ' after a final consonant, ' },
      { ko: '가', romanization: 'ga' },
      { text: ' after a vowel.' },
    ]);
    expect(hintView({ ...startFlow(1), hint: 'particle' }, copy, undefined)?.note).toBeUndefined();
  });
});

describe('noteParts', () => {
  it('keeps plain text, drops an empty token, and leaves a romanization out when it cannot be read', () => {
    expect(noteParts('Plain line.')).toEqual([{ text: 'Plain line.' }]);
    expect(noteParts('{ko:}x')).toEqual([{ text: 'x' }]);
    expect(noteParts('{ko:을}')).toEqual([{ ko: '을', romanization: 'eul' }]);
    expect(noteParts('{ko:A1}')).toEqual([{ ko: 'A1', romanization: '' }]);
  });
});

describe('doneView', () => {
  it('shows the calm line and the whole sentence once it is built', () => {
    expect(doneView(eat, startFlow(1), copy)).toBeNull();
    expect(doneView(eat, tapAll(eat, ['밥을', '먹어요']), copy)).toEqual({ line: 'You built the sentence!', sentence: EAT_RICE.sentence });
  });
});

describe('wordLabel', () => {
  it('reads "Korean, romanization", or the Korean alone', () => {
    expect(wordLabel('밥을', 'babeul')).toBe('밥을, babeul');
    expect(wordLabel('책', '')).toBe('책');
  });
});

describe('patternNoteOf', () => {
  const pattern = {
    type: 'pattern' as const,
    frame: { ko: '___이에요', romanization: '___ieyo', en: 'It is a ___' },
    noteEn: 'Use {ko:이에요} after a final consonant.',
    examples: [
      { ko: '책이에요', romanization: 'chaegieyo', en: 'It is a book.' },
      { ko: '학교예요', romanization: 'hakgyoyeyo', en: 'It is a school.' },
    ] as [never, never],
  };
  const quest = (steps: unknown[]): Pick<Quest, 'steps'> => ({ steps: steps as Quest['steps'] });

  it("finds the first pattern note of the quest's Discover step", () => {
    const steps = [
      { id: 'a', kind: 'intro', titleEn: 'Hi' },
      { id: 'b', kind: 'discover', titleEn: 'Look', discover: { pages: [{ items: [{ type: 'sentence', sentence: pattern.examples[0] }] }, { items: [pattern] }] } },
    ];
    expect(patternNoteOf(quest(steps))).toBe('Use {ko:이에요} after a final consonant.');
  });

  it('is undefined with no quest, no Discover step or no pattern item', () => {
    expect(patternNoteOf(undefined)).toBeUndefined();
    expect(patternNoteOf(quest([{ id: 'a', kind: 'intro', titleEn: 'Hi' }]))).toBeUndefined();
    expect(patternNoteOf(quest([{ id: 'b', kind: 'discover', titleEn: 'Look' }]))).toBeUndefined();
  });
});
