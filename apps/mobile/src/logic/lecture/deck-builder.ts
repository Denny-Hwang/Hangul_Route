import {
  discoverItemTexts,
  parseNarration,
  SLOT_MARKER,
  syllableSplit,
  wordReviewCardCap,
  type CheckKind,
  type Discover,
  type DiscoverItem,
  type Episode,
  type HeritageCard,
  type Jamo,
  type KoText,
  type LectureBlock,
  type LectureDeck,
  type Quest,
  type Realia,
  type StoryLevel,
} from '@hangul-route/content-schema';
import { spokenFor, type SpokenForm } from '../audio/spoken';
import { koTokenParts } from '../ko-tokens';
import type { MinigameScope } from '../minigame-config';
import {
  buildCultureQuizRounds,
  buildMatchSoundRounds,
  buildOddOneOutRounds,
  SOUND_QUIZ_JAMO_IDS,
  type CardMatchPair,
  type CultureQuizRound,
  type MatchSoundRound,
} from '../round-builder';
import { GLOSS_HIDDEN_KINDS } from '../story/check-view';
import { derangeSeeded, shuffleSeeded } from '../story/seeded-order';
import {
  buildsFor,
  joinSpoken,
  type BuildName,
  type BuildOptions,
  type KoLine,
  type NarrationPiece,
  type QuizOption,
  type RealiaSheetView,
  type SequenceStep,
  type SlideBody,
  type SpokenLine,
} from './build-steps';

/**
 * Deck builder (F-TCH-004 §3.3): expands a deck (ids, a seed, options) into
 * slides against this device's own bundle. Slides are never stored or sent.
 * Pure: the content lookups are injected (`LectureBundle`), the builder never
 * reads a clock or `Math.random`, and the same deck on the same bundle gives
 * the same slides (quiz seeds are `deck.seed + <slides so far>`).
 *
 * An id the bundle does not know, a step the presenter cannot show, a scope
 * too small for its quiz, or Korean without romanization becomes a counted
 * skip, never a crash (the start screen counts them).
 *
 * The round builders (`round-builder.ts`) read the bundled jamo list, not
 * `bundle.jamoAll`; every call to them goes through `attempt`, so a jamo they
 * do not know is a `scope-too-small` skip too.
 */

type StoryKo = { ko: string; romanization: string; en: string };

export interface LectureStoryScene {
  id: string;
  narrationEn: string;
  captionEn?: string;
  keyword?: StoryKo & { id: string };
  line?: StoryKo;
}

export interface LectureStoryCheck {
  id: string;
  kind: CheckKind;
  promptEn: string;
  target?: StoryKo;
  options: ReadonlyArray<{ id: string; en?: string; ko?: string; romanization?: string; art?: string; isCorrect: boolean }>;
  explainEn?: string;
  shuffle?: boolean;
}

export interface LectureStoryTier {
  level: StoryLevel;
  scenes: readonly LectureStoryScene[];
  checks: readonly LectureStoryCheck[];
  sequenceSceneIds: readonly string[];
}

/** The fields of a story the presenter reads (`Story` from the schema fits). */
export interface LectureStory {
  id: string;
  title: StoryKo;
  hoyaIntroEn?: string;
  coverSceneId: string;
  keywords: ReadonlyArray<StoryKo & { id: string }>;
  tiers: readonly LectureStoryTier[];
  /** The story's minutes (the catalogue's); its check slides are inside them (rule 12, section 4.4). */
  minutes: number;
}

/** A vocabulary topic as the vocab adapter gives it (`sources/vocab.ts`, PR 12). */
export interface LectureVocabTopic {
  title: string;
  hoyaLine?: string;
  /**
   * `cardId`: the word's heritage card picture; `wordArt`: its WordArt key (README D9);
   * `spokenKo` / `audioRef`: what the voice says and its clip (F-VOC-001, F-AUDIO-004), for Sound.
   */
  words: ReadonlyArray<{ id: string; ko: string; romanization: string; gloss: string; cardId?: string; wordArt?: string; spokenKo?: string; audioRef?: string }>;
}

export interface LectureBundle {
  jamoAll: readonly Jamo[];
  scopeFor(ref: string): MinigameScope | undefined;
  questById(id: string): Quest | undefined;
  episodeById(id: string): Episode | undefined;
  cardById(id: string): HeritageCard | undefined;
  hasStrokes(jamoId: string): boolean;
  strokeReviewed(jamoId: string): boolean;
  /** A story the learner Library would list; `'not-ready'` for a draft or unreviewed one. Absent: none yet. */
  story?(id: string): LectureStory | 'not-ready' | undefined;
  /** A topic the presenter may show; `'not-ready'` for a draft or preview one. Absent: none yet. */
  vocabTopic?(id: string): LectureVocabTopic | 'not-ready' | undefined;
  /** One word by id (a Word review's `vocabIds`); `'not-ready'` when no topic of it is ready. Absent: none yet. */
  vocabWord?(id: string): LectureVocabTopic['words'][number] | 'not-ready' | undefined;
}

export interface VoiceInfo {
  canPlayKorean: boolean;
}

export type Slide = SlideBody & { key: string; builds: readonly BuildName[] };

export type SkipReason = 'unknown-id' | 'not-ready' | 'no-romanization' | 'scope-too-small' | 'unsupported-step';

export interface SkippedItem {
  blockIndex: number;
  ref: string;
  reason: SkipReason;
}

export type TaughtItem =
  | { kind: 'letter'; jamoId: string; ko: string; romanization: string }
  | { kind: 'word'; ko: string; romanization: string; gloss?: string };

export interface ExpandedDeck {
  slides: Slide[];
  skipped: SkippedItem[];
  taught: TaughtItem[];
  /** About-minutes (rule 12 as amended, AMENDMENTS-LECTURE-V2 section 4.4): at least 1 for a deck that has slides. */
  minutes: number;
  /**
   * The keys of the quiz slides that counted 1 minute each (outside a quest's or story's own slides),
   * so a slide this build cannot draw gives back only a minute it counted (`runDeck`). Absent: every
   * quiz slide counted one.
   */
  timedQuizKeys?: readonly string[];
}

const listOf = <T>(items: readonly T[] | undefined): readonly T[] => items ?? [];

/** Taught Korean as the content stores it: what the voice says when it differs from `ko`, and its clip (F-AUDIO-004). */
interface SpeakableKo {
  ko: string;
  romanization: string;
  spokenKo?: string | undefined;
  audioRef?: string | undefined;
}

/** A word card's sound (section 3.4 amendment 2026-10-17): its spoken form and the speech rate it plays at. */
interface WordVoice {
  spoken: SpokenForm;
  speech: 'word' | 'sentence';
}

/** What Sound plays for taught Korean: `spokenKo` when the content has one, else the Korean, with its clip when it has one. */
function spokenOf(text: SpeakableKo): SpokenForm {
  const spoken: SpokenForm = { text: text.spokenKo ?? text.ko, romanization: text.romanization };
  return text.audioRef !== undefined ? { ...spoken, audioRef: text.audioRef } : spoken;
}

const wordVoice = (text: SpeakableKo, speech: WordVoice['speech'] = 'word'): WordVoice => ({ spoken: spokenOf(text), speech });

/** Taught Korean on a reading slide: the Korean, its romanization, its gloss and what Sound says. */
const spokenLine = (text: KoText): SpokenLine => ({ ko: text.ko, romanization: text.romanization, gloss: text.en, spoken: spokenOf(text) });

/**
 * A realia as the stage draws it (F-CURR-001 §3.6): its layout, title, lines and accessible text;
 * Sound reads the title, then each line with its value, in order.
 */
function sheetView(realia: Realia): RealiaSheetView {
  const text = (t: KoText) => ({ ko: t.ko, romanization: t.romanization });
  const line = (e: Realia['entries'][number]): SpokenForm => {
    const own = spokenOf(e.text);
    if (e.value === undefined) return own;
    const value = spokenOf(e.value);
    return { text: `${own.text} ${value.text}`, romanization: `${own.romanization} ${value.romanization}` };
  };
  return {
    kind: realia.kind ?? 'plain',
    ...(realia.title !== undefined ? { heading: text(realia.title) } : {}),
    entries: realia.entries.map((e) => ({
      id: e.id,
      text: text(e.text),
      ...(e.value !== undefined ? { value: text(e.value) } : {}),
      ...(e.dir !== undefined ? { dir: e.dir } : {}),
      ...(e.goods !== undefined ? { goods: e.goods } : {}),
    })),
    alt: realia.altEn,
    spoken: joinSpoken([...(realia.title !== undefined ? [spokenOf(realia.title)] : []), ...realia.entries.map(line)]),
  };
}

/**
 * Each piece of taught Korean a slide draws with the sound its card would have (a Word review
 * keeps it): a word card's own, a Discover sentence, pattern example or exchange line at the
 * sentence rate, a realia key word at the word rate.
 */
function slideVoices(slide: Slide): Array<[string, WordVoice]> {
  switch (slide.kind) {
    case 'vocab':
      return [[slide.word.ko, { spoken: slide.spoken, speech: slide.speech }]];
    case 'sentence':
      return [[slide.sentence.ko, { spoken: slide.sentence.spoken, speech: 'sentence' }]];
    case 'pattern':
      return slide.examples.map((e): [string, WordVoice] => [e.ko, { spoken: e.spoken, speech: 'sentence' }]);
    case 'read-along':
      return slide.lines.map((l): [string, WordVoice] => [l.ko, { spoken: l.spoken, speech: 'sentence' }]);
    case 'realia':
      return slide.keyWords.map((w): [string, WordVoice] => [w.ko, { spoken: w.spoken, speech: 'word' }]);
    default:
      return [];
  }
}

/** A scene's Korean: its line, else its keyword (the D14 rule of the schema's `sceneKorean`, on the presenter's narrower view). */
const sceneKo = (scene: LectureStoryScene): StoryKo | undefined => scene.line ?? scene.keyword;

const STORY_LEVEL_ORDER: readonly StoryLevel[] = ['listen', 'read-along', 'read'];
const QUIZ_MIN_ITEMS = 4;
const REVISIT_MAX_ROUNDS = 4;

/**
 * The key a block's slides start with (`<blockKey>/<path>`, section 3.3); a repeated block gets
 * `#2`, `#3` after it. Exported so the presenter can tell which block a slide came from.
 */
export function blockKeyOf(block: LectureBlock): string {
  switch (block.kind) {
    case 'episode':
    case 'quest':
      return block.id;
    case 'story':
      return block.storyId;
    case 'vocab':
      return block.topicId;
    case 'activity':
      return `activity:${block.preset}`;
    default:
      return block.kind;
  }
}

/** Recompute every slide's builds for new options (the live romanization flip, §3.7). */
export function withBuilds(slides: readonly Slide[], opts: BuildOptions): Slide[] {
  return slides.map((slide) => ({ ...slide, builds: buildsFor(slide, opts) }));
}

export function expandDeck(deck: LectureDeck, bundle: LectureBundle, voice: VoiceInfo): ExpandedDeck {
  const opts: BuildOptions = { romanization: deck.options.romanization, strokeGuide: deck.options.strokeGuide };
  const textPrompt = !voice.canPlayKorean || !deck.options.sound;
  const slides: Slide[] = [];
  const skipped: SkippedItem[] = [];
  const taught: TaughtItem[] = [];
  const seenJamo = new Set<string>();
  // One card per word per deck (AMENDMENTS-LECTURE-V2 section 5.1), by Korean text: a repeat is not a skip.
  const seenWords = new Set<string>();
  const usedKeys = new Map<string, number>();
  const blockKeys = new Map<string, number>();
  let quizFrom = 0;
  let minutes = 0;
  // Rule 12 (AMENDMENTS-LECTURE-V2 section 4.4, LV-0b O1): a quest's or story's catalogue minutes
  // already hold its own quiz and check slides, so only quiz slides outside them count 1 each.
  let ownMinutesDepth = 0;
  const timedQuizKeys: string[] = [];
  let blockIndex = 0;

  const skip = (ref: string, reason: SkipReason): void => {
    skipped.push({ blockIndex, ref, reason });
  };
  const nthKey = (seen: Map<string, number>, key: string): string => {
    const n = (seen.get(key) ?? 0) + 1;
    seen.set(key, n);
    return n === 1 ? key : `${key}#${n}`;
  };
  const push = (key: string, body: SlideBody): void => {
    const slideKey = nthKey(usedKeys, key);
    slides.push({ ...body, key: slideKey, builds: buildsFor(body, opts) });
    if (body.kind === 'quiz' && ownMinutesDepth === 0) timedQuizKeys.push(slideKey);
  };
  /** Pushes a quest's or story's own slides: its quiz slides are inside its catalogue minutes. */
  const insideOwnMinutes = (expand: () => void): void => {
    ownMinutesDepth += 1;
    try {
      expand();
    } finally {
      ownMinutesDepth -= 1;
    }
  };
  const seed = (): number => deck.seed + slides.length;
  /** A word card, once per deck; the word is taught either way (a later gloss still upgrades it). */
  const wordCard = (key: string, word: KoLine & { gloss: string }, voice: WordVoice, extra: { wordId?: string; cardId?: string; wordArt?: string } = {}): void => {
    if (!seenWords.has(word.ko)) {
      seenWords.add(word.ko);
      push(key, { kind: 'vocab', word, ...voice, ...extra });
    }
    teachWord(word);
  };
  const teachWord = (word: KoLine): void => {
    const met = taught.find((t): t is Extract<TaughtItem, { kind: 'word' }> => t.kind === 'word' && t.ko === word.ko);
    if (!met) {
      taught.push({ kind: 'word', ...word });
      return;
    }
    // A syllable met without a gloss (na) that is later taught as a word ("I, me") gains the gloss,
    // so it reaches a word-to-gloss quiz and End shows its meaning.
    if (met.gloss === undefined && word.gloss !== undefined) met.gloss = word.gloss;
  };

  // ---- letters and quizzes ----------------------------------------------------

  const letter = (path: string, jamo: Jamo, strokeFirst = false): void => {
    if (seenJamo.has(jamo.id)) return;
    seenJamo.add(jamo.id);
    let example: KoLine | undefined;
    if (jamo.exampleWordKo !== undefined) {
      if (jamo.exampleWordRomanization === undefined) skip(`${path}/${jamo.id}/example`, 'no-romanization');
      else example = { ko: jamo.exampleWordKo, romanization: jamo.exampleWordRomanization, gloss: jamo.exampleWordEn };
    }
    push(`${path}/${jamo.id}`, {
      kind: 'letter',
      jamoId: jamo.id,
      char: jamo.char,
      romanization: jamo.romanization,
      nameEn: jamo.nameEn,
      ...(jamo.ipa !== undefined ? { ipa: jamo.ipa } : {}),
      ...(jamo.soundHint !== undefined ? { soundHint: jamo.soundHint } : {}),
      spoken: spokenFor(jamo, 'sound'),
      ...(example ? { example } : {}),
      hasStrokes: bundle.hasStrokes(jamo.id),
      strokeReviewed: bundle.strokeReviewed(jamo.id),
      ...(strokeFirst ? { strokeFirst: true as const } : {}),
    });
    taught.push({ kind: 'letter', jamoId: jamo.id, ko: jamo.char, romanization: jamo.romanization });
  };

  const letterById = (path: string, id: string, strokeFirst = false): void => {
    const jamo = bundle.jamoAll.find((j) => j.id === id);
    if (jamo) letter(path, jamo, strokeFirst);
    else skip(id, 'unknown-id');
  };

  const jamoOption = (jamo: Jamo, correct: boolean): QuizOption => ({ ko: jamo.char, romanization: jamo.romanization, correct });

  /** Runs a round builder; one that throws on a small scope becomes a counted skip. */
  const attempt = <T>(ref: string, build: () => T): T | null => {
    try {
      return build();
    } catch {
      skip(ref, 'scope-too-small');
      return null;
    }
  };

  const soundQuiz = (path: string, ref: string, build: () => readonly MatchSoundRound[]): void => {
    attempt(ref, build)?.forEach((round, i) =>
      push(`${path}/q${i + 1}`, {
        kind: 'quiz',
        prompt: { ask: 'sound', spoken: spokenFor(round.promptJamo, 'sound') },
        options: round.tiles.map((t) => jamoOption(t, t.id === round.promptJamo.id)),
        textPrompt,
      }),
    );
  };

  /** Word-to-gloss rounds; a round whose Korean has no romanization is left out and counted. */
  const meaningQuiz = (path: string, ref: string, build: () => readonly CultureQuizRound[], from = 0): void => {
    attempt(ref, build)?.forEach((round, i) => {
      if (round.promptRomanization === undefined) {
        skip(ref, 'no-romanization');
        return;
      }
      push(`${path}/q${from + i + 1}`, {
        kind: 'quiz',
        prompt: { ask: 'meaning', ko: round.promptKo, romanization: round.promptRomanization },
        options: round.options.map((o) => ({ gloss: o.en, correct: o.isAnswer })),
        textPrompt: false,
      });
    });
  };

  // ---- blocks -------------------------------------------------------------------

  const scopeStep = (path: string, ref: string, scope: MinigameScope, stepKind: Quest['steps'][number]['kind']): void => {
    const rounds = Math.min(deck.options.quizRounds, scope.rounds ?? deck.options.quizRounds);
    const jamoIds = listOf(scope.jamoIds);
    switch (scope.kind) {
      case 'match-sound': {
        if (stepKind === 'present') {
          for (const id of jamoIds) letterById(path, id);
          return;
        }
        soundQuiz(path, ref, () => buildMatchSoundRounds({ scopeJamoIds: [...jamoIds], rounds, tileCount: 4, seed: seed() }));
        return;
      }
      case 'trace-stroke':
        for (const id of jamoIds) letterById(path, id, true);
        return;
      case 'build-letter':
        for (const s of listOf(scope.syllables)) {
          push(`${path}/${s.ko}`, {
            kind: 'syllable',
            ko: s.ko,
            romanization: s.romanization,
            split: syllableSplit(s.ko) ?? s.romanization,
            parts: [...s.jamoChars],
            spoken: { text: s.ko, romanization: s.romanization },
          });
          teachWord({ ko: s.ko, romanization: s.romanization });
        }
        return;
      case 'card-match':
      case 'pic-word-match': {
        // Every word on every board, in board order (F-QUEST-002 §3.11): KoText always carries romanization and a gloss.
        const words: Array<KoLine & { gloss: string; voice: WordVoice }> = [];
        // A board word is KoText, so its `spokenKo` and `audioRef` give the card its sound when present.
        const pairs: ReadonlyArray<{ ko: string; en: string; romanization?: string; spokenKo?: string; audioRef?: string }> =
          scope.kind === 'card-match'
            ? listOf(scope.cardPairs)
            : listOf(scope.picWord?.boards).flatMap((board) => board.pairs.map((pair) => pair.word));
        for (const pair of pairs) {
          const { romanization } = pair;
          if (romanization === undefined) {
            skip(`${path}/${pair.ko}`, 'no-romanization');
            continue;
          }
          if (!words.some((w) => w.ko === pair.ko)) words.push({ ko: pair.ko, romanization, gloss: pair.en, voice: wordVoice({ ...pair, romanization }) });
        }
        // Every word already had its card in this deck: a board of 4 or more becomes a word-to-meaning quiz (section 5.1).
        if (words.length >= QUIZ_MIN_ITEMS && words.every((w) => seenWords.has(w.ko))) {
          const cardPairs: CardMatchPair[] = words.map((w) => ({ ko: w.ko, en: w.gloss, romanization: w.romanization }));
          meaningQuiz(path, ref, () => buildCultureQuizRounds({ cardPairs, rounds, seed: seed() }));
          return;
        }
        for (const { voice, ...word } of words) wordCard(`${path}/${word.ko}`, word, voice);
        return;
      }
      case 'story-sequence': {
        const steps: SequenceStep[] = [];
        for (const step of listOf(scope.storySteps)) {
          if (step.labelKo !== undefined && step.romanization === undefined) {
            skip(ref, 'no-romanization');
            return;
          }
          steps.push({
            id: step.id,
            gloss: step.labelEn,
            ...(step.labelKo !== undefined ? { ko: step.labelKo, romanization: step.romanization } : {}),
          });
        }
        sequence(`${path}/sequence`, steps);
        return;
      }
      case 'culture-quiz': {
        meaningQuiz(path, ref, () => buildCultureQuizRounds({ cardPairs: [...listOf(scope.cardPairs)], rounds, seed: seed() }));
        return;
      }
      case 'odd-one-out': {
        const built = attempt(ref, () => buildOddOneOutRounds({ scopeJamoIds: [...jamoIds], rounds, seed: seed() }));
        built?.forEach((round, i) =>
          push(`${path}/q${i + 1}`, {
            kind: 'quiz',
            prompt: { ask: 'odd-one-out' },
            options: round.tiles.map((t) => jamoOption(t, t.id === round.oddJamo.id)),
            textPrompt: false,
          }),
        );
        return;
      }
      default:
        skip(ref, 'unsupported-step');
    }
  };

  const sequence = (key: string, steps: SequenceStep[]): void => {
    push(key, { kind: 'sequence', steps, shuffled: derangeSeeded(steps.map((s) => s.id), seed()) });
  };

  const card = (path: string, id: string): void => {
    const found = bundle.cardById(id);
    if (!found) {
      skip(id, 'unknown-id');
      return;
    }
    const { subtitleKo: ko, romanization } = found;
    if (ko !== undefined && romanization === undefined) {
      skip(id, 'no-romanization');
      return;
    }
    push(`${path}/${id}`, {
      kind: 'card',
      cardId: found.id,
      title: found.titleEn,
      ...(ko !== undefined && romanization !== undefined ? { ko, romanization } : {}),
      ...(found.factEn !== undefined ? { fact: found.factEn } : {}),
    });
    if (ko !== undefined && romanization !== undefined) teachWord({ ko, romanization, gloss: found.titleEn });
  };

  /**
   * UI-language text with `{ko:}` tokens (a pattern note, a realia caption) as pieces, each token
   * a Korean chip with its romanization. A token with no romanization drops the whole text and is
   * a counted `no-romanization` skip (rule 11); the slide keeps everything else.
   */
  const tokenPieces = (ref: string, text: string): NarrationPiece[] | undefined => {
    const pieces = koTokenParts(text);
    if (pieces.some((piece) => 'ko' in piece && piece.romanization === '')) {
      skip(ref, 'no-romanization');
      return undefined;
    }
    return pieces;
  };

  /** What a reading slide shows was taught and seen, as when its texts were word cards: no later card repeats them. */
  const shownOnSlide = (item: DiscoverItem): void => {
    for (const text of discoverItemTexts(item)) {
      seenWords.add(text.ko);
      teachWord({ ko: text.ko, romanization: text.romanization, gloss: text.en });
    }
  };

  /**
   * A Discover step (F-QUEST-002 §3.1; AMENDMENTS-LECTURE-V2 section 5.1, LV-S1): a letter slide
   * per jamo item, a vocab slide per word item, and a reading slide per upper-stage item: a
   * sentence, a sentence pattern, a read along (an exchange) and a realia page. A realia whose
   * sheet the quest does not hold is a counted `unknown-id` skip; its key words become word cards.
   */
  const discoverStep = (path: string, discover: Discover, realiaOf: (ref: string) => Realia | undefined): void => {
    discover.pages.forEach((page, p) => {
      page.items.forEach((item, i) => {
        const key = `${path}/${item.type}-${p + 1}-${i + 1}`;
        switch (item.type) {
          case 'jamo':
            letterById(path, item.jamoId);
            return;
          case 'word':
            wordCard(`${path}/${item.word.ko}`, { ko: item.word.ko, romanization: item.word.romanization, gloss: item.word.en }, wordVoice(item.word));
            return;
          case 'sentence':
            push(key, { kind: 'sentence', sentence: spokenLine(item.sentence), ...(item.picture !== undefined ? { picture: item.picture } : {}) });
            break;
          case 'pattern': {
            const note = tokenPieces(`${key}/note`, item.noteEn);
            push(key, {
              kind: 'pattern',
              frame: { pieces: item.frame.ko.split(SLOT_MARKER), romanization: item.frame.romanization, gloss: item.frame.en },
              ...(note !== undefined ? { note } : {}),
              examples: item.examples.map(spokenLine),
            });
            break;
          }
          case 'exchange':
            // No Korean voice (or the deck's sound off): read along shows every line at once (section 5.1).
            push(key, { kind: 'read-along', lines: item.lines.map((l) => ({ speaker: l.speakerEn, ...spokenLine(l.line) })), ...(textPrompt ? { together: true as const } : {}) });
            break;
          case 'realia': {
            const realia = realiaOf(item.realiaRef);
            if (realia === undefined) {
              skip(item.realiaRef, 'unknown-id');
              for (const w of item.keyWords) wordCard(`${path}/${w.ko}`, { ko: w.ko, romanization: w.romanization, gloss: w.en }, wordVoice(w));
              return;
            }
            const text = item.captionEn ?? page.captionEn;
            const caption = text === undefined ? undefined : tokenPieces(`${key}/caption`, text);
            push(key, { kind: 'realia', sheet: sheetView(realia), ...(caption !== undefined ? { caption } : {}), keyWords: item.keyWords.map(spokenLine) });
            break;
          }
        }
        shownOnSlide(item);
      });
    });
  };

  /** The realia a quest's Realia Read scopes hold, by ref: a Discover realia page shows the sheet the quest plays. */
  const realiaOfQuest =
    (quest: Quest) =>
    (ref: string): Realia | undefined => {
      for (const step of quest.steps) {
        const realia = step.minigameRef === undefined ? undefined : bundle.scopeFor(step.minigameRef)?.realiaRead?.realia;
        if (realia?.ref === ref) return realia;
      }
      return undefined;
    };

  const questBlock = (path: string, quest: Quest): void => {
    minutes += quest.estimatedMinutes;
    insideOwnMinutes(() => questSlides(path, quest));
  };

  const questSlides = (path: string, quest: Quest): void => {
    const intro = quest.steps.find((s) => s.kind === 'intro');
    push(`${path}/title`, {
      kind: 'title',
      source: 'quest',
      title: quest.titleEn,
      ...(intro?.hoyaLineEn !== undefined ? { line: intro.hoyaLineEn } : {}),
    });
    const storiesDone = new Set<string>();
    for (const step of quest.steps) {
      const stepPath = `${path}/${step.id}`;
      if (step.kind === 'reward') {
        if (quest.rewardCardId !== undefined) card(stepPath, quest.rewardCardId);
        continue;
      }
      if (step.kind === 'discover' && step.discover) {
        discoverStep(stepPath, step.discover, realiaOfQuest(quest));
        continue;
      }
      if (step.minigameRef === undefined) {
        // Intro is the title slide's line; any other step with nothing to show is counted, never dropped silently.
        if (step.kind !== 'intro') skip(stepPath, 'unsupported-step');
        continue;
      }
      const scope = bundle.scopeFor(step.minigameRef);
      if (!scope) {
        skip(step.minigameRef, 'unknown-id');
        continue;
      }
      if (scope.story) {
        // story-read / -check / -seq of one story: the story block once per quest (checks and order are in it).
        if (!storiesDone.has(scope.story.storyId)) {
          storiesDone.add(scope.story.storyId);
          storyBlock(`${path}/${scope.story.storyId}`, scope.story.storyId, scope.story.level, true, false);
        }
        continue;
      }
      scopeStep(stepPath, step.minigameRef, scope, step.kind);
    }
  };

  const questById = (path: string, id: string): void => {
    const quest = bundle.questById(id);
    if (quest) questBlock(`${path}${id}`, quest);
    else skip(id, 'unknown-id');
  };

  const episodeBlock = (path: string, id: string): void => {
    const episode = bundle.episodeById(id);
    if (!episode) {
      skip(id, 'unknown-id');
      return;
    }
    if (episode.status === 'preview' || episode.questIds.length === 0) {
      skip(id, 'not-ready');
      return;
    }
    push(`${path}/title`, {
      kind: 'title',
      source: 'episode',
      title: episode.titleEn,
      ...(episode.subtitleEn !== undefined ? { subtitle: episode.subtitleEn } : {}),
      line: episode.hoyaIntroEn,
    });
    if (episode.format === 'story' && episode.storyIds && episode.storyIds.length > 0) {
      for (const storyId of episode.storyIds) storyBlock(`${path}/${storyId}`, storyId, undefined, true, false);
      // Rule 12: the episode's quests still count their estimated minutes.
      for (const questId of episode.questIds) minutes += bundle.questById(questId)?.estimatedMinutes ?? 0;
      return;
    }
    for (const questId of episode.questIds) questById(`${path}/`, questId);
  };

  /**
   * A story's slides. `ownMinutes`: a story block counts the story's catalogue minutes, which hold
   * its check slides (rule 12, section 4.2 m(block)); a story inside a quest or a story episode is
   * inside their minutes. A skipped story counts none.
   */
  const storyBlock = (key: string, storyId: string, level: StoryLevel | undefined, checks: boolean, ownMinutes: boolean): void =>
    insideOwnMinutes(() => storySlides(key, storyId, level, checks, ownMinutes));

  const storySlides = (key: string, storyId: string, level: StoryLevel | undefined, checks: boolean, ownMinutes: boolean): void => {
    const found = bundle.story ? bundle.story(storyId) : 'not-ready';
    if (found === undefined) {
      skip(storyId, 'unknown-id');
      return;
    }
    const byLevel = found === 'not-ready' ? [] : [...found.tiers].sort((a, b) => STORY_LEVEL_ORDER.indexOf(a.level) - STORY_LEVEL_ORDER.indexOf(b.level));
    const tier = byLevel.find((t) => t.level === level) ?? byLevel[0];
    if (found === 'not-ready' || tier === undefined) {
      skip(storyId, 'not-ready');
      return;
    }
    // D14: every word on these slides is the story's own; a narration token that names no keyword fails the story.
    let narrations: NarrationPiece[][];
    try {
      narrations = tier.scenes.map((scene) =>
        parseNarration(scene.narrationEn, found.keywords).map((part): NarrationPiece =>
          'text' in part ? { text: part.text } : { ko: part.kw.ko, romanization: part.kw.romanization, gloss: part.kw.en },
        ),
      );
    } catch {
      skip(storyId, 'not-ready');
      return;
    }
    push(`${key}/title`, {
      kind: 'title',
      source: 'story',
      title: found.title.en,
      ...(found.hoyaIntroEn !== undefined ? { line: found.hoyaIntroEn } : {}),
      cover: { storyId, sceneId: found.coverSceneId },
    });
    if (ownMinutes) minutes += found.minutes;
    tier.scenes.forEach((scene, i) => {
      const ko = sceneKo(scene);
      // A scene's line is read at the sentence rate, its keyword at the word rate (Read-to-me).
      const korean = ko ? { ko: ko.ko, romanization: ko.romanization, gloss: ko.en, speech: scene.line ? ('sentence' as const) : ('word' as const) } : undefined;
      push(`${key}/${scene.id}`, {
        kind: 'story',
        storyId,
        sceneId: scene.id,
        narration: narrations[i]!,
        ...(korean ? { korean } : {}),
        ...(scene.captionEn !== undefined ? { caption: scene.captionEn } : {}),
      });
      if (scene.keyword) teachWord({ ko: scene.keyword.ko, romanization: scene.keyword.romanization, gloss: scene.keyword.en });
    });
    const steps: SequenceStep[] = [];
    for (const id of tier.sequenceSceneIds) {
      const scene = tier.scenes.find((s) => s.id === id);
      if (scene?.captionEn === undefined) {
        skip(`${key}/sequence`, 'not-ready');
        steps.length = 0;
        break;
      }
      const ko = sceneKo(scene);
      steps.push({ id, gloss: scene.captionEn, ...(ko ? { ko: ko.ko, romanization: ko.romanization } : {}) });
    }
    if (steps.length > 0) sequence(`${key}/sequence`, steps);
    if (!checks) return;
    tier.checks.forEach((check) => {
      const ref = `${key}/check-${check.id}`;
      if (check.options.some((o) => o.ko !== undefined && !o.romanization)) {
        skip(ref, 'no-romanization');
        return;
      }
      const options = check.options.map(
        (o): QuizOption => ({
          ...(o.ko !== undefined ? { ko: o.ko, romanization: o.romanization } : {}),
          gloss: o.en,
          ...(o.art !== undefined ? { art: o.art } : {}),
          correct: o.isCorrect,
        }),
      );
      const keepOrder = check.kind === 'true-false' || check.shuffle === false;
      const target = check.target ? { ko: check.target.ko, romanization: check.target.romanization, gloss: check.target.en } : undefined;
      push(ref, {
        kind: 'quiz',
        prompt: { ask: 'check', text: check.promptEn, ...(target ? { target } : {}), ...(target && GLOSS_HIDDEN_KINDS.includes(check.kind) ? { glossAtAnswer: true as const } : {}) },
        options: keepOrder ? options : shuffleSeeded(options, seed()),
        textPrompt: false,
        ...(check.explainEn !== undefined ? { explain: check.explainEn } : {}),
      });
    });
  };

  const vocabBlock = (path: string, topicId: string, wordIds: readonly string[] | undefined): void => {
    if (!bundle.vocabTopic) {
      skip(topicId, 'not-ready');
      return;
    }
    const topic = bundle.vocabTopic(topicId);
    if (!topic) {
      skip(topicId, 'unknown-id');
      return;
    }
    if (topic === 'not-ready') {
      skip(topicId, 'not-ready');
      return;
    }
    push(`${path}/title`, { kind: 'title', source: 'topic', title: topic.title, ...(topic.hoyaLine !== undefined ? { line: topic.hoyaLine } : {}) });
    const words = wordIds
      ? wordIds.flatMap((id) => {
          const word = topic.words.find((w) => w.id === id);
          if (!word) skip(id, 'unknown-id');
          return word ? [word] : [];
        })
      : topic.words;
    for (const w of words) {
      wordCard(
        `${path}/${w.id}`,
        { ko: w.ko, romanization: w.romanization, gloss: w.gloss },
        wordVoice(w),
        { wordId: w.id, ...(w.cardId !== undefined ? { cardId: w.cardId } : {}), ...(w.wordArt !== undefined ? { wordArt: w.wordArt } : {}) },
      );
    }
    // The quiz asks only words that had a slide: under 4 shown (all of a small topic, or a short chosen list), no quiz.
    if (words.length < QUIZ_MIN_ITEMS) return;
    const pairs: CardMatchPair[] = words.map((w) => ({ ko: w.ko, en: w.gloss, romanization: w.romanization }));
    meaningQuiz(path, topicId, () => buildCultureQuizRounds({ cardPairs: pairs, rounds: deck.options.quizRounds, seed: seed() }));
  };

  /**
   * Word review (v2, AMENDMENTS-LECTURE-V2 section 4.5): the words each quest teaches (the quest
   * expanded on its own, no slides), then the `vocabIds` words, one per Korean text, the first
   * `wordReviewCardCap(rounds)` of them (words not yet shown in this deck first) as word cards, then `rounds` word-to-meaning questions over
   * them. Unknown ids are counted skips; under 4 words, the quiz is a counted `scope-too-small`.
   */
  const wordReviewBlock = (path: string, questIds: readonly string[], vocabIds: readonly string[], rounds: number): void => {
    type ReviewWord = KoLine & { gloss: string; voice: WordVoice; extra?: { wordId: string; cardId?: string; wordArt?: string } };
    const words: ReviewWord[] = [];
    const add = (word: ReviewWord): void => {
      const known = words.find((w) => w.ko === word.ko);
      if (!known) {
        words.push(word);
        return;
      }
      // A word a quest already taught keeps its place and its sound (what the voice says, its romanization,
      // its rate); the vocab entry still gives it its picture, and its clip path when only the vocab entry
      // has one (F-AUDIO-004 D6). Only the clip is taken: every vocab word carries a derived path
      // (F-VOC-001 §3.4), so taking its whole spoken form would drop a quest's spokenKo.
      if (known.extra === undefined && word.extra !== undefined) known.extra = word.extra;
      const clip = word.voice.spoken.audioRef;
      if (known.voice.spoken.audioRef === undefined && clip !== undefined) known.voice = { ...known.voice, spoken: { ...known.voice.spoken, audioRef: clip } };
    };
    for (const id of questIds) {
      if (!bundle.questById(id)) {
        skip(id, 'unknown-id');
        continue;
      }
      const alone = expandDeck({ ...deck, blocks: [{ kind: 'quest', id }] }, bundle, voice);
      // A taught word keeps the sound the quest gave it, on its card or its reading slide (a Discover sentence stays a sentence).
      const voices = new Map<string, WordVoice>();
      for (const [ko, v] of alone.slides.flatMap(slideVoices)) if (!voices.has(ko)) voices.set(ko, v);
      for (const t of alone.taught) {
        if (t.kind === 'word' && t.gloss !== undefined) add({ ko: t.ko, romanization: t.romanization, gloss: t.gloss, voice: voices.get(t.ko) ?? wordVoice(t) });
      }
    }
    for (const id of vocabIds) {
      const found = bundle.vocabWord ? bundle.vocabWord(id) : 'not-ready';
      if (found === undefined || found === 'not-ready') {
        skip(id, found ?? 'unknown-id');
        continue;
      }
      const extra = { wordId: found.id, ...(found.cardId !== undefined ? { cardId: found.cardId } : {}), ...(found.wordArt !== undefined ? { wordArt: found.wordArt } : {}) };
      add({ ko: found.ko, romanization: found.romanization, gloss: found.gloss, voice: wordVoice(found), extra });
    }
    // Words an earlier block of this deck already showed have no card here (`seenWords`), so
    // unseen words fill the cap first; the quiz still asks the seen ones that made the cut.
    const ordered = [...words.filter((w) => !seenWords.has(w.ko)), ...words.filter((w) => seenWords.has(w.ko))];
    const shown = ordered.slice(0, wordReviewCardCap(rounds));
    for (const { extra, voice: sound, ...word } of shown) wordCard(`${path}/${word.ko}`, word, sound, extra);
    if (shown.length < QUIZ_MIN_ITEMS) {
      skip(`${path}/quiz`, 'scope-too-small');
      return;
    }
    const cardPairs: CardMatchPair[] = shown.map((w) => ({ ko: w.ko, en: w.gloss, romanization: w.romanization }));
    meaningQuiz(path, `${path}/quiz`, () => buildCultureQuizRounds({ cardPairs, rounds, seed: seed() }));
  };

  const revisitBlock = (path: string, chars: readonly string[]): void => {
    const focus: Jamo[] = [];
    for (const c of chars) {
      const jamo = bundle.jamoAll.find((j) => j.char === c && j.kind !== 'batchim');
      if (!jamo) {
        skip(c, 'unknown-id');
        continue;
      }
      // A repeated character is the same letter: one slide, one place in the quiz.
      if (focus.some((j) => j.id === jamo.id)) continue;
      focus.push(jamo);
      letter(path, jamo);
    }
    if (focus.length === 0) return;
    const kinds = new Set(focus.map((j) => j.kind));
    const pool = [...focus];
    for (const j of bundle.jamoAll) {
      if (pool.length >= QUIZ_MIN_ITEMS) break;
      if (kinds.has(j.kind) && !pool.some((p) => p.id === j.id)) pool.push(j);
    }
    const ref = `${path}/quiz`;
    if (pool.length < QUIZ_MIN_ITEMS) {
      skip(ref, 'scope-too-small');
      return;
    }
    // Up to 4 rounds; each must ask a revisit letter. With 4 or more letters the pool is exactly
    // those letters, so every prompt is one; with fewer, each is asked once (focus = rounds).
    const rounds = Math.min(REVISIT_MAX_ROUNDS, focus.length);
    soundQuiz(ref, ref, () =>
      buildMatchSoundRounds({
        scopeJamoIds: pool.map((j) => j.id),
        rounds,
        focusJamoIds: focus.slice(0, rounds).map((j) => j.id),
        tileCount: 4,
        seed: seed(),
      }),
    );
  };

  const quizBlock = (path: string, from: 'previous' | 'all', rounds: number): void => {
    const items = taught.slice(from === 'previous' ? quizFrom : 0);
    quizFrom = taught.length;
    // Only letters a sound round may ask (Word Builder's are shown on their letter slides, never quizzed by ear).
    const letters = [...new Set(items.flatMap((t) => (t.kind === 'letter' && SOUND_QUIZ_JAMO_IDS.has(t.jamoId) ? [t.jamoId] : [])))];
    const pairs: CardMatchPair[] = items.flatMap((t) =>
      t.kind === 'word' && t.gloss !== undefined ? [{ ko: t.ko, en: t.gloss, romanization: t.romanization }] : [],
    );
    const lettersOk = letters.length >= QUIZ_MIN_ITEMS;
    const pairsOk = pairs.length >= QUIZ_MIN_ITEMS;
    if (!lettersOk && !pairsOk) {
      skip('quiz', 'scope-too-small');
      return;
    }
    const letterRounds = lettersOk ? (pairsOk ? Math.ceil(rounds / 2) : rounds) : 0;
    if (lettersOk) soundQuiz(path, 'quiz', () => buildMatchSoundRounds({ scopeJamoIds: letters, rounds: letterRounds, tileCount: 4, seed: seed() }));
    if (pairsOk) {
      meaningQuiz(path, 'quiz', () => buildCultureQuizRounds({ cardPairs: pairs, rounds: rounds - letterRounds, seed: seed() }), letterRounds);
    }
  };

  // ---- the deck -------------------------------------------------------------------

  /**
   * Rule 12 as amended (AMENDMENTS-LECTURE-V2 section 4.4): a block of letters, cards or words
   * counts one minute per two of its non-quiz slides, rounded up; its quiz slides keep 1 each
   * (counted at the end with every quiz slide outside a quest or story).
   */
  const bySlides = (expandBlock: () => void): void => {
    const from = slides.length;
    expandBlock();
    minutes += Math.ceil(slides.slice(from).filter((s) => s.kind !== 'quiz').length / 2);
  };
  /**
   * A vocabulary topic (rule 12 as amended, LV-M1): one minute per two of its word cards, rounded
   * up (its title slide is not a word slide); its meaning-quiz slides keep 1 each, counted at the end.
   */
  const byWordSlides = (expandBlock: () => void): void => {
    const from = slides.length;
    expandBlock();
    minutes += Math.ceil(slides.slice(from).filter((s) => s.kind === 'vocab').length / 2);
  };

  let classCode: string | undefined;
  deck.blocks.forEach((block, i) => {
    blockIndex = i;
    const key = nthKey(blockKeys, blockKeyOf(block));
    switch (block.kind) {
      case 'episode':
        episodeBlock(key, block.id);
        return;
      case 'quest': {
        const quest = bundle.questById(block.id);
        if (quest) questBlock(key, quest);
        else skip(block.id, 'unknown-id');
        return;
      }
      case 'jamo-set':
        bySlides(() => {
          for (const id of block.jamoIds) letterById(key, id);
        });
        return;
      case 'revisit':
        bySlides(() => revisitBlock(key, block.chars));
        return;
      case 'vocab':
        byWordSlides(() => vocabBlock(key, block.topicId, block.wordIds));
        return;
      case 'story':
        storyBlock(key, block.storyId, block.level, block.checks, true);
        return;
      case 'cards':
        bySlides(() => {
          for (const id of block.cardIds) card(key, id);
        });
        return;
      case 'quiz':
        quizBlock(key, block.from, block.rounds);
        return;
      case 'activity':
        minutes += block.minutes;
        push(key, { kind: 'activity', preset: block.preset, minutes: block.minutes });
        return;
      case 'class-code':
        classCode = block.code;
        return;
      case 'word-review':
        bySlides(() => wordReviewBlock(key, block.questIds, block.vocabIds, block.rounds));
        return;
    }
  });

  if (slides.length === 0) return { slides, skipped, taught, minutes: 0 };

  const kept = (k: TaughtItem): KoLine => (k.kind === 'word' && k.gloss !== undefined ? { ko: k.ko, romanization: k.romanization, gloss: k.gloss } : { ko: k.ko, romanization: k.romanization });
  push('end', {
    kind: 'end',
    letters: taught.filter((t) => t.kind === 'letter').map(kept),
    words: taught.filter((t) => t.kind === 'word').map(kept),
    ...(classCode !== undefined ? { classCode } : {}),
  });
  // A deck that has slides is never "about 0 minutes" (rule 12 as amended, LV-M1).
  return { slides, skipped, taught, minutes: Math.max(1, minutes + timedQuizKeys.length), timedQuizKeys };
}
