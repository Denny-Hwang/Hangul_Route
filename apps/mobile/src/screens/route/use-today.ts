import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { utcDayKey, watchDay } from '../../logic/day-clock';
import { subscribeAppVisibility } from '../../platform/app-visibility';

/**
 * Today's UTC day key for a plan screen (F-PLAN-002 section 3.6: plan dates are UTC days). A
 * screen can stay mounted across midnight, so the day is read again whenever the screen comes
 * into focus, whenever the app comes back to the front, and at the next UTC midnight while the
 * screen is in focus (F-ROUTE-001 R-7e; `logic/day-clock.ts`).
 */
export function useToday(): string {
  const [today, setToday] = useState(() => utcDayKey(new Date()));
  useFocusEffect(useCallback(() => watchDay({ onDay: setToday, subscribeVisibility: subscribeAppVisibility }), []));
  return today;
}
