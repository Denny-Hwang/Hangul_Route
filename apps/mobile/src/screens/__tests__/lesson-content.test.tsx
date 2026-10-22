import type { OverlayLocale, QuestStep } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React, { useState } from 'react';
import { Text } from 'react-native';
import { ErrorBoundary } from 'react-error-boundary';
import { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { createLessonStore, LessonChunkMismatch, type LessonCellChunk, type LessonManifest, type LessonTitleChunk } from '../../logic/lessons/lesson-store';
import { buttonsNamed, byTestId, press, render, screenTexts } from '../../test-support/render';
import { LESSON_WAITING_LINE_MS, lessonContentBindings } from '../lesson-content';
import { OopsScreen } from '../system/OopsScreen';

/**
 * The screens' side of the on-demand lesson chunks (F-CURR-002 §10, row CM-5) from a cold store. The
 * global test setup preloads the app's own store, so these drive `lessonContentBindings` with a
 * store of their own whose loaders resolve or reject only when a test says so.
 */
const messages = getMessages('en');
const LOADING = messages.learner.presenter.state.loading;
const TRY_AGAIN = messages.common.buttons.tryAgain;
const steps: QuestStep[] = [{ id: 's1', kind: 'intro', titleEn: 'Hello', durationSeconds: 8 }];
const manifest: LessonManifest = {
  episodes: [
    { id: 'episode:stage2-rites', questIds: ['quest:stage2-rites-q1'] },
    { id: 'episode:stage3-life', questIds: ['quest:stage3-life-q1'] },
  ],
  cells: { 'episode:stage2-rites': 'h-rites', 'episode:stage3-life': 'h-life' },
  titles: { es: 'h-es', ko: 'h-ko' },
};
const chunkOf = (id: string): LessonCellChunk => ({
  CHUNK_HASH: id === 'episode:stage2-rites' ? 'h-rites' : 'h-life',
  LESSON_STEPS: Object.fromEntries((manifest.episodes.find((e) => e.id === id)?.questIds ?? []).map((q) => [q, steps])),
  LESSON_SCOPES: {},
  LESSON_OVERLAYS: { es: {}, ko: {} },
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** A store whose every load waits for the test: `pending[id]` holds the latest request of each chunk. */
function coldStore() {
  const pending: Record<string, Deferred<LessonCellChunk>> = {};
  const titles: Partial<Record<OverlayLocale, Deferred<LessonTitleChunk>>> = {};
  const asked: string[] = [];
  const store = createLessonStore(manifest, {
    cell: (id) => {
      asked.push(id);
      pending[id] = deferred<LessonCellChunk>();
      return pending[id].promise;
    },
    titles: (locale) => {
      asked.push(`titles-${locale}`);
      titles[locale] = deferred<LessonTitleChunk>();
      return titles[locale].promise;
    },
  });
  return { store, pending, titles, asked };
}

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

function bindings(
  over: { reload?: () => boolean; answer?: (error: unknown) => Promise<boolean>; locales?: { ensureAll: () => Promise<void> }; rootTimeoutMs?: number } = {},
) {
  const cold = coldStore();
  const reload = vi.fn(over.reload ?? (() => false));
  const answer = vi.fn(over.answer ?? (async () => false));
  const abandon = vi.fn();
  const b = lessonContentBindings({
    store: cold.store,
    locale: () => 'en',
    reloadForNewBuild: reload,
    isNewBuildAnswer: answer,
    abandon,
    ...(over.locales === undefined ? {} : { locales: over.locales }),
    ...(over.rootTimeoutMs === undefined ? {} : { rootTimeoutMs: over.rootTimeoutMs }),
  });
  return { ...cold, ...b, reload, answer, abandon };
}

/** Every lesson chunk of the cold store, in. */
async function loadCells(t: ReturnType<typeof bindings>): Promise<void> {
  const loading = t.store.ensureAll();
  for (const id of Object.keys(manifest.cells)) t.pending[id]?.resolve(chunkOf(id));
  await loading;
}

/** What Metro's web loader rejects with when a chunk's script tag fires `error` (a network failure, or HTML refused under nosniff). */
const scriptError = (): Error => Object.assign(new Error('Loading module /_expo/static/js/web/lessons-cell-stage2-rites-0.js failed.'), { name: 'AsyncRequireError' });

describe('useLessonQuestReady (the quest player and the game screen)', () => {
  function Player({ hook, questId }: { hook: (id: string) => boolean; questId: string }): React.ReactElement {
    return hook(questId) ? <Text testID="body">{`steps of ${questId}`}</Text> : <Text testID="waiting">waiting</Text>;
  }

  it('draws only the waiting state until the quest’s chunk is in, then the body; other quests load nothing', async () => {
    const t = bindings();
    const r = await render(<Player hook={t.useLessonQuestReady} questId="quest:stage2-rites-q1" />);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
    expect(t.asked).toEqual(['episode:stage2-rites']);
    await act(async () => t.pending['episode:stage2-rites']?.resolve(chunkOf('episode:stage2-rites')));
    expect(byTestId(r.root, 'body')).toHaveLength(1);
    expect(t.asked).toEqual(['episode:stage2-rites']);
  });

  it('a failed load reaches the crash screen, and Try again loads the chunk again', async () => {
    const t = bindings();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await render(
      <ErrorBoundary fallbackRender={({ resetErrorBoundary }) => <OopsScreen onRetry={resetErrorBoundary} />}>
        <Player hook={t.useLessonQuestReady} questId="quest:stage2-rites-q1" />
      </ErrorBoundary>,
    );
    await act(async () => t.pending['episode:stage2-rites']?.reject(new Error('offline')));
    await settle();
    const retry = buttonsNamed(r.root, TRY_AGAIN);
    expect(retry).toHaveLength(1);
    // The URL was asked again and did not answer for a newer build: a network failure, no reload.
    expect(t.answer).toHaveBeenCalledTimes(1);
    expect(t.reload).not.toHaveBeenCalled();
    await press(retry[0]!);
    expect(t.asked).toEqual(['episode:stage2-rites', 'episode:stage2-rites']);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
    await act(async () => t.pending['episode:stage2-rites']?.resolve(chunkOf('episode:stage2-rites')));
    expect(byTestId(r.root, 'body')).toHaveLength(1);
    errors.mockRestore();
  });

  it('a chunk of a newer build reloads the page instead of throwing', async () => {
    const t = bindings({ reload: () => true });
    const r = await render(<Player hook={t.useLessonQuestReady} questId="quest:stage2-rites-q1" />);
    await act(async () => t.pending['episode:stage2-rites']?.reject(new Error('Requiring unknown module "812".')));
    await settle();
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
  });

  it('a script error whose URL now answers for a newer build (HTML refused under nosniff, a 404) reloads the page', async () => {
    const t = bindings({ reload: () => true, answer: async () => true });
    const r = await render(<Player hook={t.useLessonQuestReady} questId="quest:stage2-rites-q1" />);
    const error = scriptError();
    await act(async () => t.pending['episode:stage2-rites']?.reject(error));
    await settle();
    expect(t.answer).toHaveBeenCalledWith(error);
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
  });

  it('a chunk that says it is of a newer build reloads without asking its URL again', async () => {
    const t = bindings({ reload: () => true });
    await render(<Player hook={t.useLessonQuestReady} questId="quest:stage2-rites-q1" />);
    await act(async () => t.pending['episode:stage2-rites']?.reject(new Error('Requiring unknown module "812".')));
    await settle();
    expect(t.answer).not.toHaveBeenCalled();
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('a newer-build chunk throws when the reload was refused (offline, or reloaded a moment ago)', async () => {
    const t = bindings({ reload: () => false });
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await render(
      <ErrorBoundary fallbackRender={() => <Text testID="crash">crash</Text>}>
        <Player hook={t.useLessonQuestReady} questId="quest:stage2-rites-q1" />
      </ErrorBoundary>,
    );
    await act(async () => t.pending['episode:stage2-rites']?.resolve({ ...chunkOf('episode:stage2-rites'), CHUNK_HASH: 'other-build' }));
    await settle();
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'crash')).toHaveLength(1);
    errors.mockRestore();
  });

  it('a host that reuses the screen for another quest never shows the old quest’s failure', async () => {
    const t = bindings();
    let show: (id: string) => void = () => undefined;
    function Host(): React.ReactElement {
      const [questId, setQuestId] = useState('quest:stage2-rites-q1');
      show = setQuestId;
      return (
        <ErrorBoundary fallbackRender={() => <Text testID="crash">crash</Text>}>
          <Player hook={t.useLessonQuestReady} questId={questId} />
        </ErrorBoundary>
      );
    }
    const r = await render(<Host />);
    // The first quest's load fails only after the host has moved on to the second quest.
    await act(async () => show('quest:stage3-life-q1'));
    await act(async () => t.pending['episode:stage2-rites']?.reject(new Error('offline')));
    await settle();
    expect(byTestId(r.root, 'crash')).toHaveLength(0);
    expect(byTestId(r.root, 'waiting')).toHaveLength(1);
    await act(async () => t.pending['episode:stage3-life']?.resolve(chunkOf('episode:stage3-life')));
    expect(byTestId(r.root, 'body')).toHaveLength(1);
  });
});

describe('LessonWaiting', () => {
  it('shows the calm status line only after a moment, in a polite live region', async () => {
    const { LessonWaiting } = await import('../lesson-content');
    vi.useFakeTimers();
    try {
      const r = await render(<LessonWaiting />);
      const region = byTestId(r.root, 'lesson-waiting')[0];
      expect(region?.props['aria-live']).toBe('polite');
      expect(screenTexts(r.root)).not.toContain(LOADING);
      await act(async () => {
        vi.advanceTimersByTime(LESSON_WAITING_LINE_MS);
      });
      expect(screenTexts(r.root)).toContain(LOADING);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('withLessonContent (All lessons and the presenter)', () => {
  function Root(): React.ReactElement {
    return <Text testID="root">root</Text>;
  }

  it('waits for every chunk, then mounts the root', async () => {
    const t = bindings();
    const Wrapped = t.withLessonContent(Root);
    const r = await render(<Wrapped />);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(1);
    expect(t.asked.sort()).toEqual(['episode:stage2-rites', 'episode:stage3-life']);
    await act(async () => t.pending['episode:stage2-rites']?.resolve(chunkOf('episode:stage2-rites')));
    expect(byTestId(r.root, 'root')).toHaveLength(0);
    await act(async () => t.pending['episode:stage3-life']?.resolve(chunkOf('episode:stage3-life')));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(1);
    expect(Wrapped.displayName).toBe('WithLessonContent(Root)');
  });

  it('a chunk that fails shows the crash screen, never a root with empty lessons; Try again loads it', async () => {
    const t = bindings();
    const Wrapped = t.withLessonContent(Root);
    const r = await render(<Wrapped />);
    await act(async () => t.pending['episode:stage2-rites']?.resolve(chunkOf('episode:stage2-rites')));
    await act(async () => t.pending['episode:stage3-life']?.reject(new Error('offline')));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(0);
    const retry = buttonsNamed(r.root, TRY_AGAIN);
    expect(retry).toHaveLength(1);
    await press(retry[0]!);
    expect(t.asked.filter((id) => id === 'episode:stage3-life')).toHaveLength(2);
    expect(t.asked.filter((id) => id === 'episode:stage2-rites')).toHaveLength(1);
    await act(async () => t.pending['episode:stage3-life']?.resolve(chunkOf('episode:stage3-life')));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(1);
  });

  it('a chunk of a newer build reloads the page', async () => {
    const t = bindings({ reload: () => true });
    const Wrapped = t.withLessonContent(Root);
    const r = await render(<Wrapped />);
    await act(async () => t.pending['episode:stage2-rites']?.reject(new LessonChunkMismatch('episode:stage2-rites', 'h-rites', 'x')));
    await settle();
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(1);
  });

  it('a script error whose URL now answers for a newer build reloads the page', async () => {
    const t = bindings({ reload: () => true, answer: async () => true });
    const Wrapped = t.withLessonContent(Root);
    const r = await render(<Wrapped />);
    await act(async () => t.pending['episode:stage2-rites']?.reject(scriptError()));
    await settle();
    expect(t.answer).toHaveBeenCalledTimes(1);
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(1);
  });

  it('mounts at once when every chunk is already in', async () => {
    const t = bindings();
    const loading = t.store.ensureAll();
    for (const id of Object.keys(manifest.cells)) t.pending[id]?.resolve(chunkOf(id));
    await loading;
    const Wrapped = t.withLessonContent(Root);
    const r = await render(<Wrapped />);
    expect(byTestId(r.root, 'root')).toHaveLength(1);
  });
});

describe('withLessonContent with a lazy root (the presenter and All lessons are chunks of their own)', () => {
  function Root(): React.ReactElement {
    return <Text testID="root">root</Text>;
  }
  /** A root whose code arrives when the test says. */
  function lazyRoot(name = 'PresenterApp') {
    const loads: Deferred<{ default: React.ComponentType<object> }>[] = [];
    return {
      loads,
      root: {
        name,
        load: () => {
          const d = deferred<{ default: React.ComponentType<object> }>();
          loads.push(d);
          return d.promise;
        },
      },
    };
  }

  it('waits for the content and the root\'s own code, then mounts it; a second mount needs no load', async () => {
    const t = bindings();
    await loadCells(t);
    const lazy = lazyRoot();
    const Wrapped = t.withLessonContent(lazy.root);
    expect(Wrapped.displayName).toBe('WithLessonContent(PresenterApp)');
    const r = await render(<Wrapped />);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(1);
    expect(lazy.loads).toHaveLength(1);
    await act(async () => lazy.loads[0]?.resolve({ default: Root }));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(1);
    const again = await render(<Wrapped />);
    expect(byTestId(again.root, 'root')).toHaveLength(1);
    expect(lazy.loads).toHaveLength(1);
  });

  it('waits for the locale chunks too, and a failed one does not stop the root', async () => {
    let finish!: () => void;
    const t = bindings({ locales: { ensureAll: () => new Promise<void>((_, reject) => (finish = () => reject(new Error('offline')))) } });
    await loadCells(t);
    const lazy = lazyRoot();
    const r = await render(<>{React.createElement(t.withLessonContent(lazy.root))}</>);
    await act(async () => lazy.loads[0]?.resolve({ default: Root }));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(0);
    await act(async () => finish());
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(1);
  });

  it('root code that fails shows the crash screen; Try again asks for it again and mounts it', async () => {
    const t = bindings();
    await loadCells(t);
    const lazy = lazyRoot('BrowseApp');
    const r = await render(<>{React.createElement(t.withLessonContent(lazy.root))}</>);
    await act(async () => lazy.loads[0]?.reject(new Error('offline')));
    await settle();
    expect(t.reload).not.toHaveBeenCalled();
    const retry = buttonsNamed(r.root, TRY_AGAIN);
    expect(retry).toHaveLength(1);
    await press(retry[0]!);
    expect(lazy.loads).toHaveLength(2);
    await act(async () => lazy.loads[1]?.resolve({ default: Root }));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(1);
  });

  it('root code of a newer build reloads the page', async () => {
    const t = bindings({ reload: () => true, answer: async () => true });
    await loadCells(t);
    const lazy = lazyRoot();
    const r = await render(<>{React.createElement(t.withLessonContent(lazy.root))}</>);
    await act(async () => lazy.loads[0]?.reject(scriptError()));
    await settle();
    expect(t.answer).toHaveBeenCalledTimes(1);
    expect(t.reload).toHaveBeenCalledTimes(1);
    expect(byTestId(r.root, 'lesson-waiting')).toHaveLength(1);
  });

  it('root code that hangs past its timeout gives up its pending script and shows the crash screen', async () => {
    const t = bindings({ rootTimeoutMs: 20 });
    await loadCells(t);
    const lazy = lazyRoot('PresenterApp');
    const r = await render(<>{React.createElement(t.withLessonContent(lazy.root))}</>);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    await settle();
    expect(t.abandon).toHaveBeenCalledWith('PresenterApp');
    expect(buttonsNamed(r.root, TRY_AGAIN)).toHaveLength(1);
    // A late answer of the given-up load changes nothing.
    await act(async () => lazy.loads[0]?.resolve({ default: Root }));
    await settle();
    expect(byTestId(r.root, 'root')).toHaveLength(0);
  });
});

describe('useLessonContentVersion (the screens that count over every quest)', () => {
  it('loads every chunk and changes as each arrives', async () => {
    const t = bindings();
    const seen: number[] = [];
    function Counter(): null {
      seen.push(t.useLessonContentVersion());
      return null;
    }
    await render(<Counter />);
    expect(t.asked.sort()).toEqual(['episode:stage2-rites', 'episode:stage3-life']);
    await act(async () => t.pending['episode:stage2-rites']?.resolve(chunkOf('episode:stage2-rites')));
    await act(async () => t.pending['episode:stage3-life']?.reject(new Error('offline')));
    await settle();
    expect(new Set(seen).size).toBeGreaterThanOrEqual(3);
  });
});
