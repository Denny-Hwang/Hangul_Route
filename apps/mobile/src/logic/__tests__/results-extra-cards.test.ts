import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { cardById } from '../../content';
import { EXTRA_CARDS_SHOWN, extraCardsAnnouncement, extraCardsView } from '../results-extra-cards';
import type { QuestResultOutcome } from '../results-award';

const x = getMessages('en').learner.results.extraCards;

const outcome = (over: Partial<QuestResultOutcome> = {}): QuestResultOutcome => ({
  award: null,
  extras: [],
  episodeCompleted: null,
  stageCompleted: null,
  ...over,
});

const lookup = (id: string): { id: string; titleEn: string } | undefined =>
  id.startsWith('card:') && id !== 'card:missing' ? { id, titleEn: id.slice(5) } : undefined;

describe('extraCardsView (F-STORY-006 §3.7, wireframe results/extra-cards)', () => {
  it('shows nothing before the outcome is decided', () => {
    expect(extraCardsView(null, lookup)).toBeNull();
  });

  it('shows nothing when the run brought no extra card (a replay, or nothing completed)', () => {
    expect(extraCardsView(outcome(), lookup)).toBeNull();
  });

  it('shows nothing when the episode completed but every card was already owned', () => {
    expect(extraCardsView(outcome({ episodeCompleted: 'episode:stage1-rites' }), lookup)).toBeNull();
  });

  it('lists the extras in the order the live path decided them, with the episode just finished', () => {
    const view = extraCardsView(
      outcome({
        episodeCompleted: 'episode:stage1-rites',
        extras: [
          { cardId: 'card:chuseok', source: 'episode' },
          { cardId: 'card:tteokguk', source: 'episode' },
        ],
      }),
      lookup,
    );
    expect(view).toEqual({
      cards: [
        { id: 'card:chuseok', titleEn: 'chuseok' },
        { id: 'card:tteokguk', titleEn: 'tteokguk' },
      ],
      shown: [
        { id: 'card:chuseok', titleEn: 'chuseok' },
        { id: 'card:tteokguk', titleEn: 'tteokguk' },
      ],
      more: 0,
      episodeId: 'episode:stage1-rites',
    });
  });

  it('handles every award source, the quest source of another quest card included', () => {
    const view = extraCardsView(
      outcome({
        extras: [
          { cardId: 'card:a', source: 'quest' },
          { cardId: 'card:b', source: 'episode' },
          { cardId: 'card:c', source: 'stage' },
          { cardId: 'card:d', source: 'set' },
          { cardId: 'card:e', source: 'welcome' },
        ],
      }),
      lookup,
    );
    expect(view?.cards.map((c) => c.id)).toEqual(['card:a', 'card:b', 'card:c', 'card:d', 'card:e']);
    expect(view?.episodeId).toBeNull();
  });

  it('a 1-star finish brings the quest card as an episode extra (award is null)', () => {
    const view = extraCardsView(
      outcome({
        episodeCompleted: 'episode:stage1-rites',
        extras: [{ cardId: 'card:seollal', source: 'episode' }],
      }),
      lookup,
    );
    expect(view?.cards.map((c) => c.id)).toEqual(['card:seollal']);
  });

  it('never repeats the quest card, a duplicate or a card this build does not know', () => {
    const view = extraCardsView(
      outcome({
        award: { cardId: 'card:seollal', isNew: true, isFirstCard: false },
        extras: [
          { cardId: 'card:seollal', source: 'episode' },
          { cardId: 'card:chuseok', source: 'episode' },
          { cardId: 'card:chuseok', source: 'episode' },
          { cardId: 'card:missing', source: 'episode' },
        ],
      }),
      lookup,
    );
    expect(view?.cards.map((c) => c.id)).toEqual(['card:chuseok']);
  });

  it('shows nothing when no extra resolves to a card', () => {
    expect(extraCardsView(outcome({ extras: [{ cardId: 'card:missing', source: 'episode' }] }), lookup)).toBeNull();
  });

  it(`shows at most ${EXTRA_CARDS_SHOWN} thumbnails and counts the rest`, () => {
    const extras = Array.from({ length: 9 }, (_, i) => ({ cardId: `card:c${i}`, source: 'episode' as const }));
    const view = extraCardsView(outcome({ extras }), lookup);
    expect(EXTRA_CARDS_SHOWN).toBe(6);
    expect(view?.cards).toHaveLength(9);
    expect(view?.shown.map((c) => c.id)).toEqual(['card:c0', 'card:c1', 'card:c2', 'card:c3', 'card:c4', 'card:c5']);
    expect(view?.more).toBe(3);
  });

  it('takes the row length as an option', () => {
    const extras = Array.from({ length: 3 }, (_, i) => ({ cardId: `card:c${i}`, source: 'episode' as const }));
    expect(extraCardsView(outcome({ extras }), lookup, 2)?.more).toBe(1);
  });

  it('resolves the shipped cards through the content lookup', () => {
    const view = extraCardsView(outcome({ extras: [{ cardId: 'card:chuseok', source: 'episode' }] }), cardById);
    expect(view?.cards[0]?.id).toBe('card:chuseok');
  });
});

describe('extraCardsAnnouncement', () => {
  it('reads the episode sentence first, then the count and every card title', () => {
    expect(extraCardsAnnouncement(x, ['Chuseok', 'Tteokguk'], 'New Year and Harvest')).toBe(
      'You finished New Year and Harvest! 2 more cards joined your Library: Chuseok, Tteokguk',
    );
  });

  it('reads only the count and titles when no episode just completed', () => {
    expect(extraCardsAnnouncement(x, ['Seollal'], undefined)).toBe('1 more card joined your Library: Seollal');
  });
});
