import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../../content';
import { VOCAB_ITEMS, VOCAB_TOPICS } from '../../../content/__generated__/vocab';
import { storiesAll } from '../../../content/stories';
import { buildStoryIndex } from '../../story/story-index';
import { lectureBundle } from '../content';
import { expandDeck, withBuilds, type Slide } from '../deck-builder';
import { sequenceView, slideSound } from '../slide-view';
import { readToMePlan } from '../story-slides';

/**
 * Sound plays the Korean on every slide that shows it (F-TCH-004 section 3.4 amendment
 * 2026-10-17; owner report: a word card, 김밥 / gimbap, played nothing). Every shipped episode,
 * quest, story and vocabulary topic is expanded as `presenter-glyphs.test.ts` does, with a Korean
 * voice and without one, and every slide that draws Hangul must have a `slideSound` at its full
 * reveal and at every build that shows Korean (romanization always and tap; the reading slides of
 * LV-S1 among them), unless its kind is one of the few that have nothing of their own to play.
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
 * own path, checked below), an activity, the End slide (a summary of many words), Odd One Out and a
 * story check with no target word (their only Korean is in the options, so playing it would say
 * the answer).
 */
function silentByDesign(slide: Slide): boolean {
  if (slide.kind === 'title' || slide.kind === 'story' || slide.kind === 'activity' || slide.kind === 'end') return true;
  return slide.kind === 'quiz' && (slide.prompt.ask === 'odd-one-out' || (slide.prompt.ask === 'check' && slide.prompt.target === undefined));
}

/**
 * Whether the slide shows Korean at `reveal`. Every slide kind shows its Korean from build 0, but an
 * order slide, whose steps appear one per build and may be in the UI language only: until a Korean
 * step shows, it has nothing of its own to play; and a Type Hangul write-together slide (LV-S4), whose
 * prompt is in the UI language and whose Korean is the answer, shown only at its answer build.
 */
function koreanShownAt(slide: Slide, reveal: number): boolean {
  if (slide.kind === 'write-together') return slide.variant !== 'type' || slide.builds[reveal] === 'answer';
  if (slide.kind !== 'sequence') return true;
  const view = sequenceView(slide, reveal);
  const steps = view.mode === 'order' ? view.steps : slide.steps.slice(0, view.count);
  return steps.some((step) => step.ko !== undefined);
}

/** Every `spokenKo` the shipped content gives a Korean text, by that text (any object with both fields). */
function spokenKoByKo(...roots: unknown[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value !== null && typeof value === 'object') {
      const { ko, spokenKo } = value as { ko?: unknown; spokenKo?: unknown };
      if (typeof ko === 'string' && typeof spokenKo === 'string') out.set(ko, (out.get(ko) ?? new Set()).add(spokenKo));
      Object.values(value).forEach(walk);
    }
  };
  roots.forEach(walk);
  return out;
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

  it.each([true, false])('at every build, with romanization always and tap, a slide that shows Korean has a sound (Korean voice: %s)', (canPlayKorean) => {
    const silent: string[] = [];
    for (const romanization of ['always', 'tap'] as const) {
      for (const slide of withBuilds(everySlide(canPlayKorean), { romanization, strokeGuide: true })) {
        if (!drawsHangul(slide) || silentByDesign(slide)) continue;
        slide.builds.forEach((_, reveal) => {
          if (koreanShownAt(slide, reveal) && slideSound(slide, reveal) === undefined) silent.push(`${romanization} ${slide.kind}: ${slide.key} @${reveal}`);
        });
      }
    }
    expect(silent).toEqual([]);
  });

  it('every word card plays Korean it holds: its own word, or the spoken form the content gives it', () => {
    const words = everySlide(true).filter((s): s is Extract<Slide, { kind: 'vocab' }> => s.kind === 'vocab');
    expect(words.length).toBeGreaterThan(100);
    const spokenKo = spokenKoByKo(questsAll, episodesAll, VOCAB_ITEMS);
    for (const word of words) {
      const sound = slideSound(word);
      expect(sound?.spoken.text, word.key).toBe(word.spoken.text);
      expect(sound?.kind, word.key).toBe(word.speech);
      // The word on the card, or a `spokenKo` its source gives that word (F-AUDIO-004).
      expect([word.word.ko, ...(spokenKo.get(word.word.ko) ?? [])], word.key).toContain(word.spoken.text);
      expect(word.spoken.romanization, word.key).toBe(word.word.romanization);
    }
  });

  it("Read-to-me on every story scene says every piece of Korean the scene draws, the scene's line or keyword included", () => {
    const scenes = everySlide(true).filter((s): s is Extract<Slide, { kind: 'story' }> => s.kind === 'story');
    expect(scenes.filter((s) => s.korean !== undefined).length).toBeGreaterThan(100);
    const unsaid = scenes.flatMap((scene) => {
      const plan = readToMePlan(scene, { sound: true, canPlayKorean: true, voiceChecked: true, narrationLang: 'en-US', reveal: scene.builds.length - 1 });
      const said = new Set(plan?.steps.filter((step) => step.language === 'ko-KR').map((step) => step.text));
      const drawn = [...scene.narration.flatMap((piece) => ('ko' in piece ? [piece.ko] : [])), ...(scene.korean ? [scene.korean.ko] : [])];
      return drawn.filter((ko) => !said.has(ko)).map((ko) => `${scene.key}: ${ko}`);
    });
    expect(unsaid).toEqual([]);
  });

  it('only a letter, a syllable, a Match Sound question and a letter or syllable listen round play at the sound rate', () => {
    let listenSounds = 0;
    for (const slide of everySlide(true)) {
      const sound = slideSound(slide);
      if (sound?.kind !== 'sound') continue;
      // A Listen & Pick letter or syllable round (`lp:sym:`, `lp:syl:`) plays at the sound rate, as the learner's game does (LV-S2).
      const listen = slide.kind === 'quiz' && slide.prompt.ask === 'listen' && slide.prompt.speech === 'sound';
      if (listen) listenSounds += 1;
      const soundRate = slide.kind === 'letter' || slide.kind === 'syllable' || (slide.kind === 'quiz' && slide.prompt.ask === 'sound') || listen;
      expect(soundRate, slide.key).toBe(true);
    }
    expect(listenSounds).toBeGreaterThan(0);
  });

  it('every question slide (LV-S2) plays what it asks about: the heard prompt, the other speaker\'s line, the key word or the sheet', () => {
    const asked = everySlide(true).filter((s): s is Extract<Slide, { kind: 'quiz' }> => s.kind === 'quiz' && ['listen', 'reply', 'realia'].includes(s.prompt.ask));
    for (const ask of ['listen', 'reply', 'realia'] as const) expect(asked.some((s) => s.prompt.ask === ask), ask).toBe(true);
    for (const slide of asked) {
      const sound = slideSound(slide);
      if (slide.prompt.ask === 'listen') expect(sound, slide.key).toEqual({ spoken: slide.prompt.line.spoken, kind: slide.prompt.speech });
      else if (slide.prompt.ask === 'reply') expect(sound, slide.key).toEqual({ spoken: slide.prompt.line.spoken, kind: 'sentence' });
      else if (slide.prompt.ask === 'realia') expect(sound, slide.key).toEqual({ spoken: slide.prompt.key?.spoken ?? slide.prompt.sheet.spoken, kind: 'word' });
    }
  });
});
