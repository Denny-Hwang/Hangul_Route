import { composeTyped } from '@hangul-route/content-schema';
import { normalizeTyped, scoreTyped, type TypedScore } from '../type-hangul/score';

/**
 * Write Frame round flow (F-CURR-001 §3.7, row G-5; design/wireframes/minigame/write-frame.md):
 * a pure reducer that returns the effects the renderer runs. Per frame: pick a word for each
 * slot from its bank (any pick is right), then write it (type) against the word picked; the
 * finished sentence shows, and after the step's last frame "My page" lists every sentence.
 * The free-entry name round (Write Your Name q3) skips the pick and is unscored.
 *
 * Picks, typed keys, the name and the sentences live only in this state, which the renderer
 * keeps in React state: never in a store, a log line or telemetry, and gone on unmount (OD-6,
 * test P-1). Effects carry indices and booleans only.
 */

/** The pause after a slot's write part passes, before the next slot's pick (the Type Hangul pass pause). */
export const PASS_PAUSE_MS = 1100;
/** How long the finished sentence shows before the next frame (or My page). */
export const SENTENCE_PAUSE_MS = 2000;
/** The field of a word-bank frame holds at most this many characters (a bank word is short). */
export const MAX_TYPED = 24;
/** A name is at most this many blocks, so the frame stays on one line at 320 (wireframe "Length"). */
export const MAX_NAME_BLOCKS = 8;

/** One frame as the reducer needs it: the Korean of each slot's bank, and how it is written. */
export interface FrameInput {
  /** Per slot, the bank words' Korean (empty for the free-entry slot). */
  banks: readonly (readonly string[])[];
  /** `trace` is written on the keyboard until the Trace a Word canvas joins the frame (see the renderer). */
  entry: 'type' | 'trace' | 'pick';
  freeEntry: boolean;
}

export type WriteFramePhase = 'pick' | 'typing' | 'pass' | 'miss' | 'sentence' | 'myPage';

/** A finished sentence: its frame and the word written in each slot (bank words, or the name). */
export interface WrittenFrame {
  roundIdx: number;
  words: readonly string[];
}

export interface WriteFrameState {
  frames: readonly FrameInput[];
  total: number;
  roundIdx: number;
  slotIdx: number;
  /** Bank index picked per slot of this frame; null until picked. */
  picks: readonly (number | null)[];
  /** The keys typed for this slot: jamo and `' '`. The text is `composeTyped(keys)`. */
  keys: readonly string[];
  phase: WriteFramePhase;
  /** The last Done's check against the picked word; null while typing a fresh slot. */
  score: TypedScore | null;
  /** The first Done of this slot has been checked. */
  answered: boolean;
  /** A Done happened in this frame: Change word is gone (wireframe "Change word"). */
  firstDone: boolean;
  /** A slot of this frame missed on its first Done (the frame is then a missed round). */
  missed: boolean;
  /** Dones after the first one, this slot (moves focus to the result panel again). */
  retries: number;
  lastEdit: 'key' | 'space' | 'delete' | null;
  /** The name round's helper line: the name is at its longest. */
  atLongest: boolean;
  /** The sentences finished in this step, in order: My page. */
  written: readonly WrittenFrame[];
  /** The step is over (completed or skipped). */
  done: boolean;
}

export type WriteFrameEvent =
  | { type: 'pick'; index: number }
  | { type: 'change-word' }
  | { type: 'key'; jamo: string }
  /** A name-round tile: the keys of a whole block, or one final letter. */
  | { type: 'tile'; keys: readonly string[] }
  | { type: 'space' }
  | { type: 'delete' }
  | { type: 'done' }
  | { type: 'fix' }
  | { type: 'advance' }
  /** My page's Continue. */
  | { type: 'continue' }
  /** Skip: leave now, without recording the remaining frames; My page is not shown. */
  | { type: 'skip' };

export type WriteFrameEffect =
  | { type: 'answer'; roundIdx: number; correct: boolean }
  | { type: 'haptic'; kind: 'success' | 'nudge' }
  | { type: 'schedule-advance'; ms: number }
  | { type: 'complete' };

export interface WriteFrameStep {
  state: WriteFrameState;
  effects: WriteFrameEffect[];
}

/** Every block of a name is a whole syllable, with single spaces between parts (wireframe "Done needs whole syllables"). */
export function nameReady(text: string): boolean {
  return /^[가-힣]+(?: [가-힣]+)*$/.test(normalizeTyped(text));
}

/** The blocks a text holds: every character but spaces (a lone letter counts as a block). */
export function blockCount(text: string): number {
  return [...text].filter((ch) => ch !== ' ').length;
}

const isFree = (s: WriteFrameState): boolean => s.frames[s.roundIdx]?.freeEntry === true;

function freshFrame(s: WriteFrameState, roundIdx: number, nameKeys: readonly string[]): WriteFrameState {
  const frame = s.frames[roundIdx];
  return {
    ...s,
    roundIdx,
    slotIdx: 0,
    picks: (frame?.banks ?? []).map(() => null),
    keys: frame?.freeEntry ? nameKeys : [],
    phase: frame?.freeEntry ? 'typing' : 'pick',
    score: null,
    answered: false,
    firstDone: false,
    missed: false,
    retries: 0,
    lastEdit: null,
    atLongest: false,
  };
}

/**
 * The opening state. `nameKeys` prefills the name round (the grown-up preview passes the
 * keys of the cast name 호야, F-BROWSE-001); a learner's round starts empty.
 */
export function startFlow(frames: readonly FrameInput[], nameKeys: readonly string[] = []): WriteFrameState {
  const base: WriteFrameState = {
    frames,
    total: frames.length,
    roundIdx: 0,
    slotIdx: 0,
    picks: [],
    keys: [],
    phase: 'pick',
    score: null,
    answered: false,
    firstDone: false,
    missed: false,
    retries: 0,
    lastEdit: null,
    atLongest: false,
    written: [],
    done: frames.length === 0,
  };
  return freshFrame(base, 0, nameKeys);
}

/** The Korean picked for each slot of the current frame (null where not picked yet). */
export function pickedWords(s: WriteFrameState): (string | null)[] {
  const frame = s.frames[s.roundIdx] as FrameInput;
  // A pick is always an index of its slot's bank (`pick` checks it).
  return s.picks.map((p, slot) => (p === null ? null : ((frame.banks[slot] as readonly string[])[p] as string)));
}

/** The word the current slot is written against: the pick, or (name round) nothing. */
export function targetWord(s: WriteFrameState): string | null {
  return pickedWords(s)[s.slotIdx] ?? null;
}

const unchanged = (state: WriteFrameState): WriteFrameStep => ({ state, effects: [] });

/** Applies an edit to the keys, inside the field's limit (a name: 8 blocks; else 24 characters). */
function edit(s: WriteFrameState, keys: readonly string[], lastEdit: 'key' | 'space'): WriteFrameStep {
  const text = composeTyped(keys);
  if (isFree(s)) {
    if (blockCount(text) > MAX_NAME_BLOCKS) return unchanged({ ...s, atLongest: true });
  } else if (text.length > MAX_TYPED) {
    return unchanged(s);
  }
  return unchanged({ ...s, keys, lastEdit, atLongest: false });
}

/** The frame is written: the sentence shows, then the next frame or My page. */
function finishFrame(s: WriteFrameState, words: readonly string[], effects: WriteFrameEffect[]): WriteFrameStep {
  effects.push({ type: 'schedule-advance', ms: SENTENCE_PAUSE_MS });
  return {
    state: { ...s, phase: 'sentence', written: [...s.written, { roundIdx: s.roundIdx, words }] },
    effects,
  };
}

/** A slot is written (or picked, for a pick-only frame): the next slot's pick, or the sentence. */
function slotDone(s: WriteFrameState, effects: WriteFrameEffect[], scored: boolean): WriteFrameStep {
  const frame = s.frames[s.roundIdx] as FrameInput;
  if (s.slotIdx < frame.banks.length - 1) {
    return { state: { ...s, slotIdx: s.slotIdx + 1, phase: 'pick', keys: [], score: null, answered: false, retries: 0, lastEdit: null }, effects };
  }
  // `answerRound` once per frame, after its last slot: right only if every slot passed on its first Done.
  if (scored) effects.push({ type: 'answer', roundIdx: s.roundIdx, correct: !s.missed });
  return finishFrame(s, pickedWords(s) as string[], effects);
}

export function stepFlow(s: WriteFrameState, e: WriteFrameEvent): WriteFrameStep {
  if (s.done) return unchanged(s);
  switch (e.type) {
    case 'pick': {
      const frame = s.frames[s.roundIdx];
      if (s.phase !== 'pick' || !frame || frame.banks[s.slotIdx]?.[e.index] === undefined) return unchanged(s);
      const picks = s.picks.map((p, i) => (i === s.slotIdx ? e.index : p));
      const next = { ...s, picks };
      if (frame.entry === 'pick') return slotDone(next, [], false);
      return unchanged({ ...next, phase: 'typing', keys: [], score: null, lastEdit: null });
    }
    case 'change-word':
      if (s.phase !== 'typing' || s.firstDone || isFree(s)) return unchanged(s);
      return unchanged({ ...s, phase: 'pick', keys: [], lastEdit: null });
    case 'key':
      if (s.phase !== 'typing') return unchanged(s);
      return edit(s, [...s.keys, e.jamo], 'key');
    case 'tile':
      if (s.phase !== 'typing' || !isFree(s)) return unchanged(s);
      return edit(s, [...s.keys, ...e.keys], 'key');
    case 'space': {
      const last = s.keys[s.keys.length - 1];
      if (s.phase !== 'typing' || last === undefined || last === ' ') return unchanged(s);
      return edit(s, [...s.keys, ' '], 'space');
    }
    case 'delete':
      if (s.phase !== 'typing' || s.keys.length === 0) return unchanged(s);
      return unchanged({ ...s, keys: s.keys.slice(0, -1), lastEdit: 'delete', atLongest: false });
    case 'done': {
      if (s.phase !== 'typing') return unchanged(s);
      const text = composeTyped(s.keys);
      if (isFree(s)) {
        // Unscored: any name of whole syllables is accepted; nothing is reported but the step's end.
        if (!nameReady(text)) return unchanged(s);
        return finishFrame({ ...s, firstDone: true }, [normalizeTyped(text)], [{ type: 'haptic', kind: 'success' }]);
      }
      const target = targetWord(s);
      if (target === null || text.trim() === '') return unchanged(s);
      const score = scoreTyped(text, target);
      const correct = score.verdict === 'match';
      const missed = s.missed || (!s.answered && !correct);
      const next: WriteFrameState = {
        ...s,
        score,
        answered: true,
        firstDone: true,
        missed,
        retries: s.answered ? s.retries + 1 : s.retries,
      };
      if (!correct) return { state: { ...next, phase: 'miss' }, effects: [{ type: 'haptic', kind: 'nudge' }] };
      const effects: WriteFrameEffect[] = [{ type: 'haptic', kind: 'success' }];
      const frame = s.frames[s.roundIdx] as FrameInput;
      if (s.slotIdx < frame.banks.length - 1) {
        effects.push({ type: 'schedule-advance', ms: PASS_PAUSE_MS });
        return { state: { ...next, phase: 'pass' }, effects };
      }
      return slotDone(next, effects, true);
    }
    case 'fix':
      return s.phase === 'miss' ? unchanged({ ...s, phase: 'typing', lastEdit: null }) : unchanged(s);
    case 'advance':
      if (s.phase === 'pass') return slotDone(s, [], true);
      if (s.phase !== 'sentence') return unchanged(s);
      if (s.roundIdx >= s.total - 1) return unchanged({ ...s, phase: 'myPage', keys: [] });
      return unchanged(freshFrame(s, s.roundIdx + 1, []));
    case 'continue':
      if (s.phase !== 'myPage') return unchanged(s);
      return { state: { ...s, done: true }, effects: [{ type: 'complete' }] };
    case 'skip':
      return { state: { ...s, done: true }, effects: [{ type: 'complete' }] };
  }
}
