import { discoverItemTexts, type DiscoverItem, type DiscoverPage, type Jamo, type KoText, type Overlays, type RomanizationMode, type UiLocale } from '@hangul-route/content-schema';
import { romanizationShown, type Messages } from '@hangul-route/i18n';
import { findJamo } from '../../content/jamo';
import type { PlayResult } from '../../platform/audio';
import { spokenFor } from '../audio/spoken';
import { blockShape } from '../build-letter-view';
import { localizeJamo } from '../content-locale';
import { decompose, symbolsOf } from './hangul';

/**
 * Discover flow (F-QUEST-002 §3.2): the view model and reducer behind
 * `DiscoverStep`. Pure, so the screen only renders what this returns and
 * plays the audio it asks for (the test lanes cannot render components, §5).
 *
 * Rules in one place: pages show one or two new things; nothing autoplays;
 * Hear it plays a symbol's SOUND (the letter name is a second, optional
 * button); unavailable or muted audio switches that item to a "say it out
 * loud" text line and changes nothing else; Continue is enabled at once and
 * never waits for a Hear it; an item that cannot be resolved is skipped, and
 * a step with nothing left still has a Continue.
 */

/** The Discover words (`learner.quest.discover`), passed in so the flow stays pure and testable per locale. */
export type DiscoverCopy = Messages['learner']['quest']['discover'];

/** The screen-reader labels of a symbol (`a11y.discoverLetter`, `a11y.discoverFinal`). */
export type DiscoverA11y = Pick<Messages['a11y'], 'discoverLetter' | 'discoverFinal'>;

/** What a Hear it button says: `text` is what the voice speaks, `audioRef` wins once a recording exists. */
export interface HearAction {
  /** Stable per button: `<item key>|sound`, `|name` or `|example`. */
  id: string;
  spec: { text: string; audioRef?: string };
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
  /** The main Hear it button: a symbol's sound, or the word. */
  hear: HearAction;
  /** What the voice says for `hear`, as romanization (`ga` for ㄱ, `ak` for the final ㄱ). */
  spokenRomanization: string;
  letterName?: { action: HearAction; ko: string; romanization: string };
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

export interface DiscoverPageView {
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

function hear(id: string, text: string, audioRef: string | undefined): HearAction {
  return { id, spec: audioRef === undefined ? { text } : { text, audioRef } };
}

function wordSpec(key: string, suffix: string, word: KoText): HearAction {
  return hear(`${key}|${suffix}`, word.spokenKo ?? word.ko, word.audioRef);
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
  const sound = spokenFor(jamo, 'sound');
  const romanization = soundValue(jamo.romanization);
  // Vowels already are their own name and the initial ㅇ is spoken by its name, so only a
  // consonant read by its sound gets the second button (F-AUDIO-004 W5, W6).
  const hasName = jamo.kind === 'consonant' && jamo.spokenKind === 'sound' && jamo.nameKo !== undefined;
  const name = hasName ? spokenFor(jamo, 'name') : undefined;
  return {
    key,
    kind: 'symbol',
    glyph: jamo.char,
    romanization,
    accessibilityLabel: symbolLabel(jamo, romanization, a11y),
    ...(jamo.soundHint ? { soundHint: jamo.soundHint } : {}),
    hear: hear(`${key}|sound`, sound.text, sound.audioRef),
    spokenRomanization: sound.romanization,
    ...(name ? { letterName: { action: hear(`${key}|name`, name.text, name.audioRef), ko: name.text, romanization: name.romanization } } : {}),
    ...(jamo.kind === 'batchim' ? { block: blockView(jamo.id, jamo, example), batchimLine: copy.batchimLine } : {}),
    example: exampleView(key, jamo.id, example),
    ...(item.picture ? { picture: item.picture } : {}),
  };
}

function wordItem(key: string, item: Extract<DiscoverItem, { type: 'word' }>): DiscoverItemView {
  const { word } = item;
  return {
    key,
    kind: 'word',
    glyph: word.ko,
    romanization: teachingRomanization(word),
    gloss: word.en,
    accessibilityLabel: `${word.ko}, ${word.romanization}, ${word.en}`,
    hear: wordSpec(key, 'sound', word),
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
        hear: hear(lineKey, l.line.spokenKo ?? l.line.ko, l.line.audioRef),
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
        for (const word of discoverItemTexts(item)) {
          items.push(wordItem(uniqueKey(`word:${word.ko}`), picture ? { type: 'word', word, picture } : { type: 'word', word }));
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
  return { pages: built };
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
  /** Read along could not play (sound off, no Korean voice): the status line shows once, nothing lights. */
  readAlongStatus: { item: string; result: Exclude<PlayResult, 'played'> } | null;
  /** Counts Read along runs, so a result of a stopped run never moves the highlight. */
  runs: number;
}

export type DiscoverEvent =
  | { type: 'hear'; id: string }
  | { type: 'audio'; id: string; result: PlayResult }
  | { type: 'reveal'; key: string }
  /** The Read along button of an exchange item: starts it, or stops it when it is running. */
  | { type: 'readAlong'; item: string }
  /** The pause between two lines is over (the screen waits `motion.duration.slow`). */
  | { type: 'readAlongNext'; run: number }
  | { type: 'next' };

export type DiscoverEffect =
  | { type: 'play'; id: string }
  /** Say the lit line's label to a screen reader; the `play` that follows starts after it (announce, then play). */
  | { type: 'announce'; id: string }
  /** Wait the short pause between two lines, then dispatch `readAlongNext` with this run. */
  | { type: 'pause'; run: number }
  /** Stop the audio that is playing (Stop, Continue, or a line's own speaker during Read along). */
  | { type: 'stopAudio' }
  | { type: 'done'; pages: number; heard: number };

export interface DiscoverStepOut {
  state: DiscoverState;
  effects: DiscoverEffect[];
}

export function startDiscover(model: DiscoverModel): DiscoverState {
  return {
    page: 0,
    pageCount: model.pages.length,
    tapped: [],
    played: [],
    text: [],
    revealed: [],
    readAlong: null,
    readAlongStatus: null,
    runs: 0,
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
      { type: 'play', id },
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
        const out = lightLine({ ...state, runs: state.runs + 1, readAlongStatus: null }, line.item, line.index, state.runs + 1, true);
        return { state: out.state, effects: [...stopping, { type: 'play', id: event.id }] };
      }
      const stopping: DiscoverEffect[] = state.readAlong ? [{ type: 'stopAudio' }] : [];
      return {
        state: { ...state, tapped: add(state.tapped, event.id), readAlong: null },
        effects: [...stopping, { type: 'play', id: event.id }],
      };
    }
    case 'audio': {
      const base: DiscoverState =
        event.result === 'played'
          ? { ...state, played: add(state.played, event.id), text: state.text.filter((t) => t !== event.id) }
          : { ...state, text: add(state.text, event.id) };
      const ra = state.readAlong;
      const line = parseLineId(event.id);
      if (!ra || !line || line.item !== ra.item || line.index !== ra.line) return { state: base, effects: [] };
      if (event.result !== 'played') {
        // No timed highlight without sound: the status line shows once and nothing stays lit.
        return {
          state: { ...base, readAlong: null, readAlongStatus: ra.single ? null : { item: ra.item, result: event.result } },
          effects: [],
        };
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
      const out = lightLine({ ...state, runs: state.runs + 1, readAlongStatus: null }, event.item, 0, state.runs + 1, false);
      return { state: out.state, effects: [...stopping, ...out.effects] };
    }
    case 'reveal':
      return { state: { ...state, revealed: add(state.revealed, event.key) }, effects: [] };
    case 'next': {
      const stopping: DiscoverEffect[] = state.readAlong ? [{ type: 'stopAudio' }] : [];
      const quiet = { ...state, readAlong: null, readAlongStatus: null };
      if (state.page < state.pageCount - 1) return { state: { ...quiet, page: state.page + 1 }, effects: stopping };
      return { state: quiet, effects: [...stopping, { type: 'done', pages: state.pageCount, heard: state.tapped.length }] };
    }
  }
}

export interface DiscoverItemRender {
  item: DiscoverItemView;
  /** Any of the item's buttons played. */
  heard: boolean;
  /** "Say it out loud: ga" lines for a button whose audio could not play. */
  sayLines: string[];
  /** The letter name was asked for, so it shows as text. */
  nameShown: boolean;
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
  /** Read along could not play: the status line (sound off, or no Korean voice) shows once, nothing lights. */
  status?: Exclude<PlayResult, 'played'>;
}

export interface DiscoverPageRender {
  empty: boolean;
  emptyLine?: string;
  title?: string;
  /** The page's exchange, drawn before the items. */
  exchange?: DiscoverExchangeRender;
  items: DiscoverItemRender[];
  /** Page dots: they only fill. */
  dots: { value: number; max: number };
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
    return { empty: true, emptyLine: copy.empty, items: [], dots: { value: 0, max: 0 }, isLast: true, continueEnabled: true };
  }
  const items = page.items.map((item, index): DiscoverItemRender => {
    const ids = [item.hear.id, item.letterName?.action.id, item.example?.hear.id];
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
      nameShown: item.letterName !== undefined && state.tapped.includes(item.letterName.action.id),
      exampleRomanizationShown: shown,
      showReveal: !shown && item.example !== undefined,
      pulse: index === 0 && page.exchange === undefined,
    };
  });
  return {
    empty: false,
    ...(page.title === undefined ? {} : { title: page.title }),
    ...(page.exchange === undefined ? {} : { exchange: exchangeRender(page.exchange, state, mode, copy) }),
    items,
    dots: { value: state.page + 1, max: state.pageCount },
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
  const status = state.readAlongStatus?.item === item.key ? state.readAlongStatus.result : undefined;
  return {
    item,
    lines,
    reading: ra !== null && !ra.single,
    heard: item.lines.some((l) => state.played.includes(l.hear.id)),
    ...(lit === undefined || litIndex === null
      ? {}
      : { liveLine: copy.exchange.lineLabel(litIndex + 1, item.lines.length, lit.speaker) }),
    ...(status === undefined ? {} : { status }),
  };
}
