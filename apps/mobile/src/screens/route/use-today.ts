import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { DAY_BASES, watchDay } from '../../logic/day-clock';
import { subscribeAppVisibility } from '../../platform/app-visibility';

/**
 * Today's day key for a screen (F-PLAN-002 section 3.6: plan dates are UTC days, the default).
 * A screen can stay mounted across midnight, so the day is read again whenever the screen comes
 * into focus, whenever the app comes back to the front, and at the next boundary while the
 * screen is in focus (F-ROUTE-001 R-7e; `logic/day-clock.ts`). `basis: 'local'` keys the
 * device's local calendar day instead, for the vocabulary schedule (F-VOC-005 P5, P-3b).
 */
export function useToday(basis: keyof typeof DAY_BASES = 'utc'): string {
  const { keyOf, msUntilNext } = DAY_BASES[basis];
  const [today, setToday] = useState(() => keyOf(new Date()));
  useFocusEffect(
    useCallback(
      () => watchDay({ onDay: setToday, subscribeVisibility: subscribeAppVisibility, keyOf, msUntilNext }),
      [keyOf, msUntilNext],
    ),
  );
  return today;
}
