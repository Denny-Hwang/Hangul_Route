import { Spacer } from '@hangul-route/design-system';
import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { DEFAULT_WEEKLY_DAYS } from '../../logic/goals/points';
import { goalStripView } from '../../logic/goals/strip-view';
import { checkSteadyWeeks, planDaysFor, saveGoals } from '../../store/goals';
import { usePlanStore } from '../../store/plan-store';
import { GoalFirstChoice } from './GoalFirstChoice';
import { GoalStrip } from './GoalStrip';
import { GoalsSheet } from './GoalsSheet';

/**
 * The goals on Home (F-CURR-002 section 7.4, OD-6, row CM-17; design/wireframes/home/goal-ring-weekly-dots.md A to D):
 * the week strip above the hero, the first choice under it once, and the goals sheet. Drawn only while `goals` is
 * on; the latch check runs each time Home comes into focus.
 */
export interface GoalsHomeProps {
  profileId: string;
  snapshot: ProgressSnapshot | undefined;
  /** The learner's local day. */
  today: string;
  /** The weekly plan's prompt shows on this visit: the first choice waits (one first-run prompt per Home visit). */
  planPromptShown: boolean;
  /** See my plan (C2): the plan view the Profile row opens. */
  onSeePlan: () => void;
}

export function GoalsHome({ profileId, snapshot, today, planPromptShown, onSeePlan }: GoalsHomeProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const plans = usePlanStore((s) => s.byLearner[profileId]);
  const planDays = useMemo(() => planDaysFor(profileId, snapshot), [profileId, snapshot, plans, today]);
  const view = useMemo(() => goalStripView(snapshot, today, planDays), [snapshot, today, planDays]);
  useFocusEffect(
    useCallback(() => {
      checkSteadyWeeks(profileId);
    }, [profileId]),
  );
  return (
    <>
      <Spacer size="lg" />
      <GoalStrip view={view} today={today} onPress={() => setOpen(true)} />
      {view.offerFirstChoice && !planPromptShown ? (
        <>
          <Spacer size="md" />
          <GoalFirstChoice
            onChoose={(daily) => saveGoals(profileId, { daily, weeklyDays: view.weeklyGoal })}
            onLater={() => saveGoals(profileId, { daily: view.daily, weeklyDays: DEFAULT_WEEKLY_DAYS }, { quiet: true })}
          />
        </>
      ) : null}
      <GoalsSheet
        visible={open}
        daily={view.daily}
        weeklyGoal={view.weeklyGoal}
        planDays={view.fromPlan ? view.weeklyDays : null}
        onSave={(choice) => {
          setOpen(false);
          // With a weekly plan on only the daily goal changes; the stored weekly goal applies again when it ends.
          saveGoals(profileId, view.fromPlan ? { ...choice, weeklyDays: view.weeklyGoal } : choice);
        }}
        onSeePlan={() => {
          setOpen(false);
          onSeePlan();
        }}
      />
    </>
  );
}
