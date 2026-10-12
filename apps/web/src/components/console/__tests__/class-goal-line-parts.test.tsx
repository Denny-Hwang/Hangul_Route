import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClassGoalLineView } from '@/components/console/ClassGoalParts';
import { classGoalLine } from '@/lib/console/class-goal-line';
import { ROUTE_CATALOG, TODAY, meta, plan, quest, stageTitle } from '@/lib/console/__tests__/fixtures/learning-route';
import { expectAllPseudo } from './pseudo-text';

/**
 * Learning Route LR-9 (amendment section 6.3, LR-OD-10; wireframe `console/learning-route.md` T1):
 * the class plan goal line on the class roster header, drawn from LR-7's `classGoalLine`. One line
 * about the newest whole-class plan and its end date; nothing about the learners.
 */
const lr = getMessages('en').console.learningRoute;
const PSEUDO = 'en-XA' as UiLocale;

// The formatters take UI locales only: under en-XA the console draws dates in English.
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  return { ...actual, formatDate: (locale: UiLocale, ...rest: Parameters<typeof actual.formatDate> extends [UiLocale, ...infer R] ? R : never) => actual.formatDate(locale === PSEUDO ? 'en' : locale, ...rest) };
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const decode = (s: string): string => s.replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');
const textOf = (html: string): string => decode(html.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

const line = (locale: UiLocale = 'en') =>
  classGoalLine({ kind: 'class', plans: [plan({ id: 'plan:1', items: [quest('quest:stage1-letters-q1')], meta: meta('2026-10-05', 11) })], today: TODAY, stageTitle, catalog: ROUTE_CATALOG, locale });

describe('ClassGoalLineView', () => {
  it('draws the plan line with the flag and the plan end under it', () => {
    const value = line();
    if (!value) throw new Error('no line');
    const html = renderToStaticMarkup(<ClassGoalLineView line={value} />);
    expect(textOf(html)).toBe(`${lr.planReaches.class(1, 'Hangul')} ${lr.planEnds('Dec 20')}`);
    expect(html).toContain('data-testid="class-goal-line"');
    // The flag is decoration: the words carry the line.
    expect(html.match(/<svg[^>]*aria-hidden="true"/g)).toHaveLength(1);
  });

  it('leaves the end out when the plan end is not known', () => {
    const value = line();
    if (!value) throw new Error('no line');
    expect(textOf(renderToStaticMarkup(<ClassGoalLineView line={{ ...value, planEnds: null }} />))).toBe(lr.planReaches.class(1, 'Hangul'));
  });

  it('draws nothing without a line', () => {
    expect(renderToStaticMarkup(<ClassGoalLineView line={null} />)).toBe('');
  });

  it('every word from the dictionary (en-XA)', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const value = line(PSEUDO);
    if (!value) throw new Error('no line');
    expectAllPseudo(renderToStaticMarkup(<ClassGoalLineView line={value} />), ['Hangul', 'Dec 20', 'Déç 20'], 2);
  });
});
