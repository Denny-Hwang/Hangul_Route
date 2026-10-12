import { describe, expect, it, vi } from 'vitest';
import { CATALOG_2026_10 } from '../../__tests__/fixtures/catalog-2026-10';
import type { ReportPeriod } from '../../schemas/report';
import type { ReportSummary } from '../../schemas/report-response';
import type { VocabSummary } from '../../schemas/sync';
import { InsightLineSchema, practiceNext, wentWell, type InsightSummary } from '../insights';
import { learnerReport, REPORT_WORDS_VISIBLE } from '../learner-report';

/**
 * F-REPORT-001 section 3.6 W10 and P5 (RP-2b): word lines appear from the same change that lets a teacher read
 * words (F-VOC-005 P-4 moves `vocab` off the hidden list). Here it is off the list.
 */
vi.mock('../../schemas/transfer-consent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../schemas/transfer-consent')>();
  return { ...actual, TEACHER_HIDDEN_SUMMARY_KEYS: actual.TEACHER_HIDDEN_SUMMARY_KEYS.filter((key) => key !== 'vocab') };
});

const NOW = new Date('2026-10-15T12:00:00.000Z');
const VOCAB: VocabSummary = { collected: 9, strong: 1, topicsStarted: 1, topicsPracticed7d: 1, firstTryRate: 0.5, needsPractice: ['vocab:bap', 'vocab:mul', 'vocab:kimchi'] };

/** A UTC learner who met `words` new words on 14 October, past the getting-started rule. */
function learner(words: number, vocab?: VocabSummary): InsightSummary {
  const summary: ReportSummary = {
    lastActiveAt: '2026-10-14T09:00:00.000Z',
    planProgress: {},
    activity: {
      v: 1,
      tz: 0,
      asOf: '2026-10-15',
      days: [{ d: '2026-10-14', min: 10, q: 0, c: 0, w: words, j: [] }],
      months: [{ m: '2026-10', min: 10, q: 0, c: 0, w: words, days: 1 }],
      total: { since: '2026-01-05', min: 60, q: 0, c: 0, w: words, days: 6 },
      milestones: [],
    },
  };
  return vocab ? { ...summary, vocab } : summary;
}
const ctx = (summary: InsightSummary, period: ReportPeriod = 'week') => ({
  summary,
  report: learnerReport({ summary, viewer: 'family', voice: 'third', period, now: NOW, catalog: CATALOG_2026_10, lastSyncedAt: null }),
  catalog: CATALOG_2026_10,
});

describe('words, once vocab leaves the hidden list (F-VOC-005 P-4)', () => {
  it('W10 words_new: 5 or more new words in the window (week, month, all)', () => {
    expect(REPORT_WORDS_VISIBLE).toBe(true);
    expect(wentWell(ctx(learner(5)))).toEqual([{ code: 'words_new', params: { count: 5 } }]);
    expect(wentWell(ctx(learner(4)))).toEqual([{ code: 'showed_up', params: { days: 1, period: 'week' } }]);
    expect(wentWell(ctx(learner(5), 'month'))).toEqual([{ code: 'words_new', params: { count: 5 } }]);
    expect(wentWell(ctx(learner(5), 'all'))).toContainEqual({ code: 'words_new', params: { count: 5 } });
    const day = learnerReport({ summary: learner(5), viewer: 'family', voice: 'third', period: 'day', now: new Date('2026-10-14T12:00:00.000Z'), catalog: CATALOG_2026_10, lastSyncedAt: null });
    expect(wentWell({ summary: learner(5), report: day, catalog: CATALOG_2026_10 }).map((line) => line.code)).not.toContain('words_new');
  });

  it('P5 words_revisit: up to 3 words that need practice; nothing when there are none or no slice', () => {
    expect(practiceNext(ctx(learner(1, VOCAB)))).toEqual([{ code: 'words_revisit', params: { words: ['vocab:bap', 'vocab:mul', 'vocab:kimchi'] } }]);
    expect(practiceNext(ctx(learner(1, { ...VOCAB, needsPractice: [] })))).toEqual([]);
    expect(practiceNext(ctx(learner(1)))).toEqual([]);
    expect(practiceNext(ctx(learner(1, VOCAB), 'day'))).toEqual([]);
  });

  it('word lines parse with the line schema: word ids, never free text', () => {
    for (const line of [...wentWell(ctx(learner(5))), ...practiceNext(ctx(learner(1, VOCAB)))]) expect(InsightLineSchema.parse(line)).toEqual(line);
    expect(InsightLineSchema.safeParse({ code: 'words_revisit', params: { words: ['Mina'] } }).success).toBe(false);
  });
});
