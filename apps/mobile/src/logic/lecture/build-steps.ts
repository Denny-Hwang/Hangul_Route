import type { ActivityPreset, RomanizationMode } from '@hangul-route/content-schema';
import type { SpokenForm } from '../audio/spoken';

/**
 * What a slide shows and the order its parts appear in (F-TCH-004 §3.4). A
 * **build** is one teacher click inside a slide (slideware reveal); a slide
 * starts on build 0 and `controls.ts` steps through `builds`.
 *
 * Builds depend on the deck options, so the presenter recomputes them when
 * the teacher flips romanization live (`Shift+R`, §3.7): `always` merges the
 * romanization into the Korean's first build, `tap` gives it a build of its
 * own right after (D2): on a sequence or story slide, one `rom` build reveals
 * the romanization of every Korean line on it. Pure.
 */

/** Taught Korean on a slide: always with its romanization (CLAUDE.md §1). */
export interface KoLine {
  ko: string;
  romanization: string;
  /** In the deck's UI language; absent for a syllable that is only a sound block. */
  gloss?: string;
}

/** A narration run: plain text, or a keyword drawn as a `KoreanText` chip. */
export type NarrationPiece = { text: string } | KoLine;

export type QuizPrompt =
  /** Match Sound: play the carrier syllable (never the letter name, F-AUDIO-004 AD1-AD2). */
  | { ask: 'sound'; spoken: SpokenForm }
  /** Word to gloss: the Korean on screen, pick its meaning. */
  | { ask: 'meaning'; ko: string; romanization: string }
  /** Odd One Out: which letter is not like the others (the question is a catalogue string). */
  | { ask: 'odd-one-out' }
  /** A story check: its own prompt (`{target}` stands for the target word). */
  | { ask: 'check'; text: string; target?: KoLine };

/** A quiz option; the screen adds the shape + number marker by position (§3.4). */
export interface QuizOption {
  ko?: string;
  romanization?: string;
  gloss?: string;
  /** A story check picture (`prop:` / `card:` ...). */
  art?: string;
  correct: boolean;
}

export interface SequenceStep {
  id: string;
  gloss: string;
  ko?: string;
  romanization?: string;
}

export type SlideBody =
  | {
      kind: 'title';
      source: 'episode' | 'quest' | 'topic' | 'story';
      title: string;
      subtitle?: string;
      line?: string;
      /** A story's cover scene. */
      cover?: { storyId: string; sceneId: string };
    }
  | {
      kind: 'letter';
      jamoId: string;
      char: string;
      romanization: string;
      nameEn: string;
      ipa?: string;
      soundHint?: string;
      spoken: SpokenForm;
      example?: KoLine;
      /** A stroke skeleton exists for the guide panel. */
      hasStrokes: boolean;
      /** Native-reviewed; otherwise the panel says "Simplified stroke guide" (§3.6). */
      strokeReviewed: boolean;
      /** From a trace-stroke step: the stroke guide is the first build (§3.3 rule 2). */
      strokeFirst?: true;
    }
  | { kind: 'syllable'; ko: string; romanization: string; split: string; parts: string[]; spoken: SpokenForm }
  | {
      kind: 'vocab';
      word: KoLine & { gloss: string };
      cardId?: string;
      wordId?: string;
      /** A topic word's WordArt key (F-VOC-002), drawn at the `art` build after the gloss (README D9). */
      wordArt?: string;
    }
  | { kind: 'sequence'; steps: SequenceStep[]; shuffled: string[] }
  | { kind: 'story'; storyId: string; sceneId: string; narration: NarrationPiece[]; korean?: KoLine & { gloss: string }; caption?: string }
  | {
      kind: 'quiz';
      prompt: QuizPrompt;
      options: QuizOption[];
      /** No voice (or sound off): the prompt is the teacher-says text (F-AUDIO-004 §3.8). */
      textPrompt: boolean;
      /** A story check's explanation, shown at the answer. */
      explain?: string;
    }
  | { kind: 'card'; cardId: string; title: string; ko?: string; romanization?: string; fact?: string }
  | { kind: 'activity'; preset: ActivityPreset; minutes: number }
  | { kind: 'end'; letters: KoLine[]; words: KoLine[]; classCode?: string };

export type SlideKind = SlideBody['kind'];

export type BuildName =
  | 'title'
  | 'ko'
  | 'rom'
  | 'stroke'
  | 'sound'
  | 'name'
  | 'example'
  | 'parts'
  | 'join'
  | 'gloss'
  | 'art'
  | 'step'
  | 'order'
  | 'narration'
  | 'korean'
  | 'question'
  | 'answer'
  | 'fact'
  | 'prompt'
  | 'summary';

export interface BuildOptions {
  romanization: RomanizationMode;
  strokeGuide: boolean;
}

export function buildsFor(body: SlideBody, opts: BuildOptions): BuildName[] {
  const tap = opts.romanization === 'tap';
  const rom: BuildName[] = tap ? ['rom'] : [];
  switch (body.kind) {
    case 'letter': {
      const stroke = opts.strokeGuide && body.hasStrokes;
      const first = stroke && body.strokeFirst === true;
      return [
        ...(first ? (['stroke'] as const) : []),
        'ko',
        ...rom,
        ...(stroke && !first ? (['stroke'] as const) : []),
        'sound',
        'name',
        ...(body.example ? (['example'] as const) : []),
      ];
    }
    case 'syllable':
      return ['parts', 'join', 'rom', 'sound'];
    case 'vocab':
      return ['ko', ...rom, 'gloss', ...(body.cardId !== undefined || body.wordArt !== undefined ? (['art'] as const) : [])];
    case 'sequence':
      // `tap`: every step's romanization appears together at one build, before the order question.
      return [...body.steps.map((): BuildName => 'step'), ...(body.steps.some((s) => s.ko !== undefined) ? rom : []), 'order'];
    case 'story': {
      // `tap`: the Korean line's and the narration keyword chips' romanization appear at one build, last.
      const chips = body.narration.some((piece) => 'ko' in piece);
      return ['art', 'narration', ...(body.korean ? (['korean'] as const) : []), ...(body.korean || chips ? rom : [])];
    }
    case 'quiz':
      return ['question', 'answer'];
    case 'card':
      // The chip (and so its romanization build) is drawn only when the card has both its Korean and romanization.
      return ['art', ...(body.ko !== undefined && body.romanization !== undefined ? rom : []), ...(body.fact !== undefined ? (['fact'] as const) : [])];
    case 'activity':
      return ['prompt'];
    case 'end':
      return ['summary'];
    case 'title':
      return ['title'];
  }
}
