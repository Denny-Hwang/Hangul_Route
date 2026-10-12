import { create } from 'zustand';
import type { VocabEvent } from '../logic/vocab/progress';
import type { MinigameHost } from '../screens/minigames/host';
import { useProgressStore } from './progress-store';

/**
 * The vocabulary run in progress — F-VOC-003 section 3.2 and section 3.9.
 * Ephemeral: it persists nothing; persistence is `progress-store.recordVocab`.
 *
 * It is also the vocab `MinigameHost` (F-QUEST-002 section 3.12): a Match run
 * buffers the first answer per round key and `complete` writes them as
 * `answer` events (`source: 'match'`) plus one `session` event, once.
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
  /** Writes the buffered answers and the session, then ends the run (a second call writes nothing). */
  complete: (now?: Date) => void;
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
    const events: VocabEvent[] = [
      ...answers.map((a): VocabEvent => ({ type: 'answer', id: a.id, correct: a.correct, source: 'match' })),
      { type: 'session', topicKey, kind: 'match' },
    ];
    set(EMPTY);
    useProgressStore.getState().recordVocab(profileId, events, now);
  },
}));

/** The host `VocabMatchScreen` passes to Pic-Word Match (C-6). */
export const vocabHost: MinigameHost = {
  mode: 'vocab',
  answer: (roundKey, correct, meta) => useVocabRunStore.getState().answer(roundKey, correct, meta),
  complete: () => useVocabRunStore.getState().complete(),
};
