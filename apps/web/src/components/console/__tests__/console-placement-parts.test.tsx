import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { PlacementSummary } from '@hangul-route/content-schema';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StartingSpot } from '@/components/console/PlacementParts';
import { expectAllPseudo } from './pseudo-text';

/**
 * F-PLC-001 section 3.9 (P-9, wireframe placement K): the starting-spot line on a roster card
 * and its "Suggest a different start" link into the existing plan builder. Rendered in English
 * for the exact words and in the pseudo-locale (en-XA) to prove every word is from the dictionary.
 */
const PSEUDO = 'en-XA' as UiLocale;
const view = { locale: 'en' as UiLocale };

vi.mock('@/lib/i18n/locale-context', () => ({
  useConsoleLocale: () => ({ locale: view.locale, messages: getMessages(view.locale), available: ['en'], setLocale: () => undefined }),
}));

// The formatters take UI locales only: dates render in English under en-XA and are listed as data.
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  return { ...actual, formatDate: (locale: UiLocale, ...rest: Parameters<typeof actual.formatDate> extends [UiLocale, ...infer R] ? R : never) => actual.formatDate(locale === PSEUDO ? 'en' : locale, ...rest) };
});

afterEach(() => {
  view.locale = 'en';
  vi.unstubAllEnvs();
});

const placement = (over: Partial<PlacementSummary> = {}): PlacementSummary => ({
  takenAt: '2026-10-09T15:00:00.000Z',
  level: { stage: 'stage1', band: 1 },
  oralStage: null,
  strands: { 'hangul-recognition': 'secure', 'sound-letter': 'secure', 'syllable-reading': 'getting-there', vocabulary: 'not-tested', sentences: 'not-tested' },
  beyondContent: false,
  overridden: false,
  ...over,
});

const render = (summary: { placement?: PlacementSummary } | null): string =>
  renderToStaticMarkup(<StartingSpot summary={summary} spaceId="space:c1" learnerId="learner:sam" />);

describe('StartingSpot (console/roster)', () => {
  it('shows the line and the link to the plan builder for this learner', () => {
    const html = render({ placement: placement() });
    expect(html).toContain('data-testid="starting-spot"');
    expect(html).toContain('Starting spot: Stage 1 · Letters and sounds · Oct 9');
    expect(html).toContain('href="/teach/space/plan?id=space%3Ac1&amp;suggest=learner%3Asam"');
    expect(html).toContain('Suggest a different start');
    expect(html).not.toContain('Changed by a grown-up');
  });

  it('adds the quiet note when a grown-up changed the start', () => {
    expect(render({ placement: placement({ overridden: true }) })).toContain('Changed by a grown-up');
  });

  it('draws nothing without a placement', () => {
    expect(render(null)).toBe('');
    expect(render({})).toBe('');
  });

  it('takes every word from the dictionary (en-XA)', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    view.locale = PSEUDO;
    const html = render({ placement: placement({ overridden: true }) });
    // The band label is a dictionary message inside the line message; the line's pseudo pass
    // accents the date, so both are lifted out as data once the label is seen bracketed.
    const band = getMessages(PSEUDO).learner.placement.band.lettersAndSounds;
    expect(band).toMatch(/^\[/);
    expect(html).toContain(band);
    expectAllPseudo(html, [band, 'Óçt 9'], 3);
  });
});
