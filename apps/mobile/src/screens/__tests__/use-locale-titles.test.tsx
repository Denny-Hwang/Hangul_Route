import type { OverlayLocale } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import React from 'react';
import { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { LessonTitleChunk } from '../../logic/lessons/lesson-store';
import { render } from '../../test-support/render';

/**
 * `useLocale` holds the locale the screens last drew in until a newly chosen locale's lesson titles
 * are in (F-CURR-002 §10, row CM-5), so a whole screen changes language at once. The app's store is
 * preloaded by the global test setup, so this test swaps in a store whose title loads wait for it.
 */
const titles = vi.hoisted(() => {
  const pending: Partial<Record<string, { resolve: (m: unknown) => void; reject: (e: unknown) => void }>> = {};
  const asked: string[] = [];
  return { pending, asked };
});

vi.mock('../../content/lessons', async () => {
  const { createLessonStore } = await import('../../logic/lessons/lesson-store');
  const lessonContent = createLessonStore(
    { episodes: [], cells: {}, titles: { es: 'h-es', ko: 'h-ko' } },
    {
      cell: () => undefined,
      titles: (locale: OverlayLocale) => {
        titles.asked.push(locale);
        return new Promise<LessonTitleChunk>((resolve, reject) => {
          titles.pending[locale] = { resolve: resolve as (m: unknown) => void, reject };
        });
      },
    },
  );
  return { lessonContent, lessonEpisodes: [], lessonQuests: [], lessonQuestTeaches: () => undefined };
});

const { useLocale } = await import('../../i18n/use-messages');
const { useLocaleStore } = await import('../../store/locale-store');

describe('useLocale and the lesson title chunks', () => {
  it('keeps English while the Spanish titles load, then switches; a failed Korean load switches with English titles', async () => {
    const shown: UiLocale[] = [];
    function Probe(): null {
      shown.push(useLocale());
      return null;
    }
    await act(async () => useLocaleStore.setState({ device: 'en', detected: 'en' }));
    await render(<Probe />);
    expect(shown.at(-1)).toBe('en');
    expect(titles.asked).toEqual([]);

    await act(async () => useLocaleStore.setState({ device: 'es' }));
    expect(titles.asked).toEqual(['es']);
    expect(shown.at(-1)).toBe('en');
    await act(async () => titles.pending.es?.resolve({ CHUNK_HASH: 'h-es', LESSON_TITLE_OVERLAYS: {} }));
    expect(shown.at(-1)).toBe('es');

    await act(async () => useLocaleStore.setState({ device: 'ko' }));
    expect(shown.at(-1)).toBe('es');
    await act(async () => titles.pending.ko?.reject(new Error('offline')));
    expect(shown.at(-1)).toBe('ko');

    // Back to a locale whose titles are in: at once, no new load.
    await act(async () => useLocaleStore.setState({ device: 'es' }));
    expect(shown.at(-1)).toBe('es');
    expect(titles.asked).toEqual(['es', 'ko']);
  });
});
