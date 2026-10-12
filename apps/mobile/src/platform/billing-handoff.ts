import { consoleBillingUrl } from '../logic/paywall';
import type { OpenLinkOutcome } from '../logic/story/source-link';
import { openExternalUrl } from './external-link';

/**
 * The gate destination `Billing` (F-BILL-002 B-9, section 4.7): the learner Plan screen's web-only
 * Open billing hands today's console billing page to the browser through the safe hand-off Sources
 * uses. On the web that is a new tab opened inside the tap, with its opener cleared, and a blocked
 * tab is reported as `failed` so the screen can show the address to type. `openExternalUrl` is
 * called before anything is awaited, so the tap's user activation reaches `window.open`.
 * B-9b adds the same-tab `openGrownUpArea` branch behind `flags.grownUpHomeEnabled`.
 */
export async function openBilling(): Promise<{ outcome: OpenLinkOutcome; url: string }> {
  const url = consoleBillingUrl();
  const outcome = await openExternalUrl(url);
  return { outcome, url };
}
