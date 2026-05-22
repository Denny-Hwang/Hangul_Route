import { describe, expect, it } from 'vitest';
import { nextStatusForEvent } from '../subscription-events';

describe('nextStatusForEvent', () => {
  it('activates on renewal and recovery', () => {
    expect(nextStatusForEvent('renewed')).toBe('active');
    expect(nextStatusForEvent('recovered')).toBe('active');
  });

  it('marks cancellation without ending access', () => {
    expect(nextStatusForEvent('cancelled')).toBe('cancelled');
  });

  it('expires on expiry and refund', () => {
    expect(nextStatusForEvent('expired')).toBe('expired');
    expect(nextStatusForEvent('refunded')).toBe('expired');
  });
});
