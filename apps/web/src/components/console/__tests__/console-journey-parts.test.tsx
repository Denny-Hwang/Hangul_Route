import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { JourneySummary } from '@hangul-route/content-schema';
import { colors } from '@hangul-route/design-system/tokens';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JourneyStrip } from '@/components/console/JourneyParts';
import { expectAllPseudo } from './pseudo-text';

/**
 * F-ROUTE-001 R-9a (section 3.12; wireframe console/roster "Journey strip"): the strip on a
 * roster card. Seven drawn segments (aria-hidden SVG, never text glyphs), a screen-reader word
 * list, "On Stage N" and a `<details>` with one line per stage. Rendered in English for the exact
 * words and in the pseudo-locale (en-XA) to prove every word is from the dictionary.
 */
const PSEUDO = 'en-XA' as UiLocale;
const view = { locale: 'en' as UiLocale };

vi.mock('@/lib/i18n/locale-context', () => ({
  useConsoleLocale: () => ({ locale: view.locale, messages: getMessages(view.locale), available: ['en'], setLocale: () => undefined }),
}));

afterEach(() => {
  view.locale = 'en';
  vi.unstubAllEnvs();
});

/** Wireframe I: placed into Stage 2 (Stage 1 known), one Stage 2 quest done. */
const journey: JourneySummary = {
  v: 1,
  here: 'stage2',
  stages: [
    { stage: 'stage1', state: 'known', done: 0, known: 8, total: 8 },
    { stage: 'stage2', state: 'open', done: 1, known: 0, total: 2 },
    { stage: 'stage3', state: 'later', done: 0, known: 0, total: 0 },
    { stage: 'stage4', state: 'explored', done: 1, known: 0, total: 1 },
    { stage: 'stage5', state: 'later', done: 0, known: 0, total: 0 },
    { stage: 'stage6', state: 'later', done: 0, known: 0, total: 0 },
    { stage: 'stage7', state: 'later', done: 0, known: 0, total: 0 },
  ],
};

const render = (kind: string, summary: { journey?: JourneySummary } | null): string =>
  renderToStaticMarkup(<JourneyStrip kind={kind} summary={summary} />);

const segmentsOf = (html: string): string => html.slice(html.indexOf('data-testid="journey-segments"'), html.indexOf('data-testid="journey-words"'));

describe('JourneyStrip (console/roster)', () => {
  it('shows the label, seven drawn segments, "On Stage 2" and the stage lines', () => {
    const html = render('class', { journey });
    expect(html).toContain('data-testid="journey-strip"');
    expect(html).toContain('>Learning Route<');
    expect(html).toContain('>On Stage 2<');
    expect(segmentsOf(html).match(/<svg/g)).toHaveLength(7);
    expect(html).toContain('<details');
    expect(html).toContain('<summary');
    expect(html).toContain('>Stage by stage</summary>');
    expect(html).toContain('<li>Stage 1: 8 known from the level check, 0 quests done</li>');
    expect(html).toContain('<li>Stage 2: 1 quest done</li>');
    expect(html).toContain('<li>Stage 3: Coming later</li>');
    expect(html).toContain('<li>Stages 5 to 7: Coming later</li>');
  });

  it('hides the drawn segments from screen readers and gives them a word list instead', () => {
    const html = render('family', { journey });
    expect(html).toMatch(/data-testid="journey-segments"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*data-testid="journey-segments"/);
    for (const word of ['Stage 1: Known from the level check', 'Stage 2: Open', 'Stage 4: Explored', 'Stage 7: Coming later']) {
      expect(html).toContain(`<li>${word}</li>`);
    }
  });

  it('draws each state with its own shape: never a text glyph, never a total', () => {
    const html = render('class', { journey });
    const segments = segmentsOf(html);
    expect(segments).not.toMatch(/[■□▶◀▼●○]/u);
    // known: a ring and an inner disc; later: a dashed ring; explored: a check with no ring;
    // the here segment carries the drawn cursor marker above it.
    expect(segments).toContain('stroke-dasharray');
    expect(segments.match(/<path/g)?.length).toBeGreaterThanOrEqual(2);
    const text = html.replace(/<[^>]+>/g, ' ');
    expect(text).not.toMatch(/\d+ ?\/ ?\d+/);
    expect(text).not.toContain('%');
  });

  it('fills a complete stage with its stage colour and outlines with the shape token', () => {
    const complete: JourneySummary = { ...journey, here: 'stage2', stages: [{ stage: 'stage1', state: 'complete', done: 8, known: 0, total: 8 }, ...journey.stages.slice(1)] };
    const html = render('class', { journey: complete });
    expect(html.toLowerCase()).toContain(`fill="${colors.stage.stage1.toLowerCase()}"`);
    expect(html.toLowerCase()).toContain(`stroke="${colors.border.shape.toLowerCase()}"`);
    expect(html).toContain('<li>Stage 1: 8 quests done</li>');
  });

  it('draws nothing for a school, without a summary or without a journey', () => {
    expect(render('school', { journey })).toBe('');
    expect(render('class', null)).toBe('');
    expect(render('class', {})).toBe('');
  });

  it('leaves out "On Stage" when the summary names no readable stage', () => {
    const html = render('class', { journey: { ...journey, here: null } });
    expect(html).not.toContain('On Stage');
    expect(html).toContain('data-testid="journey-strip"');
  });

  it('takes every word from the dictionary (en-XA)', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    view.locale = PSEUDO;
    expectAllPseudo(render('class', { journey }), [], 6);
  });
});
