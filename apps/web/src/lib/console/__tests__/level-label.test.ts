import { LEARNER_LEVEL_IDS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { levelPillLabel } from '../level-label';

describe('roster level pill (F-LEARN-001 §3.7)', () => {
  it('shows the plain-language label of each stored level id', () => {
    expect(LEARNER_LEVEL_IDS.map((id) => levelPillLabel(id))).toEqual(['Pictures first', 'Some reading', 'Reads easily']);
  });

  it('hides the pill for an id this build does not know', () => {
    expect(levelPillLabel('12-14')).toBeNull();
    expect(levelPillLabel('')).toBeNull();
  });

  it('never prints an age or an age range', () => {
    for (const id of LEARNER_LEVEL_IDS) {
      const label = levelPillLabel(id) ?? '';
      expect(label).not.toMatch(/\bage/i);
      expect(label).not.toMatch(/\d/);
    }
  });
});
