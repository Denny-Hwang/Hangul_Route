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
  | 'entitlement.manage';

export type Actor =
  | { kind: 'learner'; learnerId: string }
  | { kind: 'account'; accountId: string; memberships: Membership[] };

export type AccountActor = Extract<Actor, { kind: 'account' }>;

/** A space with its parent (a class under a school) so school roles cascade. */
export interface SpaceContext {
  space: Space;
  parent: Space | null;
}

export type Target = { kind: 'space'; ctx: SpaceContext } | { kind: 'learner'; learnerId: string; spaces: SpaceContext[] };

const BASE: Record<SpaceKind, Partial<Record<SpaceRole, readonly Action[]>>> = {
  family: { caregiver: ['summary.read', 'snapshot.read', 'plan.write', 'roster.manage'] },
  class: { teacher: ['summary.read', 'plan.write', 'roster.manage'] },
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
  }
  if (ctx.parent?.kind === 'school') {
    const above = roleIn(actor, ctx.parent.id);
    if (above === 'owner' || above === 'admin') {
      out.add('summary.read');
      out.add('roster.manage');
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
