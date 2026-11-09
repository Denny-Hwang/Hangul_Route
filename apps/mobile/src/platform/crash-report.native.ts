import { APP_VERSION } from '../config/app-version';
import { ACCOUNT_ROUTE_NAMES } from '../logic/account/account-gate';
import { crashPayload, type CrashSurface } from '../logic/crash/crash-report';
import { track } from './telemetry';

/**
 * The iOS and Android twin of `crash-report.ts` (Metro resolves `.native` first; the web build never sees this file,
 * so its start bundle is unchanged). The top-level error boundaries' `onError` sends `app.crash` with no profile id,
 * then never throws, as the shared module does, with one rule more:
 *
 * F-AUTH-004 CS-N15 (row NS-7): a crash on an account route (`ACCOUNT_ROUTE_NAMES`: the sign-in, the homes, the class
 * and school pages and both reports) sends `message: ''`, only the route and the error class names, so no name, email,
 * code or space name an account screen drew can leave the device in an error's text. The shared scrub removes links,
 * addresses and long numbers only, and a render error's message may quote what the screen held. Found by the NS-7
 * suite: the learner root's boundary (`App.tsx`) reported an account route's crash with its scrubbed message.
 */
export function reportCrash(error: unknown, surface: CrashSurface, route: string | undefined): void {
  try {
    const payload = crashPayload(error, { surface, route, appVersion: APP_VERSION });
    const sent = route !== undefined && ACCOUNT_ROUTE_NAMES.has(route) ? { ...payload, message: '' } : payload;
    void track({ name: 'app.crash', payload: sent }).catch(() => undefined);
  } catch {
    // Reporting is best effort.
  }
}
