/**
 * MinigameHost (F-QUEST-002 §3.12): what a game needs from the screen that
 * launches it, so one game serves a quest step, the two-question Check, the
 * Hangul Check, a vocabulary round and a preview. If F-VOC-001 adds a host
 * first, reuse its file and these member names.
 *
 * Only Listen & Pick, Pic-Word Match and Trace a Word take a host; the nine older games keep
 * their direct quest-run-store calls (decision L11).
 */
export type HostMode = 'quest' | 'check' | 'review' | 'vocab' | 'preview';

export interface MinigameHost {
  mode: HostMode;
  /**
   * Report an answer. The first answer for a `roundKey` is scored; later ones
   * are retries (`logic/first-try.ts`).
   */
  answer(roundKey: string | number, correct: boolean, meta?: { itemId?: string }): void;
  /** The game is over. A quest host marks the step complete, then closes. */
  complete(): void;
}
