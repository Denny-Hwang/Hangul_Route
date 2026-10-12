import {
  StageKeySchema,
  storyCardId,
  storyCardRarity,
  type HeritageCard,
  type KoText,
  type StageKey,
  type Story,
  type ThemeKey,
} from '@hangul-route/content-schema';
import type { CardSet } from './types';

/**
 * The heritage story cards (F-STORY-006 §3.8): one card per shelf story, built
 * from the story's `card` block, and one legendary card per collection of
 * stories. Pure: `content/story-cards.ts` applies it to the bundle.
 *
 * Nothing on a story card is typed by hand except its short English title:
 * the Korean word and its romanization are a `keywords[]` entry, the blurb is
 * the story's summary, the back-face fact is the cited fact's `claimEn`
 * verbatim and the citation is that fact's first source (D14). Story lint and
 * the card-award integrity test hold the rules (fact length, two sources, the
 * listen reward); a block that does not resolve builds no card.
 */

/** A collection of stories whose own card arrives when every member card is owned (`content/story-sets.ts`). */
export interface StorySetDef {
  /** `set:<cluster>`, the card's `unlockedBy`. */
  id: string;
  /** `card:set-<cluster>`. */
  cardId: string;
  /** The member stories, in shelf order. */
  memberStoryIds: readonly string[];
  /** The collection's name in the set earn hint ("Collect every card from the <name> stories"). */
  collectionEn: string;
  /** The set card's English title. */
  titleEn: string;
  /** The set card's Korean word with its romanization and gloss. */
  headword: KoText;
  blurbEn: string;
  theme: ThemeKey;
  rarity: 'legendary';
}

const stageKey = (n: number): StageKey => StageKeySchema.parse(`stage${n}`);

/**
 * A story's card, or null when the story builds none: only a `ready` story
 * with a `shelf` block (one that passed the review gate) and a `card` block
 * whose headword and fact resolve.
 */
export function storyCardFor(story: Story): HeritageCard | null {
  const { card } = story;
  if (story.state !== 'ready' || !story.shelf || !card) return null;
  const keyword = story.keywords.find((k) => k.id === card.keywordId);
  const fact = story.facts.find((f) => f.id === card.factId);
  const [source, ...others] = fact?.sources ?? [];
  if (!keyword || !fact || !source) return null;
  return {
    id: storyCardId(story.id),
    titleEn: card.titleEn,
    subtitleKo: keyword.ko,
    romanization: keyword.romanization,
    blurbEn: story.summaryEn,
    factEn: fact.claimEn,
    theme: story.theme,
    stage: stageKey(story.recommendedStage),
    rarity: storyCardRarity(story.recommendedStage),
    unlockedBy: `episode:shelf-${story.id.replace(/^story:/, '')}`,
    storyId: story.id,
    factId: fact.id,
    citation: { title: source.title, publisher: source.publisher, more: others.length },
  };
}

/**
 * Every story card of the bundle, then the card of each registered set, and
 * the sets the award engine reads. A set is registered only when every one of
 * its member stories builds a card (F-STORY-006 §3.2); until then neither the
 * set nor its card exists, so its card is neither listed nor awardable.
 */
export function buildStoryCards(
  stories: readonly Story[],
  defs: readonly StorySetDef[],
): { cards: HeritageCard[]; sets: CardSet[] } {
  const byStory = new Map<string, HeritageCard>();
  for (const story of stories) {
    const card = storyCardFor(story);
    if (card) byStory.set(story.id, card);
  }
  const sets: CardSet[] = [];
  const setCards: HeritageCard[] = [];
  const setOf = new Map<string, string>();
  for (const def of defs) {
    const members = def.memberStoryIds.map((id) => byStory.get(id));
    if (members.length === 0 || !members.every((c): c is HeritageCard => c !== undefined)) continue;
    sets.push({ id: def.id, cardId: def.cardId, titleEn: def.collectionEn, memberCardIds: members.map((c) => c.id) });
    for (const c of members) setOf.set(c.id, def.id);
    const lastStage = Math.max(...members.map((c) => Number(c.stage.slice('stage'.length))));
    setCards.push({
      id: def.cardId,
      titleEn: def.titleEn,
      subtitleKo: def.headword.ko,
      romanization: def.headword.romanization,
      blurbEn: def.blurbEn,
      theme: def.theme,
      // The set completes with its last member, so it sits at the latest member's stage.
      stage: stageKey(lastStage),
      rarity: def.rarity,
      unlockedBy: def.id,
    });
  }
  const cards = [...byStory.values()].map((c) => {
    const setId = setOf.get(c.id);
    return setId === undefined ? c : { ...c, setId };
  });
  return { cards: [...cards, ...setCards], sets };
}
