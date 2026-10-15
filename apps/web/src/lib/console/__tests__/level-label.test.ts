import { LEARNER_LEVEL_IDS } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { levelPillLabel } from '../level-label';

describe('roster level pill (F-LEARN-001 §3.7)', () => {
  it('shows the plain-language label of each stored level id', () => {
    expect(LEARNER_LEVEL_IDS.map((id) => levelPillLabel(id, 'en'))).toEqual(['Pictures first', 'Some reading', 'Reads easily']);
  });

  it('in the console locale, so a Spanish or Korean console shows no English pill (F-I18N-001 §10 reason (1)(d))', () => {
    expect(LEARNER_LEVEL_IDS.map((id) => levelPillLabel(id, 'es'))).toEqual(['Primero imágenes', 'Algo de lectura', 'Lee con facilidad']);
    expect(LEARNER_LEVEL_IDS.map((id) => levelPillLabel(id, 'ko'))).toEqual(['그림 먼저', '조금 읽어요', '술술 읽어요']);
  });

  it('hides the pill for an id this build does not know', () => {
    expect(levelPillLabel('12-14', 'en')).toBeNull();
    expect(levelPillLabel('', 'ko')).toBeNull();
  });

  it('never prints an age or an age range', () => {
    for (const id of LEARNER_LEVEL_IDS) {
      const label = levelPillLabel(id, 'en') ?? '';
      expect(label).not.toMatch(/\bage/i);
      expect(label).not.toMatch(/\d/);
    }
  });
});
