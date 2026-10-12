import type { Episode, Overlays, ProgressSnapshot, Quest } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { discoverQuest, episodeOf, plainQuest, snapshotWith } from '../stage1/__tests__/fixtures';
import { isStageEntitled } from '../entitlement';
import {
  resultsActions,
  resultsTeaser,
  teaserCaption,
  teaserCtaLabel,
  teaserNextStartedEvent,
  teaserTappedEvent,
  type ResultsTeaser,
} from '../quest-flow/results-teaser';
import { offplanFinishedEvent, planBeforeOf, type RouteNextInput } from '../route-next';

const nextUp = getMessages('en').learner.results.nextUp;
const Q1 = discoverQuest('quest:q1', ['jamo:giyeok', 'jamo:nieun']);
const Q2 = discoverQuest('quest:q2', ['jamo:jieut', 'jamo:chieut']);
const Q3 = discoverQuest('quest:q3', ['jamo:mieum'], { teaserEn: 'Say m like mom' });
const Q4: Quest = { ...plainQuest('quest:q4'), blurbEn: 'A plain blurb.' };
const Q5: Quest = plainQuest('quest:q5');
const QUESTS: Quest[] = [Q1, Q2, Q3, Q4, Q5];
const EPISODES: Episode[] = [
  episodeOf('episode:one', ['quest:q1', 'quest:q2', 'quest:q3']),
  episodeOf('episode:two', ['quest:q4'], { theme: 'life' }),
  episodeOf('episode:s2', ['quest:q5'], { stage: 'stage2', theme: 'life' }),
];
const done = (...ids: string[]) =>
  snapshotWith(ids.map((id) => ({ questId: `quest:${id}`, episodeId: EPISODES.find((e) => e.questIds.includes(`quest:${id}`))!.id })));
const base = { quests: QUESTS, episodes: EPISODES };

describe('resultsTeaser: which quest is next up', () => {
  it('is the quest after the one just finished', () => {
    const t = resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5 });
    expect(t).toMatchObject({ questId: 'quest:q2', episodeId: 'episode:one', titleEn: 'Title quest:q2', again: false });
  });

  it('counts the quest just finished as done before the snapshot has it', () => {
    expect(resultsTeaser({ ...base, snapshot: done('q1'), questId: 'quest:q2', total: 5 })?.questId).toBe('quest:q3');
  });

  it('is the real cursor, not the quest after the replayed one (replay quest 1 while the cursor is quest 3)', () => {
    const t = resultsTeaser({ ...base, snapshot: done('q1', 'q2'), questId: 'quest:q1', total: 5 });
    expect(t?.questId).toBe('quest:q3');
  });

  it('crosses into the next episode', () => {
    const t = resultsTeaser({ ...base, snapshot: done('q1', 'q2'), questId: 'quest:q3', total: 5 });
    expect(t).toMatchObject({ questId: 'quest:q4', episodeId: 'episode:two' });
  });

  it('is undefined when nothing is left', () => {
    expect(resultsTeaser({ ...base, snapshot: done('q1', 'q2', 'q3', 'q4', 'q5'), questId: 'quest:q5', total: 5 })).toBeUndefined();
  });

  it('under the OD-4 tier rule, never teases a stage the tier leaves out', () => {
    const free = (stage: string) => isStageEntitled(stage, 'free');
    const all = done('q1', 'q2', 'q3');
    expect(resultsTeaser({ ...base, snapshot: all, questId: 'quest:q4', total: 5, isEntitled: free })).toBeUndefined();
    const premium = (stage: string) => isStageEntitled(stage, 'premium');
    expect(resultsTeaser({ ...base, snapshot: all, questId: 'quest:q4', total: 5, isEntitled: premium })?.questId).toBe('quest:q5');
  });
});

describe('resultsTeaser: quest access (F-ENT-003 section 3.5)', () => {
  const closed = (...ids: string[]) => (questId: string): boolean => !ids.includes(questId);

  it('omitted: the same teaser as before', () => {
    const input = { ...base, snapshot: done('q1'), questId: 'quest:q2', total: 5 };
    expect(resultsTeaser({ ...input, isQuestOpen: undefined })).toEqual(resultsTeaser(input));
    expect(resultsTeaser({ ...input, isQuestOpen: () => true })).toEqual(resultsTeaser(input));
  });

  it('never teases a closed quest; the next open one comes instead', () => {
    expect(resultsTeaser({ ...base, snapshot: done('q1', 'q2'), questId: 'quest:q3', total: 5, isQuestOpen: closed('quest:q4') })?.questId).toBe('quest:q5');
  });

  it('is undefined when every quest left is closed', () => {
    expect(resultsTeaser({ ...base, snapshot: done('q1', 'q2', 'q3'), questId: 'quest:q3', total: 5, isQuestOpen: closed('quest:q4', 'quest:q5') })).toBeUndefined();
  });

  it('still offers the same quest again when every game was skipped', () => {
    expect(resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 0, isQuestOpen: closed('quest:q2') })).toMatchObject({ questId: 'quest:q1', again: true });
  });
});

describe('resultsTeaser: placed-out quests (F-PLC-001 section 3.7, consumer 1)', () => {
  it('skips quests the level check placed out', () => {
    const skip = new Set(['quest:q2', 'quest:q3']);
    expect(resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5, skipQuestIds: skip })?.questId).toBe('quest:q4');
  });

  it('offers a placed-out quest never played before nothing at all', () => {
    const skip = new Set(['quest:q2']);
    const t = resultsTeaser({ ...base, snapshot: done('q1', 'q3', 'q4'), questId: 'quest:q5', total: 5, skipQuestIds: skip });
    expect(t?.questId).toBe('quest:q2');
    expect(resultsTeaser({ ...base, snapshot: done('q1', 'q2', 'q3', 'q4'), questId: 'quest:q5', total: 5, skipQuestIds: skip })).toBeUndefined();
  });
});

describe('resultsTeaser: every game skipped', () => {
  it('offers the same quest again and says so', () => {
    const t = resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 0 });
    expect(t).toMatchObject({ questId: 'quest:q1', episodeId: 'episode:one', again: true });
    expect(teaserCtaLabel(t!, nextUp)).toBe('Try this one again');
  });

  it('does not count the skipped quest as done even when the cursor is elsewhere', () => {
    const t = resultsTeaser({ ...base, snapshot: done('q1'), questId: 'quest:q2', total: 0 });
    expect(t?.questId).toBe('quest:q2');
  });

  it('is undefined when the played quest is in no episode', () => {
    expect(resultsTeaser({ quests: QUESTS, episodes: [], snapshot: done(), questId: 'quest:q1', total: 0 })).toBeUndefined();
  });
});

describe('resultsTeaser: in the UI language (F-I18N-001 §3.6)', () => {
  const overlays: Overlays = {
    es: {
      'quest:q3': { title: 'Tres', teaser: 'Di m como en mamá' },
      'quest:q4': { title: 'Cuatro', blurb: 'Una descripción sencilla.' },
    },
    ko: {},
  };

  it('localizes the title and the line together: a translated title never sits above an English blurb or teaser', () => {
    const q4 = resultsTeaser({ ...base, snapshot: done('q1', 'q2'), questId: 'quest:q3', total: 5, locale: 'es', overlays });
    expect(q4).toMatchObject({ questId: 'quest:q4', titleEn: 'Cuatro', line: { kind: 'text', text: 'Una descripción sencilla.' } });
    const q3 = resultsTeaser({ ...base, snapshot: done('q1'), questId: 'quest:q2', total: 5, locale: 'es', overlays });
    expect(q3).toMatchObject({ questId: 'quest:q3', titleEn: 'Tres', line: { kind: 'text', text: 'Di m como en mamá' } });
  });

  it('stays English for en and for a quest without an overlay', () => {
    const en = resultsTeaser({ ...base, snapshot: done('q1', 'q2'), questId: 'quest:q3', total: 5, locale: 'en', overlays });
    expect(en).toMatchObject({ titleEn: 'Title quest:q4', line: { kind: 'text', text: 'A plain blurb.' } });
    const q2 = resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5, locale: 'es', overlays });
    expect(q2?.titleEn).toBe('Title quest:q2');
  });
});

describe('resultsTeaser: the one line', () => {
  it('uses teaserEn when the quest has one', () => {
    const t = resultsTeaser({ ...base, snapshot: done('q1', 'q2'), questId: 'quest:q2', total: 5 });
    expect(t?.line).toEqual({ kind: 'text', text: 'Say m like mom' });
  });

  it('generates "New letters" from the Discover jamo, as taught content', () => {
    const t = resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5 });
    expect(t?.line).toEqual({
      kind: 'letters',
      letters: [
        { ko: 'ㅈ', romanization: 'j' },
        { ko: 'ㅊ', romanization: 'ch' },
      ],
    });
  });

  it('falls back to the blurb, then to no line at all', () => {
    expect(resultsTeaser({ ...base, snapshot: done('q1', 'q2', 'q3'), questId: 'quest:q3', total: 5 })?.line).toEqual({
      kind: 'text',
      text: 'A plain blurb.',
    });
    const bare = resultsTeaser({ quests: [Q1, { ...Q5, blurbEn: undefined }], episodes: [EPISODES[0]!, EPISODES[2]!], snapshot: done('q1'), questId: 'quest:q1', total: 5, isEntitled: () => true });
    expect(bare?.questId).toBe('quest:q5');
    expect(bare?.line).toBeUndefined();
  });

  it('skips a jamo id the content does not know', () => {
    const odd = discoverQuest('quest:odd', ['jamo:nope', 'jamo:mieum']);
    const t = resultsTeaser({
      quests: [Q1, odd],
      episodes: [episodeOf('episode:x', ['quest:q1', 'quest:odd'])],
      snapshot: done(),
      questId: 'quest:q1',
      total: 5,
    });
    expect(t?.line).toEqual({ kind: 'letters', letters: [{ ko: 'ㅁ', romanization: 'm' }] });
  });

  it('uses the "word" Discover pages as no letters and falls to the blurb', () => {
    const wordsOnly = { ...discoverQuest('quest:w', []), blurbEn: 'Words from home.' };
    const t = resultsTeaser({
      quests: [Q1, wordsOnly],
      episodes: [episodeOf('episode:x', ['quest:q1', 'quest:w'])],
      snapshot: done(),
      questId: 'quest:q1',
      total: 5,
    });
    expect(t?.line).toEqual({ kind: 'text', text: 'Words from home.' });
  });

  it('never carries a count, a percent or "must"', () => {
    const t = resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5 });
    expect(JSON.stringify(t)).not.toMatch(/%|must|\d+ of \d+/i);
    expect(teaserCtaLabel(t!, nextUp)).toBe('Play next quest');
    expect(JSON.stringify(t)).not.toMatch(/Play next quest|Try this one again|New letters/);
  });
});

describe('teaserCtaLabel: the words come from the message subtree', () => {
  it('picks "next" or "again" by the teaser, in the given language', () => {
    const next = { questId: 'quest:q2', again: false } as ResultsTeaser;
    const again = { questId: 'quest:q1', again: true } as ResultsTeaser;
    expect(teaserCtaLabel(next, nextUp)).toBe('Play next quest');
    expect(teaserCtaLabel(again, nextUp)).toBe('Try this one again');
    const es = { ...nextUp, next: { cta: 'Jugar la siguiente' }, again: { cta: 'Probar otra vez' } };
    expect(teaserCtaLabel(next, es)).toBe('Jugar la siguiente');
    expect(teaserCtaLabel(again, es)).toBe('Probar otra vez');
  });
});

describe('resultsActions: what the buttons look like', () => {
  const teaser = { questId: 'quest:q2' } as ResultsTeaser;

  it('keeps Back home primary and Episode page ghost with no teaser', () => {
    expect(resultsActions(undefined)).toEqual({ backHome: { tone: 'primary', size: 'hero' }, episodePage: { tone: 'ghost', size: 'md' } });
  });

  it('demotes Back home and Episode page to ghost under a teaser', () => {
    expect(resultsActions(teaser)).toEqual({ backHome: { tone: 'ghost', size: 'md' }, episodePage: { tone: 'ghost', size: 'md' } });
  });
});

describe('teaserTappedEvent', () => {
  it('is quest.teaser_tapped with from and to', () => {
    expect(teaserTappedEvent('profile:p1', 'quest:q1', { questId: 'quest:q2' } as ResultsTeaser)).toEqual({
      name: 'quest.teaser_tapped',
      profileId: 'profile:p1',
      payload: { fromQuestId: 'quest:q1', toQuestId: 'quest:q2' },
    });
  });

  it('reports the same quest for "Try this one again"', () => {
    expect(teaserTappedEvent('profile:p1', 'quest:q1', { questId: 'quest:q1' } as ResultsTeaser).payload).toEqual({
      fromQuestId: 'quest:q1',
      toQuestId: 'quest:q1',
    });
  });
});

describe('resultsTeaser: the target is routeNext (F-ENT-003 section 3.8, PR E3-4)', () => {
  const P = 'profile:p1';
  const TODAY = '2026-10-12';
  const learner = getMessages('en').learner;
  const item = (questId: string, targetDate: string): ProgressSnapshot['homework'][number] => ({
    id: `route:mine#${questId}`,
    profileId: P,
    questId,
    episodeId: EPISODES.find((e) => e.questIds.includes(questId))!.id,
    assignedBy: 'system',
    assignedAt: '2026-10-01T00:00:00.000Z',
    targetDate,
  });
  const route = (snapshot: ProgressSnapshot, over: Partial<RouteNextInput> = {}): RouteNextInput => ({
    snapshot,
    profileId: P,
    today: TODAY,
    sources: [{ id: 'route:mine', kind: 'self', assignedAt: '2026-10-01T00:00:00.000Z', items: [{ kind: 'quest', id: 'quest:q4' }], meta: null }],
    quests: QUESTS,
    episodes: EPISODES,
    cursor: { isEntitled: () => true, skipQuestIds: undefined },
    isQuestOpen: () => true,
    gating: { active: false, tier: 'premium' },
    ...over,
  });
  const withPlan = { ...done(), homework: [item('quest:q4', '2026-10-14')] };

  it('names the plan\'s next quest with the caption "Next in your plan", counting the quest just played as done', () => {
    const played = { ...withPlan, homework: [item('quest:q4', '2026-10-14'), item('quest:q2', '2026-10-15')] };
    const r = route(played);
    const t = resultsTeaser({ ...base, snapshot: played, questId: 'quest:q4', total: 5, route: r, planBefore: planBeforeOf(r) });
    expect(t).toMatchObject({ questId: 'quest:q2', caption: 'nextInPlan', source: 'self' });
    expect(teaserCaption(t!, learner)).toBe('Next in your plan');
  });

  it('the last plan item played: the default route with "Next up"', () => {
    const r = route(withPlan);
    expect(resultsTeaser({ ...base, snapshot: withPlan, questId: 'quest:q4', total: 5, route: r, planBefore: planBeforeOf(r) })).toMatchObject({
      questId: 'quest:q1',
      caption: 'nextUp',
      source: 'cursor',
    });
  });

  it('after a quest outside the plan: "Back to your plan" and the plan\'s next quest', () => {
    const r = route(withPlan);
    const before = planBeforeOf(r);
    const t = resultsTeaser({ ...base, snapshot: withPlan, questId: 'quest:q5', total: 5, route: r, planBefore: before });
    expect(t).toMatchObject({ questId: 'quest:q4', caption: 'backToPlan', source: 'self' });
    expect(teaserCaption(t!, learner)).toBe('Back to your plan');
  });

  it('the Thursday class / today family case: playing the family item Home named is not "Back to your plan"', () => {
    const s = {
      ...done(),
      homework: [
        { ...item('quest:q5', '2026-10-15'), id: 'plan:cls#quest:q5', assignedBy: 'teacher' as const },
        { ...item('quest:q2', TODAY), id: 'plan:fam#quest:q2', assignedBy: 'parent' as const },
      ],
    };
    const r = route(s, {
      sources: [
        { id: 'plan:cls', kind: 'class', assignedAt: '2026-10-01T00:00:00.000Z', items: [{ kind: 'quest', id: 'quest:q5' }], meta: null },
        { id: 'plan:fam', kind: 'family', assignedAt: '2026-10-01T00:00:00.000Z', items: [{ kind: 'quest', id: 'quest:q2' }], meta: null },
      ],
    });
    const before = planBeforeOf(r);
    const t = resultsTeaser({ ...base, snapshot: s, questId: 'quest:q2', total: 5, route: r, planBefore: before });
    expect(t).toMatchObject({ questId: 'quest:q5', caption: 'nextInPlan', source: 'class' });
    expect(offplanFinishedEvent(P, before, 'quest:q2', EPISODES)).toBeNull();
  });

  it('a classic plan item ten days out, played as Home\'s next: "Next in your plan", no off-plan event', () => {
    const s = { ...done(), homework: [item('quest:q4', '2026-10-22'), item('quest:q5', '2026-10-23')] };
    const r = route(s, {
      sources: [{ id: 'route:mine', kind: 'self', assignedAt: '2026-10-01T00:00:00.000Z', items: [{ kind: 'quest', id: 'quest:q4' }, { kind: 'quest', id: 'quest:q5' }], meta: null }],
    });
    const before = planBeforeOf(r);
    expect(before.view.inPlanQuestIds.size).toBe(0);
    const t = resultsTeaser({ ...base, snapshot: s, questId: 'quest:q4', total: 5, route: r, planBefore: before });
    expect(t).toMatchObject({ questId: 'quest:q5', caption: 'nextInPlan' });
    expect(offplanFinishedEvent(P, before, 'quest:q4', EPISODES)).toBeNull();
  });

  it('no plan: the cursor with today\'s "Next up"', () => {
    const r = route(done(), { sources: [] });
    const t = resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5, route: r, planBefore: planBeforeOf(r) });
    expect(t).toMatchObject({ questId: 'quest:q2', caption: 'nextUp', source: 'cursor' });
    expect(teaserCaption(t!, learner)).toBe('Next up');
  });

  it('without a plan view from before the quest, an off-plan quest still reads "Next in your plan"', () => {
    const t = resultsTeaser({ ...base, snapshot: withPlan, questId: 'quest:q5', total: 5, route: route(withPlan) });
    expect(t).toMatchObject({ questId: 'quest:q4', caption: 'nextInPlan' });
  });

  it('free-end and rest: no teaser card (E3-7 draws the free-end card)', () => {
    const all = done('q1', 'q2', 'q3', 'q4');
    const freeEnd = route(all, { sources: [], gating: { active: true, tier: 'free' }, isQuestOpen: (id) => id !== 'quest:q5' });
    expect(resultsTeaser({ ...base, snapshot: all, questId: 'quest:q4', total: 5, route: freeEnd })).toBeUndefined();
    const rest = route(all, { sources: [] });
    expect(resultsTeaser({ ...base, snapshot: all, questId: 'quest:q5', total: 5, route: rest })).toBeUndefined();
  });

  it('no teaser when routeNext names a quest this list does not hold', () => {
    const r = route(done(), { sources: [], quests: [plainQuest('quest:q0'), ...QUESTS], episodes: [episodeOf('episode:zero', ['quest:q0']), ...EPISODES] });
    expect(resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5, route: r })).toBeUndefined();
  });

  it('every game skipped: the same quest again, unchanged, no plan caption', () => {
    const r = route(withPlan);
    const t = resultsTeaser({ ...base, snapshot: withPlan, questId: 'quest:q1', total: 0, route: r, planBefore: planBeforeOf(r) });
    expect(t).toMatchObject({ questId: 'quest:q1', again: true, caption: 'nextUp' });
    expect(t?.source).toBeUndefined();
  });

  it('without route: today\'s cursor and the "Next up" caption', () => {
    const t = resultsTeaser({ ...base, snapshot: done(), questId: 'quest:q1', total: 5 });
    expect(t).toMatchObject({ caption: 'nextUp' });
    expect(t?.source).toBeUndefined();
  });

  it('route.next_started when the teaser is the one next; none for "Try this one again"', () => {
    const r = route(withPlan);
    const t = resultsTeaser({ ...base, snapshot: withPlan, questId: 'quest:q5', total: 5, route: r, planBefore: planBeforeOf(r) })!;
    expect(teaserNextStartedEvent(P, t)).toEqual({ name: 'route.next_started', profileId: P, payload: { source: 'self', surface: 'results' } });
    const again = resultsTeaser({ ...base, snapshot: withPlan, questId: 'quest:q1', total: 0, route: r })!;
    expect(teaserNextStartedEvent(P, again)).toBeNull();
  });
});
