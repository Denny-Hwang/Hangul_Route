import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

/**
 * Follow-ups of the Home and i18n round (2026-10-13): the locked look of a pinned Home card
 * (F-STORY-004 PR 4.8f), the Hoya pose words of `a11y.hoya` per locale (review of #594),
 * the gender-neutral Spanish collected word (review of #579) and the quoted option name of the
 * Speed Round screen-reader line (review of #496).
 */

/** The `HoyaPose` union of the design system (`components/Hoya/types.ts`); the mobile lane pins the two lists equal. */
const POSES = ['idle', 'cheering', 'thinking', 'reading', 'waving'] as const;
const LOCALES = ['en', 'es', 'ko'] as const;

describe('learner.home.lockedCard (F-STORY-004 PR 4.8f)', () => {
  it('adds the Not open yet word of the access glossary to the card label in every locale', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale);
      const label = m.learner.home.lockedCard.a11y(m.a11y.missionCard('Meet Hoya', 'Say hello', false));
      expect(label.startsWith('Meet Hoya. Say hello.')).toBe(true);
      expect(label).toContain(m.learner.access.notOpen);
      expect(label.endsWith('.')).toBe(true);
    }
  });

  it('reads the exact wording', () => {
    expect(getMessages('en').learner.home.lockedCard.a11y('A. B.')).toBe('A. B. Not open yet.');
    expect(getMessages('es').learner.home.lockedCard.a11y('A. B.')).toBe('A. B. Aún sin abrir.');
    expect(getMessages('ko').learner.home.lockedCard.a11y('A. B.')).toBe('A. B. 아직 안 열렸어요.');
  });

  it('never says locked, a price or a product name', () => {
    for (const locale of LOCALES) {
      const label = getMessages(locale).learner.home.lockedCard.a11y('x.');
      expect(label).not.toMatch(/lock|bloque|잠|premium|plan|\$/i);
    }
  });
});

describe('a11y.hoya pose words per locale (review of #594)', () => {
  it('every locale names every pose of the design-system union', () => {
    for (const locale of LOCALES) {
      expect(Object.keys(getMessages(locale).a11y.hoyaPose).sort()).toEqual([...POSES].sort());
    }
  });

  it('English keeps its labels as shipped', () => {
    const m = getMessages('en');
    for (const pose of POSES) expect(m.a11y.hoya(pose)).toBe(`Hoya the tiger, ${pose}`);
  });

  it('es and ko labels carry no English pose token, for every pose', () => {
    const token = new RegExp(`\\b(${POSES.join('|')})\\b`, 'i');
    for (const locale of ['es', 'ko'] as const) {
      const m = getMessages(locale);
      for (const pose of POSES) {
        const label = m.a11y.hoya(pose);
        expect(label, `${locale} ${pose}`).not.toMatch(token);
        expect(label).toContain(m.a11y.hoyaPose[pose]);
      }
    }
  });

  it('reads the exact Spanish and Korean labels', () => {
    expect(getMessages('es').a11y.hoya('cheering')).toBe('Hoya, el tigre, celebrando');
    expect(getMessages('es').a11y.hoya('waving')).toBe('Hoya, el tigre, saludando');
    expect(getMessages('ko').a11y.hoya('thinking')).toBe('호랑이 호야, 생각해요');
    expect(getMessages('ko').a11y.hoya('reading')).toBe('호랑이 호야, 책을 읽어요');
  });

  it('an unknown pose never puts an English token into es or ko', () => {
    expect(getMessages('es').a11y.hoya('dancing')).toBe('Hoya, el tigre');
    expect(getMessages('ko').a11y.hoya('dancing')).toBe('호랑이 호야');
    expect(getMessages('en').a11y.hoya('dancing')).toBe('Hoya the tiger, dancing');
  });
});

describe('Spanish wording nits', () => {
  const es = getMessages('es');

  it('the collected word is gender-neutral (review of #579)', () => {
    expect(es.a11y.missionCard('A', 'B', true)).toBe('A. B. Hecho.');
    expect(es.a11y.vocabMissionCard('A', 'B', true)).toBe('A. B. Hecho. Abre una ronda rápida.');
    expect(es.a11y.missionCard('A', 'B', false)).toBe('A. B.');
  });

  it('the Speed Round screen-reader line quotes the option name (review of #496)', () => {
    const line = es.learner.vocab.speed.challenge.screenReaderLine;
    expect(line).toBe('Ya elegimos «El doble» para ti. Puedes cambiarlo.');
    expect(line).toContain(`«${es.learner.vocab.speed.challenge.scale.twice}»`);
  });
});
