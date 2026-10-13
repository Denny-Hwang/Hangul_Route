import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { dayKey } from '../../logic/homework/mission-builder';
import { subscribeAppVisibility } from '../../platform/app-visibility';

/**
 * Today's UTC day key for a plan screen (F-PLAN-002 section 3.6: plan dates are UTC days). A
 * screen can stay mounted across midnight, so the day is read again whenever the screen comes
 * into focus and whenever the app comes back to the front.
 */
export function useToday(): string {
  const [today, setToday] = useState(() => dayKey(new Date().toISOString()));
  useFocusEffect(
    useCallback(() => {
      setToday(dayKey(new Date().toISOString()));
      return subscribeAppVisibility((visible) => {
        if (visible) setToday(dayKey(new Date().toISOString()));
      });
    }, []),
  );
  return today;
}
