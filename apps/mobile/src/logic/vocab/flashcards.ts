import type { RuntimeVocabItem, VocabProgress } from '@hangul-route/content-schema';
import type { VocabEvent } from './progress';

/**
 * Flashcards: chunks, the card state machine and what each step writes —
 * F-VOC-003 section 3.5 and section 3.6. Pure; the screen only dispatches.
 *
 * A word is collected the first time its back is shown (T2). "Got it" and
 * "Show me again" are self reports accepted only on the back (T3); "Show me
 * again" brings the card back once at the end of the chunk, so a word appears
 * at most twice. Nothing here can mark a card wrong.
 */

/** Words per chunk by the learner's level order (T4); no level -> 4. Never an age. */
export function chunkSize(levelOrder: 0 | 1 | 2 | null): 4 | 6 {
  return levelOrder === 2 ? 6 : 4;
}

const DEFAULT_CHUNK = 4;

/**
 * The topic's words in learning order — file order for a `fixedOrder` topic
 * (Colors, Numbers), otherwise ascending level with file order inside a level —
 * cut into consecutive chunks of `size`. A trailing chunk of one word joins the
 * previous chunk, so no chunk has fewer than 2 words unless the topic does.
 */
export function chunksFor<T extends Pick<RuntimeVocabItem, 'id' | 'level'>>(
  items: readonly T[],
  size: number,
  fixedOrder: boolean,
): T[][] {
  const n = Number.isInteger(size) && size >= 1 ? size : DEFAULT_CHUNK;
  // Array.prototype.sort is stable: equal levels keep file order.
  const ordered = fixedOrder ? [...items] : [...items].sort((a, b) => a.level - b.level);
  const chunks: T[][] = [];
  for (let i = 0; i < ordered.length; i += n) chunks.push(ordered.slice(i, i + n));
  const last = chunks[chunks.length - 1];
  if (chunks.length > 1 && last !== undefined && last.length === 1) {
    chunks.pop();
    chunks[chunks.length - 1]!.push(last[0]!);
  }
  return chunks;
}

function firstChunkToMeet(chunks: readonly (readonly { id: string }[])[], collected: ReadonlySet<string>): number {
  const i = chunks.findIndex((c) => c.some((w) => !collected.has(w.id)));
  return i < 0 ? 0 : i;
}

/** The first chunk with a word not yet collected; chunk 0 (a review) when every word is. */
export function suggestedChunk(chunks: readonly (readonly { id: string }[])[], progress: VocabProgress): number {
  return firstChunkToMeet(chunks, new Set(progress.items.map((s) => s.id)));
}

export type Face = 'front' | 'back';
export type SelfMark = 'got-it' | 'again';

export interface FlashState {
  /** Item ids in the order they will be shown. */
  queue: readonly string[];
  /** Position in the queue. */
  index: number;
  face: Face;
  /** Ids already requeued once. */
  requeued: ReadonlySet<string>;
  /** The last self mark per id in this run. */
  outcomes: Readonly<Record<string, SelfMark>>;
  /** Ids whose back was shown: collected. */
  flipped: ReadonlySet<string>;
  /** Speaker taps (telemetry). */
  heard: number;
  phase: 'cards' | 'check' | 'done';
}

export type FlashEvent = 'flip' | 'got-it' | 'again' | 'hear' | 'check-done';

export function initFlash(chunk: readonly { id: string }[]): FlashState {
  return {
    queue: chunk.map((w) => w.id),
    index: 0,
    face: 'front',
    requeued: new Set(),
    outcomes: {},
    flipped: new Set(),
    heard: 0,
    phase: chunk.length === 0 ? 'check' : 'cards',
  };
}

/** The id of the card on screen, or null outside the cards phase. */
export function currentId(s: FlashState): string | null {
  return s.phase === 'cards' ? (s.queue[s.index] ?? null) : null;
}

const withId = (set: ReadonlySet<string>, id: string): ReadonlySet<string> => (set.has(id) ? set : new Set([...set, id]));

function mark(s: FlashState, id: string, outcome: SelfMark): FlashState {
  const requeue = outcome === 'again' && !s.requeued.has(id);
  const queue = requeue ? [...s.queue, id] : s.queue;
  const index = s.index + 1;
  return {
    ...s,
    queue,
    index,
    face: 'front',
    requeued: requeue ? withId(s.requeued, id) : s.requeued,
    outcomes: { ...s.outcomes, [id]: outcome },
    flipped: withId(s.flipped, id),
    phase: index >= queue.length ? 'check' : 'cards',
  };
}

/** Returns the same object when the event does not apply, so a screen can skip a render. */
export function flashReducer(s: FlashState, event: FlashEvent): FlashState {
  if (event === 'check-done') return s.phase === 'check' ? { ...s, phase: 'done' } : s;
  const id = currentId(s);
  if (id === null) return s;
  switch (event) {
    case 'flip': {
      const face: Face = s.face === 'front' ? 'back' : 'front';
      return { ...s, face, flipped: face === 'back' ? withId(s.flipped, id) : s.flipped };
    }
    case 'got-it':
    case 'again':
      return s.face === 'back' ? mark(s, id, event) : s;
    case 'hear':
      return { ...s, heard: s.heard + 1 };
    default:
      return s;
  }
}

/** Dots for the fill-only meter: the distinct cards shown so far (a requeued card adds none). */
export function dotsFilled(s: FlashState): number {
  const shown = s.phase === 'cards' ? s.queue.slice(0, s.index + 1) : s.queue;
  return new Set(shown).size;
}

/**
 * What a dispatched event writes through `progress-store.recordVocab`, given
 * the state **before** it (section 3.6): `introduced` the first time a back is
 * shown (idempotent in the reducer), and a self report for each mark. Events
 * are written as they happen, so a closed app loses nothing.
 */
export function flashEvents(before: FlashState, event: FlashEvent): VocabEvent[] {
  const id = currentId(before);
  if (id === null) return [];
  const introduced: VocabEvent[] = before.flipped.has(id) ? [] : [{ type: 'introduced', id }];
  if (event === 'flip') return before.face === 'front' ? introduced : [];
  if ((event === 'got-it' || event === 'again') && before.face === 'back') {
    return [...introduced, { type: 'self', id, known: event === 'got-it' }];
  }
  return [];
}

/** The quick check's first answer to a question (section 3.6). */
export function quickCheckEvent(id: string, correct: boolean): VocabEvent {
  return { type: 'answer', id, correct, format: 'word-to-image', source: 'cards' };
}

/** Written when the chunk summary shows. */
export function cardsSessionEvent(topicKey: string): VocabEvent {
  return { type: 'session', topicKey, kind: 'cards' };
}

/** Questions in the quick check after a chunk. */
export const QUICK_CHECK_SIZE = 2;

/**
 * The words of the quick check: the chunk's "Show me again" words first,
 * padded with the earliest words of the chunk, never twice, in chunk order.
 */
export function quickCheckItems<T extends { id: string }>(
  chunk: readonly T[],
  outcomes: Readonly<Record<string, SelfMark>>,
  size: number = QUICK_CHECK_SIZE,
): T[] {
  const again = chunk.filter((w) => outcomes[w.id] === 'again').slice(0, size);
  const picked = new Set(again.map((w) => w.id));
  for (const w of chunk) {
    if (picked.size >= size) break;
    picked.add(w.id);
  }
  return chunk.filter((w) => picked.has(w.id));
}

/** The counts `vocab.cards.complete` carries (section 3.7). */
export interface ChunkTally {
  words: number;
  gotIt: number;
  again: number;
  heard: number;
  /** Words first collected in this chunk: a count, never a fraction. */
  newlyCollected: number;
}

/** `collectedBefore`: the ids collected when the chunk opened. */
export function chunkTally(s: FlashState, collectedBefore: ReadonlySet<string>): ChunkTally {
  const marks = Object.values(s.outcomes);
  return {
    words: new Set(s.queue).size,
    gotIt: marks.filter((m) => m === 'got-it').length,
    again: marks.filter((m) => m === 'again').length,
    heard: s.heard,
    newlyCollected: [...s.flipped].filter((id) => !collectedBefore.has(id)).length,
  };
}

export type SummaryPrimary = { kind: 'next' | 'review'; chunk: number };

/**
 * The chunk summary's primary button: "Next words" (the first chunk with a word
 * still to meet) while the topic has one, else "Review these" (the same chunk;
 * chunk 0 when `current` is out of range).
 */
export function summaryPrimary(
  chunks: readonly (readonly { id: string }[])[],
  current: number,
  collected: ReadonlySet<string>,
): SummaryPrimary {
  const toMeet = chunks.some((c) => c.some((w) => !collected.has(w.id)));
  if (toMeet) return { kind: 'next', chunk: firstChunkToMeet(chunks, collected) };
  return { kind: 'review', chunk: current >= 0 && current < chunks.length ? current : 0 };
}
