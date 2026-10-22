import { getMessages } from '@hangul-route/i18n';
import type { ProgressSnapshot, SessionLog } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { goalStripView, headlineOf, ringLineOf, streakTextOf, stripLabelOf, tierLabelOf } from '../strip-view';

/*
 * The Home week strip's view (F-CURR-002 section 7.4, OD-6, row CM-17; design/wireframes/home/goal-ring-weekly-dots.md
 * A, A2, states and Accessibility), including the CM-4 hand-off: "Start a new run" and the best run once a run has
 * ended, never "lost". The suite runs under TZ=UTC.
 */

const en = getMessages('en');
const [MON, TUE, WED, THU, FRI] = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23'];
const NAMES: Record<string, string> = { [MON]: 'Monday', [TUE]: 'Tuesday', [WED]: 'Wednesday', [THU]: 'Thursday', [FRI]: 'Friday', '2026-10-24': 'Saturday', '2026-10-25': 'Sunday' };
const dayName = (d: string) => NAMES[d] ?? d;

let seq = 0;
function quest(localDay: string): SessionLog {
  seq += 1;
  return { id: `session:${localDay}T09:00:00.000Z:${seq}`, profileId: 'p1', startedAt: `${localDay}T09:00:00.000Z`, episodesTouched: [], localDay };
}
function snapshot(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return { profileId: 'p1', updatedAt: '2026-10-21T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over };
}

describe('goalStripView', () => {
  it('first day, no history: plain dots but today, "Your first steady week starts here", no streak line, an empty ring', () => {
    const view = goalStripView(undefined, WED, null);
    expect(view.dots.map((d) => d.state)).toEqual(['plain', 'plain', 'today', 'plain', 'plain', 'plain', 'plain']);
    expect(headlineOf(view, en.learner.goals)).toBe('Your first steady week starts here');
    expect(view.streak).toBeNull();
    expect(streakTextOf(view, en)).toBeNull();
    expect(view.ring).toEqual({ state: 'empty', fraction: 0 });
    expect([view.daily, view.tier, view.weeklyDays, view.weeklyGoal, view.fromPlan, view.offerFirstChoice]).toEqual([3, 'light', 3, 3, false, false]);
    expect(stripLabelOf(view, en, WED, dayName)).toBe(
      'This week: Monday, Tuesday, Wednesday today, Thursday, Friday, Saturday, Sunday. Your first steady week starts here. Daily goal: Light, about 5 minutes, ready to start. Change goals.',
    );
  });

  it('A: a run in progress with a rest day, steady weeks as the headline, the ring part way', () => {
    const snap = snapshot({
      sessions: [quest(MON), quest(TUE), quest(THU), quest(FRI)],
      dayLog: { [MON]: { a: 3 }, [TUE]: { a: 3 }, [THU]: { a: 3 }, [FRI]: { a: 2 } },
      goals: { daily: 3, weeklyDays: 3, setAt: '2026-10-01T00:00:00.000Z' },
      steadyWeeks: { '2026-10-05': '2026-10-08T00:00:00.000Z', '2026-10-12': '2026-10-15T00:00:00.000Z', '2026-10-19': '2026-10-22T00:00:00.000Z', '2026-09-28': '2026-10-01T00:00:00.000Z' },
    });
    const view = goalStripView(snap, FRI, null);
    expect(view.dots.map((d) => d.state)).toEqual(['learned', 'learned', 'rest', 'learned', 'learned', 'plain', 'plain']);
    expect(headlineOf(view, en.learner.goals)).toBe('4 steady weeks');
    expect(streakTextOf(view, en)).toBe('Streak 4 days');
    expect(view.ring.state).toBe('partly');
    expect(ringLineOf(view, en.learner.goals)).toBe('A little more for your daily goal');
    expect(stripLabelOf(view, en, FRI, dayName)).toBe(
      'This week: Monday learned, Tuesday learned, Wednesday rest day, Thursday learned, Friday learned today, Saturday, Sunday. 4 steady weeks. Streak 4 days. Daily goal: Light, about 5 minutes, a little more to go. Change goals.',
    );
  });

  it('A2 (the CM-4 hand-off): a run that ended shows "Start a new run! Best run: N days", the best run kept, until the next finished activity', () => {
    const snap = snapshot({ sessions: [quest(MON)], streakLocal: { run: 1, lastDay: MON }, streakBest: 12 });
    const ended = goalStripView(snap, FRI, null);
    expect(ended.dots.map((d) => d.state)).toEqual(['learned', 'rest', 'rest', 'plain', 'today', 'plain', 'plain']);
    expect(ended.streak).toEqual({ kind: 'newRun', best: 12 });
    expect(streakTextOf(ended, en)).toBe('Start a new run! Best run: 12 days');
    expect(streakTextOf(ended, getMessages('es'))).toBe('¡Empieza una racha nueva! Mejor racha: 12 días');
    expect(streakTextOf(ended, getMessages('ko'))).toBe('새 연속 기록을 시작해요! 최고 기록: 12일');
    // The next finished activity starts the new run.
    const again = goalStripView({ ...snap, sessions: [...snap.sessions, quest(FRI)], dayLog: { [FRI]: { a: 3 } } }, FRI, null);
    expect(streakTextOf(again, en)).toBe('Streak 1 day');
    expect(again.ring.state).toBe('met');
    expect(ringLineOf(again, en.learner.goals)).toBe('Daily goal done');
  });

  it('a weekly plan on sets the weekly days in force; the stored weekly goal stays for when it ends', () => {
    const view = goalStripView(snapshot({ goals: { daily: 10, weeklyDays: 5, setAt: '2026-10-01T00:00:00.000Z' } }), WED, 4);
    expect([view.weeklyDays, view.weeklyGoal, view.fromPlan, view.tier]).toEqual([4, 5, true, 'strong']);
    expect(tierLabelOf(view.tier, en.learner.goals)).toBe('Strong, about 15 minutes');
  });

  it('offers the first choice once something is finished and no goals are stored', () => {
    expect(goalStripView(snapshot({ sessions: [quest(MON)] }), WED, null).offerFirstChoice).toBe(true);
    expect(goalStripView(snapshot({ sessions: [quest(MON)], goals: { daily: 3, weeklyDays: 3, setAt: '2026-10-19T00:00:00.000Z' } }), WED, null).offerFirstChoice).toBe(false);
  });
});
