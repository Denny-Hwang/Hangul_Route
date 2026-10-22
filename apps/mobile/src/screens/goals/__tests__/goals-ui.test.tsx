import { Caption, LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import type { ProgressSnapshot, SessionLog } from '@hangul-route/content-schema';
import React from 'react';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { goalStripView } from '../../../logic/goals/strip-view';
import { GoalFirstChoice } from '../GoalFirstChoice';
import { GoalMomentBanner } from '../GoalMomentBanner';
import { GoalStrip } from '../GoalStrip';
import { GoalsSheet } from '../GoalsSheet';

/*
 * The goals UI (F-CURR-002 row CM-17; design/wireframes/home/goal-ring-weekly-dots.md A, A2, B, C, C2, D, E): the
 * strip is one button read as one sentence, the sheet saves on every way out, the first choice and the banners.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

// react-native-web's Modal draws into a portal outside the test tree: draw its children in place.
vi.mock('react-native', async (load) => {
  const rn = await load<Record<string, unknown>>();
  return { ...rn, Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => (visible ? children : null) };
});

const [MON, TUE, THU, FRI] = ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-23'];
const mounted: ReactTestRenderer[] = [];
let seq = 0;
function quest(localDay: string): SessionLog {
  seq += 1;
  return { id: `session:${localDay}T09:00:00.000Z:${seq}`, profileId: 'p1', startedAt: `${localDay}T09:00:00.000Z`, episodesTouched: [], localDay };
}
function snapshot(over: Partial<ProgressSnapshot> = {}): ProgressSnapshot {
  return { profileId: 'p1', updatedAt: '2026-10-21T00:00:00.000Z', episodes: [], quests: [], cards: [], sessions: [], homework: [], reviews: [], streakDays: 0, ...over };
}

async function draw(node: React.ReactElement, width = 320): Promise<ReactTestInstance> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(<LayoutProvider value={layoutClassFor({ width, height: 800 })}>{node}</LayoutProvider>);
  });
  mounted.push(r);
  return r.root;
}
/** Each element with the test id once (the composite that received the prop). */
const byId = (root: ReactTestInstance, id: string) => root.findAll((n) => n.props.testID === id && typeof n.type !== 'string' && n.parent?.props.testID !== id);
const textOf = (root: ReactTestInstance): string =>
  root
    .findAll((n) => typeof n.props.children === 'string')
    .map((n) => n.props.children as string)
    .join(' | ');

afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
});

describe('GoalStrip', () => {
  const snap = snapshot({ sessions: [quest(MON), quest(TUE), quest(THU), quest(FRI)], dayLog: { [FRI]: { a: 1 } }, steadyWeeks: { '2026-10-12': '2026-10-15T00:00:00.000Z' } });

  it.each([320, 1024])('at %i: one button with the whole week in its name, the headline, 7 dots and the streak line', async (width) => {
    const onPress = vi.fn();
    const root = await draw(<GoalStrip view={goalStripView(snap, FRI, null)} today={FRI} onPress={onPress} />, width);
    const strip = root.find((n) => n.props.testID === 'home-goal-strip' && n.props.accessibilityRole === 'button');
    expect(strip.props.accessibilityLabel).toBe(
      'This week: Monday learned, Tuesday learned, Wednesday rest day, Thursday learned, Friday learned today, Saturday, Sunday. 1 steady week. Streak 4 days. Daily goal: Light, about 5 minutes, a little more to go. Change goals.',
    );
    const text = textOf(root);
    expect(text).toContain('1 steady week');
    expect(text).toContain('Streak 4 days');
    expect(text).not.toMatch(/%|\bof\b|points?/);
    expect(byId(root, 'goal-dot-learned').length + byId(root, 'goal-dot-rest').length + byId(root, 'goal-dot-today').length + byId(root, 'goal-dot-plain').length).toBe(7);
    expect(byId(root, 'goal-dot-rest')).toHaveLength(1);
    // The day letters, Monday first.
    expect(root.findAllByType(Caption).map((c) => c.props.children).slice(0, 7)).toEqual(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
    if (width > 600) expect(text).toContain('A little more for your daily goal');
    act(() => strip.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('A2: a run that ended reads "Start a new run! Best run: 12 days", never lost', async () => {
    const ended = snapshot({ sessions: [quest(MON)], streakLocal: { run: 1, lastDay: MON }, streakBest: 12 });
    const root = await draw(<GoalStrip view={goalStripView(ended, FRI, null)} today={FRI} onPress={() => undefined} />);
    expect(textOf(root)).toContain('Start a new run! Best run: 12 days');
    expect(textOf(root)).not.toMatch(/lost|missed|broken/i);
    expect(byId(root, 'goal-ring')).toHaveLength(1);
  });

  it('the daily goal met: the ring closes with a check', async () => {
    const met = snapshot({ sessions: [quest(FRI)], dayLog: { [FRI]: { a: 3 } } });
    const root = await draw(<GoalStrip view={goalStripView(met, FRI, null)} today={FRI} onPress={() => undefined} />, 1024);
    expect(byId(root, 'goal-ring-met')).toHaveLength(1);
    expect(textOf(root)).toContain('Daily goal done');
  });
});

describe('GoalsSheet', () => {
  it('C: plain time words, days a week, the help lines; Done saves the choice', async () => {
    const onSave = vi.fn();
    const root = await draw(<GoalsSheet visible daily={3} weeklyGoal={3} planDays={null} onSave={onSave} onSeePlan={() => undefined} />);
    const text = textOf(root);
    for (const line of ['Your goals', 'Every day', 'Light', 'about 5 minutes', 'Steady', 'about 10 minutes', 'Strong', 'about 15 minutes', 'Every week', '3 days', '5 days', '7 days']) expect(text).toContain(line);
    expect(text).toContain('A steady week is a week you learn on the days you chose. They add up and never go away.');
    expect(text).toContain('Rest days: Hoya keeps your streak going on up to 2 quiet days a week.');
    const radio = (id: string) => root.find((n) => n.props.testID === id && n.props.accessibilityRole === 'radio');
    expect(radio('goals-daily-light').props.accessibilityState).toEqual({ checked: true });
    act(() => radio('goals-daily-strong').props.onPress());
    act(() => radio('goals-weekly-5').props.onPress());
    expect(radio('goals-daily-strong').props.accessibilityState).toEqual({ checked: true });
    act(() => root.find((n) => n.props.testID === 'goals-sheet-done' && typeof n.props.onPress === 'function').props.onPress());
    expect(onSave).toHaveBeenCalledWith({ daily: 10, weeklyDays: 5 });
  });

  it('the close button and the scrim save too; C2: with a plan on, its days read only, with See my plan', async () => {
    const onSave = vi.fn();
    const onSeePlan = vi.fn();
    const root = await draw(<GoalsSheet visible daily={6} weeklyGoal={5} planDays={4} onSave={onSave} onSeePlan={onSeePlan} />, 1024);
    expect(textOf(root)).toContain('4 days, from your weekly plan');
    expect(root.findAll((n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('goals-weekly-') && n.props.accessibilityRole === 'radio')).toHaveLength(0);
    act(() => root.find((n) => n.props.testID === 'goals-see-plan' && typeof n.props.onPress === 'function').props.onPress());
    expect(onSeePlan).toHaveBeenCalledTimes(1);
    act(() => root.find((n) => n.props.testID === 'goals-sheet-close' && typeof n.props.onPress === 'function').props.onPress());
    act(() => root.find((n) => n.props.testID === 'goals-sheet-scrim' && typeof n.props.onPress === 'function').props.onPress());
    expect(onSave).toHaveBeenNthCalledWith(1, { daily: 6, weeklyDays: 5 });
    expect(onSave).toHaveBeenCalledTimes(2);
  });
});

describe('GoalFirstChoice and GoalMomentBanner', () => {
  it('D: three time choices and Not now', async () => {
    const onChoose = vi.fn();
    const onLater = vi.fn();
    const root = await draw(<GoalFirstChoice onChoose={onChoose} onLater={onLater} />);
    expect(textOf(root)).toContain('How much time a day suits you?');
    act(() => root.find((n) => n.props.testID === 'goal-first-steady' && typeof n.props.onPress === 'function').props.onPress());
    act(() => root.find((n) => n.props.testID === 'goal-first-later' && typeof n.props.onPress === 'function').props.onPress());
    expect(onChoose).toHaveBeenCalledWith(6);
    expect(onLater).toHaveBeenCalledTimes(1);
  });

  it('E: one line per goal reached, nothing otherwise', async () => {
    const both = await draw(<GoalMomentBanner moment={{ dayMet: true, weekMet: 5 }} />);
    expect(textOf(both)).toContain('Daily goal done!');
    expect(textOf(both)).toContain('Week goal reached! That is 5 steady weeks.');
    const none = await draw(<GoalMomentBanner moment={{ dayMet: false, weekMet: null }} />);
    expect(byId(none, 'results-goal-moment')).toHaveLength(0);
    const nil = await draw(<GoalMomentBanner moment={null} />);
    expect(byId(nil, 'results-goal-moment')).toHaveLength(0);
  });
});
