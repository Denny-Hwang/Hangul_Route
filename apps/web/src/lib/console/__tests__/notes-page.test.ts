import { CATALOG, type SpaceRole } from '@hangul-route/content-schema';
import type { SpaceListItem } from '../api';
import { describe, expect, it } from 'vitest';
import {
  FAMILY_TABS,
  composerPrefill,
  notesHubView,
  notesPageQuery,
  notesPageHref,
  questOptions,
  questPrefill,
  reactionGlyph,
  notesSender,
  reportNoteLink,
  rosterNotesLinks,
} from '../notes-page';
import type { RecipientRow } from '../notes';
import { catalogTitle } from '@/data/catalog';
import { CATALOGUE_TITLES } from '@/data/catalogue-titles.generated';

/**
 * F-FEEDBACK-001 FB-11a (section 6.13; wireframes console/notes-sent.md, console/note-composer.md): the pure parts of
 * the notes page. The URL carries ids only; the composer preselects from `&learner` and prefills from `&quest`; the
 * family page auto-selects its only learner; the roster entries render only with the flag and never on an archived
 * space.
 */

const params = (query: string) => new URLSearchParams(query);

const row = (id: string, selectable = true): RecipientRow => ({ id, name: `Name ${id}`, selectable, line: null, presetsOnly: false });

describe('notesPageQuery', () => {
  it('reads the space id, the opaque learner id, the quest id, the composer switch and the tab', () => {
    expect(notesPageQuery(params('id=space%3Ac1&learner=profile%3Aa&quest=quest%3Ax&compose=1&tab=sent'))).toEqual({
      spaceId: 'space:c1',
      learner: 'profile:a',
      quest: 'quest:x',
      compose: true,
      tab: 'sent',
    });
  });

  it('defaults: no learner, no quest, the list, the first family tab', () => {
    expect(notesPageQuery(params('id=space%3Ac1'))).toEqual({ spaceId: 'space:c1', learner: null, quest: null, compose: false, tab: FAMILY_TABS[0] });
  });

  it('an unknown tab or a compose value other than 1 reads as the defaults; blank values are absent', () => {
    expect(notesPageQuery(params('id=s&tab=other&compose=yes&learner=%20&quest='))).toEqual({ spaceId: 's', learner: null, quest: null, compose: false, tab: FAMILY_TABS[0] });
  });

  it('the family tabs: Received first, the default of section 6.13, then Sent (FB-12)', () => {
    expect(FAMILY_TABS).toEqual(['received', 'sent']);
    expect(notesPageQuery(params('id=s&tab=received')).tab).toBe('received');
    expect(notesPageQuery(params('id=s')).tab).toBe('received');
  });

  it('null params (a static prerender) read as an empty page', () => {
    expect(notesPageQuery(null).spaceId).toBe('');
  });
});

describe('notesPageHref', () => {
  it('keeps the learner filter and the tab, adds or drops the composer, under the persona prefix', () => {
    expect(notesPageHref('space:c1', 'class', { learner: 'profile:a', compose: true })).toBe('/teach/space/notes?id=space%3Ac1&compose=1&learner=profile%3Aa');
    expect(notesPageHref('space:f1', 'family', { learner: null, compose: false, tab: 'sent' })).toBe('/parent/space/notes?id=space%3Af1&tab=sent');
    expect(notesPageHref('space:f1', 'family', {})).toBe('/parent/space/notes?id=space%3Af1');
  });

  it('never carries a name', () => {
    expect(notesPageHref('space:c1', 'class', { learner: 'profile:a' })).not.toContain('Name');
  });
});

describe('composerPrefill', () => {
  it('preselects the learner from the URL when that learner can be picked', () => {
    expect(composerPrefill([row('a'), row('b')], 'class', 'b')).toEqual(['b']);
  });

  it('never preselects a learner who cannot be picked or is not on the list', () => {
    expect(composerPrefill([row('a', false), row('b')], 'class', 'a')).toEqual([]);
    expect(composerPrefill([row('a')], 'class', 'z')).toEqual([]);
  });

  it('a family with exactly one learner selects that learner', () => {
    expect(composerPrefill([row('a')], 'family', null)).toEqual(['a']);
    expect(composerPrefill([row('a', false)], 'family', null)).toEqual([]);
    expect(composerPrefill([row('a'), row('b')], 'family', null)).toEqual([]);
  });

  it('a class with one student does not auto-select (the family rule only)', () => {
    expect(composerPrefill([row('a')], 'class', null)).toEqual([]);
  });
});

describe('questPrefill', () => {
  it('keeps a catalogue quest id and drops anything else', () => {
    const quest = CATALOG.quests[0];
    expect(quest).toBeDefined();
    expect(questPrefill(quest?.id ?? null)).toBe(quest?.id);
    expect(questPrefill('quest:not-in-the-catalogue')).toBeNull();
    expect(questPrefill(null)).toBeNull();
  });
});

describe('questOptions', () => {
  it('lists every catalogue quest once, grouped by stage in catalogue order, with the stage title', () => {
    const groups = questOptions((stage) => `T-${stage}`);
    const ids = groups.flatMap((g) => g.quests.map((q) => q.id));
    expect(ids).toHaveLength(CATALOG.quests.length);
    expect(new Set(ids).size).toBe(ids.length);
    expect(groups[0]?.title).toBe(`T-${groups[0]?.stage}`);
    for (const g of groups) for (const q of g.quests) expect(CATALOG.quests.find((c) => c.id === q.id)?.stage).toBe(g.stage);
  });

  it('titles every quest in the console language, English where no overlay has one (owner report 2026-10-16)', () => {
    const en = questOptions((stage) => stage).flatMap((g) => g.quests);
    expect(en.find((q) => q.id === 'quest:stage1-life-q1')?.title).toBe(CATALOG.quests.find((q) => q.id === 'quest:stage1-life-q1')?.title);
    for (const locale of ['es', 'ko'] as const) {
      const local = questOptions((stage) => stage, CATALOG, locale).flatMap((g) => g.quests);
      expect(local.map((q) => q.id)).toEqual(en.map((q) => q.id));
      for (const q of local) expect(q.title).toBe(catalogTitle(q.id, locale));
      expect(local.find((q) => q.id === 'quest:stage1-letters-q1')?.title).toBe(CATALOGUE_TITLES[locale]!['quest:stage1-letters-q1']);
    }
  });
});

describe('reactionGlyph', () => {
  it('maps each answer to its glyph (design/screens/notes/note-page.md) and anything else to none', () => {
    expect(reactionGlyph('thanks')).toBe('heart');
    expect(reactionGlyph('will_try')).toBe('pencil');
    expect(reactionGlyph('did_it')).toBe('check-circle');
    expect(reactionGlyph('happy')).toBe('sparkle');
    expect(reactionGlyph('new_answer')).toBeNull();
    expect(reactionGlyph(null)).toBeNull();
  });
});

describe('rosterNotesLinks', () => {
  it('flag off: no Notes action and no Send a note', () => {
    const links = rosterNotesLinks({ enabled: false, archived: false, role: 'owner', spaceId: 'space:c1', kind: 'class' });
    expect(links.header).toBeNull();
    expect(links.card('profile:a')).toBeNull();
  });

  it('flag on: the header opens the notes page; a card opens the composer with that learner, ids only', () => {
    const links = rosterNotesLinks({ enabled: true, archived: false, role: 'teacher', spaceId: 'space:c1', kind: 'class' });
    expect(links.header).toBe('/teach/space/notes?id=space%3Ac1');
    expect(links.card('profile:a')).toBe('/teach/space/notes?id=space%3Ac1&compose=1&learner=profile%3Aa');
  });

  it('a family uses the /parent prefix', () => {
    const links = rosterNotesLinks({ enabled: true, archived: false, role: 'caregiver', spaceId: 'space:f1', kind: 'family' });
    expect(links.header).toBe('/parent/space/notes?id=space%3Af1');
    expect(links.card('profile:a')).toBe('/parent/space/notes?id=space%3Af1&compose=1&learner=profile%3Aa');
  });

  it('an archived space keeps Notes (the list and take back still work) and has no Send a note', () => {
    const links = rosterNotesLinks({ enabled: true, archived: true, role: 'owner', spaceId: 'space:c1', kind: 'class' });
    expect(links.header).toBe('/teach/space/notes?id=space%3Ac1');
    expect(links.card('profile:a')).toBeNull();
  });

  it('a viewer whose role does not send here gets neither entry (a school admin on a class roster, section 8.2)', () => {
    for (const [role, kind] of [
      ['admin', 'class'],
      ['student', 'class'],
      ['caregiver', 'class'],
      ['teacher', 'family'],
      [null, 'class'],
      ['owner', 'school'],
    ] as const) {
      const links = rosterNotesLinks({ enabled: true, archived: false, role, spaceId: 'space:c1', kind });
      expect(links.header).toBeNull();
      expect(links.card('profile:a')).toBeNull();
    }
  });
});

describe('notesSender', () => {
  it('the owner, a class teacher and a family caregiver send; nobody sends in a school', () => {
    expect(notesSender('owner', 'class')).toBe(true);
    expect(notesSender('owner', 'family')).toBe(true);
    expect(notesSender('teacher', 'class')).toBe(true);
    expect(notesSender('caregiver', 'family')).toBe(true);
    expect(notesSender('admin', 'class')).toBe(false);
    expect(notesSender('admin', 'school')).toBe(false);
    expect(notesSender('owner', 'school')).toBe(false);
    expect(notesSender(null, 'family')).toBe(false);
  });
});

describe('notesHubView (FB-11b, console/notes-hub.md)', () => {
  const item = (id: string, kind: 'family' | 'class' | 'school', role: SpaceRole, archived = false): SpaceListItem => ({
    space: { id, kind, name: `Name ${id}`, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt: archived ? '2026-10-01T00:00:00.000Z' : null, createdAt: '2026-09-01T00:00:00.000Z' },
    role,
    counts: { learners: 1, accounts: 1, classes: 0 },
    joinCode: null,
    joinCodeExpiresAt: null,
  } as SpaceListItem);

  it('one family where the account may send or oversee: straight on to its notes page (A)', () => {
    expect(notesHubView([item('f1', 'family', 'caregiver'), item('c1', 'class', 'teacher')], 'parent')).toEqual({ kind: 'redirect', href: '/parent/space/notes?id=f1' });
  });

  it('one class the account teaches or owns: straight on to its notes page', () => {
    expect(notesHubView([item('c1', 'class', 'owner'), item('f1', 'family', 'owner')], 'teacher')).toEqual({ kind: 'redirect', href: '/teach/space/notes?id=c1' });
  });

  it('several: one row per space in the API order, with its notes page (B); archived classes left out', () => {
    expect(notesHubView([item('c2', 'class', 'teacher'), item('c1', 'class', 'owner'), item('c3', 'class', 'teacher', true)], 'teacher')).toEqual({
      kind: 'list',
      rows: [
        { id: 'c2', name: 'Name c2', href: '/teach/space/notes?id=c2' },
        { id: 'c1', name: 'Name c1', href: '/teach/space/notes?id=c1' },
      ],
    });
  });

  it('none: the persona start (C); a student, an admin or a school is not a notes space', () => {
    expect(notesHubView([item('c1', 'class', 'admin'), item('s1', 'school', 'owner'), item('f1', 'family', 'student')], 'teacher')).toEqual({ kind: 'none', start: '/start?persona=teacher' });
    expect(notesHubView([item('c1', 'class', 'teacher')], 'parent')).toEqual({ kind: 'none', start: '/start?persona=parent' });
  });
});

describe('reportNoteLink (FB-11b, F-REPORT-001 section 3.6)', () => {
  const base = { enabled: true, archived: false, spaceId: 'space:c1', learnerId: 'profile:a' };
  it('the composer with the learner, for the roles that may send', () => {
    expect(reportNoteLink({ ...base, kind: 'class', role: 'teacher' })).toBe('/teach/space/notes?id=space%3Ac1&compose=1&learner=profile%3Aa');
    expect(reportNoteLink({ ...base, kind: 'class', role: 'owner' })).not.toBeNull();
    expect(reportNoteLink({ ...base, kind: 'family', role: 'caregiver' })).toBe('/parent/space/notes?id=space%3Ac1&compose=1&learner=profile%3Aa');
    expect(reportNoteLink({ ...base, kind: 'family', role: 'owner' })).not.toBeNull();
  });

  it('none: flag off, archived, a school admin, a teacher of a family, a caregiver of a class, an unknown role, a school', () => {
    expect(reportNoteLink({ ...base, enabled: false, kind: 'class', role: 'owner' })).toBeNull();
    expect(reportNoteLink({ ...base, archived: true, kind: 'class', role: 'owner' })).toBeNull();
    expect(reportNoteLink({ ...base, kind: 'class', role: 'admin' })).toBeNull();
    expect(reportNoteLink({ ...base, kind: 'family', role: 'teacher' })).toBeNull();
    expect(reportNoteLink({ ...base, kind: 'class', role: 'caregiver' })).toBeNull();
    expect(reportNoteLink({ ...base, kind: 'class', role: null })).toBeNull();
    expect(reportNoteLink({ ...base, kind: 'school', role: 'owner' })).toBeNull();
  });
});
