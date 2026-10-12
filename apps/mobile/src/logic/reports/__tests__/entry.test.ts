import { describe, expect, it } from 'vitest';
import { reportEntry } from '../entry';

/** F-REPORT-001 section 3.9 (RP-9): See report opens the report while the gate opens directly, else the PIN screen first. */
describe('reportEntry', () => {
  it('the gate open (a live session, or a self-only device without a PIN): straight to the report', () => {
    expect(reportEntry('profile:sam', true)).toEqual({ screen: 'LearnerReport', params: { profileId: 'profile:sam' } });
  });

  it('the gate closed (the 15-minute session lapsed): the PIN screen, which continues to that report', () => {
    expect(reportEntry('profile:sam', false)).toEqual({ screen: 'PinEntry', params: { next: 'LearnerReport', profileId: 'profile:sam' } });
  });
});
