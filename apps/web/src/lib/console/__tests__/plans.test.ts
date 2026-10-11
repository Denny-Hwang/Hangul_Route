import { formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SpaceKind } from '@hangul-route/content-schema';
import type { RosterLearner } from '../api';
import { addDays, currentPlan, latestPublished, moveItem, memberKind, oneExplicitPerDay, planErrorText, planEveryone, planSummary, planReadout, planStatusLabel, readoutLine, spaceKey, spreadDates } from '../plans';

describe('plan helpers (F-PLAN-001 §3.5)', () => {
  it('spreads dates evenly and never twice on one day', () => {
    expect(spreadDates('2026-09-21', 2, 4)).toEqual(['2026-09-21', '2026-09-25', '2026-09-28', '2026-10-02']);
    expect(spreadDates('2026-09-21', 7, 3)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
    expect(spreadDates('2026-09-21', 99, 3)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']); // clamps to daily
    expect(spreadDates('2026-09-21', 0, 2)).toEqual(['2026-09-21', '2026-09-28']); // clamps to weekly
    expect(spreadDates('2026-12-30', 1, 2)).toEqual(['2026-12-30', '2027-01-06']);
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('slides colliding items to the next free day in list order', () => {
    const { items, moved } = oneExplicitPerDay([
      { kind: 'quest', id: 'a', targetDate: '2026-09-21' },
      { kind: 'quest', id: 'b', targetDate: '2026-09-21' },
      { kind: 'quest', id: 'c' },
      { kind: 'quest', id: 'd', targetDate: '2026-09-22' },
    ]);
    expect(items.map((i) => i.targetDate)).toEqual(['2026-09-21', '2026-09-22', undefined, '2026-09-23']);
    expect(moved).toBe(2);
    expect(oneExplicitPerDay([{ kind: 'quest', id: 'a', targetDate: '2026-09-21' }]).moved).toBe(0);
  });

  it('picks the latest published and the current plan, and labels status', () => {
    const plans = [
      { id: 'p1', title: 'old', publishedAt: '2026-09-01T00:00:00.000Z', archivedAt: null, updatedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'p2', title: 'new', publishedAt: '2026-09-20T00:00:00.000Z', archivedAt: null, updatedAt: '2026-09-20T00:00:00.000Z' },
      { id: 'p3', title: 'draft', publishedAt: null, archivedAt: null, updatedAt: '2026-09-21T00:00:00.000Z' },
      { id: 'p4', title: 'gone', publishedAt: '2026-09-25T00:00:00.000Z', archivedAt: '2026-09-26T00:00:00.000Z', updatedAt: '2026-09-26T00:00:00.000Z' },
    ];
    expect(latestPublished(plans)?.id).toBe('p2');
    expect(currentPlan(plans)?.id).toBe('p3');
    expect(latestPublished([])).toBeNull();
    expect(currentPlan([plans[3] as (typeof plans)[number]])).toBeNull();
    expect(planStatusLabel(plans[1] as (typeof plans)[number])).toBe('Published Sep 20');
    expect(planStatusLabel(plans[2] as (typeof plans)[number])).toBe('Draft');
    expect(planStatusLabel(plans[3] as (typeof plans)[number])).toBe('Archived');
    for (const locale of ['en', 'es', 'ko'] as const) {
      const status = getMessages(locale).console.planStatus;
      expect(planStatusLabel(plans[1] as (typeof plans)[number], locale)).toBe(status.published(formatDate(locale, '2026-09-20T00:00:00.000Z', 'monthDay', { utc: true })));
      expect(planStatusLabel(plans[2] as (typeof plans)[number], locale)).toBe(status.draft);
      expect(planStatusLabel(plans[3] as (typeof plans)[number], locale)).toBe(status.archived);
    }
    // The published day is the UTC calendar day, whatever the device time zone.
    expect(planStatusLabel({ ...(plans[1] as (typeof plans)[number]), publishedAt: '2026-09-20T23:30:00.000Z' })).toBe('Published Sep 20');
  });

  it('reads out per-learner progress in roster order without ranking', () => {
    const learner = (id: string, progress: { done: number; total: number; notReady: number } | null): RosterLearner => ({
      id,
      displayName: id,
      ageGroup: '5-7',
      avatar: 'hoya-orange',
      joinedAt: 't',
      lastActiveAt: 't',
      lastSyncedAt: null,
      summary: progress
        ? { lastActiveAt: 't', streakDays: 0, stage1: { questsDone: 0, questsTotal: 11, anchorAccuracy: null }, cardsUnlocked: 0, minutesLast7d: 0, jamoRecognized: [], needsPractice: [], planProgress: { 'plan:w3': progress } }
        : null,
    });
    const rows = planReadout('plan:w3', [learner('minho', { done: 2, total: 3, notReady: 0 }), learner('suji', { done: 0, total: 2, notReady: 1 }), learner('new', null)]);
    expect(rows.map((r) => r.name)).toEqual(['minho', 'suji', 'new']);
    expect(readoutLine(rows[0] as ReadoutRowT)).toBe('2 / 3');
    expect(readoutLine(rows[1] as ReadoutRowT)).toBe('0 / 2 · 1 not ready yet');
    expect(readoutLine(rows[2] as ReadoutRowT)).toBe('waiting for the next sync');
    for (const locale of ['en', 'es', 'ko'] as const) {
      const words = getMessages(locale).console.plan.readout;
      expect(readoutLine(rows[0] as ReadoutRowT, locale)).toBe(words.progress(2, 3));
      expect(readoutLine(rows[1] as ReadoutRowT, locale)).toBe(words.withNotReady(0, 2, 1));
      expect(readoutLine(rows[2] as ReadoutRowT, locale)).toBe(words.waiting);
    }
  });

  it('moves items within bounds only', () => {
    const items = [{ kind: 'quest' as const, id: 'a' }, { kind: 'quest' as const, id: 'b' }, { kind: 'quest' as const, id: 'c' }];
    expect(moveItem(items, 0, 2).map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(moveItem(items, 2, 0).map((i) => i.id)).toEqual(['c', 'a', 'b']);
    expect(moveItem(items, 1, 1).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(moveItem(items, -1, 0).map((i) => i.id)).toEqual(['a', 'b', 'c']);
    expect(moveItem(items, 0, 5).map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });
});

type ReadoutRowT = ReturnType<typeof planReadout>[number];

describe('plan page words (F-I18N-001 PR 10b)', () => {
  const PSEUDO = 'en-XA' as UiLocale;
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('words the errors from a key', () => {
    expect(planErrorText('cantReach')).toBe("Can't reach the console right now.");
    expect(planErrorText('saveInvalid')).toBe("Some learners are no longer in this space — check who it's for.");
    expect(planErrorText('saveFailed')).toBe("Didn't save. Try again.");
    expect(planErrorText('archiveFailed')).toBe("Couldn't archive it right now.");
  });

  it('names who the plan is for, as the page did', () => {
    expect(planSummary(1, null, 'class')).toBe('1 item · for everyone in this class');
    expect(planSummary(4, null, null)).toBe('4 items · for everyone in this space');
    expect(planSummary(4, 3, 'class')).toBe('4 items · for 3 students');
    expect(planSummary(2, 2, 'family')).toBe('2 items · for 2 learners');
    expect(planSummary(2, 1, 'school')).toBe('2 items · for 1 member');
    expect(planSummary(1, 1, 'family')).toBe('1 item · for 1 learner');
    expect(planSummary(3, 1, 'class')).toBe('3 items · for 1 student');
    expect(planSummary(3, 1, null)).toBe('3 items · for 1 learner');
    expect(planSummary(2, 2, null)).toBe('2 items · for 2 learners'); // before the roster loads, as before
    expect(planEveryone('class')).toBe('everyone in this class');
    expect(planEveryone(null)).toBe('everyone in this space');
    for (const locale of ['en', 'es', 'ko'] as const) {
      const p = getMessages(locale).console.plan;
      expect(planSummary(3, null, 'family', locale)).toBe(p.summary.everyone.family(3));
      expect(planSummary(3, 4, 'class', locale)).toBe(p.summary.some.class(3, 4));
      expect(planEveryone('school', locale)).toBe(p.who.everyone.school);
    }
  });

  it('reads a space kind this build does not know as the roster-not-loaded words, never a crash', () => {
    // The roster is not validated at runtime; a newer Worker could send a kind added later.
    const unknown = 'district' as unknown as SpaceKind;
    expect(memberKind(unknown)).toBe('family');
    expect(memberKind(null)).toBe('family');
    expect(memberKind('school')).toBe('school');
    expect(spaceKey(unknown)).toBe('space');
    expect(spaceKey(null)).toBe('space');
    expect(spaceKey('class')).toBe('class');
    expect(planSummary(2, 3, unknown)).toBe('2 items · for 3 learners');
    expect(planSummary(2, null, unknown)).toBe('2 items · for everyone in this space');
    expect(planEveryone(unknown)).toBe('everyone in this space');
  });

  it('leaves no English in the pseudo-locale', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const bracketed = /^\[.*\]$/;
    for (const error of ['cantReach', 'saveInvalid', 'saveFailed', 'archiveFailed'] as const) expect(planErrorText(error, PSEUDO)).toMatch(bracketed);
    expect(planSummary(1, null, 'class', PSEUDO)).toMatch(bracketed);
    expect(planSummary(1, 3, 'class', PSEUDO)).toMatch(bracketed);
    expect(planEveryone('class', PSEUDO)).toMatch(bracketed);
    const row = { learnerId: 'a', name: 'a', done: 0, total: 2, notReady: 1, synced: true, lastActiveAt: 't' };
    expect(readoutLine(row, PSEUDO)).toMatch(bracketed);
    expect(readoutLine({ ...row, synced: false }, PSEUDO)).toMatch(bracketed);
  });
});
