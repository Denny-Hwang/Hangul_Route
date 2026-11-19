import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import { en as webEn } from '../messages/en/index.web';

/**
 * AMENDMENTS-FINISH-2026-11 FN-7: the learner PWA's English twin (`messages/en/index.web.ts`, picked by Metro's web build
 * only) is the dictionary without the public site's `landing` namespace; every other namespace is the same object.
 */
describe('the learner PWA English twin (FN-7)', () => {
  it('has every namespace of the dictionary, the same objects, but landing', () => {
    expect(Object.keys(webEn)).toEqual(Object.keys(en));
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      if (key === 'landing') continue;
      expect(webEn[key], key).toBe(en[key]);
    }
  });

  it('landing is empty there', () => {
    expect(webEn.landing).toEqual({});
    expect(Object.keys(en.landing).length).toBeGreaterThan(0);
  });
});
