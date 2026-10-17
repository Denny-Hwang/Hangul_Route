import { formatDate as realFormatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PlanDraftItems, PlanReadout } from '@/components/console/PlanParts';
import type { PlanView } from '@/lib/console/api';
import type { ReadoutRow } from '@/lib/console/plans';
import { expectAllPseudo } from './pseudo-text';
import { STAGE1_EPISODES, STAGE1_TITLES, questsOfCell } from './stage1-catalog';

/**
 * F-I18N-001 PR 10b, §3.11: the loaded states of the plan page — the published readout and
 * the draft's item rows — take every word from the dictionary (the billing home's parts:
 * billing-home-parts-pseudo.test.tsx). The page tests (console-pages-pseudo.test.tsx) only reach first paint,
 * because effects do not run in a server render; these render the parts with data, in en-XA.
 */
const PSEUDO = 'en-XA' as UiLocale;

vi.mock('@/lib/i18n/locale-context', () => {
  const view = () => ({ locale: PSEUDO, messages: getMessages(PSEUDO), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => PSEUDO, useSetLocale: () => () => undefined };
});

// The formatters take UI locales only (en-XA is a dictionary test locale): dates render in
// English here and are listed as data below.
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

const now = new Date('2026-10-11T12:00:00.000Z');
const contentTitles = [...STAGE1_TITLES];
const episode = STAGE1_EPISODES[0]!;
const quest = questsOfCell(episode)[0]!;

const plan = (over: Partial<PlanView>): PlanView => ({
  id: 'plan:1',
  spaceId: 'space:c1',
  authorAccountId: 'teacher-kim',
  title: 'Week three',
  items: [
    { kind: 'episode', id: episode.episodeId, targetDate: '2026-10-12', note: 'warm up' },
    { kind: 'quest', id: quest.id },
  ],
  targetLearnerIds: null,
  publishedAt: '2026-10-10T09:00:00.000Z',
  archivedAt: null,
  createdAt: '2026-10-09T09:00:00.000Z',
  updatedAt: '2026-10-10T09:00:00.000Z',
  ...over,
});
const row = (over: Partial<ReadoutRow>): ReadoutRow => ({ learnerId: 'l:1', name: 'Mina', done: 1, total: 2, notReady: 0, synced: true, lastActiveAt: '2026-10-11T08:00:00.000Z', ...over });
// Data on the readout: the plan title, item notes, raw target dates, learner names and the published date.
const readoutData = ['Week three', 'warm up', '2026-10-12', 'Mina', 'Jun', realFormatDate('en', '2026-10-10T09:00:00.000Z', 'monthDay', { utc: true }), ...contentTitles];
const noop = (): void => undefined;

describe('plan parts render only dictionary text (en-XA)', () => {
  it('the published readout for everyone, with progress rows (synced, not ready, waiting)', () => {
    const html = renderToStaticMarkup(
      <PlanReadout plan={plan({})} rows={[row({}), row({ learnerId: 'l:2', name: 'Jun', done: 0, notReady: 1 }), row({ learnerId: 'l:3', name: 'Mina', synced: false, lastActiveAt: '2026-10-10T08:00:00.000Z' })]} kind="class" busy={false} now={now} onEdit={noop} onArchive={noop} onNew={noop} />,
    );
    expect(html).toContain('data-testid="readout-row"');
    expectAllPseudo(html, readoutData);
  });

  it('the readout for some learners, with nobody yet, before and after the roster loads', () => {
    for (const kind of ['family', 'class', 'school', null] as const) {
      const html = renderToStaticMarkup(<PlanReadout plan={plan({ targetLearnerIds: ['l:1', 'l:2'] })} rows={[]} kind={kind} busy={false} now={now} onEdit={noop} onArchive={noop} onNew={noop} />);
      expectAllPseudo(html, readoutData);
    }
  });

  it("the draft's item rows: reorder, remove, date and note", () => {
    const html = renderToStaticMarkup(<PlanDraftItems items={plan({}).items} onMove={noop} onRemove={noop} onUpdate={noop} />);
    expect(html).toContain('type="date"');
    expectAllPseudo(html, ['warm up', ...contentTitles]);
  });

  it('the empty draft', () => {
    const html = renderToStaticMarkup(<PlanDraftItems items={[]} onMove={noop} onRemove={noop} onUpdate={noop} />);
    // One line only; expectAllPseudo needs several words, so check it directly.
    expect(html).toMatch(/^<p[^>]*>\[[^\]]*\]<\/p>$/);
  });
});
