import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

/**
 * The grouped lesson picker's words (owner report 2026-10-16 item 5, AMENDMENTS-LECTURE-V2 row LV-3) in the three
 * UI languages, as the multi-agent review signed them (F-I18N-001 §3.10: Spanish informal tú with Latin-American words,
 * Korean 해요체 with no particle on a variable; glossary: n단계 for Stage n, 낱말 for a word being learned). Content
 * titles are data and never part of these messages.
 */
describe('console.chooser', () => {
  it('English', () => {
    const c = getMessages('en').console.chooser;
    expect(c.planTitle).toBe('Lessons');
    expect(c.search).toEqual({ label: 'Search lessons', hint: 'Type a title, Hangul or romanization.' });
    expect(c.clearSearch.cta).toBe('Clear');
    expect(c.groups).toBe('Choose what to see');
    expect([c.chip.stage(2), c.chip.stories, c.chip.topics]).toEqual(['Stage 2', 'Stories', 'Word topics']);
    expect([c.heading.stage(2, 18), c.heading.stage(1, 1), c.heading.stories(24), c.heading.stories(1), c.heading.topics(12), c.heading.topics(1)]).toEqual([
      'Stage 2 · 18 lessons',
      'Stage 1 · 1 lesson',
      'Stories · 24 stories',
      'Stories · 1 story',
      'Word topics · 12 topics',
      'Word topics · 1 topic',
    ]);
    expect([c.episodeDetail(3, 15), c.episodeDetail(1, 5)]).toEqual(['3 lessons · about 15 min', '1 lesson · about 5 min']);
    expect(c.minutes(5)).toBe('about 5 min');
    expect(c.lessonsOf('Meet the Letters')).toBe('Lessons: Meet the Letters');
    expect([c.found(1), c.found(4)]).toEqual(['1 match', '4 matches']);
    expect(c.noMatch).toBe('Nothing matches. Try another word, or type it in Hangul.');
    expect([c.chosen(1, 5), c.chosen(3, 40)]).toEqual(['1 chosen · about 5 min', '3 chosen · about 40 min']);
    expect(c.full).toBe('This is full. Remove something to add more.');
    expect(c.bar).toBe('Your choices');
  });

  it('Spanish', () => {
    const c = getMessages('es').console.chooser;
    expect(c.planTitle).toBe('Lecciones');
    expect(c.search).toEqual({ label: 'Buscar lecciones', hint: 'Busca por título, hangul o romanización.' });
    expect(c.clearSearch.cta).toBe('Borrar');
    expect(c.groups).toBe('Elige qué ver');
    expect([c.chip.stage(2), c.chip.stories, c.chip.topics]).toEqual(['Etapa 2', 'Historias', 'Temas de palabras']);
    expect([c.heading.stage(2, 18), c.heading.stage(1, 1), c.heading.stories(24), c.heading.stories(1), c.heading.topics(12), c.heading.topics(1)]).toEqual([
      'Etapa 2 · 18 lecciones',
      'Etapa 1 · 1 lección',
      'Historias · 24 historias',
      'Historias · 1 historia',
      'Temas de palabras · 12 temas',
      'Temas de palabras · 1 tema',
    ]);
    expect([c.episodeDetail(3, 15), c.episodeDetail(1, 5)]).toEqual(['3 lecciones · aprox. 15 min', '1 lección · aprox. 5 min']);
    expect(c.minutes(5)).toBe('aprox. 5 min');
    expect(c.lessonsOf('Conoce las letras')).toBe('Lecciones: Conoce las letras');
    expect([c.found(1), c.found(4)]).toEqual(['1 resultado', '4 resultados']);
    expect(c.noMatch).toBe('No hay resultados. Prueba otra palabra o escríbela en hangul.');
    expect(c.chosen(3, 40)).toBe('Elegiste 3 · aprox. 40 min');
    expect(c.full).toBe('Ya está lleno. Quita algo para añadir más.');
    expect(c.bar).toBe('Tu selección');
  });

  it('Korean', () => {
    const c = getMessages('ko').console.chooser;
    expect(c.planTitle).toBe('수업');
    expect(c.search).toEqual({ label: '수업 찾기', hint: '제목, 한글, 로마자로 찾아요.' });
    expect(c.clearSearch.cta).toBe('지우기');
    expect(c.groups).toBe('볼 것 고르기');
    expect([c.chip.stage(2), c.chip.stories, c.chip.topics]).toEqual(['2단계', '이야기', '낱말 주제']);
    expect([c.heading.stage(2, 18), c.heading.stories(24), c.heading.topics(12)]).toEqual(['2단계 · 수업 18개', '이야기 · 24편', '낱말 주제 · 12개']);
    expect(c.episodeDetail(3, 15)).toBe('수업 3개 · 약 15분');
    expect(c.minutes(5)).toBe('약 5분');
    // No particle on the variable: a colon form.
    expect(c.lessonsOf('글자 만나기')).toBe('수업 목록: 글자 만나기');
    expect(c.found(4)).toBe('4개 찾았어요');
    expect(c.noMatch).toBe('맞는 수업이 없어요. 다른 말로 찾거나 한글로 써 봐요.');
    expect(c.chosen(3, 40)).toBe('3개 골랐어요 · 약 40분');
    expect(c.full).toBe('가득 찼어요. 하나를 빼면 더 넣을 수 있어요.');
    expect(c.bar).toBe('고른 것');
  });
});
