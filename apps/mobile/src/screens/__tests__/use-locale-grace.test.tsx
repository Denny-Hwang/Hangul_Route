import type { UiLocale } from '@hangul-route/i18n';
import React, { useMemo } from 'react';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LessonTitleChunk } from '../../logic/lessons/lesson-store';
import { render } from '../../test-support/render';

/**
 * A title chunk that hangs (no worker in control on a slow network) holds a newly chosen locale back
 * for `titlesGraceMs` only (F-CURR-002 §10): the screens then show in that locale with the lesson
 * titles in English, and a memo keyed on `useLessonTitlesVersion` draws the titles once they arrive.
 * The app's store is preloaded by the global test setup, so this test swaps in one of its own.
 */
const titles = vi.hoisted(() => ({ arrive: (_mod: LessonTitleChunk) => undefined as void }));

vi.mock('../../content/lessons', async () => {
  const { createLessonStore } = await import('../../logic/lessons/lesson-store');
  const lessonContent = createLessonStore(
    { episodes: [], cells: {}, titles: { es: 'h-es', ko: 'h-ko' } },
    {
      cell: () => undefined,
      titles: () =>
        new Promise<LessonTitleChunk>((resolve) => {
          titles.arrive = resolve;
        }),
    },
    { timeoutMs: 15_000, titlesGraceMs: 2_500 },
  );
  return { lessonContent, lessonEpisodes: [], lessonQuests: [], lessonQuestTeaches: () => undefined, TITLES_GRACE_MS: 2_500 };
});

const { useLessonTitlesVersion, useLocale } = await import('../../i18n/use-messages');
const { useLocaleStore } = await import('../../store/locale-store');

afterEach(() => {
  vi.useRealTimers();
});

describe('useLocale with a title chunk that hangs', () => {
  it('applies the chosen locale after the grace, and a late title chunk recomputes the localized memos', async () => {
    vi.useFakeTimers();
    const shown: UiLocale[] = [];
    const computed: string[] = [];
    function Probe(): null {
      const locale = useLocale();
      const titlesVersion = useLessonTitlesVersion();
      useMemo(() => computed.push(`${locale}:${titlesVersion}`), [locale, titlesVersion]);
      shown.push(locale);
      return null;
    }
    await act(async () => useLocaleStore.setState({ device: 'en', detected: 'en' }));
    await render(<Probe />);
    expect(shown.at(-1)).toBe('en');

    await act(async () => useLocaleStore.setState({ device: 'ko' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_499);
    });
    expect(shown.at(-1)).toBe('en');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(shown.at(-1)).toBe('ko');
    const before = computed.length;

    await act(async () => {
      titles.arrive({ CHUNK_HASH: 'h-ko', LESSON_TITLE_OVERLAYS: {} });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(shown.at(-1)).toBe('ko');
    expect(computed.length).toBe(before + 1);
    expect(computed.at(-1)?.startsWith('ko:')).toBe(true);
  });
});
