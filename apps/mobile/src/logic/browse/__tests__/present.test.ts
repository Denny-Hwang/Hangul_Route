import { LECTURE_TITLE_RE, LectureDeckSchema, decodeDeck } from '@hangul-route/content-schema';
import { layoutClassFor } from '@hangul-route/design-system/layout';
import { describe, expect, it } from 'vitest';
import { VOCAB_TOPICS } from '../../../content/__generated__/vocab';
import { lectureBundle } from '../../lecture/content';
import { PRESENT_PICKER, presentBlock, presentDeck, presentHref, presentItemShown, presentPlacement, presentThisShown, presentTitle } from '../present';
import { PRESENTER_PATH } from '../../../platform/presenter';
import { TALE_ID } from './browse-fixture';

/**
 * F-BROWSE-001 BR-13 (section 4.6 secondary action, OD-9; design
 * `design/screens/presenter/present-this.md`): [ Present this ] opens the
 * item as a one-block deck in the presenter (`/present#d=…`). It is shown
 * only with a full pass, once the presenter root exists, and only when the
 * presenter can draw at least one slide of that block on this build.
 */
const NOW = new Date('2026-10-13T09:00:00.000Z');
const rng = (): number => 0.5;
const QUEST = 'quest:stage1-letters-q1';
const TOPIC = VOCAB_TOPICS.find((t) => t.status === 'ready' || t.status === 'shipped')?.id ?? 'vocab-topic:food';
const bundle = lectureBundle('en');

function deckOf(kind: 'quest' | 'story' | 'vocab-topic', id: string, title = 'Meet a, eo, g, n') {
  const deck = presentDeck({ kind, id, title }, { now: NOW, rng, uiLocale: 'en' });
  if (!deck) throw new Error('expected a deck');
  return deck;
}

describe('presentBlock', () => {
  it('maps each item kind to its one deck block', () => {
    expect(presentBlock('quest', QUEST)).toEqual({ kind: 'quest', id: QUEST });
    expect(presentBlock('story', TALE_ID)).toEqual({ kind: 'story', storyId: TALE_ID, checks: true });
    expect(presentBlock('vocab-topic', TOPIC)).toEqual({ kind: 'vocab', topicId: TOPIC });
  });
});

describe('presentTitle', () => {
  it('keeps a title the deck grammar accepts', () => {
    expect(presentTitle('Meet a, eo, g, n')).toBe('Meet a, eo, g, n');
    expect(presentTitle('Vista previa: canción')).toBe('Vista previa: canción');
  });

  it('drops characters the deck grammar refuses, collapses spaces and caps the length at 60', () => {
    expect(presentTitle('Food & drink')).toBe('Food drink');
    expect(presentTitle(`  ${'a'.repeat(70)}  `)).toBe('a'.repeat(60));
    const cleaned = presentTitle('Hello "world" #1 ~ ok');
    expect(cleaned).not.toBeNull();
    expect(LECTURE_TITLE_RE.test(cleaned as string)).toBe(true);
  });

  it('gives null when nothing usable is left', () => {
    expect(presentTitle('  &&  ')).toBeNull();
  });
});

describe('presentDeck', () => {
  it('is a valid one-block catalogue deck with a numbers picker of 12 and no names', () => {
    const deck = deckOf('quest', QUEST);
    expect(LectureDeckSchema.safeParse(deck).success).toBe(true);
    expect(deck.blocks).toEqual([{ kind: 'quest', id: QUEST }]);
    expect(deck.source).toBe('catalogue');
    expect(deck.picker).toEqual({ mode: 'numbers', count: 12 });
    expect(PRESENT_PICKER).toEqual({ mode: 'numbers', count: 12 });
    expect(deck.createdAt).toBe(NOW.toISOString());
    expect(deck.id).toMatch(/^lecture:[a-z0-9]{10}$/);
    expect(deck.options.uiLocale).toBe('en');
    expect(deck.title).toBe('Meet a, eo, g, n');
  });

  it('follows the page language and is null when the title has nothing usable', () => {
    expect(presentDeck({ kind: 'quest', id: QUEST, title: 'Conoce' }, { now: NOW, rng, uiLocale: 'es' })?.options.uiLocale).toBe('es');
    expect(presentDeck({ kind: 'quest', id: QUEST, title: '&&' }, { now: NOW, rng, uiLocale: 'en' })).toBeNull();
  });
});

describe('presentDeck per press', () => {
  it('gives every press its own deck id and quiz seed', () => {
    let state = 1;
    // A small seeded generator stands in for Math.random.
    const seeded = (): number => {
      state = (state * 48_271) % 2_147_483_647;
      return state / 2_147_483_647;
    };
    const first = presentDeck({ kind: 'quest', id: QUEST, title: 'Meet' }, { now: NOW, rng: seeded, uiLocale: 'en' });
    const second = presentDeck({ kind: 'quest', id: QUEST, title: 'Meet' }, { now: NOW, rng: seeded, uiLocale: 'en' });
    expect(first?.id).not.toBe(second?.id);
    expect(first?.seed).not.toBe(second?.seed);
  });
});

describe('presentHref', () => {
  it('is a same-origin /present link whose fragment decodes back to the deck', () => {
    const deck = deckOf('quest', QUEST);
    const href = presentHref(deck);
    expect(href.startsWith('/present#d=')).toBe(true);
    const decoded = decodeDeck(href.slice('/present#'.length));
    expect(decoded.ok && decoded.deck).toEqual(deck);
  });
});

describe('presentThisShown, per item kind', () => {
  const full = { scope: 'full' as const, presenterRoot: true, bundle };

  it('shows for a lesson with a full pass once the presenter root exists', () => {
    expect(presentThisShown({ ...full, deck: deckOf('quest', QUEST) })).toBe(true);
  });

  it('shows for a story the Library lists, now the story slides have landed (F-TCH-004 PR 11)', () => {
    expect(presentThisShown({ ...full, deck: deckOf('story', 'story:chuseok-ganggangsullae') })).toBe(true);
  });

  it('hides for a story this bundle does not hold: the block expands to nothing', () => {
    expect(presentThisShown({ ...full, deck: deckOf('story', TALE_ID) })).toBe(false);
  });

  it('shows for a ready word topic now that the vocabulary slides have landed (F-TCH-004 PR 12)', () => {
    expect(presentThisShown({ ...full, deck: deckOf('vocab-topic', TOPIC) })).toBe(true);
  });

  it('hides for a word topic the bundle cannot expand (a topic that is not ready)', () => {
    const notReady = { ...bundle, vocabTopic: () => 'not-ready' as const };
    expect(presentThisShown({ ...full, bundle: notReady, deck: deckOf('vocab-topic', TOPIC) })).toBe(false);
  });

  it('hides for a lesson the bundle does not hold', () => {
    expect(presentThisShown({ ...full, deck: deckOf('quest', 'quest:not-in-this-build') })).toBe(false);
  });

  it('hides with a sampler pass (OD-9: a full pass only)', () => {
    expect(presentThisShown({ ...full, scope: 'sampler', deck: deckOf('quest', QUEST) })).toBe(false);
  });

  it('hides when the presenter root does not exist (native builds)', () => {
    expect(presentThisShown({ ...full, presenterRoot: false, deck: deckOf('quest', QUEST) })).toBe(false);
  });

  it('hides when no deck could be made', () => {
    expect(presentThisShown({ ...full, deck: null })).toBe(false);
  });
});

describe('presentItemShown, the item page rule', () => {
  const page = { scope: 'full' as const, access: 'access' as const, presenterRoot: true, uiLocale: 'en' as const, bundle };
  const quest = { kind: 'quest' as const, id: QUEST, title: 'Meet a, eo, g, n' };

  it('shows for a lesson with a full pass the item is open to', () => {
    expect(presentItemShown({ ...page, item: quest })).toBe(true);
    expect(presentItemShown({ ...page, access: 'open', item: quest })).toBe(true);
  });

  it('hides for an item the pass closes, with no pass, and for an item this build does not hold', () => {
    expect(presentItemShown({ ...page, access: 'closed', item: quest })).toBe(false);
    expect(presentItemShown({ ...page, scope: null, item: quest })).toBe(false);
    expect(presentItemShown({ ...page, item: null })).toBe(false);
  });

  it('hides with a sampler pass and while the presenter is not mounted', () => {
    expect(presentItemShown({ ...page, scope: 'sampler', item: quest })).toBe(false);
    expect(presentItemShown({ ...page, presenterRoot: false, item: quest })).toBe(false);
  });

  it('shows for a ready word topic (F-TCH-004 PR 12)', () => {
    expect(presentItemShown({ ...page, item: { kind: 'vocab-topic', id: TOPIC, title: 'Food' } })).toBe(true);
  });

  it('hides for a story this bundle does not hold, and for a title the deck grammar cannot carry', () => {
    expect(presentItemShown({ ...page, item: { kind: 'story', id: TALE_ID, title: 'The tale' } })).toBe(false);
    expect(presentItemShown({ ...page, item: { ...quest, title: '&&' } })).toBe(false);
  });
});

describe('presentHref', () => {
  it('starts with the presenter path #591 exports, so openPresenter accepts it', () => {
    expect(presentHref(deckOf('quest', QUEST)).startsWith(`${PRESENTER_PATH}#d=`)).toBe(true);
  });
});

describe('presentPlacement (the item page action bar, review of #590)', () => {
  const base = { compact: true, closed: false, canPreview: true, presentShown: true, short: false };

  it('pins the preview and Present this together on a phone window that is not short', () => {
    expect(presentPlacement(base)).toEqual({ footer: { preview: true, present: true, main: true }, inline: null });
  });

  it('pins only the preview on a short phone window and ends the page with Present this', () => {
    expect(presentPlacement({ ...base, short: true })).toEqual({
      footer: { preview: true, present: false, main: true },
      inline: { preview: false, present: true, main: false },
    });
  });

  it('reads the layout class: a first frame with no height yet is not short, so nothing jumps', () => {
    expect(layoutClassFor({ width: 320, height: 0 }).short).toBe(false);
    expect(layoutClassFor({ width: 568, height: 320 }).short).toBe(true);
    expect(layoutClassFor({ width: 320, height: 568 }).short).toBe(false);
  });

  it('draws Present this alone, with no preview, when this build cannot preview the item', () => {
    expect(presentPlacement({ ...base, canPreview: false })).toEqual({ footer: { preview: false, present: true, main: true }, inline: null });
    expect(presentPlacement({ ...base, canPreview: false, compact: false })).toEqual({ footer: null, inline: { preview: false, present: true, main: true } });
    // Nothing to pin on a short window: Present this ends the page as the one group, a story's questions with it.
    expect(presentPlacement({ ...base, canPreview: false, short: true })).toEqual({ footer: null, inline: { preview: false, present: true, main: true } });
  });

  it('puts the whole bar inline from the regular class', () => {
    expect(presentPlacement({ ...base, compact: false })).toEqual({ footer: null, inline: { preview: true, present: true, main: true } });
  });

  it('draws no bar with neither action, and the closed line inline when the pass closes the item', () => {
    expect(presentPlacement({ ...base, canPreview: false, presentShown: false })).toEqual({ footer: null, inline: null });
    expect(presentPlacement({ ...base, closed: true })).toEqual({ footer: null, inline: 'closed' });
    expect(presentPlacement({ ...base, closed: true, compact: false })).toEqual({ footer: null, inline: 'closed' });
  });
});
