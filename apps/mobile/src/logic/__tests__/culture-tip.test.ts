import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { cardTipQuest, cultureTipView, type TipCell } from '../culture-tip';
import type { LessonQuestNote } from '../lessons/lesson-store';

/** F-CURR-002 §5.7, row CM-3C: the Did you know? tip at the reward step and on the card back. */
const m = getMessages('en').learner.cardDetail.citation;
const note: LessonQuestNote = {
  id: 'n2',
  textEn: 'Kites fly at {ko:설날}.',
  citation: { title: '연날리기', publisher: '국립민속박물관 (National Folk Museum of Korea)', more: 1 },
};
const overlays = { es: { 'episode:stage2-rites': { title: 'Fiestas', 'culture.n2.text': 'Las cometas vuelan en {ko:설날}.' } }, ko: {} };

describe('cultureTipView', () => {
  it('draws the English note around its tokens, with the source line of the first source', () => {
    const view = cultureTipView(note, 'episode:stage2-rites', 'en', overlays, m);
    expect(view.noteId).toBe('n2');
    expect(view.parts).toEqual([{ text: 'Kites fly at ' }, { ko: '설날', romanization: 'seollal' }, { text: '.' }]);
    expect(view.citation?.line).toBe('Source: 국립민속박물관 (National Folk Museum of Korea), 연날리기');
    expect(view.citation?.more).toBe('and 1 more source');
    // Only the Korean is marked for a Korean voice.
    expect(view.citation?.runs.filter((r) => r.korean).map((r) => r.text)).toEqual(['국립민속박물관', '연날리기']);
  });

  it("reads the note in the UI language from the cell's culture.<id>.text gloss, else the English", () => {
    const es = cultureTipView(note, 'episode:stage2-rites', 'es', overlays, m);
    expect(es.parts[0]).toEqual({ text: 'Las cometas vuelan en ' });
    expect(es.parts[1]).toEqual({ ko: '설날', romanization: 'seollal' });
    // No ko gloss yet: the English stays, never a blank.
    expect(cultureTipView(note, 'episode:stage2-rites', 'ko', overlays, m).parts[0]).toEqual({ text: 'Kites fly at ' });
    // Another cell's gloss never lands on this note.
    expect(cultureTipView(note, 'episode:stage2-life', 'es', overlays, m).parts[0]).toEqual({ text: 'Kites fly at ' });
  });

  it('a note with one source has no "more" line', () => {
    expect(cultureTipView({ ...note, citation: { ...note.citation, more: 0 } }, 'episode:stage2-rites', 'en', overlays, m).citation?.more).toBeNull();
  });
});

describe('cardTipQuest', () => {
  const cells: TipCell[] = [
    { id: 'episode:stage2-life', questIds: ['quest:stage2-life-q1', 'quest:stage2-life-q2'], rewardCardIds: ['card:dosirak', 'card:sagwa'] },
    { id: 'episode:stage3-nature', questIds: ['quest:stage3-nature-q1'], rewardCardIds: ['card:gom'] },
  ];
  const rewardOf = (q: string): string | undefined => ({ 'quest:stage2-life-q2': 'card:dosirak' })[q];

  it("a card a quest awards shows that quest's note", () => {
    expect(cardTipQuest('card:dosirak', cells, rewardOf)).toBe('quest:stage2-life-q2');
  });

  it("a card the whole cell gives shows its first quest's note", () => {
    expect(cardTipQuest('card:sagwa', cells, rewardOf)).toBe('quest:stage2-life-q1');
    expect(cardTipQuest('card:gom', cells, rewardOf)).toBe('quest:stage3-nature-q1');
  });

  it('a card no lesson cell gives has no tip', () => {
    expect(cardTipQuest('card:hangeul-ga', cells, rewardOf)).toBeUndefined();
    expect(cardTipQuest('card:x', [{ id: 'episode:stage2-x', questIds: [], rewardCardIds: ['card:x'] }], rewardOf)).toBeUndefined();
  });
});
