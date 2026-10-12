import type { CultureNote } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { DRAWN_LIBRARY_SECTIONS, LIBRARY_SECTIONS, librarySectionTabs, selectedSection, visibleSections } from '../library-sections';
import { shelfIndex, story } from './shelf-fixture';

const note: CultureNote = {
  id: 'cn-x',
  titleEn: 'A note',
  bodyEn: 'A short sourced fact.',
  term: { ko: '한글날', romanization: 'hangeullal', en: 'Hangul Day' },
  factIds: ['f3'],
};

const tale = (slug: string, notes: CultureNote[] = []) =>
  ({ ...story(slug, { shelf: { category: 'story-time', order: 1 } }), cultureNotes: notes });
const culture = (slug: string, notes: CultureNote[] = []) =>
  ({ ...story(slug, { shelf: { category: 'culture', order: 1 } }), cultureNotes: notes });

describe('LIBRARY_SECTIONS', () => {
  it('registers the four sections in tab order', () => {
    expect(LIBRARY_SECTIONS.map((s) => s.id)).toEqual(['cards', 'story-time', 'culture', 'theme-packs']);
  });
});

describe('visibleSections', () => {
  it('cards only when no story is indexed (behaviour 5: today’s gallery, no tab row)', () => {
    expect(visibleSections({ entries: [] })).toEqual(['cards']);
  });

  it('Story Time needs a Story Time shelf story', () => {
    expect(visibleSections({ entries: shelfIndex([tale('tiger')]) })).toEqual(['cards', 'story-time']);
  });

  it('Culture appears for a culture shelf story', () => {
    expect(visibleSections({ entries: shelfIndex([culture('seollal')]) })).toEqual(['cards', 'culture']);
  });

  it('Culture also appears when an indexed story has a culture note', () => {
    expect(visibleSections({ entries: shelfIndex([tale('tiger', [note])]) })).toEqual(['cards', 'story-time', 'culture']);
  });

  it('all story sections together; theme packs stay reserved (F-VOC-003)', () => {
    expect(visibleSections({ entries: shelfIndex([tale('tiger'), culture('seollal')]) })).toEqual(['cards', 'story-time', 'culture']);
  });

  it('a book (grid) entry alone opens no shelf section, but its notes open Culture', () => {
    const grid = shelfIndex([tale('tiger')]).map((e) => ({ ...e, placement: 'grid' as const, category: null }));
    expect(visibleSections({ entries: grid })).toEqual(['cards']);
    const withNote = grid.map((e) => ({ ...e, story: { ...e.story, cultureNotes: [note] } }));
    expect(visibleSections({ entries: withNote })).toEqual(['cards', 'culture']);
  });
});

describe('selectedSection (§3.3: route.params.section ?? cards)', () => {
  const all = ['cards', 'story-time', 'culture'] as const;

  it('no requested section opens Cards', () => {
    expect(selectedSection(undefined, all)).toBe('cards');
  });

  it('a requested section that is offered opens it (deep link)', () => {
    expect(selectedSection('story-time', all)).toBe('story-time');
    expect(selectedSection('culture', all)).toBe('culture');
  });

  it('a requested section that is not offered falls back to Cards (no reviewed story, theme packs reserved)', () => {
    expect(selectedSection('story-time', ['cards'])).toBe('cards');
    expect(selectedSection('theme-packs', all)).toBe('cards');
  });
});

describe('librarySectionTabs (the tab row the Library draws)', () => {
  it('no tab row when only Cards is offered (behaviour 5: exactly today’s gallery)', () => {
    expect(librarySectionTabs({ entries: [] })).toEqual([]);
  });

  it('Cards and Story Time once a Story Time shelf story is indexed', () => {
    expect(librarySectionTabs({ entries: shelfIndex([tale('tiger')]) })).toEqual(['cards', 'story-time']);
  });

  it('a Culture shelf story or a culture note alone draws Cards and Culture', () => {
    expect(librarySectionTabs({ entries: shelfIndex([culture('seollal', [note])]) })).toEqual(['cards', 'culture']);
    expect(librarySectionTabs({ entries: shelfIndex([culture('seollal')]) })).toEqual(['cards', 'culture']);
  });

  it('a Story Time story with a culture note draws Cards, Story Time and Culture', () => {
    expect(librarySectionTabs({ entries: shelfIndex([tale('tiger', [note])]) })).toEqual(['cards', 'story-time', 'culture']);
  });

  it('keeps the registry order whatever the drawn set lists', () => {
    const all = new Set(['culture', 'story-time', 'cards'] as const);
    expect(librarySectionTabs({ entries: shelfIndex([tale('tiger', [note])]) }, all)).toEqual(['cards', 'story-time', 'culture']);
  });

  it('draws Cards, Story Time and Culture in this build (Theme packs is F-VOC-003)', () => {
    expect([...DRAWN_LIBRARY_SECTIONS]).toEqual(['cards', 'story-time', 'culture']);
  });
});
