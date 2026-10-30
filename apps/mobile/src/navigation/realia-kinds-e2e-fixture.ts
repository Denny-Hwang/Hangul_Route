import type { KoText, RealiaReadRound } from '@hangul-route/content-schema';
import type { MinigameScope } from '../logic/minigame-config';

/**
 * One Realia Read scope per realia kind of F-CURR-002 row CM-47 (a recipe card, a receipt, a food label, a weather
 * forecast, a calendar, a timetable, a map and a poster), for the fixture build's e2e screen (`realia-read-e2e-screen.tsx`, a
 * chunk `realia-read-e2e.tsx` reaches only through its literal `import()`, so a release start bundle never carries it) and the unit
 * tests. The words are fixture words: no lesson cell plays them (Volume 2 Stage 6 and the packs' L4 bring their own).
 * Prices are round practice amounts in won inside the drawn sheet only (OD-11); each question uses one number system.
 */

const k = (ko: string, romanization: string, en: string): KoText => ({ ko, romanization, en });

type FixtureEntry = { id: string; text: KoText; value?: KoText; dir?: 'left' | 'right' };
type AddedKind = 'recipe' | 'receipt' | 'label' | 'forecast' | 'calendar' | 'timetable' | 'map' | 'poster';

/** A one-question scope on one CM-47 sheet (row CM-47). */
const realiaScope = (kind: AddedKind, altEn: string, title: KoText, entries: FixtureEntry[], round: RealiaReadRound) =>
  ({ kind: 'realia-read', realiaRead: { realia: { ref: `realia:e2e-${kind}`, kind, title, entries, altEn }, rounds: [round] } }) as const satisfies MinigameScope;

export const REALIA_KIND_FIXTURES = {
  recipe: realiaScope('recipe', 'A recipe card for gimbap: rice, laver and an egg', k('김밥 만들기', 'gimbap mandeulgi', 'making gimbap'), [
    { id: 'rice', text: k('밥', 'bap', 'rice'), value: k('한 공기', 'han gonggi', 'one bowl') },
    { id: 'laver', text: k('김', 'gim', 'laver'), value: k('두 장', 'du jang', 'two sheets') },
    { id: 'egg', text: k('달걀', 'dalgyal', 'egg'), value: k('한 개', 'han gae', 'one') },
  ], { id: 'q1', questionEn: 'How many sheets of laver?', key: k('김', 'gim', 'laver'), options: [
    { id: 'one', text: k('한 장', 'han jang', 'one sheet') },
    { id: 'two', text: k('두 장', 'du jang', 'two sheets') },
    { id: 'three', text: k('세 장', 'se jang', 'three sheets') },
  ], answerId: 'two', answerEntryId: 'laver' }),
  receipt: realiaScope('receipt', 'A receipt: gimbap, instant noodles and milk, and the total', k('주문', 'jumun', 'order'), [
    { id: 'gimbap', text: k('김밥', 'gimbap', 'gimbap'), value: k('2,000원', 'icheon won', '2,000 won') },
    { id: 'ramyeon', text: k('라면', 'ramyeon', 'instant noodles'), value: k('3,000원', 'samcheon won', '3,000 won') },
    { id: 'milk', text: k('우유', 'uyu', 'milk'), value: k('1,000원', 'cheon won', '1,000 won') },
    { id: 'total', text: k('합계', 'hapgye', 'total'), value: k('6,000원', 'yukcheon won', '6,000 won') },
  ], { id: 'q1', questionEn: 'How much is this?', key: k('우유', 'uyu', 'milk'), options: [
    { id: 'cheon', text: k('천 원', 'cheon won', '1,000 won') },
    { id: 'icheon', text: k('이천 원', 'icheon won', '2,000 won') },
    { id: 'samcheon', text: k('삼천 원', 'samcheon won', '3,000 won') },
  ], answerId: 'cheon', answerEntryId: 'milk' }),
  label: realiaScope('label', 'A food label on a pack of laver: its weight and where it is from', k('김', 'gim', 'laver'), [
    { id: 'weight', text: k('무게', 'muge', 'weight'), value: k('20g', 'isip geuraem', '20 g') },
    { id: 'origin', text: k('원산지', 'wonsanji', 'origin'), value: k('국산', 'guksan', 'made in Korea') },
  ], { id: 'q1', questionEn: 'Where is it from?', key: k('원산지', 'wonsanji', 'origin'), options: [
    { id: 'local', text: k('국산', 'guksan', 'made in Korea') },
    { id: 'import', text: k('수입', 'suip', 'imported') },
  ], answerId: 'local', answerEntryId: 'origin' }),
  forecast: realiaScope('forecast', 'A weather card: sunny on Monday, rain on Tuesday, snow on Wednesday', k('이번 주 날씨', 'ibeon ju nalssi', "this week's weather"), [
    { id: 'mon', text: k('월', 'wol', 'Monday'), value: k('맑음', 'malgeum', 'sunny') },
    { id: 'tue', text: k('화', 'hwa', 'Tuesday'), value: k('비', 'bi', 'rain') },
    { id: 'wed', text: k('수', 'su', 'Wednesday'), value: k('눈', 'nun', 'snow') },
  ], { id: 'q1', questionEn: 'What is the weather on this day?', key: k('화', 'hwa', 'Tuesday'), options: [
    { id: 'sunny', text: k('맑음', 'malgeum', 'sunny') },
    { id: 'rain', text: k('비', 'bi', 'rain') },
    { id: 'snow', text: k('눈', 'nun', 'snow') },
  ], answerId: 'rain', answerEntryId: 'tue' }),
  calendar: realiaScope('calendar', 'A calendar page for October with two holidays', k('10월', 'siwol', 'October'), [
    { id: 'd3', text: k('3일', 'samil', 'the 3rd'), value: k('개천절', 'gaecheonjeol', 'National Foundation Day') },
    { id: 'd9', text: k('9일', 'guil', 'the 9th'), value: k('한글날', 'hangeullal', 'Hangeul Day') },
  ], { id: 'q1', questionEn: 'When is it?', key: k('한글날', 'hangeullal', 'Hangeul Day'), options: [
    { id: 'd3', figure: '3' },
    { id: 'd9', figure: '9' },
  ], answerId: 'd9', answerEntryId: 'd9' }),
  timetable: realiaScope('timetable', 'A station departure board: trains to Daejeon, Busan and Daegu, each with its time', k('출발', 'chulbal', 'departure'), [
    { id: 'daejeon', text: k('대전', 'daejeon', 'Daejeon (a city)'), value: k('한 시', 'han si', '1:00') },
    { id: 'busan', text: k('부산', 'busan', 'Busan (a city)'), value: k('두 시', 'du si', '2:00') },
    { id: 'daegu', text: k('대구', 'daegu', 'Daegu (a city)'), value: k('세 시', 'se si', '3:00') },
  ], { id: 'q1', questionEn: 'When does it leave?', key: k('부산', 'busan', 'Busan (a city)'), options: [
    { id: 'one', text: k('한 시', 'han si', '1:00') },
    { id: 'two', text: k('두 시', 'du si', '2:00') },
    { id: 'three', text: k('세 시', 'se si', '3:00') },
  ], answerId: 'two', answerEntryId: 'busan' }),
  map: realiaScope('map', 'A park map with the entrance, a lake and the summit', k('공원 지도', 'gongwon jido', 'park map'), [
    { id: 'entrance', text: k('입구', 'ipgu', 'entrance'), dir: 'left' },
    { id: 'lake', text: k('호수', 'hosu', 'lake'), value: k('500m', 'obaek miteo', '500 m') },
    { id: 'summit', text: k('정상', 'jeongsang', 'summit'), dir: 'right' },
  ], { id: 'q1', questionEn: 'Which way is the summit?', key: k('정상', 'jeongsang', 'summit'), options: [
    { id: 'left', text: k('왼쪽', 'oenjjok', 'left') },
    { id: 'right', text: k('오른쪽', 'oreunjjok', 'right') },
  ], answerId: 'right', answerEntryId: 'summit' }),
  poster: realiaScope('poster', 'A Hangeul Day poster: the date, the place and the time', k('한글날', 'hangeullal', 'Hangeul Day'), [
    { id: 'date', text: k('10월 9일', 'siwol guil', 'October 9') },
    { id: 'place', text: k('도서관', 'doseogwan', 'library') },
    { id: 'time', text: k('오전 열 시', 'ojeon yeol si', '10 a.m.') },
  ], { id: 'q1', questionEn: 'Where is it?', options: [
    { id: 'library', text: k('도서관', 'doseogwan', 'library') },
    { id: 'school', text: k('학교', 'hakgyo', 'school') },
    { id: 'park', text: k('공원', 'gongwon', 'park') },
  ], answerId: 'library', answerEntryId: 'place' }),
} satisfies Record<AddedKind, MinigameScope>;

export type RealiaKindFixtureKey = keyof typeof REALIA_KIND_FIXTURES;
