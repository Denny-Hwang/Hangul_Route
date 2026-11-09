import { APP_VERSION } from '../config/app-version';
import { crashPayload, type CrashSurface } from '../logic/crash/crash-report';
import { track } from './telemetry';

/**
 * The top-level error boundaries' `onError` (the learner root, All lessons, the presenter): sends `app.crash` with no
 * profile id, then never throws, so a failing report can never turn one crash into two.
 */
export function reportCrash(error: unknown, surface: CrashSurface, route: string | undefined): void {
  try {
    void track({ name: 'app.crash', payload: crashPayload(error, { surface, route, appVersion: APP_VERSION }) }).catch(() => undefined);
  } catch {
    // Reporting is best effort.
  }
}
