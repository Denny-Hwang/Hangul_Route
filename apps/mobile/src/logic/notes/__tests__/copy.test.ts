import { FAMILY_LABEL_IDS, NOTE_PRESET_IDS, NOTE_REACTION_IDS } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { familyLabelText, noteDateText, presetText, reactionText, reportLinkText, seenByText, teacherLabelText, textLang } from '../copy';

const m = getMessages('en');

/** F-FEEDBACK-001 section 6.11 and FB-7 `copy.ts`: the dictionary selectors of the learner screens. */
describe('presetText', () => {
  it('renders every catalogue id from common.notes.presets', () => {
    for (const id of NOTE_PRESET_IDS) expect(presetText(m, id)).toBe(m.common.notes.presets[id]);
  });

  it('an id this app does not know (a newer Worker) renders the fallback line', () => {
    expect(presetText(m, 'warm_new_one')).toBe('A note for you.');
    expect(presetText(m, 'toString')).toBe('A note for you.');
    expect(presetText(m, '')).toBe('A note for you.');
  });
});

describe('familyLabelText', () => {
  it('renders every label; a missing or unknown label reads "Your family"', () => {
    for (const id of FAMILY_LABEL_IDS.filter((l) => l !== 'partner')) expect(familyLabelText(m, id, 'child')).toBe(m.common.notes.familyLabels[id]);
    expect(familyLabelText(m, null, 'child')).toBe('Your family');
  });

  it('reads "Your partner" only on a self learner; any other profile, or no type, reads "Your family"', () => {
    expect(familyLabelText(m, 'partner', 'self')).toBe('Your partner');
    expect(familyLabelText(m, 'partner', 'child')).toBe('Your family');
    expect(familyLabelText(m, 'partner', undefined)).toBe('Your family');
  });
});

describe('teacherLabelText', () => {
  it('names the class, never an account; an unknown class reads "Your teacher"', () => {
    expect(teacherLabelText(m, 'Sunday Class A')).toBe('Your teacher · Sunday Class A');
    expect(teacherLabelText(m, null)).toBe('Your teacher');
    expect(teacherLabelText(m, '  ')).toBe('Your teacher');
  });
});

describe('reactionText', () => {
  it('renders the four reactions and ignores an unknown id', () => {
    for (const id of NOTE_REACTION_IDS) expect(reactionText(m, id)).toBe(m.common.notes.reactions[id]);
    expect(reactionText(m, 'wave')).toBeNull();
    expect(reactionText(m, null)).toBeNull();
  });
});

describe('seenByText and reportLinkText', () => {
  it('words who sees the answer', () => {
    expect(seenByText(m, 'teacher')).toBe('Your teacher will see your answer.');
    expect(seenByText(m, 'family')).toBe('Your family will see your answer.');
  });

  it('says "Tell a grown-up", or "Report this note" on a self-managed profile', () => {
    expect(reportLinkText(m, false)).toBe('Tell a grown-up');
    expect(reportLinkText(m, true)).toBe('Report this note');
  });
});

describe('noteDateText', () => {
  const now = new Date('2026-10-12T15:00:00.000Z');

  it('"Today", "Yesterday", otherwise a short date in the UI locale', () => {
    expect(noteDateText(m, 'en', '2026-10-12T01:00:00.000Z', now)).toBe('Today');
    expect(noteDateText(m, 'en', '2026-10-11T23:00:00.000Z', now)).toBe('Yesterday');
    expect(noteDateText(m, 'en', '2026-10-03T10:00:00.000Z', now)).toBe('Oct 3');
    expect(noteDateText(m, 'es', '2026-10-03T10:00:00.000Z', now)).not.toBe('Oct 3');
  });

  it('a date from a clock ahead of the device reads "Today"; an unreadable date reads as nothing', () => {
    expect(noteDateText(m, 'en', '2026-10-13T10:00:00.000Z', now)).toBe('Today');
    expect(noteDateText(m, 'en', 'not a date', now)).toBe('');
  });
});

describe('textLang', () => {
  it('marks a text with Hangul as Korean, otherwise the sender console locale, otherwise nothing', () => {
    expect(textLang({ text: '잘했어요 Mina', textLocale: 'en' })).toBe('ko');
    expect(textLang({ text: 'ㄱ and ㄴ today', textLocale: 'en' })).toBe('ko');
    expect(textLang({ text: 'Muy bien', textLocale: 'es' })).toBe('es');
    expect(textLang({ text: 'Great work', textLocale: null })).toBeUndefined();
    expect(textLang({ text: null, textLocale: 'en' })).toBeUndefined();
  });
});
