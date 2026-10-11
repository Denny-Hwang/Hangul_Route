import { CATALOG, addDays, generateCurriculum, toMeta, toPlanItems, type CurriculumMeta, type PlanItem } from '@hangul-route/content-schema';
import { formatDate as realFormatDate, getMessages, pseudoText, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { WeekTable } from '@/components/console/CurriculumParts';
import { PlanSwitcher, RouteDraftItems, RouteReadout } from '@/components/console/RoutePlanParts';
import type { PlanView } from '@/lib/console/api';
import { defaultsFor, toParams, weekGroups } from '@/lib/console/curriculum';
import type { ReadoutRow } from '@/lib/console/plans';
import { wordsOf } from './pseudo-text';

/**
 * F-PLAN-002 section 3.8 steps 4-6: the route parts of the plan page and the wizard preview
 * (the plan switcher, a route's week groups in the builder, the published route readout and
 * the week table) take every word from `console.curriculum`, in en-XA, and render the
 * structure the spec asks for. The page tests reach first paint only; these render the parts
 * with data. Titles, names and dates are data.
 */
const PSEUDO = 'en-XA' as UiLocale;

vi.mock('@/lib/i18n/locale-context', () => {
  const view = () => ({ locale: PSEUDO, messages: getMessages(PSEUDO), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => PSEUDO, useSetLocale: () => () => undefined };
});

// The formatters take UI locales only (en-XA is a dictionary test locale): dates render in English and are data.
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  return { ...actual, formatDate: (locale: UiLocale, ...rest: Parameters<typeof actual.formatDate> extends [UiLocale, ...infer R] ? R : never) => actual.formatDate(locale === PSEUDO ? 'en' : locale, ...rest) };
});

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
});
afterAll(() => {
  vi.unstubAllEnvs();
});

const START = '2026-10-18';

function route(): { meta: CurriculumMeta; items: PlanItem[] } {
  const params = toParams({ ...defaultsFor('class', [], START), length: '4-week', sessionDays: ['sun', 'wed'] }, ['stage1']);
  if (!params) throw new Error('params');
  const draft = generateCurriculum(params, CATALOG);
  return { meta: toMeta(draft), items: toPlanItems(draft) };
}

const plan = (over: Partial<PlanView>): PlanView => ({
  id: 'plan:1',
  spaceId: 'space:c1',
  authorAccountId: 'teacher-kim',
  title: 'Week three',
  items: [],
  targetLearnerIds: null,
  publishedAt: '2026-10-10T09:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-09T09:00:00.000Z',
  updatedAt: '2026-10-10T09:00:00.000Z',
  ...over,
});
const row = (over: Partial<ReadoutRow>): ReadoutRow => ({ learnerId: 'l:1', name: 'Mina', done: 1, total: 2, notReady: 0, synced: true, lastActiveAt: '2026-10-11T08:00:00.000Z', ...over });

const titles = [...CATALOG.cells.map((c) => c.title), ...CATALOG.quests.map((q) => q.title), ...CATALOG.stories.map((s) => s.title), ...CATALOG.topics.map((t) => t.title)];
const days = Array.from({ length: 120 }, (_, k) => realFormatDate('en', addDays('2026-09-01', k), 'monthDay', { utc: true }));
// Longest first, so "Oct 1" never eats the start of "Oct 18".
const data = [...titles, ...days, 'Mina', 'Jun', 'Week three', 'Route one', 'Draft two', 'yesterday', 'today'].sort((a, b) => b.length - a.length);
const noop = (): void => undefined;

/**
 * Like `expectAllPseudo`, but a week heading nests one message inside another ("Week 3 · [Oct
 * 18 – Oct 24] · Learn"), so brackets are removed innermost first; any letter left outside
 * every bracket is text that did not come from the dictionary.
 */
function expectAllPseudo(html: string, extra: readonly string[] = [], minWords = 4): void {
  const words = wordsOf(html, extra);
  expect(words.length).toBeGreaterThanOrEqual(minWords);
  for (const word of words) {
    let rest = word;
    for (let before = ''; before !== rest; ) {
      before = rest;
      rest = rest.replace(/\[[^[\]]*\]/g, '');
    }
    expect(rest, `"${word}" is not from the dictionary`).not.toMatch(/[A-Za-z]/);
  }
}

/** A data value as it reads inside a pseudo message (accented, no brackets). */
const inPseudo = (text: string): string => pseudoText(text).replace(/^\[|~*\]$/g, '');

const readout = (meta: CurriculumMeta, items: PlanItem[], today: string, rows: ReadoutRow[] = [row({})]): string =>
  renderToStaticMarkup(
    <RouteReadout plan={{ ...plan({ items }), meta }} rows={rows} today={today} locale={PSEUDO} busy={false} onSave={async () => true} relativeDayOf={() => 'today'} />,
  );

describe('RouteReadout (section 3.8 step 6)', () => {
  it('shows This week with its items and each learner against the planned length, then All weeks and Re-pace', () => {
    const { meta, items } = route();
    const html = readout(meta, items, '2026-10-26', [row({}), row({ learnerId: 'l:2', name: 'Jun', notReady: 1 }), row({ learnerId: 'l:3', synced: false })]);
    expect(html).toContain('data-testid="route-this-week"');
    expect(html.match(/data-testid="readout-row"/g)).toHaveLength(3);
    expect(html).toContain('<details');
    expect(html).toContain('data-testid="route-repace"');
    expect(html).not.toContain('route-repace-confirm');
    expect(html).not.toMatch(/%/);
    expectAllPseudo(html, data);
  });

  it('says when the route has not started or has ended', () => {
    const { meta, items } = route();
    expectAllPseudo(readout(meta, items, '2026-10-01'), data);
    expectAllPseudo(readout(meta, items, '2026-12-01'), data);
  });

  it('offers Refresh route, worded as what it does, on a route from an older catalogue', () => {
    const { meta, items } = route();
    const html = readout({ ...meta, catalogVersion: 0 }, items, '2026-10-26');
    const words = getMessages('en').console.curriculum.readout;
    expect(words.refreshLine).not.toMatch(/new lessons/i);
    expectAllPseudo(html, data);
    expect(html).not.toBe(readout(meta, items, '2026-10-26'));
  });
});

describe('PlanSwitcher (section 3.8 step 5)', () => {
  const { meta } = route();
  const plans = [
    plan({ id: 'plan:draft', title: 'Draft two', publishedAt: null, updatedAt: '2026-10-12T09:00:00.000Z' }),
    plan({ id: 'plan:classic', title: 'Week three', publishedAt: '2026-10-11T09:00:00.000Z' }),
    plan({ id: 'plan:route', title: 'Route one', publishedAt: '2026-10-09T09:00:00.000Z', meta }),
    plan({ id: 'plan:old', title: 'Week three', archivedAt: '2026-10-11T09:00:00.000Z' }),
  ];

  it('lists the active route first, then live plans, then drafts, and marks the open one', () => {
    const html = renderToStaticMarkup(<PlanSwitcher plans={plans} selectedId="plan:classic" onSelect={noop} locale={PSEUDO} />);
    const chips = [...html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1] ?? '');
    expect(chips).toHaveLength(3);
    expect(chips[0]).toContain(inPseudo('Route one'));
    expect(chips[1]).toContain(inPseudo('Week three'));
    expect(chips[2]).toContain(inPseudo('Draft two'));
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
    expectAllPseudo(html, data, 3);
  });

  it('hides itself with fewer than two plans to choose from', () => {
    expect(renderToStaticMarkup(<PlanSwitcher plans={[plans[1] as PlanView]} selectedId={null} onSelect={noop} locale={PSEUDO} />)).toBe('');
  });
});

describe('RouteDraftItems: the builder groups a route under its weeks (section 3.8 step 5)', () => {
  it('numbers items in the order shown, with up off on the first and down off on the last', () => {
    const { meta, items } = route();
    const html = renderToStaticMarkup(<RouteDraftItems meta={meta} items={items} locale={PSEUDO} onSwap={noop} onRemove={noop} onUpdate={noop} />);
    expect(html.match(/data-testid="builder-week"/g)).toHaveLength(meta.weeks.length);
    expect(html.match(/data-testid="draft-item"/g)).toHaveLength(items.length);
    const numbers = [...html.matchAll(/<span[^>]*>(\d+)\. /g)].map((m) => Number(m[1]));
    expect(numbers).toEqual(items.map((_, k) => k + 1));
    const buttons = [...html.matchAll(/<button([^>]*)>/g)].map((m) => m[1] ?? '');
    expect(buttons[0]).toContain('disabled');
    expect(buttons[buttons.length - 2]).toContain('disabled');
    expectAllPseudo(html, [...data, ...items.map((i) => i.targetDate ?? '')]);
  });

  it('lists an item outside the route under Not in a week yet', () => {
    const { meta, items } = route();
    const html = renderToStaticMarkup(<RouteDraftItems meta={meta} items={[...items, { kind: 'quest', id: 'quest:stage1-life-q1', targetDate: '2027-02-01' }]} locale={PSEUDO} onSwap={noop} onRemove={noop} onUpdate={noop} />);
    expect(html).toContain('<h3');
    expectAllPseudo(html, [...data, '2027-02-01', ...items.map((i) => i.targetDate ?? '')]);
  });
});

describe('WeekTable: a real table on a wide window, week cards on a narrow one (section 3.11)', () => {
  it('has header cells, row headers and one card per week', () => {
    const { meta, items } = route();
    const rows = weekGroups(meta.weeks, items).rows;
    const html = renderToStaticMarkup(<WeekTable rows={rows} locale={PSEUDO} />);
    expect(html.match(/<th scope="col"/g)).toHaveLength(6);
    expect(html.match(/<th scope="row"/g)).toHaveLength(rows.length);
    expect(html.match(/data-testid="week-card"/g)).toHaveLength(rows.length);
    expectAllPseudo(html.replace(/<style>.*?<\/style>/, ''), data);
  });
});
