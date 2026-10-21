import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { lessonContent } from '../content/lessons';
import { activeLocale, useLocaleStore } from '../store/locale-store';

/**
 * The screens' side of the on-demand lesson chunks (F-CURR-002 §10, row CM-5;
 * `logic/lessons/lesson-store.ts`). A lesson quest's steps and games come from its cell's
 * chunk, so the screens that play or summarise lesson quests wait for it:
 * - `useLessonQuestReady`: the quest player and the game screen draw nothing until the quest's
 *   chunk is in (the service worker answers from its precache, so this is a frame or two), and a
 *   chunk that cannot load goes to the app's crash screen, whose Try again loads it again;
 * - `useLessonContentVersion`: the screens that count over every quest (the skills of My Route and
 *   the grown-up reports) load every chunk and recompute as each arrives (a count only fills);
 * - `withLessonContent`: the grown-up roots (All lessons, the presenter), which read the whole
 *   catalogue, mount once every chunk has settled.
 */

const subscribe = lessonContent.subscribe;

/** True once the quest's chunk is in (at once for a quest that is not a lesson quest); throws a failed load. */
export function useLessonQuestReady(questId: string): boolean {
  const ready = useSyncExternalStore(subscribe, () => lessonContent.isQuestReady(questId));
  const [failed, setFailed] = useState<{ error: unknown } | null>(null);
  useEffect(() => {
    if (ready) return undefined;
    let live = true;
    const cell = lessonContent.cellOfQuest(questId);
    if (cell !== undefined) {
      lessonContent.ensureCells([cell]).catch((error: unknown) => {
        if (live) setFailed({ error });
      });
    }
    return () => {
      live = false;
    };
  }, [questId, ready]);
  if (!ready && failed !== null) throw failed.error;
  return ready;
}

/** Loads every lesson chunk; the number changes as each arrives, for the memos that count over every quest. */
export function useLessonContentVersion(): number {
  const version = useSyncExternalStore(subscribe, lessonContent.version);
  useEffect(() => {
    // A chunk that cannot load leaves its quests out of the counts; the next screen visit tries again.
    lessonContent.ensureAll().catch(() => undefined);
  }, []);
  return version;
}

/** Mounts `Root` once every lesson chunk and the device locale's titles have loaded or failed. */
export function withLessonContent<P extends object>(Root: React.ComponentType<P>): React.ComponentType<P> {
  function LessonContentRoot(props: P): React.ReactElement | null {
    const [settled, setSettled] = useState(() => lessonContent.isAllReady());
    useEffect(() => {
      if (settled) return undefined;
      let live = true;
      void Promise.allSettled([lessonContent.ensureAll(), lessonContent.ensureTitles(activeLocale(useLocaleStore.getState()))]).then(() => {
        if (live) setSettled(true);
      });
      return () => {
        live = false;
      };
    }, [settled]);
    return settled ? <Root {...props} /> : null;
  }
  LessonContentRoot.displayName = `WithLessonContent(${Root.displayName ?? Root.name ?? 'Root'})`;
  return LessonContentRoot;
}
