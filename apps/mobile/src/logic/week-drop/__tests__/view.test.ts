import type { WeekNotePart } from '@hangul-route/content-schema/week-drops';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { WEEK_DROPS } from '../../../content/__generated__/week-drop-chunks/week-drops';
import { weekDropView } from '../view';

/*
 * A drop in the UI language (F-CURR-002 §5.7, row CM-48), and the overlay coverage of the first 13 drops: every title,
 * note and word meaning has its es and ko text, a note keeps its taught-Korean tokens in every locale, no Spanish text
 * carries Hangul, and the source line is the card back's citation, never a URL.
 */

const HANGUL = /[가-힣ㄱ-ㆎ]/;

describe('weekDropView', () => {
  it('draws the drop in each UI locale, its first word as the card lead, and its first source as the citation', () => {
    const drop = WEEK_DROPS.find((d) => d.weekOf === '2026-11-02');
    expect(drop).toBeDefined();
    for (const locale of ['en', 'es', 'ko'] as const) {
      const view = weekDropView(drop!, locale, getMessages(locale).learner.cardDetail.citation);
      expect(view.lead).toEqual({ ko: '입동', romanization: 'ipdong' });
      expect(view.words.map((w) => w.ko)).toEqual(['입동', '겨울', '김장', '배추', '무']);
      expect(view.citation?.line).not.toMatch(/https?:/);
      expect(view.citation?.more).not.toBeNull();
    }
    expect(weekDropView(drop!, 'en', getMessages('en').learner.cardDetail.citation).title).toBe('Winter Begins');
    expect(weekDropView(drop!, 'es', getMessages('es').learner.cardDetail.citation).title).toBe('Empieza el invierno');
    expect(weekDropView(drop!, 'ko', getMessages('ko').learner.cardDetail.citation).words[1]?.meaning).toBe('가을과 봄 사이의 가장 추운 계절');
  });

  it('falls back to the English field by field when a locale has no text', () => {
    const drop = { ...WEEK_DROPS[0]!, title: { en: 'Only English' }, note: { en: [{ text: 'x' }] }, items: [] };
    const view = weekDropView(drop, 'ko', getMessages('ko').learner.cardDetail.citation);
    expect(view.title).toBe('Only English');
    expect(view.note).toEqual([{ text: 'x' }]);
    expect(view.lead).toEqual({ ko: '', romanization: '' });
  });
});

describe('overlay coverage of the first 13 drops (es and ko in the same PR, F-I18N-001 §3.10)', () => {
  it('gives every title, note and meaning its es and ko text, never the English', () => {
    expect(WEEK_DROPS).toHaveLength(13);
    for (const drop of WEEK_DROPS) {
      for (const locale of ['es', 'ko'] as const) {
        expect(drop.title[locale], `${drop.id} ${locale} title`).toBeDefined();
        expect(drop.title[locale]).not.toBe(drop.title.en);
        expect(drop.note[locale], `${drop.id} ${locale} note`).toBeDefined();
        for (const item of drop.items) {
          expect(item.gloss[locale], `${drop.id} ${item.id} ${locale}`).toBeDefined();
          if (locale === 'ko') expect(item.gloss.ko, `${drop.id} ${item.id}`).not.toBe(item.ko);
        }
      }
    }
  });

  it('keeps the same taught-Korean tokens in every locale, and no Hangul in Spanish outside them', () => {
    const tokens = (parts: readonly WeekNotePart[]) => parts.flatMap((p) => ('ko' in p ? [p.ko] : [])).sort();
    for (const drop of WEEK_DROPS) {
      expect(tokens(drop.note.es ?? []), drop.id).toEqual(tokens(drop.note.en));
      expect(tokens(drop.note.ko ?? []), drop.id).toEqual(tokens(drop.note.en));
      for (const part of drop.note.es ?? []) if ('text' in part) expect(HANGUL.test(part.text), drop.id).toBe(false);
      expect(HANGUL.test(drop.title.es ?? ''), drop.id).toBe(false);
      for (const item of drop.items) expect(HANGUL.test(item.gloss.es ?? ''), `${drop.id} ${item.id}`).toBe(false);
    }
  });

  it('romanizes every note token (F-CNT-002), and no copy shows a percentage, a score or an emoji', () => {
    for (const drop of WEEK_DROPS) {
      for (const parts of [drop.note.en, drop.note.es ?? [], drop.note.ko ?? []]) {
        for (const part of parts) if ('ko' in part) expect(part.romanization, drop.id).toMatch(/^[a-z]+( [a-z]+)*$/);
      }
      const text = JSON.stringify([drop.title, drop.note]);
      expect(text, drop.id).not.toMatch(/%|\b\d+\s*(of|\/)\s*\d+\b/);
      expect(text, drop.id).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});
