import { describe, expect, it } from 'vitest';
import { lessonOccurrences } from '../review-items/extract';

/** F-CURR-002 row CM-34: a Story Order scope's captions are the round's taught lines, glossed at their overlay field. */

const kt = (ko: string, romanization: string, en: string) => ({ ko, romanization, en });
const step = (id: string, kind: string, ref?: string) => (ref === undefined ? { id, kind } : { id, kind, minigameRef: ref });
const REF = 'minigame:s4-crafts-q2-apply';
const cell = {
  quests: [
    {
      id: 'quest:stage4-crafts-q2',
      steps: [step('s1', 'intro'), step('s2', 'apply', REF), step('s3', 'reward')],
      scopes: [
        {
          ref: REF,
          kind: 'story-order',
          rounds: [
            {
              id: 'r1',
              panels: [
                { id: 'sun', caption: kt('아침에 해가 떠요.', 'achime haega tteoyo', 'In the morning the sun comes up.'), pictureRef: 'word:nature-sun' },
                { id: 'star', caption: kt('밤에 별이 떠요.', 'bame byeori tteoyo', 'At night the stars come out.') },
                'not a panel',
              ],
            },
            { panels: [{ caption: kt('먼저 일어나요.', 'meonjeo ireonayo', 'First, I get up.') }] },
          ],
        },
      ],
    },
  ],
};

describe('lessonOccurrences of a story-order scope', () => {
  it('reads every caption as a pat item of the round, with its gloss key and picture', () => {
    const occs = lessonOccurrences({ file: 'content/episodes/stage-4/crafts.json', body: cell, cellId: 'episode:stage4-crafts', stage: 4, home: 'crafts', volume: 1 }, []);
    expect(occs.map((o) => [o.kind, o.ko, o.source, o.glossKey ?? '', o.picture ?? ''])).toEqual([
      ['pat', '아침에 해가 떠요.', 'round', `${REF}#storyOrder.rounds.r1.panels.sun.caption.gloss`, 'word:nature-sun'],
      ['pat', '밤에 별이 떠요.', 'round', `${REF}#storyOrder.rounds.r1.panels.star.caption.gloss`, ''],
      // A round or panel with no id is keyed by its index (the overlay rule).
      ['pat', '먼저 일어나요.', 'round', `${REF}#storyOrder.rounds.1.panels.0.caption.gloss`, ''],
    ]);
    expect(occs[0]?.at).toBe('content/episodes/stage-4/crafts.json quests[0].scopes[0].rounds[0].panels[0]');
  });
});
