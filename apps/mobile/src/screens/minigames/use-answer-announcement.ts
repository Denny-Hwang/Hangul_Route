import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useMessages } from '../../i18n/use-messages';
import { announceWaitMs, answerAnnouncement, readerPath, segmentsText, type AnswerResult } from '../../logic/answer-feedback';
import { useNativeScreenReader } from '../../i18n/use-romanization-mode';
import { announceAndWait, announceQueued, focusForScreenReader } from '../../platform/screen-reader';
import { useLocaleStore } from '../../store/locale-store';
import { EMPTY_ANNOUNCER_LINE, type AnnouncerLine } from './answer-announcer';

/**
 * The answer announcement of a game screen (F-A11Y-001 §3.3, §3.4): thin glue between the pure rules
 * (`logic/answer-feedback.ts`) and the platform calls (`platform/screen-reader`). The screen renders
 * `<AnswerAnnouncer line={a.line} />` once, puts `a.promptRef` on its round's header node, and calls `a.announce` once
 * per result and `a.clear` when a new round opens.
 *
 * - `announce(result)` writes the announcer's line (the channel of Android and the web) and makes the iOS call: one
 *   queued call per result, never on Android or the web. It settles once the line has been said: at once with the reader
 *   path off; on iOS on VoiceOver's own finish event for this line; on Android and the web after `announceWaitMs`.
 * - `readerOn`: native follows the platform reader, from the one app-wide holder in `i18n/use-romanization-mode.tsx` (the
 *   romanization fade reads the same signal, AMENDMENTS-ROMANIZATION-FADE section 3.13); the web follows the device flag
 *   "I use a screen reader" (OD-AF3 (d)).
 * - `focusPrompt()` moves screen-reader focus to the header node, only with the reader path on.
 */
export interface AnswerAnnouncement {
  line: AnnouncerLine;
  announce: (result: AnswerResult) => Promise<void>;
  clear: () => void;
  readerOn: boolean;
  promptRef: (node: unknown) => void;
  focusPrompt: () => void;
}

/** A promise that never settles: what a line started before the screen closed resolves to, so nothing runs after. */
const never = (): Promise<void> => new Promise<void>(() => undefined);

export function useAnswerAnnouncement(): AnswerAnnouncement {
  const a11y = useMessages().a11y;
  const webFlag = useLocaleStore((s) => s.screenReader);
  const nativeReader = useNativeScreenReader();
  const [line, setLine] = useState<AnnouncerLine>(EMPTY_ANNOUNCER_LINE);
  const readerOn = readerPath({ platform: Platform.OS, nativeReader, webFlag }) === 'reader';

  // Read when a result comes, so `announce` keeps one identity for the screen's whole life.
  const latest = useRef({ a11y, readerOn });
  latest.current = { a11y, readerOn };
  const prompt = useRef<unknown>(null);
  const mounted = useRef(true);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => {
    mounted.current = true;
    const pending = timers.current;
    return () => {
      mounted.current = false;
      for (const t of pending) clearTimeout(t);
      pending.clear();
    };
  }, []);

  const announce = useCallback((result: AnswerResult): Promise<void> => {
    const segments = answerAnnouncement(result, latest.current.a11y);
    const text = segmentsText(segments);
    setLine((prev) => ({ segments, key: prev.key + 1 }));
    if (!latest.current.readerOn) {
      announceQueued(text);
      return Promise.resolve();
    }
    if (Platform.OS === 'ios') return announceAndWait(text, 0, { queue: true }).then(() => (mounted.current ? undefined : never()));
    return new Promise<void>((resolve) => {
      const t = setTimeout(() => {
        timers.current.delete(t);
        resolve();
      }, announceWaitMs(text));
      timers.current.add(t);
    });
  }, []);

  const clear = useCallback((): void => {
    setLine((prev) => (prev.segments.length === 0 ? prev : { segments: [], key: prev.key + 1 }));
  }, []);

  const promptRef = useCallback((node: unknown): void => {
    prompt.current = node;
  }, []);

  const focusPrompt = useCallback((): void => {
    if (!latest.current.readerOn || prompt.current === null) return;
    focusForScreenReader(prompt.current as object);
  }, []);

  return { line, announce, clear, readerOn, promptRef, focusPrompt };
}
