import type { Episode, UiLocale } from '@hangul-route/content-schema';
import { useMemo } from 'react';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LessonHeaderChunk } from '../../logic/lessons/lesson-store';
import { render } from '../../test-support/render';

/**
 * The English headers chunk (F-CURR-002 row CM-40) holds a lesson episode's display lines and reward cards. When it
 * hangs past the grace, the first screen shows without them; an English episode is then the same object before and
 * after the chunk lands, so a memo over its reward cards must key on `useLessonTitlesVersion` to draw them without a
 * remount (the Episode page's cards, the Results teaser and the free-lesson cards do). The app's store is preloaded by
 * the global test setup, so this test swaps in one of its own.
 */
const headers = vi.hoisted(() => ({ arrive: (_mod: LessonHeaderChunk) => undefined as void }));

vi.mock('../../content/lessons', async () => {
  const { createLessonStore, episodesOverStore } = await import('../../logic/lessons/lesson-store');
  const lessonContent = createLessonStore(
    { episodes: [{ id: 'episode:stage2-life', questIds: [] }], cells: {}, titles: { es: 'h-es', ko: 'h-ko' }, headers: { en: 'h-en', es: 'he-es', ko: 'he-ko' } },
    {
      cell: () => undefined,
      titles: () => new Promise(() => undefined),
      headers: (locale) =>
        locale === 'en'
          ? new Promise<LessonHeaderChunk>((resolve) => {
              headers.arrive = resolve;
            })
          : new Promise(() => undefined),
    },
    { timeoutMs: 15_000, titlesGraceMs: 2_500 },
  );
  const manifest = [{ id: 'episode:stage2-life', titleEn: 'Life', questIds: [] }] as unknown as Parameters<typeof episodesOverStore>[0];
  const lessonEpisodes = episodesOverStore(manifest, lessonContent);
  return { lessonContent, lessonEpisodes, lessonQuests: [], lessonQuestTeaches: () => undefined, TITLES_GRACE_MS: 2_500 };
});

const { useLessonTitlesVersion, useLocale } = await import('../../i18n/use-messages');
const { lessonEpisodes } = (await import('../../content/lessons')) as unknown as { lessonEpisodes: Episode[] };
const { useLocaleStore } = await import('../../store/locale-store');

afterEach(() => {
  vi.useRealTimers();
});

describe('the English headers chunk after the grace', () => {
  it('shows English at once past the grace, and a memo keyed on the titles version draws the cards when the chunk lands', async () => {
    vi.useFakeTimers();
    const shown: UiLocale[] = [];
    const cards: string[][] = [];
    const episode = lessonEpisodes[0] as Episode;
    function Probe(): null {
      const locale = useLocale();
      const titles = useLessonTitlesVersion();
      // The Episode page's pattern: the same English object on both sides of the chunk, keyed on `titles`.
      const shownCards = useMemo(() => [...episode.rewardCardIds], [titles]);
      cards.push(shownCards);
      shown.push(locale);
      return null;
    }
    await act(async () => useLocaleStore.setState({ device: 'en', detected: 'en' }));
    await render(<Probe />);
    expect(shown.at(-1)).toBe('en');
    expect(cards.at(-1)).toEqual([]);
    expect(episode.hoyaIntroEn).toBe('');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_500);
    });
    expect(shown.at(-1)).toBe('en');
    expect(cards.at(-1)).toEqual([]);

    await act(async () => {
      headers.arrive({
        CHUNK_HASH: 'h-en',
        LESSON_EPISODE_HEADERS: { 'episode:stage2-life': { subtitleEn: 'Every day', hoyaIntroEn: 'Hi!', rewardCardIds: ['card:kimchi'] } },
        LESSON_QUEST_HEADERS: {},
        LESSON_HEADER_OVERLAYS: {},
      });
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(cards.at(-1)).toEqual(['card:kimchi']);
    expect(episode.hoyaIntroEn).toBe('Hi!');
    expect(episode.subtitleEn).toBe('Every day');
  });
});
