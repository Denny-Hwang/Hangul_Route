import type { HeritageCard, Jamo } from '@hangul-route/content-schema';
import { findBannedWord, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { heritageCardsAll } from '../../../content/heritage-cards';
import { jamoAll } from '../../../content/jamo';
import {
  PRIZE_STAGE,
  opensStagePrize,
  ownsStagePrize,
  stageCompleteActions,
  stagePrizeCards,
  symbolWall,
  wallTileLabel,
} from '../stage-complete';

const m = getMessages('en');

describe('opensStagePrize: when Results offers the Stage 1 prize', () => {
  it('is true only on the run that completed Stage 1', () => {
    expect(opensStagePrize({ stageCompleted: 'stage1' })).toBe(true);
  });

  it('is false before the outcome is decided, on an ordinary run and for another stage', () => {
    expect(opensStagePrize(null)).toBe(false);
    expect(opensStagePrize({ stageCompleted: null })).toBe(false);
    expect(opensStagePrize({ stageCompleted: 'stage2' })).toBe(false);
  });

  it('names Stage 1 as the one stage with a ceremony', () => {
    expect(PRIZE_STAGE).toBe('stage1');
  });
});

describe('symbolWall: the 30 symbols, every one lit', () => {
  const wall = symbolWall();

  it('holds every one of the 30 anchor symbols exactly once', () => {
    expect(wall).toHaveLength(30);
    expect(new Set(wall.map((t) => t.id)).size).toBe(30);
    expect(new Set(wall.map((t) => t.id))).toEqual(new Set(jamoAll.map((j) => j.id)));
  });

  it('is a fixed order: 14 consonants, then 10 vowels, then 6 finals, each by its content order', () => {
    expect(wall.slice(0, 14).every((t) => t.kind === 'consonant')).toBe(true);
    expect(wall.slice(14, 24).every((t) => t.kind === 'vowel')).toBe(true);
    expect(wall.slice(24).every((t) => t.kind === 'batchim')).toBe(true);
    expect(wall.slice(0, 3).map((t) => t.char)).toEqual(['ㄱ', 'ㄴ', 'ㄷ']);
    expect(wall[14]?.char).toBe('ㅏ');
    expect(wall[24]?.id).toBe('jamo:giyeok-batchim');
  });

  it('sorts by kind and order whatever order the jamo arrive in', () => {
    const shuffled = [...jamoAll].reverse();
    expect(symbolWall(shuffled).map((t) => t.id)).toEqual(wall.map((t) => t.id));
  });

  it('lights every tile (fill-only: nothing on the wall is unlit or counted)', () => {
    expect(wall.every((t) => t.lit)).toBe(true);
  });

  it('carries the glyph and its romanization, ㅇ as silent/ng, never the empty-set sign', () => {
    const ieung = wall.find((t) => t.id === 'jamo:ieung');
    expect(ieung).toMatchObject({ char: 'ㅇ', romanization: 'silent/ng' });
    expect(wall.some((t) => t.romanization.includes('∅'))).toBe(false);
    expect(wall.find((t) => t.id === 'jamo:nieun-batchim')).toMatchObject({ char: 'ㄴ', romanization: 'n', kind: 'batchim' });
  });

  it('leaves out a symbol that is not one of the three kinds (never a crash)', () => {
    const odd = { ...jamoAll[0], id: 'jamo:odd', kind: 'other' } as unknown as Jamo;
    expect(symbolWall([odd, ...jamoAll])).toHaveLength(30);
  });
});

describe('wallTileLabel: what a screen reader says for a tile', () => {
  it('reads a letter by its sound value and its sound hint, a final as a final, never the glyph alone', () => {
    const wall = symbolWall();
    const g = wall.find((t) => t.id === 'jamo:giyeok');
    const finalN = wall.find((t) => t.id === 'jamo:nieun-batchim');
    expect(wallTileLabel(g!, m.a11y)).toBe('Korean letter g/k. a soft, light g (between g and k)');
    expect(wallTileLabel(finalN!, m.a11y)).toBe('Korean final consonant n');
  });

  it('glosses ㅇ with its hint, so silent/ng is never read alone', () => {
    const ieung = symbolWall().find((t) => t.id === 'jamo:ieung');
    expect(wallTileLabel(ieung!, m.a11y)).toBe('Korean letter silent/ng. silent at the start of a block; "ng" in "sing" at the end');
  });

  it('reads the sound value alone when a letter has no hint', () => {
    expect(wallTileLabel({ romanization: 'g/k', kind: 'consonant' }, m.a11y)).toBe('Korean letter g/k');
  });
});

describe('stagePrizeCards: the three legendary cards', () => {
  it('is every card unlocked by completing Stage 1, in content order', () => {
    expect(stagePrizeCards('stage1').map((c) => c.id)).toEqual(['card:hangul-day', 'card:lantern', 'card:gayageum']);
  });

  it('is empty for a stage whose completion awards nothing', () => {
    expect(stagePrizeCards('stage7')).toEqual([]);
  });

  it('reads the cards it is given', () => {
    const one = { ...heritageCardsAll[0], id: 'card:x', unlockedBy: 'stage2-complete' } as HeritageCard;
    expect(stagePrizeCards('stage2', [one]).map((c) => c.id)).toEqual(['card:x']);
  });
});

describe('ownsStagePrize: the ceremony opens only for a learner who holds every prize card', () => {
  const owned = (ids: readonly string[]) => ids.map((cardId) => ({ cardId }));

  it('is true when the learner owns all three legendary cards', () => {
    expect(ownsStagePrize(owned(['card:hangul-day', 'card:lantern', 'card:gayageum', 'card:other']), 'stage1')).toBe(true);
  });

  it('is false when a prize card is missing (Complete only by the old stage latch)', () => {
    expect(ownsStagePrize(owned([]), 'stage1')).toBe(false);
    expect(ownsStagePrize(owned(['card:hangul-day', 'card:lantern']), 'stage1')).toBe(false);
  });

  it('is false for a stage with no prize cards', () => {
    expect(ownsStagePrize(owned(['card:hangul-day']), 'stage7')).toBe(false);
  });
});

describe('stageCompleteActions: the ceremony buttons', () => {
  it('has one primary, Take the Hangul Check (PR Q-10b), with See my cards and Back home as ghosts; no purchase and no Premium', () => {
    const actions = stageCompleteActions();
    expect(actions).toEqual([
      { id: 'hangulCheck', tone: 'primary', size: 'hero' },
      { id: 'seeCards', tone: 'ghost', size: 'md' },
      { id: 'backHome', tone: 'ghost', size: 'md' },
    ]);
    expect(actions.filter((a) => a.tone === 'primary')).toHaveLength(1);
  });
});

describe('ceremony copy (D3, D5)', () => {
  const copy = m.learner.stageComplete;
  const strings = [
    copy.title,
    copy.headline,
    copy.canDo,
    copy.wallTitle,
    copy.cardsTitle,
    copy.seeCards.cta,
    copy.backHome.cta,
    copy.notFound,
    copy.hangulCheck.cta,
    copy.hangulCheck.note,
  ];

  it('shows no number, fraction or percent on the learner screen', () => {
    for (const s of strings) expect(s, s).not.toMatch(/[0-9]|%|\//u);
  });

  it('never names a price, a plan or Premium', () => {
    for (const s of strings) expect(s.toLowerCase(), s).not.toMatch(/premium|price|buy|upgrade|plan\b/u);
  });

  it('passes the shared banned-word list', () => {
    for (const s of strings) expect(findBannedWord(s, 'en', 'learner'), s).toBeNull();
  });

  it('labels the Results button "See your Stage 1 prize"', () => {
    expect(m.learner.results.stagePrize.cta).toBe('See your Stage 1 prize');
  });

  it('labels the Journey Stage 1 header button "See your prize", with no number, price or plan word', () => {
    const cta = m.learner.journey.stagePrize.cta;
    expect(cta).toBe('See your prize');
    expect(cta).not.toMatch(/[0-9]|%/u);
    expect(cta.toLowerCase()).not.toMatch(/premium|price|buy|upgrade|plan\b/u);
    expect(findBannedWord(cta, 'en', 'learner')).toBeNull();
  });
});
