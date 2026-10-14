import { describe, expect, it, vi } from 'vitest';
import type { MissionCard } from '../homework/mission-builder';

// A shipped lesson cell's glosses, as lessons-index.ts would carry them (F-CURR-001 §3.10).
vi.mock('../../content/lessons', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../content/lessons')>();
  return {
    ...original,
    lessonIndexOverlays: {
      es: { 'quest:stage2-letters-q1': { titleEn: 'Constructor de palabras 1' }, 'episode:stage2-letters': { titleEn: 'Constructor de palabras' } },
      ko: { 'quest:stage2-letters-q1': { titleEn: '낱말 만들기 1' } },
    },
  };
});

const { localizeMissionCard, localizeTitle } = await import('../content-locale');

describe('lesson glosses reach every title helper by default (F-CURR-001 §3.10)', () => {
  const card: MissionCard = {
    slot: 2,
    kind: 'new',
    titleEn: 'Word Builder 1',
    subtitle: 'new',
    questId: 'quest:stage2-letters-q1',
    episodeId: 'episode:stage2-letters',
    collected: false,
  } as MissionCard;

  it('localizeMissionCard shows a lesson quest title in Spanish and Korean, English as built', () => {
    expect(localizeMissionCard(card, 'es').titleEn).toBe('Constructor de palabras 1');
    expect(localizeMissionCard(card, 'ko').titleEn).toBe('낱말 만들기 1');
    expect(localizeMissionCard(card, 'en')).toBe(card);
  });

  it('localizeTitle (notes, the Results teaser) reads the same glosses', () => {
    expect(localizeTitle({ titleEn: 'Word Builder' }, 'episode:stage2-letters', 'es').titleEn).toBe('Constructor de palabras');
  });
});
