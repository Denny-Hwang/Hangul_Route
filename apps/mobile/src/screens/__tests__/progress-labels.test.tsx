import { Progress } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';
import { ProgressLabelsHost } from '../../components/ProgressLabelsHost';
import { useLocaleStore } from '../../store/locale-store';
import { render, unmount } from '../../test-support/render';

/**
 * AMENDMENTS-AUDIT-2026-11 AU-17d (audit A11Y-3: axe reported `role="progressbar"` with no accessible name on the quest
 * player). Under the app's `ProgressLabelsHost` every design-system `Progress` (a quest's step dots, a game's round
 * bar) renders on the web as a named progressbar with its numbers and its value in words, in the UI language.
 */
const LOCALES: readonly UiLocale[] = ['en', 'es', 'ko'];

const bars = (renderer: ReactTestRenderer) => renderer.root.findAll((node) => typeof node.type === 'string' && node.props.role === 'progressbar');

afterEach(() => {
  useLocaleStore.setState({ device: 'en', byProfile: {} });
});

describe('ProgressLabelsHost (every progress bar has a name)', () => {
  it.each(LOCALES)('%s: the step dots and the round bar are named and read in the UI language', async (locale) => {
    useLocaleStore.setState({ device: locale, byProfile: {} });
    const said = getMessages(locale).a11y.progress;
    const renderer = await render(
      <ProgressLabelsHost>
        <Progress variant="dots" value={2} max={6} tone="primary" />
        <Progress value={3} max={5} tone="primary" />
      </ProgressLabelsHost>,
    );
    const [dots, bar] = bars(renderer);
    expect(bars(renderer)).toHaveLength(2);
    expect(dots!.props).toMatchObject({ 'aria-label': said.name, 'aria-valuenow': 2, 'aria-valuemin': 0, 'aria-valuemax': 6, 'aria-valuetext': said.value(2, 6) });
    expect(bar!.props).toMatchObject({ 'aria-label': said.name, 'aria-valuenow': 3, 'aria-valuemin': 0, 'aria-valuemax': 5, 'aria-valuetext': said.value(3, 5) });
    expect(String(dots!.props['aria-label']).trim()).not.toBe('');
    await unmount(renderer);
  });

  it('en reads "Progress", "2 of 6"; es and ko have their own words, never the English', () => {
    expect(getMessages('en').a11y.progress.name).toBe('Progress');
    expect(getMessages('en').a11y.progress.value(2, 6)).toBe('2 of 6');
    for (const locale of ['es', 'ko'] as const) {
      expect(getMessages(locale).a11y.progress.name).not.toBe('Progress');
      expect(getMessages(locale).a11y.progress.value(2, 6)).not.toBe('2 of 6');
    }
  });

  it('a meter that draws its own line is read with that line', async () => {
    const renderer = await render(
      <ProgressLabelsHost>
        <Progress value={3} max={24} label="3 of 24 quests" />
      </ProgressLabelsHost>,
    );
    expect(bars(renderer)[0]!.props['aria-valuetext']).toBe('3 of 24 quests');
    await unmount(renderer);
  });
});
