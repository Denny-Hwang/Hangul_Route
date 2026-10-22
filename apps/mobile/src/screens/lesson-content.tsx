import type { UiLocale } from '@hangul-route/i18n';
import { Body, Screen } from '@hangul-route/design-system';
import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { lessonContent } from '../content/lessons';
import { useMessages } from '../i18n/use-messages';
import { isNewBuildError, type LessonStore } from '../logic/lessons/lesson-store';
import { isStoryNewBuildError, type StoryStore } from '../logic/story/story-chunk-store';
import { storyContent } from '../content/stories';
import { localePacks } from '../content/locale-packs';
import { abandonPendingChunk } from '../platform/lesson-chunk-abandon';
import { isNewBuildAnswer, reloadForNewBuild } from '../platform/new-build-reload';
import { activeLocale, useLocaleStore } from '../store/locale-store';
import { OopsScreen } from './system/OopsScreen';

/**
 * The screens' side of the on-demand lesson chunks (F-CURR-002 §10, row CM-5;
 * `logic/lessons/lesson-store.ts`). A lesson quest's steps and games come from its cell's
 * chunk, so the screens that play or summarise lesson quests wait for it:
 * - `useLessonQuestReady`: the quest player and the game screen draw only their header
 *   (`LessonWaiting`, the way back) until the quest's chunk is in (the service worker answers from
 *   its precache, so this is a frame or two). A chunk that cannot load goes to the app's crash
 *   screen, whose Try again returns to Home, where opening the lesson loads it again; a chunk of a newer
 *   build (what it held, or what its URL answers when asked again) reloads the page once instead;
 * - `useLessonContentVersion`: the screens that count over every quest (the skills of My Route and
 *   the grown-up reports) load every chunk and recompute as each arrives (a count only fills);
 * - `withLessonContent`: the grown-up roots (All lessons, the presenter), which read the whole
 *   catalogue, mount once every chunk is in, the story chunks of row CM-8 and the locale chunks included, with
 *   the crash screen's Try again if one fails; their own code is a chunk too (`LazyRoot`), loaded with them.
 * `lessonContentBindings` takes the store and the page's reload, so the render tests drive them
 * with a store of their own (the global test setup preloads the app's).
 */

export interface LessonContentDeps {
  store: LessonStore;
  /** The device's UI locale now (the grown-up roots load its titles with the chunks). */
  locale: () => UiLocale;
  /** Reloads the page for a newer build (online, at most once a minute); false when it did not. */
  reloadForNewBuild: () => boolean;
  /** Asks a failed chunk's URL again: true when the host answers for a newer build (404, or its HTML page refused as a script). */
  isNewBuildAnswer: (error: unknown) => Promise<boolean>;
  /** The story chunks (row CM-8), which the grown-up roots also read in full; none when omitted (a lesson-only test). */
  stories?: Pick<StoryStore, 'isAllReady' | 'ensureAll'>;
  /**
   * The locale chunks (`content/locale-packs.ts`): the grown-up roots draw in any UI locale (the presenter's
   * slides in the deck's), so they mount with every one in; a failed one keeps that locale's text in English.
   */
  locales?: { ensureAll: () => Promise<void> };
  /** Gives up a hung root chunk's pending script by its bundle name (`platform/lesson-chunk-abandon`); none when omitted. */
  abandon?: (bundleName: string) => void;
  /** A root chunk that has not loaded after this many ms fails (a hung request); 15 s when omitted. */
  rootTimeoutMs?: number;
}

/**
 * A grown-up root that is a chunk of its own (F-CURR-002 §10): the presenter and All lessons are not part of the
 * learner's start bundle, so `index.ts` hands `withLessonContent` their literal `import()` and the wrapper loads
 * the root's code with the content it reads. `name` is the root's web bundle name (`PresenterApp-<md5>.js`).
 */
export interface LazyRoot<P extends object> {
  name: string;
  load: () => Promise<{ default: React.ComponentType<P> }>;
}

/** A root chunk that did not arrive in time (a hung request); Try again asks again. */
export class RootChunkTimeout extends Error {
  constructor(
    readonly bundleName: string,
    readonly ms: number,
  ) {
    super(`the root chunk ${bundleName} did not load within ${ms} ms`);
    this.name = 'RootChunkTimeout';
  }
}

const isLazyRoot = <P extends object>(root: React.ComponentType<P> | LazyRoot<P>): root is LazyRoot<P> =>
  typeof root === 'object' && root !== null && 'load' in root && typeof root.load === 'function';

const NO_STORIES: Pick<StoryStore, 'isAllReady' | 'ensureAll'> = { isAllReady: () => true, ensureAll: () => Promise.resolve() };
const NO_LOCALES = { ensureAll: () => Promise.resolve() };

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

export function lessonContentBindings({
  store,
  locale,
  reloadForNewBuild: reload,
  isNewBuildAnswer: newBuildAnswer,
  stories = NO_STORIES,
  locales = NO_LOCALES,
  abandon,
  rootTimeoutMs = 15_000,
}: LessonContentDeps) {
  const subscribe = store.subscribe;
  /** True when a failed load means a newer build on the host: what the chunk said, else what its URL answers now. */
  const isNewer = async (error: unknown): Promise<boolean> => isNewBuildError(error) || (await newBuildAnswer(error).catch(() => false));

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
        store.ensureCells([cell]).catch(async (error: unknown) => {
          if (!live) return;
          const newer = await isNewer(error);
          if (!live || (newer && reload())) return;
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

  /** Loads a lazy root's code once, within `rootTimeoutMs`; a failed or hung load is forgotten, so Try again asks again. */
  const loadedRoots = new WeakMap<object, React.ComponentType<never>>();
  function loadRoot<P extends object>(root: LazyRoot<P>): Promise<React.ComponentType<P>> {
    const hit = loadedRoots.get(root) as React.ComponentType<P> | undefined;
    if (hit !== undefined) return Promise.resolve(hit);
    return new Promise<React.ComponentType<P>>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new RootChunkTimeout(root.name, rootTimeoutMs));
        abandon?.(root.name);
      }, rootTimeoutMs);
      root.load().then(
        (mod) => {
          clearTimeout(timer);
          loadedRoots.set(root, mod.default as React.ComponentType<never>);
          resolve(mod.default);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  /**
   * Mounts `Root` once every lesson chunk, every story chunk, the device locale's titles and the locale chunks are
   * in, and, for a lazy root (`LazyRoot`), its own code; the crash screen if a lesson, story or root chunk fails.
   */
  function withLessonContent<P extends object>(Root: React.ComponentType<P> | LazyRoot<P>): React.ComponentType<P> {
    const lazy = isLazyRoot(Root) ? Root : null;
    const eager = isLazyRoot(Root) ? null : Root;
    const contentIn = (): boolean => store.isAllReady() && stories.isAllReady();
    function LessonContentRoot(props: P): React.ReactElement {
      const [Loaded, setLoaded] = useState<React.ComponentType<P> | null>(() => eager ?? ((lazy === null ? undefined : loadedRoots.get(lazy)) as React.ComponentType<P> | undefined) ?? null);
      const [state, setState] = useState<'loading' | 'ready' | 'failed'>(() => (contentIn() && Loaded !== null ? 'ready' : 'loading'));
      useEffect(() => {
        if (state !== 'loading') return undefined;
        let live = true;
        // Titles that fail keep their English; a body chunk that fails would leave its quests (or its story's
        // tiers, and so its quests and episode) out of the catalogue; a root whose code fails cannot mount at all.
        const root = lazy === null ? Promise.resolve(eager) : loadRoot(lazy);
        void Promise.allSettled([store.ensureAll(), stories.ensureAll(), store.ensureTitles(locale()), locales.ensureAll(), root]).then(
          async ([cells, storyBodies, , , code]) => {
            if (!live) return;
            const failure = [cells, storyBodies, code].find((r): r is PromiseRejectedResult => r.status === 'rejected');
            if (failure === undefined) {
              if (code.status === 'fulfilled' && code.value !== null) setLoaded(() => code.value);
              setState('ready');
              return;
            }
            const newer = isStoryNewBuildError(failure.reason) || (await isNewer(failure.reason));
            if (live && !(newer && reload())) setState('failed');
          },
        );
        return () => {
          live = false;
        };
      }, [state]);
      if (state === 'ready' && Loaded !== null) return <Loaded {...props} />;
      if (state === 'failed') return <OopsScreen onRetry={() => setState('loading')} />;
      return <LessonWaiting />;
    }
    const name = lazy !== null ? lazy.name : (eager?.displayName ?? eager?.name ?? 'Root');
    LessonContentRoot.displayName = `WithLessonContent(${name || 'Root'})`;
    return LessonContentRoot;
  }

  return { useLessonQuestReady, useLessonContentVersion, withLessonContent };
}

export const { useLessonQuestReady, useLessonContentVersion, withLessonContent } = lessonContentBindings({
  store: lessonContent,
  locale: () => activeLocale(useLocaleStore.getState()),
  reloadForNewBuild: () => reloadForNewBuild(),
  isNewBuildAnswer: (error) => isNewBuildAnswer(error),
  stories: storyContent,
  locales: localePacks,
  abandon: (bundleName) => {
    abandonPendingChunk(bundleName);
  },
});
