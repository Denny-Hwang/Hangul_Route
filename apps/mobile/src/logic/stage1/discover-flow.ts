import { discoverItemTexts, type DiscoverItem, type DiscoverPage, type Jamo, type KoText, type Overlays, type RomanizationMode, type UiLocale } from '@hangul-route/content-schema';
import { romanizationShown, type Messages } from '@hangul-route/i18n';
import { findJamo } from '../../content/jamo';
import type { PlayResult } from '../../platform/audio';
import type { PromptKind } from '../audio/rate';
import { voiceLine } from '../audio/jamo-lines';
import { jamoVoice } from '../audio/jamo-voice';
import { blockShape } from '../build-letter-view';
import { localizeJamo } from '../content-locale';
import { jamoIdOfKey, writeLetters, writePageIndex } from './discover-write';
import { decompose, symbolsOf } from './hangul';

/**
 * Discover flow (F-QUEST-002 §3.2): the view model and reducer behind
 * `DiscoverStep`. Pure, so the screen only renders what this returns and
 * plays the audio it asks for (the test lanes cannot render components, §5).
 *
 * Rules in one place: pages show one or two new things; nothing autoplays
 * but the first letter's sound (AU-10);
 * Hear it says the SOUND (ㄴ is na, a vowel its sound, ㅇ its name, a final its closed
 * syllable; AMENDMENTS-DISCOVER-SOUND-FIRST SF-1), and a consonant's second, optional
 * button, Hear the name, says the letter's name (nieun); the initial ㅇ's second button, Hear it with vowels, says
 * a, o, u (the vowel cards' own sounds) one after the other, so its silence can be heard (SF-3); unavailable or muted audio
 * switches that item to a "say it out loud" text line and changes nothing else; Continue is enabled at once and
 * never waits for a Hear it; an item that cannot be resolved is skipped, and
 * a step with nothing left still has a Continue.
 */

/** The Discover words (`learner.quest.discover`), passed in so the flow stays pure and testable per locale. */
export type DiscoverCopy = Messages['learner']['quest']['discover'];

/** The screen-reader labels of a symbol (`a11y.discoverLetter`, `a11y.discoverFinal`). */
export type DiscoverA11y = Pick<Messages['a11y'], 'discoverLetter' | 'discoverFinal'>;

/** The surface id of Discover for the audio telemetry (`audio.fallback_shown`, F-AUDIO-004 §3.14). */
export const DISCOVER_AUDIO_SOURCE = 'discover';

/** One thing a button says: `text` is what the voice speaks, `audioRef` wins once a recording exists. */
export interface HearSpec {
  text: string;
  audioRef?: string;
}

/** What a Hear it button says. */
export interface HearAction {
  /** Stable per button: `<item key>|sound` (the main Hear it), `|name` (Hear the name), `|vowels` (Hear it with vowels) or `|example`. */
  id: string;
  /** What it says; for a button that says several things in a row, the first of `series`. */
  spec: HearSpec;
  /** [SF-3] A button that says several things one after the other (ㅇ's a, o, u), in order. */
  series?: readonly HearSpec[];
  /**
   * The speech rate (F-AUDIO-004 §3.3): `sound` for a symbol and its name, `sentence` for a
   * sentence, a pattern example and an exchange line, `word` for everything else.
   */
  kind: PromptKind;
}

export interface DiscoverExampleView {
  ko: string;
  /** Teaching-UI form: the syllables joined with a thin separator when the content has them (D13). */
  romanization: string;
  /** Plain romanization, what the voice would say. */
  spokenRomanization: string;
  gloss: string;
  /** The word split into syllable blocks; the one that holds the symbol is emphasised. */
  blocks: Array<{ text: string; emphasised: boolean }>;
  hear: HearAction;
}

export interface DiscoverBlockView {
  vowel: 'beside' | 'under';
  hasFinal: true;
  highlight: 'final';
  /** Initial, vowel, final of the example block. */
  parts: [string, string, string];
}

export interface DiscoverItemView {
  key: string;
  kind: 'symbol' | 'word';
  /** The big glyph for a symbol; the word itself for a word item. */
  glyph: string;
  /** A symbol's sound value (`g/k`, `silent/ng`) or a word's romanization. */
  romanization: string;
  gloss?: string;
  accessibilityLabel: string;
  soundHint?: string;
  /** The main Hear it button: a letter's sound (na), a final's closed syllable (ak), or the word. */
  hear: HearAction;
  /** What the voice says for `hear`, as romanization (`ga` for ㄱ, `ak` for the final ㄱ). */
  spokenRomanization: string;
  /**
   * An initial or a vowel: the line under Hear it (D2). A consonant whose name differs from its sound shows the carrier
   * line "ga = ㄱ + ㅏ" (in Hangul) with its romanization; ㅇ and a vowel show what Hear it says (ieung, a), with it.
   */
  spokenLine?: { ko: string; romanization: string };
  /**
   * A final: the `learner.audio.finalLine` parts, the final and the closed syllable Hear it says, shown as
   * spelled with the pronounced romanization (ㄱ, the syllable ak; ㅈ, the spelled syllable, at).
   */
  finalLine?: { letter: string; syllable: string };
  /**
   * A consonant's second button, Hear the name (SF-1): the letter's name (nieun), with the name as the line `ko` and
   * its romanization (nieun), drawn as content. Only a consonant whose name differs from its sound has one.
   */
  nameButton?: { action: HearAction; ko: string; romanization: string };
  /**
   * [SF-3] The initial ㅇ's second button, Hear it with vowels (AMENDMENTS-DISCOVER-SOUND-FIRST §12): a, o, u in a
   * row, from the vowel cards' own clips, with a carrier line for each (a = ㅇ + ㅏ, in Hangul), drawn as content. Its
   * `accessibilityLabel` is the syllable and its romanization only, so a Korean voice never reads the lone ㅇ by its name (ieung).
   */
  vowelsButton?: { action: HearAction; lines: Array<{ ko: string; romanization: string; accessibilityLabel: string }> };
  block?: DiscoverBlockView;
  batchimLine?: string;
  example?: DiscoverExampleView;
  note?: string;
  picture?: string;
}

/** One line of an `exchange` item (F-CURR-001 §3.5, D-1 S3a): a named speaker and the Korean they say. */
export interface DiscoverExchangeLineView {
  /** Stable per line: `<item key>|line<n>`; also the id of the line's own Hear it. */
  key: string;
  /** Speaker `a` sits at the start, `b` at the end. */
  side: 'a' | 'b';
  /** The speaker's name in the UI language (never Hangul). */
  speaker: string;
  ko: string;
  romanization: string;
  spokenRomanization: string;
  gloss: string;
  accessibilityLabel: string;
  hear: HearAction;
}

/** An `exchange` item: two lines between two named speakers, read along with the line highlight (D-1 S3b). */
export interface DiscoverExchangeView {
  key: string;
  kind: 'exchange';
  lines: DiscoverExchangeLineView[];
}

/**
 * [TC] One letter of the trace page (AMENDMENTS-STAGE1-TRACE-COVERAGE §3.5): its glyph, the romanization its heading shows,
 * whether it is a final, and the letter card's own Hear it under the id `write|<jamoId>` (Show me plays the same).
 */
export interface DiscoverWriteLetter {
  jamoId: string;
  glyph: string;
  romanization: string;
  final: boolean;
  hear: HearAction;
}

/** [TC] The trace page "Trace the new letters": the letters of the step, in page order. Its page has no items. */
export interface DiscoverWriteView {
  key: 'write';
  letters: DiscoverWriteLetter[];
}

export interface DiscoverPageView {
  /** [TC] Set only on the trace page (`items` is empty and there is no `exchange`). */
  write?: DiscoverWriteView;
  title?: string;
  /**
   * The page's exchange, drawn first. A page holds at most one heavy item (D-1 "item weights"), so
   * one exchange per page; a second exchange on a page falls back to word cards.
   */
  exchange?: DiscoverExchangeView;
  items: DiscoverItemView[];
}

export interface DiscoverModel {
  /** Only pages that still have an item; an unresolvable item is skipped. */
  pages: DiscoverPageView[];
}

/** A sound value is read aloud: `∅` is never shown (audit F08). */
const soundValue = (romanization: string): string => romanization.replace('∅', 'silent');

const SYLLABLE_SEPARATOR = '·';
const teachingRomanization = (text: KoText): string =>
  text.syllables ? text.syllables.join(SYLLABLE_SEPARATOR) : text.romanization;

const specOf = (text: string, audioRef: string | undefined): HearSpec => (audioRef === undefined ? { text } : { text, audioRef });

function hear(id: string, text: string, audioRef: string | undefined, kind: PromptKind): HearAction {
  return { id, spec: specOf(text, audioRef), kind };
}

/** Everything a button says, in order: its `series`, or its one `spec`. Warm-up, clip checks and play read all of it. */
export function actionSpecs(action: HearAction): readonly HearSpec[] {
  return action.series ?? [action.spec];
}

/** [SF-3] The vowels the initial ㅇ's Hear it with vowels says, in order (SF-OD-8): all taught before ㅇ (quests 1, 2). */
const SILENT_IEUNG_VOWELS = ['jamo:a', 'jamo:o', 'jamo:u'] as const;

/** [SF-3] Hear it with vowels on the initial ㅇ: each vowel's own sound (`jamoVoice(v, 'sound')`) and its carrier line. */
function vowelsButton(key: string, ieung: Jamo): DiscoverItemView['vowelsButton'] {
  const voices = SILENT_IEUNG_VOWELS.flatMap((id) => {
    const vowel = findJamo(id);
    return vowel ? [{ vowel, voice: jamoVoice(vowel, 'sound') }] : [];
  });
  const series = voices.map(({ voice }) => specOf(voice.text, voice.audioRef));
  const first = series[0];
  if (first === undefined) return undefined;
  return {
    action: { id: `${key}|vowels`, spec: first, series, kind: 'sound' },
    lines: voices.map(({ vowel, voice }) => ({
      ko: `${voice.shown} = ${ieung.char} + ${vowel.char}`,
      romanization: voice.romanization,
      accessibilityLabel: `${voice.shown}, ${voice.romanization}`,
    })),
  };
}

/**
 * [SF-3] How long Hear it with vowels waits after one sound has finished before the next (§12.3). Each vowel clip
 * already holds about 0.35 s of silence at each end, so the voices land about 0.85 s apart; the wait keeps a device
 * voice (no silence of its own) from running them together.
 */
export const SERIES_GAP_MS = 150;

/**
 * [SF-3] Plays `steps` one after the other, waiting `SERIES_GAP_MS` between two. Stops at the first step that does
 * not play and reports it (a throw counts as `unavailable`). A prompt cut off by a newer one still resolves as
 * `played` (F-AUDIO-004), so `live()` is asked after every play and every wait: a run that is no longer live plays
 * nothing more and reports `superseded`, and the screen reports nothing for it.
 */
export async function playInOrder<T>(
  steps: readonly T[],
  play: (step: T) => Promise<PlayResult>,
  opts: { wait: (ms: number) => Promise<void>; live: () => boolean },
): Promise<PlayResult | 'superseded'> {
  let result: PlayResult = 'played';
  for (const [i, step] of steps.entries()) {
    if (i > 0) {
      await opts.wait(SERIES_GAP_MS);
      if (!opts.live()) return 'superseded';
    }
    try {
      result = await play(step);
    } catch {
      result = 'unavailable';
    }
    if (!opts.live()) return 'superseded';
    if (result !== 'played') return result;
  }
  return result;
}

function wordSpec(key: string, suffix: string, word: KoText, kind: PromptKind = 'word'): HearAction {
  return hear(`${key}|${suffix}`, word.spokenKo ?? word.ko, word.audioRef, kind);
}

/** The example word with the first block that holds `jamoId` emphasised. */
function exampleView(key: string, jamoId: string, example: KoText): DiscoverExampleView {
  let found = false;
  const blocks = [...example.ko].map((text) => {
    const holds = !found && (symbolsOf(text)?.includes(jamoId) ?? false);
    if (holds) found = true;
    return { text, emphasised: holds };
  });
  return {
    ko: example.ko,
    romanization: teachingRomanization(example),
    spokenRomanization: example.romanization,
    gloss: example.en,
    blocks,
    hear: wordSpec(key, 'example', example),
  };
}

/** The block diagram of a final consonant: the example block that holds it, else a plain ㅇ + ㅏ + final. */
function blockView(jamoId: string, final: Jamo, example: KoText): DiscoverBlockView {
  for (const text of example.ko) {
    const ids = symbolsOf(text);
    const parts = decompose(text);
    if (ids?.includes(jamoId) && parts?.final) {
      const shape = blockShape(ids);
      return { vowel: shape.vowel, hasFinal: true, highlight: 'final', parts: [parts.initial, parts.medial, parts.final] };
    }
  }
  return { vowel: 'beside', hasFinal: true, highlight: 'final', parts: ['ㅇ', 'ㅏ', final.char] };
}

function symbolLabel(jamo: Jamo, romanization: string, a11y: DiscoverA11y): string {
  if (jamo.kind === 'batchim') return a11y.discoverFinal(romanization);
  return jamo.soundHint ? a11y.discoverLetter(romanization, jamo.soundHint) : a11y.discoverLetter(romanization);
}

/**
 * The page's example word with the jamo's translated example gloss when the page shows
 * that jamo's own example word with the same English gloss (`jamo:*.exampleWord.gloss`,
 * F-I18N-001 §3.6). A page gloss of another sense, or one its quest overlay already
 * translated, stays as it is.
 */
function exampleIn(example: KoText, source: Jamo, local: Jamo): KoText {
  const shared = example.ko === source.exampleWordKo && example.en === source.exampleWordEn;
  return shared && local.exampleWordEn !== undefined && local.exampleWordEn !== example.en
    ? { ...example, en: local.exampleWordEn }
    : example;
}

function symbolItem(
  key: string,
  item: Extract<DiscoverItem, { type: 'jamo' }>,
  jamo: Jamo,
  copy: DiscoverCopy,
  a11y: DiscoverA11y,
  source: Jamo,
): DiscoverItemView {
  const example = exampleIn(item.example, source, jamo);
  // A new letter is first heard by its SOUND (SF-1): a consonant on its carrier vowel (na), a vowel its sound, ㅇ its name
  // (it has no sound of its own) and a final its closed syllable (M12: a final j says at). For ㅇ, a vowel and a final this
  // is the lone-letter voice as before.
  const main = jamoVoice(jamo, 'sound');
  const final = jamo.kind === 'batchim';
  const romanization = soundValue(jamo.romanization);
  // Only a consonant whose name differs from its sound gets the second button: a vowel's name is its sound, and the
  // initial ㅇ has no sound of its own (F-AUDIO-004 W5, W6). The kind goes first: a final has no letter question.
  const name = jamo.kind === 'consonant' ? jamoVoice(jamo, 'letter') : undefined;
  const nameDiffers = name !== undefined && name.text !== main.text;
  const carrier = nameDiffers ? decompose(main.text) : undefined;
  return {
    key,
    kind: 'symbol',
    glyph: jamo.char,
    romanization,
    accessibilityLabel: symbolLabel(jamo, romanization, a11y),
    ...(jamo.soundHint ? { soundHint: jamo.soundHint } : {}),
    hear: hear(`${key}|sound`, main.text, main.audioRef, 'sound'),
    spokenRomanization: main.romanization,
    ...(final
      ? { finalLine: { letter: jamo.char, syllable: voiceLine(main) } }
      : {
          spokenLine: carrier
            ? { ko: `${main.shown} = ${carrier.initial} + ${carrier.medial}`, romanization: main.romanization }
            : { ko: main.shown, romanization: main.romanization },
        }),
    ...(name && nameDiffers
      ? { nameButton: { action: hear(`${key}|name`, name.text, name.audioRef, 'sound'), ko: name.shown, romanization: name.romanization } }
      : {}),
    // [SF-3] The initial ㅇ (never the final ㅇ, a separate record) has no sound of its own: its second button lets it be heard.
    ...(jamo.id === 'jamo:ieung' ? withVowels(key, jamo) : {}),
    ...(jamo.kind === 'batchim' ? { block: blockView(jamo.id, jamo, example), batchimLine: copy.batchimLine } : {}),
    example: exampleView(key, jamo.id, example),
    ...(item.picture ? { picture: item.picture } : {}),
  };
}

function withVowels(key: string, ieung: Jamo): Pick<DiscoverItemView, 'vowelsButton'> {
  const button = vowelsButton(key, ieung);
  return button ? { vowelsButton: button } : {};
}

function wordItem(key: string, item: Extract<DiscoverItem, { type: 'word' }>, kind: PromptKind = 'word'): DiscoverItemView {
  const { word } = item;
  return {
    key,
    kind: 'word',
    glyph: word.ko,
    romanization: teachingRomanization(word),
    gloss: word.en,
    accessibilityLabel: `${word.ko}, ${word.romanization}, ${word.en}`,
    hear: wordSpec(key, 'sound', word, kind),
    spokenRomanization: word.romanization,
    ...(item.noteEn ? { note: item.noteEn } : {}),
    ...(item.picture ? { picture: item.picture } : {}),
  };
}

function exchangeItem(key: string, item: Extract<DiscoverItem, { type: 'exchange' }>): DiscoverExchangeView {
  return {
    key,
    kind: 'exchange',
    lines: item.lines.map((l, i) => {
      const lineKey = `${key}|line${i}`;
      return {
        key: lineKey,
        side: l.speaker,
        speaker: l.speakerEn,
        ko: l.line.ko,
        romanization: teachingRomanization(l.line),
        spokenRomanization: l.line.romanization,
        gloss: l.line.en,
        accessibilityLabel: `${l.speakerEn}: ${l.line.ko}, ${l.line.romanization}, ${l.line.en}`,
        hear: hear(lineKey, l.line.spokenKo ?? l.line.ko, l.line.audioRef, 'sentence'),
      };
    }),
  };
}

/**
 * Turn the authored pages into view models, skipping what cannot be resolved. `locale`
 * picks the jamo sound hint and example gloss of the UI language (F-I18N-001 §3.6; the
 * glyph and romanization never change); `overlays` defaults to the generated ones. The
 * pages' own glosses, caption and notes come localized with the quest (`localizeQuest`).
 */
export function buildDiscover(
  pages: readonly DiscoverPage[],
  copy: DiscoverCopy,
  a11y: DiscoverA11y,
  locale: UiLocale = 'en',
  overlays?: Overlays,
  options: { writeOnce?: boolean } = {},
): DiscoverModel {
  const used = new Map<string, number>();
  const uniqueKey = (base: string): string => {
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n === 0 ? base : `${base}#${n}`;
  };

  const built: DiscoverPageView[] = [];
  for (const page of pages) {
    const items: DiscoverItemView[] = [];
    let exchange: DiscoverExchangeView | undefined;
    for (const item of page.items) {
      if (item.type === 'word') {
        items.push(wordItem(uniqueKey(`word:${item.word.ko}`), item));
        continue;
      }
      if (item.type === 'exchange' && exchange === undefined) {
        exchange = exchangeItem(uniqueKey(`exchange:${item.lines.map((l) => l.line.ko).join('/')}`), item);
        continue;
      }
      if (item.type !== 'jamo') {
        // F-CURR-001 upper-stage items (sentence, pattern, realia): until their own Discover
        // views land (S3-1, G-2 / S6-1), each taught text shows as a word card with Hear it.
        const picture = item.type === 'sentence' ? item.picture : undefined;
        // A sentence and a pattern's examples are read as sentences; a realia key word is a word.
        const kind: PromptKind = item.type === 'realia' ? 'word' : 'sentence';
        for (const word of discoverItemTexts(item)) {
          items.push(wordItem(uniqueKey(`word:${word.ko}`), picture ? { type: 'word', word, picture } : { type: 'word', word }, kind));
        }
        continue;
      }
      const found = findJamo(item.jamoId);
      if (found) items.push(symbolItem(uniqueKey(item.jamoId), item, localizeJamo(found, locale, overlays), copy, a11y, found));
    }
    if (items.length === 0 && exchange === undefined) continue;
    const allWords = exchange === undefined && items.every((i) => i.kind === 'word');
    const title = page.captionEn ?? (allWords ? copy.wordsTitle : undefined);
    built.push({ ...(title === undefined ? {} : { title }), ...(exchange === undefined ? {} : { exchange }), items });
  }
  if (options.writeOnce === true) {
    const at = writePageIndex(built);
    const write = at < 0 ? undefined : writeView(writeLetters(pages), built);
    if (write !== undefined) built.splice(at, 0, { write, items: [] });
  }
  return { pages: built };
}

/**
 * [TC] The trace page's letters: each content letter that built a card (an unresolved item is skipped), taken from the
 * first card that shows it. A letter with no card, or none at all, gives no page.
 */
function writeView(ids: readonly string[], built: readonly DiscoverPageView[]): DiscoverWriteView | undefined {
  const cards = new Map<string, DiscoverItemView>();
  for (const page of built) {
    for (const item of page.items) {
      if (item.kind === 'symbol' && !cards.has(jamoIdOfKey(item.key))) cards.set(jamoIdOfKey(item.key), item);
    }
  }
  const letters = ids.flatMap((jamoId): DiscoverWriteLetter[] => {
    const card = cards.get(jamoId);
    if (card === undefined) return [];
    return [
      {
        jamoId,
        glyph: card.glyph,
        romanization: card.romanization,
        final: card.finalLine !== undefined,
        hear: { ...card.hear, id: `write|${jamoId}` },
      },
    ];
  });
  return letters.length === 0 ? undefined : { key: 'write', letters };
}

/**
 * Read along on an `exchange` item (D-1 S3b): `line` is the lit line, or `null` in the short
 * pause between two lines. `run` tells a stale audio result (from a stopped run) apart.
 * `single` is a line's own speaker: it plays and lights just that line.
 */
export interface ReadAlongState {
  item: string;
  line: number | null;
  /** The line that played last (the pause waits after it). */
  last: number;
  run: number;
  single: boolean;
}

export interface DiscoverState {
  page: number;
  /**
   * [QB] The furthest page reached (AMENDMENTS-QUEST-SOUND-BACK QB-1): Previous shows an earlier page, and the page
   * dots keep this one (they only fill).
   */
  furthest: number;
  pageCount: number;
  /**
   * Distinct Hear it buttons tapped, and exchange lines played by Read along (keyed by the line, so a
   * line counts once whether it was tapped or read along); its length is the `heard` of
   * `quest.discover_completed`.
   */
  tapped: readonly string[];
  /** Buttons whose audio played: the item shows its heard mark. */
  played: readonly string[];
  /** Buttons whose audio could not play (unavailable or muted): the item shows the text line. */
  text: readonly string[];
  /** Items whose example romanization was revealed by a tap (`romanizationMode === 'tap'`). */
  revealed: readonly string[];
  /** The Read along in progress, if any. */
  readAlong: ReadAlongState | null;
  /** Counts Read along runs, so a result of a stopped run never moves the highlight. */
  runs: number;
  /**
   * [TC] The trace page (§3.5): the letter shown (`at`), how many letters the page has (`count`, 0 with no trace page: it
   * caps `at`), and the letters traced on this visit (`traced`, the `written` of `quest.discover_completed`). Never persisted.
   */
  write: { at: number; count: number; traced: readonly string[] };
}

export type DiscoverEvent =
  | { type: 'hear'; id: string }
  /**
   * [AU] The page's first letter sounding by itself as the page opens (AMENDMENTS-AUDIT-2026-11 row AU-10). It plays as
   * Hear it does, but it is not a tap: `tapped` (the `heard` of `quest.discover_completed`) does not move.
   */
  | { type: 'autoHear'; id: string }
  /** A play finished; `run` is the one its `play` effect carried (a line of an exchange item). */
  | { type: 'audio'; id: string; result: PlayResult; run?: number }
  | { type: 'reveal'; key: string }
  /** The Read along button of an exchange item: starts it, or stops it when it is running. */
  | { type: 'readAlong'; item: string }
  /** The pause between two lines is over (the screen waits `motion.duration.slow`). */
  | { type: 'readAlongNext'; run: number }
  | { type: 'next' }
  /** [QB] Previous (QB-1): the page before, with every sound stopped. On the first page nothing moves (the step's own Previous is the player's). */
  | { type: 'prev' }
  /** [TC] A letter was traced to the end (the pad's idle gate fired); it is recorded once and never removed. */
  | { type: 'traced'; jamoId: string }
  /**
   * [TC] The next letter of the trace page, from letter `from`: it moves only when `from` is the letter shown, so the advance
   * timer and a Next letter tap can never skip a letter.
   */
  | { type: 'writeNext'; from: number };

export type DiscoverEffect =
  /** Play a button's audio; a line of an exchange item carries its run, which the `audio` result echoes. */
  | { type: 'play'; id: string; run?: number }
  /** Say the lit line's label to a screen reader; the `play` that follows starts after it (announce, then play). */
  | { type: 'announce'; id: string }
  /** Wait the short pause between two lines, then dispatch `readAlongNext` with this run. */
  | { type: 'pause'; run: number }
  /** Stop the audio that is playing (Stop, Continue, or a line's own speaker during Read along). */
  | { type: 'stopAudio' }
  | { type: 'done'; pages: number; heard: number; written: number };

export interface DiscoverStepOut {
  state: DiscoverState;
  effects: DiscoverEffect[];
}

/**
 * [AU] Row AU-10 (audit UX-7): the Hear it that plays by itself when a page opens, or undefined. It is the page's
 * first item when that item is a letter: a letter page says its first letter once. A page that opens on a word or on
 * an exchange stays quiet until a tap, as before.
 */
export function autoHearId(model: DiscoverModel, page: number): string | undefined {
  const first = model.pages[page]?.items[0];
  return first?.kind === 'symbol' ? first.hear.id : undefined;
}

/**
 * [AU] Whether the page may sound by itself now (row AU-10). Not with sound off; not while a screen reader is on (it
 * is reading the new page, and a letter's sound over it would be lost or would hide its words); and only when the
 * sound can play (a recording of it, or a Korean voice), so a device that cannot say it shows nothing new.
 */
export function autoHearAllowed(input: { muted: boolean; screenReader: boolean; hasClip: boolean; voiceReady: boolean }): boolean {
  return !input.muted && !input.screenReader && (input.hasClip || input.voiceReady);
}

export interface DiscoverStart {
  /** [QB] Open on the last page: the step was reached by Previous from the step after it (QB-2). */
  lastPage?: boolean;
  /** [QB] Every page was seen before (a step shown again): the dots start full. */
  seen?: boolean;
}

export function startDiscover(model: DiscoverModel, start: DiscoverStart = {}): DiscoverState {
  const last = Math.max(0, model.pages.length - 1);
  const page = start.lastPage ? last : 0;
  return {
    page,
    furthest: start.seen ? last : page,
    pageCount: model.pages.length,
    tapped: [],
    played: [],
    text: [],
    revealed: [],
    readAlong: null,
    runs: 0,
    write: { at: 0, count: model.pages.find((p) => p.write !== undefined)?.write?.letters.length ?? 0, traced: [] },
  };
}

const add = (list: readonly string[], id: string): readonly string[] => (list.includes(id) ? list : [...list, id]);

const lineId = (item: string, index: number): string => `${item}|line${index}`;
/** `<item key>|line<n>` -> the item key and n; anything else -> undefined. */
function parseLineId(id: string): { item: string; index: number } | undefined {
  const m = /^(.*)\|line(\d+)$/.exec(id);
  return m ? { item: m[1]!, index: Number(m[2]) } : undefined;
}

/** Light line `index` of `item`: announce it, then play it (D-1 S3b "announce, then play"). */
function lightLine(state: DiscoverState, item: string, index: number, run: number, single: boolean): DiscoverStepOut {
  const id = lineId(item, index);
  return {
    state: { ...state, tapped: add(state.tapped, id), readAlong: { item, line: index, last: index, run, single } },
    effects: [
      { type: 'announce', id },
      { type: 'play', id, run },
    ],
  };
}

/**
 * The Discover reducer. `lineCount` says how many lines an exchange item has (Read along stops after
 * the last); the screen passes the model's, and a test may leave it out for two-line items.
 */
export function stepDiscover(
  state: DiscoverState,
  event: DiscoverEvent,
  lineCount: (item: string) => number = () => 2,
): DiscoverStepOut {
  switch (event.type) {
    case 'hear': {
      const line = parseLineId(event.id);
      if (line) {
        // A line's own speaker stops any Read along and plays just that line, lit.
        const stopping: DiscoverEffect[] = state.readAlong ? [{ type: 'stopAudio' }] : [];
        const out = lightLine({ ...state, runs: state.runs + 1 }, line.item, line.index, state.runs + 1, true);
        return { state: out.state, effects: [...stopping, { type: 'play', id: event.id, run: state.runs + 1 }] };
      }
      const stopping: DiscoverEffect[] = state.readAlong ? [{ type: 'stopAudio' }] : [];
      return {
        state: { ...state, tapped: add(state.tapped, event.id), readAlong: null },
        effects: [...stopping, { type: 'play', id: event.id }],
      };
    }
    case 'autoHear':
      // Never over a Read along or a sound the learner asked for: the page has only just opened, so there is none.
      return state.readAlong ? { state, effects: [] } : { state, effects: [{ type: 'play', id: event.id }] };
    case 'audio': {
      const base: DiscoverState =
        event.result === 'played'
          ? { ...state, played: add(state.played, event.id), text: state.text.filter((t) => t !== event.id) }
          : { ...state, text: add(state.text, event.id) };
      const ra = state.readAlong;
      const line = parseLineId(event.id);
      // Only the run that lit the line moves the highlight: a stopped or superseded run's play still
      // resolves (often 'played'), and that result only records the heard mark.
      if (!ra || !line || event.run !== ra.run || line.item !== ra.item || line.index !== ra.line) return { state: base, effects: [] };
      if (event.result !== 'played') {
        // No timed highlight without sound: nothing stays lit, and Read along stops. Why it is silent is the
        // exchange card's prompt slot (its status panel, F-AUDIO-004 A-5b), not this reducer.
        return { state: { ...base, readAlong: null }, effects: [] };
      }
      if (ra.single || line.index >= lineCount(ra.item) - 1) return { state: { ...base, readAlong: null }, effects: [] };
      return { state: { ...base, readAlong: { ...ra, line: null, last: line.index } }, effects: [{ type: 'pause', run: ra.run }] };
    }
    case 'readAlongNext': {
      const ra = state.readAlong;
      if (!ra || ra.run !== event.run || ra.line !== null) return { state, effects: [] };
      return lightLine(state, ra.item, ra.last + 1, ra.run, false);
    }
    case 'readAlong': {
      if (state.readAlong?.item === event.item && !state.readAlong.single) {
        return { state: { ...state, readAlong: null }, effects: [{ type: 'stopAudio' }] };
      }
      const stopping: DiscoverEffect[] = state.readAlong ? [{ type: 'stopAudio' }] : [];
      const out = lightLine({ ...state, runs: state.runs + 1 }, event.item, 0, state.runs + 1, false);
      return { state: out.state, effects: [...stopping, ...out.effects] };
    }
    case 'reveal':
      return { state: { ...state, revealed: add(state.revealed, event.key) }, effects: [] };
    case 'next': {
      const stopping: DiscoverEffect[] = state.readAlong ? [{ type: 'stopAudio' }] : [];
      const quiet = { ...state, readAlong: null };
      if (state.page < state.pageCount - 1) {
        return { state: { ...quiet, page: state.page + 1, furthest: Math.max(state.furthest, state.page + 1) }, effects: stopping };
      }
      return { state: quiet, effects: [...stopping, { type: 'done', pages: state.pageCount, heard: state.tapped.length, written: state.write.traced.length }] };
    }
    case 'prev':
      // [QB] Whatever is sounding stops (a word, a sentence, a Read along); what was heard and revealed stays.
      return { state: { ...state, readAlong: null, page: Math.max(0, state.page - 1) }, effects: [{ type: 'stopAudio' }] };
    case 'traced':
      return { state: { ...state, write: { ...state.write, traced: add(state.write.traced, event.jamoId) } }, effects: [] };
    case 'writeNext':
      if (event.from !== state.write.at) return { state, effects: [] };
      return { state: { ...state, write: { ...state.write, at: Math.min(event.from + 1, Math.max(0, state.write.count - 1)) } }, effects: [] };
  }
}

export interface DiscoverItemRender {
  item: DiscoverItemView;
  /** Any of the item's buttons played. */
  heard: boolean;
  /** "Say it out loud: ga" lines for a button whose audio could not play. */
  sayLines: string[];
  /** `false` hides only the example's romanization (reading practice). */
  exampleRomanizationShown: boolean;
  /** The "Show how to say it" tap is offered. */
  showReveal: boolean;
  /** The Hear it button pulses once as the page opens (static under reduced motion). */
  pulse: boolean;
}

export interface DiscoverExchangeLineRender {
  line: DiscoverExchangeLineView;
  /** This line is playing (Read along or its own speaker): border, tint, the ">>" glyph and "Reading now". */
  lit: boolean;
  /** `false` hides the line's romanization behind "Show how to say it" (`romanizationMode === 'tap'`). */
  romanizationShown: boolean;
  showReveal: boolean;
}

export interface DiscoverExchangeRender {
  item: DiscoverExchangeView;
  lines: DiscoverExchangeLineRender[];
  /** Read along is running on this item: its button reads Stop. */
  reading: boolean;
  /** Any line of the item played. */
  heard: boolean;
  /** "Line 1 of 2, Hoya" for the polite live region while a line is lit (not the line card itself). */
  liveLine?: string;
}

/** [TC] What the trace page shows: its letters, the one shown, the letters traced so far, and whether it is the last letter. */
export interface DiscoverWriteRender {
  letters: readonly DiscoverWriteLetter[];
  at: number;
  traced: readonly string[];
  last: boolean;
}

export interface DiscoverPageRender {
  /** [TC] Set only on the trace page, which has no `items`. */
  write?: DiscoverWriteRender;
  empty: boolean;
  emptyLine?: string;
  title?: string;
  /** The page's exchange, drawn before the items. */
  exchange?: DiscoverExchangeRender;
  items: DiscoverItemRender[];
  /**
   * Page dots: they only fill. [QB] `value` is the furthest page reached and `page` the one shown; `current` is set
   * (to `page`) only while the page shown is behind the furthest one, so the dots mark it (QB-1).
   */
  dots: { value: number; max: number; current?: number };
  /** The page shown, 1-based ("Page 1 of 2"). */
  page: number;
  /** [QB] The page has one before it: Previous shows it (QB-1). */
  hasPrevious: boolean;
  isLast: boolean;
  /** Always true: nobody is held on a page (heritage learners already know the letters). */
  continueEnabled: true;
}

export function pageRender(
  model: DiscoverModel,
  state: DiscoverState,
  mode: RomanizationMode,
  copy: DiscoverCopy,
): DiscoverPageRender {
  const page = model.pages[state.page];
  if (!page) {
    return { empty: true, emptyLine: copy.empty, items: [], dots: { value: 0, max: 0 }, page: 0, hasPrevious: false, isLast: true, continueEnabled: true };
  }
  const write: DiscoverWriteRender | undefined = page.write && {
    letters: page.write.letters,
    at: state.write.at,
    traced: state.write.traced,
    last: state.write.at >= page.write.letters.length - 1,
  };
  const items = page.items.map((item, index): DiscoverItemRender => {
    const ids = [item.hear.id, item.nameButton?.action.id, item.vowelsButton?.action.id, item.example?.hear.id];
    const sayLines: string[] = [];
    if (state.text.includes(item.hear.id)) sayLines.push(copy.sayLine(item.spokenRomanization));
    if (item.example && state.text.includes(item.example.hear.id)) {
      sayLines.push(copy.sayLine(item.example.spokenRomanization));
    }
    const shown = romanizationShown(mode, state.revealed.includes(item.key));
    return {
      item,
      heard: ids.some((id) => id !== undefined && state.played.includes(id)),
      sayLines,
      exampleRomanizationShown: shown,
      showReveal: !shown && item.example !== undefined,
      pulse: index === 0 && page.exchange === undefined,
    };
  });
  return {
    empty: false,
    ...(write === undefined ? {} : { write }),
    ...(page.title === undefined ? {} : { title: page.title }),
    ...(page.exchange === undefined ? {} : { exchange: exchangeRender(page.exchange, state, mode, copy) }),
    items,
    dots: {
      value: Math.max(state.furthest, state.page) + 1,
      max: state.pageCount,
      ...(state.page < state.furthest ? { current: state.page + 1 } : {}),
    },
    page: state.page + 1,
    hasPrevious: state.page > 0,
    isLast: state.page >= state.pageCount - 1,
    continueEnabled: true,
  };
}

function exchangeRender(
  item: DiscoverExchangeView,
  state: DiscoverState,
  mode: RomanizationMode,
  copy: DiscoverCopy,
): DiscoverExchangeRender {
  const ra = state.readAlong?.item === item.key ? state.readAlong : null;
  const litIndex = ra?.line ?? null;
  const lines = item.lines.map((line, i): DiscoverExchangeLineRender => {
    const shown = romanizationShown(mode, state.revealed.includes(line.key));
    return { line, lit: litIndex === i, romanizationShown: shown, showReveal: !shown };
  });
  const lit = litIndex === null ? undefined : item.lines[litIndex];
  return {
    item,
    lines,
    reading: ra !== null && !ra.single,
    heard: item.lines.some((l) => state.played.includes(l.hear.id)),
    ...(lit === undefined || litIndex === null
      ? {}
      : { liveLine: copy.exchange.lineLabel(litIndex + 1, item.lines.length, lit.speaker) }),
  };
}
