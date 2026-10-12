import { useEffect, useState } from 'react';
import { isOnline, subscribeOnline } from '../platform/online';

/**
 * Whether the browser says it is online, kept current by the `online` / `offline` events
 * (F-APP-001 sections 3.6 and 3.12: the grown-up entries are disabled offline and re-enable on
 * `online`). Native builds always answer true (`platform/online.ts`).
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline);
  useEffect(() => {
    setOnline(isOnline());
    return subscribeOnline(setOnline);
  }, []);
  return online;
}
