import type { SpaceKind } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { TelemetryEvent } from '../platform/telemetry';
import type { DeviceAudience } from './profiles/learner-type';

/**
 * The learner's way to the grown-up at the free limit (F-ENT-003 section 3.7, the ask table;
 * wireframe episode/detail-access-preview). The ask appears only after a learner taps a lesson
 * or tile that is not open yet, and once at the end of the free lessons (section 3.15): the
 * episode page's preview card, a closed Library tile's hint, and the free-end card.
 *
 * Pure: the device audience, the learner's memberships and the gate state come in as values.
 */

/** Who the ask names: the family, the class (teacher or grown-up), or the learner on a self-only device. */
export type AskAudience = 'family' | 'class' | 'self';

/** The surface the ask was pressed on (`access.help_asked.from`, and the Plan screen's `from`). */
export type AskFrom = 'episode' | 'home' | 'results' | 'library';

/** True when the learner has space memberships and every one is a class or a school. */
export function isClassOnly(memberships: readonly { kind: SpaceKind }[]): boolean {
  return memberships.length > 0 && memberships.every((m) => m.kind === 'class' || m.kind === 'school');
}

/** A self-only device always reads `self`; a family device reads `class` when the learner is only in classes. */
export function askAudienceOf(audience: DeviceAudience, classOnly: boolean): AskAudience {
  if (audience === 'self') return 'self';
  return classOnly ? 'class' : 'family';
}

/** The ask button's label by device and learner; `self` never says "grown-up". */
export function askFor(
  audience: DeviceAudience,
  classOnly: boolean,
  m: Messages['learner']['access'],
): { audience: AskAudience; label: string } {
  const who = askAudienceOf(audience, classOnly);
  return { audience: who, label: m.ask[who] };
}

/**
 * Where the ask goes: the Plan screen (route key `Paywall`, F-BILL-002 section 4.7), directly
 * when the gate opens directly (a self-only device with no PIN, or an open grown-up session),
 * else through the PIN screen. The Plan screen is attributed to the surface that asked.
 */
export type AskGate =
  | { route: 'Paywall'; params: { from: AskFrom } }
  | { route: 'PinEntry'; params: { next: 'Paywall'; from: AskFrom } };

export function askGate(opensDirectly: boolean, from: AskFrom): AskGate {
  return opensDirectly ? { route: 'Paywall', params: { from } } : { route: 'PinEntry', params: { next: 'Paywall', from } };
}

/** `access.help_asked { from, audience }`, sent when the ask is pressed, before the gate (section 3.12). */
export function helpAskedEvent(profileId: string | undefined, from: AskFrom, audience: AskAudience): TelemetryEvent {
  return { name: 'access.help_asked', ...(profileId === undefined ? {} : { profileId }), payload: { from, audience } };
}
