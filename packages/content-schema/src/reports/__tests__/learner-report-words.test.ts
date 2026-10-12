import { describe, expect, it, vi } from 'vitest';
import { CATALOG_2026_10 } from '../../__tests__/fixtures/catalog-2026-10';
import type { ReportSummary } from '../../schemas/report-response';
import { learnerReport, REPORT_WORDS_VISIBLE } from '../learner-report';
import { NOW, STEADY } from './fixtures/activity-2026-10';

/**
 * F-REPORT-001 section 3.10 (RP-2a): words reach a report from the same change that lets a teacher read them.
 * Here `vocab` is off the hidden list, as F-VOC-005 P-4b will leave it: the words figure appears, with the same
 * up-only rule as every other figure.
 */
vi.mock('../../schemas/transfer-consent', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../schemas/transfer-consent')>();
  return { ...actual, TEACHER_HIDDEN_SUMMARY_KEYS: actual.TEACHER_HIDDEN_SUMMARY_KEYS.filter((key) => key !== 'vocab') };
});

describe('words, once vocab leaves the hidden list (F-VOC-005 P-4b)', () => {
  it('shows new words in the window, up only when they grew', () => {
    expect(REPORT_WORDS_VISIBLE).toBe(true);
    const words: ReportSummary = { ...STEADY, activity: { ...STEADY.activity, days: STEADY.activity.days.map((row) => ({ ...row, w: row.d >= '2026-10-09' ? 4 : 1 })) } };
    const r = learnerReport({ summary: words, viewer: 'family', voice: 'third', period: 'week', now: NOW, catalog: CATALOG_2026_10, lastSyncedAt: null });
    expect(r.figures?.words).toEqual({ count: 12, up: true });
    // A day has no window to compare with.
    const today = learnerReport({ summary: words, viewer: 'family', voice: 'third', period: 'day', now: NOW, catalog: CATALOG_2026_10, lastSyncedAt: null });
    expect(today.figures?.words).toEqual({ count: 4 });
  });
});
