import { create } from 'zustand';
import { dayKey } from '../logic/homework/mission-builder';
import type { VocabEvent } from '../logic/vocab/progress';
import { speedAnswerEvent, speedSessionEvent } from '../logic/vocab/speed-round';
import type { QuestionResult } from '../logic/vocab/speed-session';
import type { RoundSummary } from '../logic/vocab/stars';
import type { MinigameHost } from '../screens/minigames/host';
import { markVocabRoundDone } from './mission-pin-store';
import { useProgressStore } from './progress-store';

/**
 * The vocabulary run in progress — F-VOC-003 section 3.2 and section 3.9.
 * Ephemeral: it persists nothing; persistence is `progress-store.recordVocab`.
 *
 * It is also the vocab `MinigameHost` (F-QUEST-002 section 3.12): a Match run
 * buffers the first answer per round key and `complete` writes them as
 * `answer` events (`source: 'match'`) plus one `session` event, once.
 *
 * A Speed Round (F-VOC-004 section 3.6) writes each first tap at once
 * (`speedAnswer`, `source: 'speed'`), so a closed app loses nothing, and one
 * `session` event when the round reaches its results (`finishSpeed`). A quit
 * is `reset`: the answers already given stay written, no session is added.
 */

export type VocabRunMode = 'cards' | 'speed' | 'match';

export interface BufferedAnswer {
  /** The round key, as a string. */
  key: string;
  id: string;
  correct: boolean;
}

interface State {
  profileId: string | null;
  topicKey: string | null;
  mode: VocabRunMode | null;
  answers: readonly BufferedAnswer[];
}

interface Actions {
  begin: (profileId: string, topicKey: string, mode: VocabRunMode) => void;
  reset: () => void;
  /** First answer per round key, Match runs only; an answer without an item id is ignored. */
  answer: (roundKey: string | number, correct: boolean, meta?: { itemId?: string }) => void;
  /**
   * Writes the buffered answers and the session, then ends the run (a second
   * call writes nothing). A run with no answers (left early) writes nothing:
   * no practice happened.
   */
  complete: (now?: Date) => void;
  /** A Speed Round's first tap, written at once (speed runs only). */
  speedAnswer: (result: QuestionResult, now?: Date) => void;
  /**
   * The end of a Speed Round that reached its results: one session event when
   * anything was answered (stars), then the run ends (a second call writes nothing).
   */
  finishSpeed: (summary: RoundSummary, now?: Date) => void;
}

const EMPTY: State = { profileId: null, topicKey: null, mode: null, answers: [] };

export const useVocabRunStore = create<State & Actions>((set, get) => ({
  ...EMPTY,
  begin: (profileId, topicKey, mode) => set({ profileId, topicKey, mode, answers: [] }),
  reset: () => set(EMPTY),
  answer: (roundKey, correct, meta) => {
    const s = get();
    const id = meta?.itemId;
    const key = String(roundKey);
    if (s.mode !== 'match' || id === undefined || s.answers.some((a) => a.key === key)) return;
    set({ answers: [...s.answers, { key, id, correct }] });
  },
  complete: (now = new Date()) => {
    const { profileId, topicKey, mode, answers } = get();
    if (mode !== 'match' || profileId === null || topicKey === null) return;
    if (answers.length === 0) {
      set(EMPTY);
      return;
    }
    const events: VocabEvent[] = [
      ...answers.map((a): VocabEvent => ({ type: 'answer', id: a.id, correct: a.correct, source: 'match' })),
      { type: 'session', topicKey, kind: 'match' },
    ];
    try {
      useProgressStore.getState().recordVocab(profileId, events, now);
    } finally {
      // Cleared after the write, and even when it throws, so a second call can never write the session twice.
      set(EMPTY);
    }
  },
  speedAnswer: (result, now = new Date()) => {
    const { profileId, mode } = get();
    if (mode !== 'speed' || profileId === null) return;
    useProgressStore.getState().recordVocab(profileId, [speedAnswerEvent(result)], now);
  },
  finishSpeed: (summary, now = new Date()) => {
    const { profileId, topicKey, mode } = get();
    if (mode !== 'speed' || profileId === null || topicKey === null) return;
    const event = speedSessionEvent(topicKey, summary);
    try {
      if (event !== null) {
        // Before the write, so the Home plan it re-renders already sees the round (F-VOC-005 section 3.7).
        markVocabRoundDone(profileId, dayKey(now.toISOString()), topicKey);
        useProgressStore.getState().recordVocab(profileId, [event], now);
      }
    } finally {
      set(EMPTY);
    }
  },
}));

/**
 * The host `VocabMatchScreen` passes to Pic-Word Match (C-6). Match only: the
 * flashcards' quick check does **not** go through this host (it would be
 * recorded as `source: 'match'`); `VocabCardsScreen` (C-5) writes each first
 * answer itself with `recordVocab` and `flashcards.quickCheckEvent`
 * (`source: 'cards'`, `format: 'word-to-image'`, F-VOC-003 section 3.6).
 */
export const vocabHost: MinigameHost = {
  mode: 'vocab',
  answer: (roundKey, correct, meta) => useVocabRunStore.getState().answer(roundKey, correct, meta),
  complete: () => useVocabRunStore.getState().complete(),
};

/**
 * The host `VocabSpeedRoundScreen` passes to `VocabQuestionView` (F-VOC-004
 * section 3.9). It records nothing itself: the view's first tap goes to the
 * session reducer (`onAnswer`), whose result carries the hint and the active
 * time, and the screen writes that with `speedAnswer`.
 */
export const speedHost: MinigameHost = {
  mode: 'vocab',
  answer: () => undefined,
  complete: () => undefined,
};
