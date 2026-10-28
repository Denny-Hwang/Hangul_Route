import type { KoText, StoryOrderRound } from '@hangul-route/content-schema';
import type { MinigameScope } from '../logic/minigame-config';

/**
 * Story Order fixture scopes (F-CURR-002 row CM-34) for the e2e spec, which hands one to the fixture build's entry
 * (`story-order-e2e.tsx`), and the unit tests; no app module imports this file. No lesson cell plays Story Order until the
 * Check rotation rows (CM-3A) author it, so these are not real content: everyday lines built
 * from words Stages 2-4 teach, each romanized as `romanize()` of rr.ts gives it (a unit test
 * holds that, and that each round parses with `StoryOrderRoundSchema`). The romanization is the content's; the
 * screens never compute it.
 */

const line = (ko: string, romanization: string, en: string): KoText => ({ ko, romanization, en });

/** Captions only: a morning, told by its sequence words (먼저, 그다음에, 그리고, 마지막에). */
const MORNING: StoryOrderRound = {
  id: 'morning',
  captionsOnly: true,
  panels: [
    { id: 'up', caption: line('먼저 일어나요.', 'meonjeo ireonayo', 'First, I get up.') },
    { id: 'wash', caption: line('그다음에 세수해요.', 'geudaeume sesuhaeyo', 'Next, I wash my face.') },
    { id: 'eat', caption: line('그리고 밥을 먹어요.', 'geurigo babeul meogeoyo', 'Then I eat a meal.') },
    { id: 'park', caption: line('마지막에 공원에 가요.', 'majimage gongwone gayo', 'Last, I go to the park.') },
  ],
};

/** Illustrated, settled by its time words (아침, 점심, 저녁, 밤): the pictures alone could go in any order. */
const DAY: StoryOrderRound = {
  id: 'day',
  captionsSettleOrder: true,
  panels: [
    { id: 'sun', caption: line('아침에 해가 떠요.', 'achime haega tteoyo', 'In the morning the sun comes up.'), pictureRef: 'word:nature-sun' },
    { id: 'bread', caption: line('점심에 빵을 먹어요.', 'jeomsime ppangeul meogeoyo', 'At lunch I eat bread.'), pictureRef: 'word:food-bread' },
    { id: 'rain', caption: line('저녁에 비가 와요.', 'jeonyeoge biga wayo', 'In the evening it rains.'), pictureRef: 'word:nature-rain' },
    { id: 'star', caption: line('밤에 별이 떠요.', 'bame byeori tteoyo', 'At night the stars come out.'), pictureRef: 'word:nature-star' },
  ],
};

/** Five lines (the schema's most, the wireframe's open question 2): checked at 320 x 568 before content uses it. */
const FIVE: StoryOrderRound = {
  id: 'five',
  captionsOnly: true,
  panels: [
    ...MORNING.panels.slice(0, 3),
    { id: 'read', caption: line('그리고 책을 읽어요.', 'geurigo chaegeul ilgeoyo', 'Then I read a book.') },
    MORNING.panels[3]!,
  ],
};

const scope = (rounds: StoryOrderRound[]): MinigameScope => ({ kind: 'story-order', rounds: rounds.length, storyOrder: { rounds } });

export const STORY_ORDER_FIXTURES = {
  /** One captions-only round. */
  captions: scope([MORNING]),
  /** Two rounds: illustrated (settled by time words), then captions only. */
  twoRounds: scope([DAY, MORNING]),
  five: scope([FIVE]),
  /** Bad data: no round with three panels (the empty state). */
  empty: { kind: 'story-order', rounds: 0, storyOrder: { rounds: [] } } satisfies MinigameScope,
} as const;

export type StoryOrderFixtureKey = keyof typeof STORY_ORDER_FIXTURES;
