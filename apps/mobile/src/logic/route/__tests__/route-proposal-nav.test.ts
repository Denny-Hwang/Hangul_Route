import { describe, expect, expectTypeOf, it } from 'vitest';
import type { GrownUpDestination, RootStackParamList } from '../../../navigation/types';
import type { PlanChoice, ProposalSource } from '../proposal-flow';
import type { SetupState } from '../setup-flow';

/**
 * F-PLAN-002 section 3.9 (P2-7a): the proposal is a root screen with its source and profile, and
 * the grown-up gate can continue to it for a child profile's Profile row. A type-checker fixture:
 * `pnpm run typecheck` (tsc includes `__tests__`) fails if the screen or the destination goes.
 */
describe('RouteProposal navigation', () => {
  it('takes a source and a profile, and is a grown-up gate destination', () => {
    // `proposedSent`: the door already counted `route.proposed` (F-PLC-001 P-7b, the result strip's and report card's Change).
    expectTypeOf<RootStackParamList['RouteProposal']>().toEqualTypeOf<{ source: ProposalSource; profileId: string; proposedSent?: true }>();
    expectTypeOf<'RouteProposal'>().toMatchTypeOf<GrownUpDestination>();
    const gate: RootStackParamList['PinEntry'] = { next: 'RouteProposal', profileId: 'profile:a' };
    const sources: ProposalSource[] = ['placement', 'home', 'profile', 'parent'];
    expect([gate.next, sources.length]).toEqual(['RouteProposal', 4]);
  });

  it('P2-7b: set-up, preview and overview are root screens, and the gate continues to the set-up', () => {
    expectTypeOf<RootStackParamList['RouteSetup']>().toEqualTypeOf<{ profileId: string; choice?: PlanChoice }>();
    expectTypeOf<RootStackParamList['RoutePreview']>().toEqualTypeOf<{ profileId: string; setup: SetupState; replacing: string | null }>();
    expectTypeOf<RootStackParamList['RouteOverview']>().toEqualTypeOf<{ profileId: string; viewer?: 'grownup' }>();
    expectTypeOf<'RouteSetup'>().toMatchTypeOf<GrownUpDestination>();
    const gate: RootStackParamList['PinEntry'] = { next: 'RouteSetup', profileId: 'profile:a' };
    expect(gate.next).toBe('RouteSetup');
  });

  it('a child\'s Stop this plan goes through the gate back to the overview', () => {
    expectTypeOf<'RouteOverview'>().toMatchTypeOf<GrownUpDestination>();
    const gate: RootStackParamList['PinEntry'] = { next: 'RouteOverview', profileId: 'profile:a' };
    expect(gate.next).toBe('RouteOverview');
  });
});
