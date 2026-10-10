import { describe, expect, it } from 'vitest';
import {
  deviceAudience,
  effectiveLearnerType,
  gateRequired,
  pinRequiredForNewProfile,
  requiredConsent,
} from '../learner-type';

const child = { role: 'learner', learnerType: 'child' } as const;
const self = { role: 'learner', learnerType: 'self' } as const;
const legacy = { role: 'learner' } as const;
const parent = { role: 'parent' } as const;

describe('effectiveLearnerType (L3)', () => {
  it('reads the stored value', () => {
    expect(effectiveLearnerType({ learnerType: 'self' })).toBe('self');
    expect(effectiveLearnerType({ learnerType: 'child' })).toBe('child');
  });

  it('treats an absent value as child, the conservative branch', () => {
    expect(effectiveLearnerType({})).toBe('child');
    expect(effectiveLearnerType({ learnerType: undefined })).toBe('child');
  });
});

describe('deviceAudience', () => {
  it('is family when there are no profiles', () => {
    expect(deviceAudience([])).toBe('family');
  });

  it('is self when every learner manages their own profile', () => {
    expect(deviceAudience([self])).toBe('self');
    expect(deviceAudience([self, self])).toBe('self');
  });

  it('is family when any learner is effectively a child', () => {
    expect(deviceAudience([child])).toBe('family');
    expect(deviceAudience([self, child])).toBe('family');
  });

  it('treats a learner without learnerType (legacy profile) as a child', () => {
    expect(deviceAudience([legacy])).toBe('family');
    expect(deviceAudience([self, legacy])).toBe('family');
  });

  it('ignores non-learner roles', () => {
    // A parent profile has no learnerType but is not a learner.
    expect(deviceAudience([parent, self])).toBe('self');
    expect(deviceAudience([{ role: 'teacher' }, { role: 'admin' }, self])).toBe('self');
  });

  it('is family when only non-learner profiles exist (no learner to relax for)', () => {
    expect(deviceAudience([parent])).toBe('family');
  });
});

describe('requiredConsent', () => {
  const none = { guardianAcceptedAt: null, selfAcceptedAt: null };
  const stamp = '2026-10-10T00:00:00.000Z';

  it('child needs guardian consent until a guardian has accepted', () => {
    expect(requiredConsent({ learnerType: 'child', ...none })).toBe('guardian');
    expect(requiredConsent({ learnerType: 'child', guardianAcceptedAt: stamp, selfAcceptedAt: null })).toBeNull();
  });

  it('a self attestation never covers a child', () => {
    expect(requiredConsent({ learnerType: 'child', guardianAcceptedAt: null, selfAcceptedAt: stamp })).toBe('guardian');
    expect(requiredConsent({ learnerType: 'child', guardianAcceptedAt: stamp, selfAcceptedAt: stamp })).toBeNull();
  });

  it('self needs self consent only when neither timestamp exists', () => {
    expect(requiredConsent({ learnerType: 'self', ...none })).toBe('self');
    expect(requiredConsent({ learnerType: 'self', guardianAcceptedAt: null, selfAcceptedAt: stamp })).toBeNull();
    expect(requiredConsent({ learnerType: 'self', guardianAcceptedAt: stamp, selfAcceptedAt: null })).toBeNull();
    expect(requiredConsent({ learnerType: 'self', guardianAcceptedAt: stamp, selfAcceptedAt: stamp })).toBeNull();
  });
});

describe('gateRequired (L7)', () => {
  it('is true on a family device even before a PIN exists', () => {
    expect(gateRequired({ profiles: [child], parentPinHash: null })).toBe(true);
    expect(gateRequired({ profiles: [], parentPinHash: null })).toBe(true);
    expect(gateRequired({ profiles: [legacy], parentPinHash: null })).toBe(true);
  });

  it('is false on a self-only device without a PIN', () => {
    expect(gateRequired({ profiles: [self], parentPinHash: null })).toBe(false);
  });

  it('is true whenever a PIN exists, whatever the audience', () => {
    expect(gateRequired({ profiles: [self], parentPinHash: 'salt:digest' })).toBe(true);
    expect(gateRequired({ profiles: [child], parentPinHash: 'salt:digest' })).toBe(true);
  });
});

describe('pinRequiredForNewProfile', () => {
  it('is required for a child profile on a device with no PIN', () => {
    expect(pinRequiredForNewProfile({ learnerType: 'child', parentPinHash: null })).toBe(true);
  });

  it('is not required once a PIN exists', () => {
    expect(pinRequiredForNewProfile({ learnerType: 'child', parentPinHash: 'salt:digest' })).toBe(false);
  });

  it('is optional for a self learner', () => {
    expect(pinRequiredForNewProfile({ learnerType: 'self', parentPinHash: null })).toBe(false);
    expect(pinRequiredForNewProfile({ learnerType: 'self', parentPinHash: 'salt:digest' })).toBe(false);
  });
});
