import { describe, expect, it } from 'vitest';
import { LESSON_MIN_SOURCES, isLessonPublicHost, lintLessonCell, type LessonLintContext } from '../index';
import { lessonCell, source, verification } from './helpers/lesson-fixtures';

type Json = Record<string, any>;
const CTX: LessonLintContext = { today: '2026-10-14', storyFacts: new Map([['seollal-new-year', new Set(['f1', 'f3'])]]) };
const nfm = { ...source, title: 'Encyclopedia of Korean Folk Culture', publisher: 'National Folk Museum of Korea', url: 'https://folkency.nfm.go.kr/topic/detail/1' };
const SIGNED = { language: 'native-reviewed', culture: 'culture-reviewed', reviewedBy: 'MAR', reviewedAt: '2026-10-14' };

function cellWith(note: Json, extra: Json = {}): Json {
  return lessonCell('stage2', 'rites', { culture: [{ id: 'n1', kind: 'culture', textEn: 'Families share a soup at the New Year.', verification, ...note }], ...extra });
}
const rules = (raw: unknown) => lintLessonCell(raw, CTX).map((f) => `${f.rule} ${f.path}`);

describe('lintLessonCell (F-CURR-001 validator lesson rules)', () => {
  it('passes a well-sourced draft and a signed ready cell', () => {
    expect(lintLessonCell(cellWith({ sources: [source, nfm] }), CTX)).toEqual([]);
    expect(lintLessonCell(cellWith({ sources: [source, nfm] }, { status: 'ready', review: SIGNED }), CTX)).toEqual([]);
  });

  it('reports a file that is not a lesson cell as lesson-schema and stops', () => {
    expect(rules({ id: 'episode:stage2-rites' })[0]).toMatch(/^lesson-schema /);
    expect(rules([])).toEqual(['lesson-schema (root)']);
  });

  it('names the cell rules of the schema by their rule', () => {
    const ready = cellWith({ sources: [source, nfm] }, { status: 'ready' });
    expect(rules(ready)).toEqual(['lesson-review-unsigned review']);
    const speech = cellWith({ sources: [source, nfm] }) as Json;
    speech.quests[0].steps[3].minigameKind = 'voice-echo';
    expect(rules(speech)).toContain('lesson-no-speaking quests[0].steps[3].minigameKind');
  });

  it('lesson-unsourced-note: a note with neither sources nor a factRef', () => {
    expect(rules(cellWith({}))).toEqual(['lesson-unsourced-note culture[0].sources']);
  });

  it('lesson-factref-unknown: a factRef must name a fact of a story file', () => {
    expect(rules(cellWith({ factRef: 'story:seollal-new-year#f3' }))).toEqual([]);
    expect(rules(cellWith({ factRef: 'story:seollal-new-year#f9' }))).toEqual(['lesson-factref-unknown culture[0].factRef']);
    expect(rules(cellWith({ factRef: 'story:no-such-story#f1' }))).toEqual(['lesson-factref-unknown culture[0].factRef']);
  });

  it('lesson-source-shape: two sources, one public, https, allow-listed, accessed not in the future', () => {
    expect(LESSON_MIN_SOURCES).toBe(2);
    expect(rules(cellWith({ sources: [nfm] }))).toEqual(['lesson-source-shape culture[0].sources']);
    const unesco = { ...source, url: 'https://ich.unesco.org/en/RL/1' };
    expect(rules(cellWith({ sources: [unesco, { ...unesco, url: 'https://www.unesco.org/x' }] }))).toEqual(['lesson-source-shape culture[0].sources']);
    expect(rules(cellWith({ sources: [nfm, { ...source, url: 'http://stdict.korean.go.kr/x' }] }))).toEqual(['lesson-source-shape culture[0].sources[1].url']);
    expect(rules(cellWith({ sources: [nfm, { ...source, url: 'https://example.com/x' }] }))).toEqual(['lesson-source-shape culture[0].sources[1].url']);
    expect(rules(cellWith({ sources: [nfm, { ...source, accessed: '2026-10-15' }] }))).toEqual(['lesson-source-shape culture[0].sources[1].accessed']);
  });

  it('lesson-copies-source: a note may not share a run of eight words with its sources', () => {
    const quote = 'On the morning of the first day families share a bowl of rice cake soup together';
    const copied = 'On the morning of the first day families share a bowl of soup.';
    expect(rules(cellWith({ textEn: copied, sources: [{ ...source, quoteOrLocator: quote }, nfm] }))).toEqual(['lesson-copies-source culture[0].textEn']);
  });

  it('lesson-national-treasure-number: no designation number in learner copy', () => {
    expect(rules(cellWith({ textEn: 'It is National Treasure No. 70.', sources: [source, nfm] }))).toEqual(['lesson-national-treasure-number culture[0].textEn']);
    const hoya = cellWith({ sources: [source, nfm] }) as Json;
    hoya.quests[0].steps[0].hoyaLineEn = 'This is Treasure No. 1!';
    expect(rules(hoya)).toEqual(['lesson-national-treasure-number quests[0].steps[0].hoyaLineEn']);
    // Source titles may carry the number.
    expect(rules(cellWith({ sources: [{ ...source, title: 'National Treasure No. 70' }, nfm] }))).toEqual([]);
  });

  it('lesson-verification-passes: a ready cell checks every note three times, scoped lesson', () => {
    const ready = (v: Json) => cellWith({ sources: [source, nfm], verification: { ...verification, ...v } }, { status: 'ready', review: SIGNED });
    expect(rules(ready({ passes: 2 }))).toEqual(['lesson-verification-passes culture[0].verification.passes']);
    expect(rules(ready({ scope: 'story' }))).toEqual(['lesson-verification-passes culture[0].verification.scope']);
    // A draft may still be at pass 1.
    expect(rules(cellWith({ sources: [source, nfm], verification: { ...verification, passes: 1 } }))).toEqual([]);
  });

  it('knows the Korean public institutions of the section 3.9 bar', () => {
    for (const host of ['folkency.nfm.go.kr', 'stdict.korean.go.kr', 'encykorea.aks.ac.kr', 'www.korea.kr', 'www.korea.net', 'english.visitkorea.or.kr', 'www.knps.or.kr']) {
      expect(isLessonPublicHost(host), host).toBe(true);
    }
    for (const host of ['ich.unesco.org', 'www.gutenberg.org', 'evilkorea.net', 'go.kr.example.com']) expect(isLessonPublicHost(host), host).toBe(false);
  });

});
