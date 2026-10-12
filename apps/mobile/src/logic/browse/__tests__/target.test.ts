import type { BrowseTarget } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { stage1QuestsFrom, teachingQuestFor } from '../../stage1/curriculum';
import type { ResolvedPass } from '../pass';
import { resolveEntry, resolveTarget } from '../target';
import { TALE_ID, fixtureBundle } from './browse-fixture';

/**
 * F-BROWSE-001 §4.4 (BR-4): a deep-link target resolves to one browse screen;
 * a letter opens the lesson that teaches it; anything the bundle does not
 * know lands on home with a note; without an active pass, the Access screen.
 */
const bundle = fixtureBundle();
const stage1 = stage1QuestsFrom(bundle.episodes, bundle.quests);
const active: ResolvedPass = { status: 'active', scope: 'full', from: 'account', fallback: false, removeSession: false, removeKept: false };
const CARD = (bundle.cards[0] as (typeof bundle.cards)[number]).id;
/** A compatibility jamo (U+3131 to U+318E) this bundle holds no letter for: read from the bundle, so new letters never break the case. */
const ABSENT_CHAR = Array.from({ length: 0x318e - 0x3131 + 1 }, (_, i) => String.fromCharCode(0x3131 + i)).find((c) => !bundle.jamo.some((j) => j.char === c)) as string;

describe('resolveTarget', () => {
  it('no target opens home on its default section', () => {
    expect(resolveTarget(null, bundle)).toEqual({ screen: 'home', section: null });
  });

  it('a stage opens the Journey at that stage', () => {
    expect(resolveTarget({ kind: 'stage', stage: 'stage4' }, bundle)).toEqual({ screen: 'home', section: 'journey', stage: 'stage4' });
  });

  it('an episode opens its outline, a preview episode too (it reads "Coming later")', () => {
    expect(resolveTarget({ kind: 'episode', id: 'episode:stage1-letters' }, bundle)).toEqual({ screen: 'episode', episodeId: 'episode:stage1-letters' });
    const preview = bundle.episodes.find((e) => e.status === 'preview');
    expect(preview).toBeDefined();
    expect(resolveTarget({ kind: 'episode', id: preview?.id ?? '' }, bundle)).toEqual({ screen: 'episode', episodeId: preview?.id });
  });

  it('a quest, a story and a word topic open their item page; a card opens over home', () => {
    expect(resolveTarget({ kind: 'quest', id: 'quest:stage1-letters-q2' }, bundle)).toEqual({ screen: 'item', kind: 'quest', id: 'quest:stage1-letters-q2' });
    expect(resolveTarget({ kind: 'quest', id: 'quest:story-hangul-day-listen' }, bundle)).toEqual({ screen: 'item', kind: 'quest', id: 'quest:story-hangul-day-listen' });
    expect(resolveTarget({ kind: 'episode', id: 'episode:shelf-hangul-day' }, bundle)).toEqual({ screen: 'episode', episodeId: 'episode:shelf-hangul-day' });
    expect(resolveTarget({ kind: 'story', id: TALE_ID }, bundle)).toEqual({ screen: 'item', kind: 'story', id: TALE_ID });
    expect(resolveTarget({ kind: 'vocab-topic', id: 'vocab-topic:food' }, bundle)).toEqual({ screen: 'item', kind: 'vocab-topic', id: 'vocab-topic:food' });
    expect(resolveTarget({ kind: 'card', id: CARD }, bundle)).toEqual({ screen: 'card', cardId: CARD });
  });

  it('a letter opens the lesson that teaches it, marked as the focus', () => {
    const taught = bundle.jamo.filter((j) => teachingQuestFor(j.id, stage1));
    expect(taught.length).toBeGreaterThan(0);
    for (const jamo of taught) {
      expect(resolveTarget({ kind: 'jamo', id: jamo.id }, bundle), jamo.id).toEqual({ screen: 'item', kind: 'quest', id: teachingQuestFor(jamo.id, stage1)?.id, focusJamoId: jamo.id });
    }
  });

  it('a letter no lesson teaches lands on the Stage 1 Journey with a note', () => {
    // Since F-QUEST-002 Q-8 the bundle teaches every letter; without the lesson that teaches one, that letter is untaught.
    expect(bundle.jamo.every((j) => teachingQuestFor(j.id, stage1))).toBe(true);
    const letter = bundle.jamo[bundle.jamo.length - 1] as (typeof bundle.jamo)[number];
    const teacher = teachingQuestFor(letter.id, stage1);
    const without = { ...bundle, quests: bundle.quests.filter((q) => q.id !== teacher?.id) };
    expect(teachingQuestFor(letter.id, stage1QuestsFrom(without.episodes, without.quests))).toBeUndefined();
    expect(resolveTarget({ kind: 'jamo', id: letter.id }, without)).toEqual({ screen: 'home', section: 'journey', stage: 'stage1', note: 'letter-across-stage1' });
  });

  it('a character resolves to its letter, never to the final-consonant form', () => {
    // every character the bundle holds as a final consonant too
    const finals = bundle.jamo.filter((j) => j.kind === 'batchim');
    expect(finals.length).toBeGreaterThan(0);
    for (const final of finals) {
      const letter = bundle.jamo.find((j) => j.char === final.char && j.kind !== 'batchim');
      expect(letter, final.char).toBeDefined();
      expect(resolveTarget({ kind: 'char', char: final.char }, bundle), final.char).toEqual(resolveTarget({ kind: 'jamo', id: letter?.id ?? '' }, bundle));
      expect(resolveTarget({ kind: 'char', char: final.char }, bundle)).not.toMatchObject({ focusJamoId: final.id });
    }
    const vowel = bundle.jamo.find((j) => j.kind === 'vowel' && teachingQuestFor(j.id, stage1)) as (typeof bundle.jamo)[number];
    expect(resolveTarget({ kind: 'char', char: vowel.char }, bundle)).toMatchObject({ screen: 'item', focusJamoId: vowel.id });
  });

  it('an id the bundle does not know lands on home with the not-in-this-version note', () => {
    expect(ABSENT_CHAR).toBeDefined();
    const unknown: BrowseTarget[] = [
      { kind: 'episode', id: 'episode:stage9-space' },
      { kind: 'quest', id: 'quest:stage9-space-q1' },
      { kind: 'story', id: 'story:draft-tale' }, // bundled but unreviewed: never reachable
      { kind: 'quest', id: 'quest:story-draft-tale-listen' }, // ...not through its own quest
      { kind: 'episode', id: 'episode:shelf-draft-tale' }, // ...nor through its shelf episode
      { kind: 'story', id: 'story:not-bundled' },
      { kind: 'vocab-topic', id: 'vocab-topic:space' },
      { kind: 'card', id: 'card:not-bundled' },
      { kind: 'jamo', id: 'jamo:not-bundled' },
      { kind: 'char', char: ABSENT_CHAR },
    ];
    for (const target of unknown) expect(resolveTarget(target, bundle), JSON.stringify(target)).toEqual({ screen: 'home', section: null, note: 'not-in-version' });
  });

  it('a draft episode and a quest that no openable episode lists are not in this version', () => {
    const draft = { ...(bundle.episodes[0] as (typeof bundle.episodes)[number]), id: 'episode:draft-cell', status: 'draft' as const, questIds: ['quest:draft-only'] };
    const withDraft = { ...bundle, episodes: [...bundle.episodes, draft], quests: [...bundle.quests, { ...(bundle.quests[0] as (typeof bundle.quests)[number]), id: 'quest:draft-only' }] };
    expect(resolveTarget({ kind: 'episode', id: 'episode:draft-cell' }, withDraft)).toMatchObject({ note: 'not-in-version' });
    expect(resolveTarget({ kind: 'quest', id: 'quest:draft-only' }, withDraft)).toMatchObject({ note: 'not-in-version' });
  });
});

describe('resolveEntry', () => {
  it('an active pass gets the resolved screen', () => {
    expect(resolveEntry({ target: { kind: 'quest', id: 'quest:stage1-letters-q1' }, pass: active, lastPersona: null, bundle })).toEqual({ screen: 'item', kind: 'quest', id: 'quest:stage1-letters-q1' });
    expect(resolveEntry({ target: null, pass: { ...active, scope: 'sampler', from: 'gate' }, lastPersona: null, bundle })).toEqual({ screen: 'home', section: null });
  });

  it('no active pass always lands on the Access screen, whatever the target', () => {
    const none: ResolvedPass = { status: 'none', reason: 'none', expiredSource: null, removeSession: false, removeKept: false };
    const expired: ResolvedPass = { status: 'none', reason: 'expired', expiredSource: 'gate', removeSession: false, removeKept: false };
    expect(resolveEntry({ target: { kind: 'quest', id: 'quest:stage1-letters-q1' }, pass: none, lastPersona: null, bundle })).toEqual({ screen: 'access', reason: 'none', source: 'unknown' });
    expect(resolveEntry({ target: null, pass: none, lastPersona: 'teacher', bundle })).toEqual({ screen: 'access', reason: 'none', source: 'account' });
    expect(resolveEntry({ target: { kind: 'card', id: CARD }, pass: expired, lastPersona: 'parent', bundle })).toEqual({ screen: 'access', reason: 'expired', source: 'gate' });
  });
});
