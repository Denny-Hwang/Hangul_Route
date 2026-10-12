import type { UiLocale } from '@hangul-route/i18n';
import type { GrownUpHandoffRequest } from '../logic/shell/handoff-rules';

/**
 * Native stub of the grown-up hand-off (F-APP-001 section 3.9, OD-6): the grown-up area lives on
 * the web app host only and native builds show no grown-up entry, so nothing native calls these;
 * the two that would navigate throw so a wrong call is caught in tests. There is no
 * `sessionStorage` on native, so clearing is a no-op. The web variant is
 * `grown-up-handoff.web.ts`.
 */
export type HandoffResult = 'opened' | 'pin';

const WEB_ONLY = 'The grown-up hand-off is web only (F-APP-001 OD-6)';

export async function openGrownUpArea(_request: GrownUpHandoffRequest): Promise<HandoffResult> {
  throw new Error(WEB_ONLY);
}

export function continueToGrownUpPage(_target: string | null | undefined, _locale?: UiLocale): void {
  throw new Error(WEB_ONLY);
}

export function clearGrownUpTab(): void {
  // Nothing to clear on native.
}
