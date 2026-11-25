import { useCallback, useEffect, useRef, useState } from 'react';
import type { View } from 'react-native';
import { focusForScreenReader } from '../../platform/screen-reader';

/**
 * The Next button of a game that ends its round on a right answer with a screen reader on (F-A11Y-001 §3.4, OD-AF9 (b);
 * design/components/AnswerFeedback/spec.md D9). Thin glue, like `use-answer-announcement.ts`: the decisions are in
 * `afterRightAnswer` (`logic/answer-feedback.ts`).
 *
 * - `show()` mounts Next; once it has mounted, screen-reader focus moves to it.
 * - `afterFocus(run)` holds `run` until that focus move has happened, so the result line is queued after the focus move
 *   (iOS `queue: true`), never before it. Its promise settles with `run`'s.
 * - `hide()` drops Next and anything still waiting for it, when the round moves on.
 */
export interface RoundNext {
  shown: boolean;
  /** Goes on Next's `pressableRef`. */
  nextRef: React.RefObject<View>;
  show: () => void;
  hide: () => void;
  afterFocus: <T>(run: () => Promise<T>) => Promise<T>;
}

export function useRoundNext(): RoundNext {
  const nextRef = useRef<View>(null);
  const [shown, setShown] = useState(false);
  const queued = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!shown) return;
    focusForScreenReader(nextRef.current);
    const run = queued.current;
    queued.current = null;
    run?.();
  }, [shown]);

  const show = useCallback((): void => setShown(true), []);
  const hide = useCallback((): void => {
    queued.current = null;
    setShown(false);
  }, []);
  const afterFocus = useCallback(
    <T,>(run: () => Promise<T>): Promise<T> =>
      new Promise<T>((resolve, reject) => {
        queued.current = () => {
          run().then(resolve, reject);
        };
      }),
    [],
  );
  return { shown, nextRef, show, hide, afterFocus };
}
