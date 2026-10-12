import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(),
}));

import type { Profile } from '@hangul-route/content-schema';
import { PARENT_SESSION_MS } from '../../logic/profiles/session';
import { useAccountStore } from '../account-store';
import { gateOpensDirectlyNow } from '../gate-now';
import { useProfileStore } from '../profile-store';
import { useUiStore } from '../ui-store';

/** F-BILL-002 B-9 review: the one store-reading copy of the L7 gate rule, shared by Sources and the Plan screen. */
const learner = (learnerType: 'child' | 'self'): Profile => ({ role: 'learner', learnerType }) as unknown as Profile;

describe('gateOpensDirectlyNow', () => {
  beforeEach(() => {
    useUiStore.setState({ parentGateOpenedAt: null });
    useAccountStore.setState({ parentPinHash: null });
    useProfileStore.setState({ profiles: [] });
  });

  it('a family device with no open session goes through the PIN screen', () => {
    useProfileStore.setState({ profiles: [learner('child')] });
    useAccountStore.setState({ parentPinHash: 'hash' });
    expect(gateOpensDirectlyNow(1_000_000)).toBe(false);
  });

  it('reads the session the PIN screen just opened, and drops it once it has expired', () => {
    useProfileStore.setState({ profiles: [learner('child')] });
    useAccountStore.setState({ parentPinHash: 'hash' });
    useUiStore.setState({ parentGateOpenedAt: 1_000_000 });
    expect(gateOpensDirectlyNow(1_000_000 + 1)).toBe(true);
    expect(gateOpensDirectlyNow(1_000_000 + PARENT_SESSION_MS)).toBe(false);
  });

  it('a self-only device that never set a PIN opens directly', () => {
    useProfileStore.setState({ profiles: [learner('self')] });
    expect(gateOpensDirectlyNow(1_000_000)).toBe(true);
  });
});
