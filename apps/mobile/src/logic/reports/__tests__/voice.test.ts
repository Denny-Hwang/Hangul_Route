import { describe, expect, it } from 'vitest';
import { reportVoice } from '../voice';

/**
 * F-REPORT-001 section 5, RP-9: `reportVoice` decides the in-app report's voice (OD-17). The helper takes no
 * session input, so an open grown-up session can never change the answer.
 */
const child = (id: string) => ({ id, role: 'learner' as const, learnerType: 'child' as const });
const self = (id: string) => ({ id, role: 'learner' as const, learnerType: 'self' as const });
const parent = (id: string) => ({ id, role: 'parent' as const });

describe('reportVoice', () => {
  it('a family device (a child profile on it) reads the third person, whoever is active', () => {
    const profiles = [parent('profile:p'), child('profile:kid'), self('profile:mom')];
    expect(reportVoice({ profiles, activeProfileId: 'profile:kid', profileId: 'profile:kid' })).toBe('third');
    expect(reportVoice({ profiles, activeProfileId: 'profile:mom', profileId: 'profile:mom' })).toBe('third');
  });

  it('a self-only device viewing another self profile reads the third person', () => {
    const profiles = [self('profile:a'), self('profile:b')];
    expect(reportVoice({ profiles, activeProfileId: 'profile:a', profileId: 'profile:b' })).toBe('third');
  });

  it('a self-only device viewing the active profile reads the second person', () => {
    const profiles = [self('profile:a'), self('profile:b')];
    expect(reportVoice({ profiles, activeProfileId: 'profile:a', profileId: 'profile:a' })).toBe('second');
    // The input has no session field: the same call answers the same with or without an open grown-up session.
    expect(reportVoice({ profiles: [self('profile:a')], activeProfileId: 'profile:a', profileId: 'profile:a' })).toBe('second');
  });

  it('a device with only grown-up profiles, or no active profile, reads the third person', () => {
    expect(reportVoice({ profiles: [parent('profile:p')], activeProfileId: 'profile:p', profileId: 'profile:p' })).toBe('third');
    expect(reportVoice({ profiles: [self('profile:a')], activeProfileId: null, profileId: 'profile:a' })).toBe('third');
  });

  it('a profile without a learner type reads as a child (the conservative branch), so the third person', () => {
    const profiles = [{ id: 'profile:old', role: 'learner' as const }];
    expect(reportVoice({ profiles, activeProfileId: 'profile:old', profileId: 'profile:old' })).toBe('third');
  });
});
