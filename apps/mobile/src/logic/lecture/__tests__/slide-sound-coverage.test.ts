import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../../content';
import { VOCAB_TOPICS } from '../../../content/__generated__/vocab';
import { storiesAll } from '../../../content/stories';
import { buildStoryIndex } from '../../story/story-index';
import { lectureBundle } from '../content';
import { expandDeck, type Slide } from '../deck-builder';
import { slideSound } from '../slide-view';

/**
 * Sound plays the Korean on every slide that shows it (F-TCH-004 section 3.4 amendment
 * 2026-10-17; owner report: a word card, 김밥 / gimbap, played nothing). Every shipped episode,
 * quest, story and vocabulary topic is expanded as `presenter-glyphs.test.ts` does, with a Korean
 * voice and without one, and every slide that draws Hangul must have a `slideSound` at its full
 * reveal, unless its kind is one of the few that have nothing of their own to play.
 */

/** Hangul syllables, Hangul jamo and compatibility jamo. */
const isHangul = (cp: number): boolean =>
  (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x3130 && cp <= 0x318f);

/** Slide fields that are not drawn Korean: UI-language text, the slide key and the voice's own text. */
const NOT_DRAWN_KOREAN = new Set(['key', 'title', 'fact', 'gloss', 'spoken']);

function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value !== null && typeof value === 'object') {
    for (const [field, v] of Object.entries(value)) if (!NOT_DRAWN_KOREAN.has(field)) strings(v, out);
  }
  return out;
}

const drawsHangul = (slide: Slide): boolean => strings(slide).some((s) => [...s].some((ch) => isHangul(ch.codePointAt(0)!)));

/**
 * The slides with nothing of their own to play: a title, a story scene (Read-to-me reads it on its
 * own path), an activity, the End slide (a summary of many words), Odd One Out and a story check
 * with no target word (their only Korean is in the options, so playing it would say the answer).
 */
function silentByDesign(slide: Slide): boolean {
  if (slide.kind === 'title' || slide.kind === 'story' || slide.kind === 'activity' || slide.kind === 'end') return true;
  return slide.kind === 'quiz' && (slide.prompt.ask === 'odd-one-out' || (slide.prompt.ask === 'check' && slide.prompt.target === undefined));
}

const deck = (blocks: LectureBlock[]) =>
  LectureDeckSchema.parse({ v: 1, id: 'lecture:sound01', title: 'Every block', createdAt: '2026-10-17T09:00:00Z', seed: 1, blocks });

const blocks: LectureBlock[] = [
  ...episodesAll.filter((e) => e.status !== 'preview' && e.questIds.length > 0).map((e): LectureBlock => ({ kind: 'episode', id: e.id })),
  ...questsAll.map((q): LectureBlock => ({ kind: 'quest', id: q.id })),
  ...[...new Set(buildStoryIndex({ stories: storiesAll, episodes: episodesAll, quests: questsAll, showUnreviewed: false }).map((e) => e.storyId))].map(
    (storyId): LectureBlock => ({ kind: 'story', storyId, checks: true }),
  ),
  ...VOCAB_TOPICS.map((t): LectureBlock => ({ kind: 'vocab', topicId: t.id })),
];

function everySlide(canPlayKorean: boolean): Slide[] {
  const out: Slide[] = [];
  for (let i = 0; i < blocks.length; i += 30) out.push(...expandDeck(deck(blocks.slice(i, i + 30)), lectureBundle('en'), { canPlayKorean }).slides);
  return out;
}

describe('Sound plays the Korean on every slide that shows it (F-TCH-004 section 3.4 amendment 2026-10-17)', () => {
  it('covers every kind of block that is shipped', () => {
    expect(new Set(blocks.map((b) => b.kind))).toEqual(new Set(['episode', 'quest', 'story', 'vocab']));
  });

  it.each([true, false])('every slide that draws Hangul has a sound at its full reveal, or is silent by design (Korean voice: %s)', (canPlayKorean) => {
    const slides = everySlide(canPlayKorean);
    expect(slides.length).toBeGreaterThan(500);
    const silent = slides.filter((s) => drawsHangul(s) && !silentByDesign(s) && slideSound(s, s.builds.length - 1) === undefined).map((s) => `${s.kind}: ${s.key}`);
    expect(silent).toEqual([]);
  });

  it('every word card plays Korean it holds: its own word, or the spoken form the content gives it', () => {
    const words = everySlide(true).filter((s): s is Extract<Slide, { kind: 'vocab' }> => s.kind === 'vocab');
    expect(words.length).toBeGreaterThan(100);
    for (const word of words) {
      const sound = slideSound(word);
      expect(sound?.spoken.text, word.key).toBe(word.spoken.text);
      expect(sound?.kind, word.key).toBe(word.speech);
      // A shipped word card has no `spokenKo` of its own yet, so Sound says the word on the card.
      expect(word.spoken.text, word.key).toBe(word.word.ko);
      expect(word.spoken.romanization, word.key).toBe(word.word.romanization);
    }
  });

  it('only a letter, a syllable and a Match Sound question play at the sound rate', () => {
    for (const slide of everySlide(true)) {
      const sound = slideSound(slide);
      if (sound?.kind !== 'sound') continue;
      const soundRate = slide.kind === 'letter' || slide.kind === 'syllable' || (slide.kind === 'quiz' && slide.prompt.ask === 'sound');
      expect(soundRate, slide.key).toBe(true);
    }
  });
});
