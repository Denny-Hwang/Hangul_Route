/**
 * MinigameHost (F-QUEST-002 §3.12): what a game needs from the screen that
 * launches it, so one game serves a quest step, the two-question Check, the
 * Hangul Check, a vocabulary round and a preview. If F-VOC-001 adds a host
 * first, reuse its file and these member names.
 *
 * Listen & Pick, Pic-Word Match, Sentence Builder (F-CURR-001 G-1) and Trace a Word take a host;
 * the nine older games keep their direct quest-run-store calls (decision L11).
 */
export type HostMode = 'quest' | 'check' | 'review' | 'vocab' | 'preview';

/** What a game says about an answer beside right or wrong. */
export interface AnswerMeta {
  /** The round's item, for the memory store (F-CURR-002 row CM-12). */
  itemId?: string;
  /**
   * The memory store records this first answer as a hinted right answer (no promotion, no demotion; section 4.3):
   * Dictation's "Show how it sounds", or a typed answer one letter off (row CM-31). The stars still follow `correct`.
   */
  hinted?: boolean;
}

export interface MinigameHost {
  mode: HostMode;
  /**
   * Report an answer. The first answer for a `roundKey` is scored; later ones
   * are retries (`logic/first-try.ts`). `hinted`: given with a hint showing (Story Order's and Role Play's Show
   * meanings, F-CURR-002 rows CM-34 and CM-35, which pass it with a right answer only), still scored as usual.
   */
  answer(roundKey: string | number, correct: boolean, meta?: AnswerMeta): void;
  /** The game is over. A quest host marks the step complete, then closes. */
  complete(): void;
}
