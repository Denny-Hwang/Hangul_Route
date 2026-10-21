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
  /**
   * A story check: its own prompt (`{target}` stands for the target word). `glossAtAnswer`: a
   * pick-meaning or fill-word check, whose target gloss would give the answer away before the reveal.
   */
  | { ask: 'check'; text: string; target?: KoLine; glossAtAnswer?: true }
  /**
   * Listen & Pick (AMENDMENTS-LECTURE-V2 section 5.1, LV-S2; practice, apply and the Check): the room
   * hears `line` and picks how it is written or what it shows. At the answer build `line` (its
   * Korean, romanization and meaning) joins the question, so the room sees what it heard; without a
   * Korean voice the teacher reads its romanization and its Hangul waits for the answer (section 3.7).
   * `speech`: the rate Sound plays it at, as the learner's game (a letter or syllable round is a `sound`).
   * `reply`: the room heard a line and picks the reply that fits it (a word or sentence round whose answer
   * is not the line itself, as the Stage 4 Checks): the question is "Which answer fits?", not "Which one did you hear?".
   */
  | { ask: 'listen'; line: SpokenLine; speech: 'sound' | 'word' | 'sentence'; reply?: true }
  /** Tap to Respond (LV-S2): the other speaker's line, drawn from the start; the room picks the reply that fits. */
  | { ask: 'reply'; line: SpokenLine }
  /**
   * Realia Read (LV-S2): a question about the sheet that stays beside it (`text`, in the slide
   * language), the word it is about (`key`: its Korean and romanization; its meaning would give some
   * answers away) and the sheet line that holds the answer (`answerEntryId`), marked found at the
   * answer build.
   */
  | { ask: 'realia'; text: string; sheet: RealiaSheetView; key?: SheetText & { spoken: SpokenForm }; answerEntryId?: string };

/** A quiz option; the screen adds the shape + number marker by position (§3.4). */
export interface QuizOption {
  ko?: string;
  romanization?: string;
  /**
   * Its meaning in the slide language. A story check's word option shows it under the word; a
   * Listen & Pick or Tap to Respond row shows it at the answer build (V8); a picture's is its name.
   */
  gloss?: string;
  /** A story check picture (`prop:` / `card:` ...). */
  art?: string;
  /** A Listen & Pick or Realia Read picture (`card:` / `word:`, drawn by `PictureArt`); `gloss` names it (LV-S2). */
  picture?: string;
  /** A Realia Read figure: plain text with no Hangul, such as a price ("5,000 won"), drawn with the question (LV-S2). */
  figure?: string;
  correct: boolean;
}

/** Taught Korean on a reading slide (AMENDMENTS-LECTURE-V2 section 5.1): its gloss and what Sound says (`spokenKo ?? ko`, its clip). */
export type SpokenLine = KoLine & { gloss: string; spoken: SpokenForm };

/** A piece of a drawn real-world text on the stage (F-CURR-001 G-2): Hangul and its romanization. */
export interface SheetText {
  ko: string;
  romanization: string;
}

/**
 * A realia sheet as the stage draws it (F-CURR-001 §3.6, RealiaSheet's anatomy in stage units):
 * its layout, title and lines, its accessible text in the slide language, and what Sound reads
 * before the key words show (the title, then each line and its value, in order).
 */
export interface RealiaSheetView {
  /** The layout and dressing; `plain` for a realia with no kind. */
  kind: 'menu' | 'ticket' | 'sign' | 'price-card' | 'plain';
  /** The sheet's own title (taught Korean, so not `title`, which names UI-language text on a slide). */
  heading?: SheetText;
  entries: ReadonlyArray<{ id: string; text: SheetText; value?: SheetText; dir?: 'left' | 'right'; goods?: 'apples' | 'fan' | 'hanji' }>;
  /** `altEn` in the slide language (overlays): the sheet's accessible text (F-CURR-001 §3.14). */
  alt: string;
  spoken: SpokenForm;
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
      /**
       * What Sound / S plays (`slideSound`, section 3.4 amendment 2026-10-17): the content's
       * `spokenKo` when it has one, else the word, with its `audioRef` clip when there is one.
       */
      spoken: SpokenForm;
      /** The speech rate (F-AUDIO-004 `RATE_BASE`): a Discover sentence, pattern or exchange line is a sentence. */
      speech: 'word' | 'sentence';
      cardId?: string;
      wordId?: string;
      /** A topic word's WordArt key (F-VOC-002), drawn at the `art` build after the gloss (README D9). */
      wordArt?: string;
    }
  | { kind: 'sequence'; steps: SequenceStep[]; shuffled: string[] }
  | {
      kind: 'story';
      storyId: string;
      sceneId: string;
      narration: NarrationPiece[];
      /**
       * The scene's Korean (its line, else its keyword). `speech`: the rate Read-to-me reads it at
       * once its `korean` build shows (section 3.4 amendment 2026-10-17): a line is a sentence.
       */
      korean?: KoLine & { gloss: string; speech: 'word' | 'sentence' };
      caption?: string;
    }
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
  /** A Discover sentence (LV-S1, section 5.1): the Korean, its meaning and, when it has one, its picture (`card:` / `word:`). */
  | { kind: 'sentence'; sentence: SpokenLine; picture?: string }
  /**
   * A Discover sentence pattern (LV-S1): the frame's Korean around its slots (`pieces` has one more
   * entry than the frame has `___` slots, each slot drawn as a gap box, never as text), the note in
   * the slide language with its `{ko:}` tokens as Korean chips (absent when a token has no
   * romanization, rule 11), and the two examples.
   */
  | { kind: 'pattern'; frame: { pieces: string[]; romanization: string; gloss: string }; note?: NarrationPiece[]; examples: SpokenLine[] }
  /**
   * A Discover exchange (LV-S1): two lines between named speakers; Sound plays the current line and
   * lights it. `together`: no Korean voice or the deck's sound is off (section 5.1 "Text without a
   * Korean voice"), so every line shows at once and none is lit.
   */
  | { kind: 'read-along'; lines: Array<SpokenLine & { speaker: string }>; together?: true }
  /**
   * A Discover realia page (LV-S1): the drawn sheet, its caption (`{ko:}` tokens as chips) and its key
   * words; or a Realia Read sheet no page of this deck showed yet (LV-S2): the sheet alone, before its questions.
   */
  | { kind: 'realia'; sheet: RealiaSheetView; caption?: NarrationPiece[]; keyWords: SpokenLine[] }
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
  | 'summary'
  // The reading slides (LV-S1): a pattern's frame, note and examples, a read-along line, a realia sheet and its key words.
  | 'frame'
  | 'note'
  | 'line'
  | 'sheet'
  | 'words';

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
    case 'sentence':
      return ['ko', ...rom, 'gloss', ...(body.picture !== undefined ? (['art'] as const) : [])];
    case 'pattern': {
      // `tap`: each Korean part (the frame, a note with a Korean chip, each example) has its romanization one build later.
      const chips = body.note?.some((piece) => 'ko' in piece) === true;
      return [
        'frame',
        ...rom,
        ...(body.note !== undefined ? (['note', ...(chips ? rom : [])] as BuildName[]) : []),
        ...body.examples.flatMap((): BuildName[] => ['example', ...rom]),
      ];
    }
    case 'read-along':
      // `together` (no Korean voice): one build shows every line, and with `tap` one more their romanization.
      return body.together === true ? ['line', ...rom] : body.lines.flatMap((): BuildName[] => ['line', ...rom]);
    case 'realia':
      // A Realia Read sheet the deck has not shown yet has no key words (LV-S2): the sheet alone.
      return ['sheet', ...rom, ...(body.keyWords.length > 0 ? (['words', ...rom] as BuildName[]) : [])];
  }
}

/** One part of a slide on screen: the build that showed it and whether its romanization shows. */
export interface ShownPart {
  name: BuildName;
  rom: boolean;
}

/**
 * The parts on screen at `reveal`, in build order (the reading slides, section 5.2): every build
 * but `rom` shows one part; a `rom` build (`romanization: 'tap'`) shows the romanization of the
 * part before it. A slide with no `rom` build shows each part's romanization with it (D2).
 */
export function partsShown(builds: readonly BuildName[], reveal: number): ShownPart[] {
  const tap = builds.includes('rom');
  const parts: ShownPart[] = [];
  for (const name of builds.slice(0, Math.max(0, reveal + 1))) {
    const last = parts[parts.length - 1];
    if (name === 'rom') {
      if (last) last.rom = true;
      continue;
    }
    parts.push({ name, rom: !tap });
  }
  return parts;
}

/**
 * Several pieces of Korean read in one go (a realia sheet, its key words): the texts and their
 * romanizations joined with a pause. A single piece keeps its clip; joined text has none.
 */
export function joinSpoken(pieces: readonly SpokenForm[]): SpokenForm {
  if (pieces.length === 1) return pieces[0]!;
  return { text: pieces.map((p) => p.text).join(', '), romanization: pieces.map((p) => p.romanization).join(', ') };
}
