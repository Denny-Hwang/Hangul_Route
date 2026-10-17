import { PlacementBankSchema, PlacementTemplateSchema, type PlacementSource } from '@hangul-route/content-schema';
import { PLACEMENT_BANK, PLACEMENT_WARMUP } from '../../content/placement.generated';
import { skippedEvent } from './events';

/**
 * Where the level check is offered (F-PLC-001 section 3.10): the onboarding
 * fork after CreateProfile, the Home card and the Profile row. Every entry is
 * hidden while `flags.placementEnabled` is off, and when the bundled bank does
 * not parse (section 3.11: no dead end, the fork is skipped and nothing else
 * changes). The parent report's entry arrives with P-8.
 */

/** The generated bank and its warm-up parse (a failure is a development error; at runtime the check hides). */
export function placementBankReady(bank: unknown, warmup: unknown): boolean {
  return PlacementBankSchema.safeParse(bank).success && PlacementTemplateSchema.safeParse(warmup).success;
}

let bundledReady: boolean | null = null;

/** The bundled bank, parsed once per app session on first use. */
function bundledBankReady(): boolean {
  if (bundledReady === null) bundledReady = placementBankReady(PLACEMENT_BANK, PLACEMENT_WARMUP);
  return bundledReady;
}

/** Whether the entry points show: the flag first, so with it off the bank is never parsed. */
export function placementEntriesOn(enabled: boolean, bankReady: () => boolean = bundledBankReady): boolean {
  return enabled && bankReady();
}

/** Where CreateProfile goes next: the fork when the check is on (section 3.1 step 1), else as today. */
export function afterProfileCreated(entriesOn: boolean): 'PlacementInvite' | 'FirstQuestPreview' {
  return entriesOn ? 'PlacementInvite' : 'FirstQuestPreview';
}

/**
 * The same, for a first run that began at Welcome's "Got a class code?" (owner request 2026-10-16, item 8):
 * the profile and consent steps run unchanged, then Join a class opens with the new profile active (Home under
 * it). The level check stays in Profile for later. Any other start goes on as `afterProfileCreated`.
 */
export function profileCreatedNext(then: 'join' | undefined, entriesOn: boolean): 'JoinSpace' | 'PlacementInvite' | 'FirstQuestPreview' {
  return then === 'join' ? 'JoinSpace' : afterProfileCreated(entriesOn);
}

export type InviteChoice = 'new' | 'knowSome';

export type InviteOutcome =
  /** "I am new to Korean": FirstQuestPreview, unchanged; only `placement-ui.declinedAt` is written. */
  | { kind: 'declined'; declinedAt: string; event: ReturnType<typeof skippedEvent> }
  /** "I already know some Korean": the check opens; nothing is recorded until a result. */
  | { kind: 'check'; params: { source: PlacementSource } };

export function inviteOutcome(choice: InviteChoice, profileId: string, nowIso: string): InviteOutcome {
  if (choice === 'new') return { kind: 'declined', declinedAt: nowIso, event: skippedEvent(profileId, 'onboarding') };
  return { kind: 'check', params: { source: 'onboarding' } };
}

/** Completed quests of a snapshot (any star count): the Home card hides after three. */
export function questsDoneOf(quests: readonly { completedAt?: string }[] | undefined): number {
  return (quests ?? []).filter((q) => q.completedAt !== undefined).length;
}
