import type { UiLocale } from '@hangul-route/i18n';
import React, { useMemo } from 'react';
import { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { LocalePackChunk } from '../../logic/locale/locale-pack-store';
import { render } from '../../test-support/render';

/**
 * The learner PWA loads each locale's UI messages and content text as a chunk of its own (F-CURR-002 §10,
 * `content/locale-packs.ts`). Every vitest project binds the native loader (none: every locale is in), so
 * this test swaps in a store whose chunks arrive or fail when the test says, as on the web, and checks the
 * gate `useLocale` puts on a newly chosen locale and the re-render `useLocalePacks` gives a screen that
 * draws another locale's text.
 */
type Pending = { locale: string; arrive: () => void; fail: (error: Error) => void };
const chunks = vi.hoisted(() => ({ pending: [] as Pending[], installed: [] as string[] }));

vi.mock('../../content/locale-packs', async () => {
  const { createLocalePackStore } = await import('../../logic/locale/locale-pack-store');
  const localePacks = createLocalePackStore(
    (locale) =>
      new Promise<LocalePackChunk>((resolve, reject) => {
        chunks.pending.push({
          locale,
          arrive: () => resolve({ LOCALE_PACK: `locale-pack:${locale}`, LOCALE_MESSAGES: {}, LOCALE_CONTENT: {} }),
          fail: reject,
        });
      }),
    {
      install: (locale) => {
        chunks.installed.push(locale);
      },
    },
  );
  return { localePacks };
});

const { useLocale, useLocalePacks } = await import('../../i18n/use-messages');
const { localePacks } = await import('../../content/locale-packs');
const { useLocaleStore } = await import('../../store/locale-store');

/** Settles the oldest pending load of this locale. */
async function settle(locale: string, how: 'arrive' | 'fail'): Promise<void> {
  const index = chunks.pending.findIndex((p) => p.locale === locale);
  expect(index).toBeGreaterThanOrEqual(0);
  const [load] = chunks.pending.splice(index, 1) as [Pending];
  await act(async () => {
    if (how === 'arrive') load.arrive();
    else load.fail(new Error('offline'));
    await Promise.resolve();
  });
}

describe('useLocale and useLocalePacks with locale chunks that load late (F-CURR-002 §10)', () => {
  it('keeps the screens in the locale they drew in until the chosen locale\'s chunk is in, through a failed load and its retry', async () => {
    const shown: UiLocale[] = [];
    function Probe(): null {
      shown.push(useLocale());
      return null;
    }
    await act(async () => useLocaleStore.setState({ device: 'en', detected: 'en' }));
    await render(<Probe />);
    expect(shown.at(-1)).toBe('en');

    // Korean chosen: its chunk is asked for, and the screens stay English while it loads.
    await act(async () => useLocaleStore.setState({ device: 'ko' }));
    expect(chunks.pending.map((p) => p.locale)).toEqual(['ko']);
    expect(shown.at(-1)).toBe('en');

    // A failed load keeps them English: never a Korean screen without its Korean menus.
    await settle('ko', 'fail');
    expect(localePacks.settled('ko')).toBe(true);
    expect(localePacks.isLoaded('ko')).toBe(false);
    expect(shown.at(-1)).toBe('en');

    // The retry (back online: App.tsx asks again) brings the chunk in, and the screens switch to Korean.
    await act(async () => {
      localePacks.ensure('ko').catch(() => undefined);
      await Promise.resolve();
    });
    await settle('ko', 'arrive');
    expect(chunks.installed).toEqual(['ko']);
    expect(shown.at(-1)).toBe('ko');

    // Back to English: no chunk to wait for.
    await act(async () => useLocaleStore.setState({ device: 'en' }));
    expect(shown.at(-1)).toBe('en');
    expect(chunks.pending).toEqual([]);
  });

  it('asks for every listed locale\'s chunk and recomputes a memo of its text when it arrives', async () => {
    const computed: number[] = [];
    function Tiles(): null {
      const packs = useLocalePacks(['es', 'ko']);
      useMemo(() => computed.push(packs), [packs]);
      return null;
    }
    await render(<Tiles />);
    // Korean is in from the first test; Spanish is asked for once.
    expect(chunks.pending.map((p) => p.locale)).toEqual(['es']);
    const before = computed.length;
    await settle('es', 'arrive');
    expect(chunks.installed).toEqual(['ko', 'es']);
    expect(computed.length).toBe(before + 1);
    expect(chunks.pending).toEqual([]);
  });
});
