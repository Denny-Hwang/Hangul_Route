import type { UiLocale } from '@hangul-route/i18n';
import { Body, Screen } from '@hangul-route/design-system';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { lessonContent } from '../content/lessons';
import { useMessages } from '../i18n/use-messages';
import { isNewBuildError, type LessonStore } from '../logic/lessons/lesson-store';
import { reloadForNewBuild } from '../platform/new-build-reload';
import { activeLocale, useLocaleStore } from '../store/locale-store';
import { OopsScreen } from './system/OopsScreen';

/**
 * The screens' side of the on-demand lesson chunks (F-CURR-002 §10, row CM-5;
 * `logic/lessons/lesson-store.ts`). A lesson quest's steps and games come from its cell's
 * chunk, so the screens that play or summarise lesson quests wait for it:
 * - `useLessonQuestReady`: the quest player and the game screen draw only their header
 *   (`LessonWaiting`, the way back) until the quest's chunk is in (the service worker answers from
 *   its precache, so this is a frame or two). A chunk that cannot load goes to the app's crash
 *   screen, whose Try again loads it again; a chunk of a newer build reloads the page once instead;
 * - `useLessonContentVersion`: the screens that count over every quest (the skills of My Route and
 *   the grown-up reports) load every chunk and recompute as each arrives (a count only fills);
 * - `withLessonContent`: the grown-up roots (All lessons, the presenter), which read the whole
 *   catalogue, mount once every chunk is in, with the crash screen's Try again if one fails.
 * `lessonContentBindings` takes the store and the page's reload, so the render tests drive them
 * with a store of their own (the global test setup preloads the app's).
 */

export interface LessonContentDeps {
  store: LessonStore;
  /** The device's UI locale now (the grown-up roots load its titles with the chunks). */
  locale: () => UiLocale;
  /** Reloads the page for a newer build (online, at most once a minute); false when it did not. */
  reloadForNewBuild: () => boolean;
}

/** Shown after this long without the chunk, so a load from the precache never flashes a line. */
export const LESSON_WAITING_LINE_MS = 500;

/** The screen while its lesson chunk loads: the header (the way back), then a calm status line. */
export function LessonWaiting(): React.ReactElement {
  const m = useMessages();
  const [late, setLate] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setLate(true), LESSON_WAITING_LINE_MS);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Screen>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} accessibilityLiveRegion="polite" testID="lesson-waiting">
        {late ? (
          <Body tone="secondary" align="center">
            {m.learner.presenter.state.loading}
          </Body>
        ) : null}
      </View>
    </Screen>
  );
}

export function lessonContentBindings({ store, locale, reloadForNewBuild: reload }: LessonContentDeps) {
  const subscribe = store.subscribe;

  /** True once the quest's chunk is in (at once for a quest that is not a lesson quest); throws a failed load. */
  function useLessonQuestReady(questId: string): boolean {
    const ready = useSyncExternalStore(subscribe, () => store.isQuestReady(questId));
    // Keyed by the quest, so a host that reuses the screen for another quest never shows the old one's failure.
    const [failed, setFailed] = useState<{ questId: string; error: unknown } | null>(null);
    useEffect(() => {
      if (ready) return undefined;
      let live = true;
      const cell = store.cellOfQuest(questId);
      if (cell !== undefined) {
        store.ensureCells([cell]).catch((error: unknown) => {
          if (!live) return;
          if (isNewBuildError(error) && reload()) return;
          setFailed({ questId, error });
        });
      }
      return () => {
        live = false;
      };
    }, [questId, ready]);
    if (!ready && failed !== null && failed.questId === questId) throw failed.error;
    return ready;
  }

  /** Loads every lesson chunk; the number changes as each arrives, for the memos that count over every quest. */
  function useLessonContentVersion(): number {
    const version = useSyncExternalStore(subscribe, store.version);
    useEffect(() => {
      // A chunk that cannot load leaves its quests out of the counts; the next screen visit tries again.
      store.ensureAll().catch(() => undefined);
    }, []);
    return version;
  }

  /** Mounts `Root` once every lesson chunk and the device locale's titles are in; the crash screen if a chunk fails. */
  function withLessonContent<P extends object>(Root: React.ComponentType<P>): React.ComponentType<P> {
    function LessonContentRoot(props: P): React.ReactElement {
      const [state, setState] = useState<'loading' | 'ready' | 'failed'>(() => (store.isAllReady() ? 'ready' : 'loading'));
      useEffect(() => {
        if (state !== 'loading') return undefined;
        let live = true;
        // Titles that fail keep their English; a body chunk that fails would leave its quests empty.
        void Promise.allSettled([store.ensureAll(), store.ensureTitles(locale())]).then(([cells]) => {
          if (!live) return;
          if (cells.status === 'fulfilled') setState('ready');
          else if (!(isNewBuildError(cells.reason) && reload())) setState('failed');
        });
        return () => {
          live = false;
        };
      }, [state]);
      if (state === 'ready') return <Root {...props} />;
      if (state === 'failed') return <OopsScreen onRetry={() => setState('loading')} />;
      return <LessonWaiting />;
    }
    LessonContentRoot.displayName = `WithLessonContent(${Root.displayName ?? Root.name ?? 'Root'})`;
    return LessonContentRoot;
  }

  return { useLessonQuestReady, useLessonContentVersion, withLessonContent };
}

export const { useLessonQuestReady, useLessonContentVersion, withLessonContent } = lessonContentBindings({
  store: lessonContent,
  locale: () => activeLocale(useLocaleStore.getState()),
  reloadForNewBuild: () => reloadForNewBuild(),
});
