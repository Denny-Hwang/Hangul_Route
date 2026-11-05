import type { UiLocale } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { touchTarget } from '@hangul-route/design-system';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLocaleStore } from '../../../store/locale-store';
import { cleanup, hostNodes, press, render, resetPlatform, screenTexts } from '../../../test-support/render';
import { CardsChip } from '../CardsChip';

/**
 * Home's blue Cards chip is a way into the Library (owner request OW-2): the chip keeps its pill look, becomes one
 * button at least 64 px each way (AMENDMENTS-TOUCH), and is named by its count plus where it goes, from words the
 * dictionary already holds in all three languages ("See my cards").
 */

afterEach(async () => {
  await cleanup();
  resetPlatform();
  vi.unstubAllEnvs();
  useLocaleStore.setState({ device: 'en', byProfile: {} });
});

function useUiLocale(locale: UiLocale): void {
  // es and ko are hidden until they ship (LOCALE_STATUS); the QA switch shows them.
  vi.stubEnv('EXPO_PUBLIC_SHOW_ALL_LOCALES', '1');
  useLocaleStore.setState({ device: locale, byProfile: {} });
}

const buttons = (root: Parameters<typeof hostNodes>[0]) => hostNodes(root, (n) => n.props.role === 'button');

describe('CardsChip', () => {
  it.each<UiLocale>(['en', 'es', 'ko'])('%s: one button named by the count and the way in; the visible pill is the dictionary count', async (locale) => {
    useUiLocale(locale);
    const m = getMessages(locale).learner.home;
    const r = await render(<CardsChip cards={3} onOpen={() => undefined} />);
    const [button, ...rest] = buttons(r.root);
    expect(rest).toHaveLength(0);
    expect(button?.props['aria-label']).toBe(`${m.cards.pill(3)}. ${m.catchUp.cta}`);
    // The name contains the words on the chip (label in name).
    expect(screenTexts(r.root)).toContain(m.cards.pill(3));
  });

  it('a tap opens the cards once', async () => {
    const onOpen = vi.fn();
    const r = await render(<CardsChip cards={1} onOpen={onOpen} />);
    await press(buttons(r.root)[0]!);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('a learner with no card yet still has the way in (the Library says how cards are earned)', async () => {
    const onOpen = vi.fn();
    const r = await render(<CardsChip cards={0} onOpen={onOpen} />);
    await press(buttons(r.root)[0]!);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('is at least 64 px each way (touchTarget.min) and never wider than its row', async () => {
    const r = await render(<CardsChip cards={12} onOpen={() => undefined} />);
    const style = buttons(r.root)[0]!.props.style as Record<string, unknown>;
    expect(style.minHeight).toBe(`${touchTarget.min}px`);
    expect(style.minWidth).toBe(`${touchTarget.min}px`);
    expect(style.maxWidth).toBe('100%');
  });
});
