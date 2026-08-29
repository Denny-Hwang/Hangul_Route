import { describe, expect, it } from 'vitest';
import { statusFromVerification, verifyReceiptStub, type VerificationResult } from '../receipt';

describe('verifyReceiptStub (dev stub)', () => {
  it('accepts a well-formed JSON receipt', () => {
    const receipt = JSON.stringify({ plan: 'yearly', expiresAt: '2027-01-01T00:00:00.000Z' });
    const result = verifyReceiptStub('apple', receipt);
    expect(result.valid).toBe(true);
    expect(result.plan).toBe('yearly');
    expect(result.store).toBe('apple');
    expect(result.expiresAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('rejects garbage, missing plan, or missing expiry', () => {
    expect(verifyReceiptStub('apple', 'not-json').valid).toBe(false);
    expect(verifyReceiptStub('google', JSON.stringify({ plan: 'weekly', expiresAt: '2027-01-01T00:00:00.000Z' })).valid).toBe(false);
    expect(verifyReceiptStub('google', JSON.stringify({ plan: 'monthly' })).valid).toBe(false);
  });
});

describe('statusFromVerification (pure)', () => {
  const now = new Date('2026-05-22T00:00:00.000Z');

  it('is active when expiry is in the future', () => {
    const result: VerificationResult = { valid: true, plan: 'monthly', store: 'apple', expiresAt: '2026-06-22T00:00:00.000Z' };
    expect(statusFromVerification(result, now)).toBe('active');
  });

  it('is expired when expiry is in the past', () => {
    const result: VerificationResult = { valid: true, plan: 'monthly', store: 'apple', expiresAt: '2026-04-22T00:00:00.000Z' };
    expect(statusFromVerification(result, now)).toBe('expired');
  });

  it('is expired when the result is invalid', () => {
    const result: VerificationResult = { valid: false, plan: null, store: null, expiresAt: null };
    expect(statusFromVerification(result, now)).toBe('expired');
  });
});
