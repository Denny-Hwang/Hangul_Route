import { APP_ROUTES } from '@hangul-route/content-schema';
import { bundleOs, flags, type Flags } from '../config/flags';
import { consoleBillingUrl, type BillingOpenResult } from '../logic/paywall';
import type { GrownUpHandoffRequest } from '../logic/shell/handoff-rules';
import { openExternalUrl } from './external-link';
import { openGrownUpArea } from './grown-up-handoff';

/**
 * The Plan screen's billing page in the grown-up area (F-BILL-002 B-9b, F-APP-001 section 3.9): the
 * same-tab hand-off's request. `via` is `plan` in the shipped schema (renamed from `paywall`).
 */
export const BILLING_HANDOFF: GrownUpHandoffRequest = { via: 'plan', target: APP_ROUTES.billing };

/**
 * Whether Open billing hands off in the same tab (B-9b): the web with `flags.grownUpHomeEnabled` on.
 * Native builds never do (the grown-up hand-off is web only, F-APP-001 OD-6), and they render no
 * Open billing anyway (`planView`, section 4.8).
 */
export function billingOpensSameTab(
  f: Pick<Flags, 'grownUpHomeEnabled'> = flags,
  os: string | undefined = bundleOs(),
): boolean {
  return f.grownUpHomeEnabled && os === 'web';
}

/**
 * The gate destination `Billing` (F-BILL-002 section 4.7): the learner Plan screen's web-only Open
 * billing.
 *
 * - B-9b, flag on: `openGrownUpArea(BILLING_HANDOFF)` in the **same tab**. It writes F-APP-001's
 *   per-tab unlock (so `/account/billing` opens without the "Grown-ups only" lock, and the unlock
 *   survives the Stripe round trip), sends `shell.grown_up_handoff { via: 'plan', target: 'billing' }`
 *   and leaves; `pin` means a fresh PIN is needed first and nothing was written.
 * - B-9, flag off: today's console billing page through the safe hand-off Sources uses. On the web
 *   that is a new tab opened inside the tap, with its opener cleared, and a blocked tab is reported as
 *   `failed` so the screen can show the address to type. `openExternalUrl` is called before anything
 *   is awaited, so the tap's user activation reaches `window.open`. The billing base must be `https:`
 *   (`EXPO_PUBLIC_CONSOLE_URL`, default hangulroute.com): an `http://localhost` console in a dev
 *   build comes back as `failed` and the screen shows the address to type instead of opening it.
 */
export async function openBilling(sameTab: boolean = billingOpensSameTab()): Promise<BillingOpenResult> {
  if (sameTab) return { kind: 'same-tab', outcome: await openGrownUpArea(BILLING_HANDOFF) };
  const url = consoleBillingUrl();
  const outcome = await openExternalUrl(url);
  return { kind: 'browser', outcome, url };
}
