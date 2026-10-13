import type { DeviceAccount } from '../logic/dashboard-free-line';

/**
 * The grown-up account signed in on this device, as the learner app sees it (F-ENT-003 row E3-12b,
 * the standing default of its open question: the dashboard free-lessons line shows only when the
 * device's signed-in account owns the learner's space, and never without a signed-in account).
 *
 * The learner app holds no grown-up sign-in. On the web the grown-up session lives in the console
 * pages, and every learner boot clears it from this tab (F-APP-001 section 3.9, `clearGrownUpTab`),
 * so a child on a shared browser never inherits it; native builds have no grown-up sign-in at all
 * (F-APP-001 OD-6). So no account is signed in here, and the row stays hidden on every device. A
 * device-side account source, if the owner decides on one, answers here and nowhere else.
 */
export function signedInAccount(): DeviceAccount | null {
  return null;
}
