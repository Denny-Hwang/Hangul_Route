import { describe, expect, expectTypeOf, it } from 'vitest';
import type { GrownUpDestination, RootStackParamList } from '../../../navigation/types';
import type { ProposalSource } from '../proposal-flow';

/**
 * F-PLAN-002 section 3.9 (P2-7a): the proposal is a root screen with its source and profile, and
 * the grown-up gate can continue to it for a child profile's Profile row. A type-checker fixture:
 * `pnpm run typecheck` (tsc includes `__tests__`) fails if the screen or the destination goes.
 */
describe('RouteProposal navigation', () => {
  it('takes a source and a profile, and is a grown-up gate destination', () => {
    expectTypeOf<RootStackParamList['RouteProposal']>().toEqualTypeOf<{ source: ProposalSource; profileId: string }>();
    expectTypeOf<'RouteProposal'>().toMatchTypeOf<GrownUpDestination>();
    const gate: RootStackParamList['PinEntry'] = { next: 'RouteProposal', profileId: 'profile:a' };
    const sources: ProposalSource[] = ['placement', 'home', 'profile', 'parent'];
    expect([gate.next, sources.length]).toEqual(['RouteProposal', 4]);
  });
});
