import type { Membership, Space, SpaceKind, SpaceRole } from '@hangul-route/content-schema';

/**
 * The one access function every space-aware route calls — F-SPACE-001 §3.4
 * (roadmap §3.1). Pure: callers pass the actor's memberships and the target's
 * spaces. A teacher can never obtain `snapshot.read`; the action simply does
 * not exist for class roles.
 */
export type Action =
  | 'snapshot.read'
  | 'snapshot.write'
  | 'summary.read'
  | 'plan.write'
  | 'roster.manage'
  | 'space.manage'
  | 'class.create'
  | 'teacher.invite'
  | 'entitlement.manage'
  | 'learner.delete'
  /** Fill a class slot (source or destination) of a class move (F-SPACE-002 T10, §4.5). Never implied by `roster.manage`, never the learner slot. */
  | 'learner.transfer'
  /**
   * Send a note to the space's students (F-FEEDBACK-001 section 6.1): the family owner, a family caregiver
   * only with the owner's grant (`ctx.sendGrant`, OD-17), a class teacher or owner. Never cascaded from a
   * school and never a school-level role (OD-6).
   */
  | 'feedback.send'
  /** Read, hide, report and block every note to a learner of the family: the family owner and every caregiver, granted or not. */
  | 'feedback.oversee';

export type Actor =
  | { kind: 'learner'; learnerId: string }
  | { kind: 'account'; accountId: string; memberships: Membership[] };

export type AccountActor = Extract<Actor, { kind: 'account' }>;

/** A space with its parent (a class under a school) so school roles cascade. */
export interface SpaceContext {
  space: Space;
  parent: Space | null;
  /**
   * Whether the family owner granted the acting account the right to send notes (a `feedback_send_grants`
   * row, F-FEEDBACK-001 OD-17). The route loads it with the membership so `can()` stays pure; absent = no grant.
   */
  sendGrant?: boolean;
}

export type Target = { kind: 'space'; ctx: SpaceContext } | { kind: 'learner'; learnerId: string; spaces: SpaceContext[] };

const BASE: Record<SpaceKind, Partial<Record<SpaceRole, readonly Action[]>>> = {
  family: { caregiver: ['summary.read', 'snapshot.read', 'plan.write', 'roster.manage'] },
  class: { teacher: ['summary.read', 'plan.write', 'roster.manage', 'learner.transfer'] },
  school: {
    admin: ['summary.read', 'roster.manage', 'space.manage', 'class.create', 'teacher.invite', 'entitlement.manage'],
    teacher: ['class.create'],
  },
};

/** The owner's membership row is `owner`; it acts as the kind's working role plus `space.manage`. */
const OWNER_AS: Record<SpaceKind, SpaceRole> = { family: 'caregiver', class: 'teacher', school: 'admin' };

function roleIn(actor: AccountActor, spaceId: string): SpaceRole | null {
  return actor.memberships.find((m) => m.spaceId === spaceId && m.memberKind === 'account' && m.memberId === actor.accountId)?.role ?? null;
}

export function allowedOnSpace(actor: AccountActor, ctx: SpaceContext): Set<Action> {
  const out = new Set<Action>();
  const role = roleIn(actor, ctx.space.id);
  if (role) {
    const effective = role === 'owner' ? OWNER_AS[ctx.space.kind] : role;
    for (const action of BASE[ctx.space.kind][effective] ?? []) out.add(action);
    if (role === 'owner') out.add('space.manage');
    // Deletion rights (F-TCH-001 §10.3): caregivers always; teachers only under school consent.
    if (ctx.space.kind === 'family' && effective === 'caregiver') out.add('learner.delete');
    if (ctx.space.kind === 'class' && effective === 'teacher' && ctx.space.settings.consentMode === 'school') out.add('learner.delete');
    // Notes from grown-ups (F-FEEDBACK-001 section 6.1). Not added through the school cascade below.
    if (ctx.space.kind === 'family' && effective === 'caregiver') {
      out.add('feedback.oversee');
      if (role === 'owner' || ctx.sendGrant === true) out.add('feedback.send');
    }
    if (ctx.space.kind === 'class' && effective === 'teacher') out.add('feedback.send');
  }
  if (ctx.parent?.kind === 'school') {
    const above = roleIn(actor, ctx.parent.id);
    if (above === 'owner' || above === 'admin') {
      out.add('summary.read');
      out.add('roster.manage');
      out.add('learner.transfer');
    }
  }
  return out;
}

export function can(actor: Actor, action: Action, target: Target): boolean {
  if (actor.kind === 'learner') {
    return target.kind === 'learner' && target.learnerId === actor.learnerId && (action === 'snapshot.read' || action === 'snapshot.write');
  }
  if (target.kind === 'space') return allowedOnSpace(actor, target.ctx).has(action);
  return target.spaces.some((ctx) => allowedOnSpace(actor, ctx).has(action));
}
