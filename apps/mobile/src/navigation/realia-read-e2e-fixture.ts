import type { KoText } from '@hangul-route/content-schema';
import type { MinigameScope } from '../logic/minigame-config';

/**
 * The four realia of the D-2 mocks (design/screens/minigame-realia-read/), as Realia Read
 * scopes for the fixture build's e2e entry (`realia-read-e2e.tsx`) and the unit tests. No lesson
 * cell plays Realia Read until S6-1 .. S6-5 ship, so the game is tested on these.
 *
 * The words are the spec's fixture words (F-CURR-001 §3.6). Prices are round practice amounts in
 * won inside the drawn sheet only (OD-11): no shop, brand, product price, fare, company or train
 * number. Each question uses one number system (Sino-Korean for won and minutes, native before a
 * counter), never both.
 */

const k = (ko: string, romanization: string, en: string): KoText => ({ ko, romanization, en });

export const REALIA_FIXTURES = {
  menu: {
    kind: 'realia-read',
    realiaRead: {
      realia: {
        ref: 'realia:e2e-menu',
        kind: 'menu',
        title: k('메뉴', 'menyu', 'menu'),
        entries: [
          { id: 'gimbap', text: k('김밥', 'gimbap', 'gimbap, rice rolls'), value: k('2,000원', 'icheon won', '2,000 won') },
          { id: 'tteokbokki', text: k('떡볶이', 'tteokbokki', 'spicy rice cakes'), value: k('3,000원', 'samcheon won', '3,000 won') },
          { id: 'ramyeon', text: k('라면', 'ramyeon', 'instant noodles'), value: k('3,000원', 'samcheon won', '3,000 won') },
          { id: 'bibimbap', text: k('비빔밥', 'bibimbap', 'mixed rice'), value: k('5,000원', 'ocheon won', '5,000 won') },
        ],
        altEn: 'A snack-bar menu board with four dishes and their prices',
      },
      rounds: [
        {
          id: 'q1',
          questionEn: 'How much is this?',
          key: k('라면', 'ramyeon', 'instant noodles'),
          options: [
            { id: 'samcheon', text: k('삼천 원', 'samcheon won', '3,000 won') },
            { id: 'icheon', text: k('이천 원', 'icheon won', '2,000 won') },
            { id: 'ocheon', text: k('오천 원', 'ocheon won', '5,000 won') },
            { id: 'cheon', text: k('천 원', 'cheon won', '1,000 won') },
          ],
          answerId: 'samcheon',
          answerEntryId: 'ramyeon',
        },
        {
          id: 'q2',
          questionEn: 'Which one costs this?',
          key: k('오천 원', 'ocheon won', '5,000 won'),
          options: [
            { id: 'bibimbap', text: k('비빔밥', 'bibimbap', 'mixed rice') },
            { id: 'gimbap', text: k('김밥', 'gimbap', 'gimbap') },
            { id: 'ramyeon', text: k('라면', 'ramyeon', 'instant noodles') },
          ],
          answerId: 'bibimbap',
          answerEntryId: 'bibimbap',
        },
        {
          id: 'q3',
          questionEn: 'How much is this?',
          key: k('김밥', 'gimbap', 'gimbap'),
          options: [
            { id: 'icheon', text: k('이천 원', 'icheon won', '2,000 won') },
            { id: 'samcheon', text: k('삼천 원', 'samcheon won', '3,000 won') },
          ],
          answerId: 'icheon',
          answerEntryId: 'gimbap',
        },
      ],
    },
  },
  ticket: {
    kind: 'realia-read',
    realiaRead: {
      realia: {
        ref: 'realia:e2e-ticket',
        kind: 'ticket',
        title: k('기차표', 'gichapyo', 'train ticket'),
        entries: [
          { id: 'dep', text: k('출발', 'chulbal', 'departure'), value: k('서울 3:00', 'seoul se si', 'Seoul, 3:00') },
          { id: 'arr', text: k('도착', 'dochak', 'arrival'), value: k('대전 4:30', 'daejeon ne si samsip bun', 'Daejeon, 4:30') },
        ],
        altEn: 'A train ticket with a departure and an arrival',
      },
      rounds: [
        {
          id: 'q1',
          questionEn: 'What time does it leave?',
          key: k('출발', 'chulbal', 'departure'),
          options: [
            { id: 't300', figure: '3:00' },
            { id: 't400', figure: '4:00' },
            { id: 't430', figure: '4:30' },
          ],
          answerId: 't300',
          answerEntryId: 'dep',
        },
      ],
    },
  },
  sign: {
    kind: 'realia-read',
    realiaRead: {
      realia: {
        ref: 'realia:e2e-sign',
        kind: 'sign',
        title: k('산길', 'sangil', 'mountain trail'),
        entries: [
          { id: 'summit', text: k('정상', 'jeongsang', 'summit'), value: k('1시간', 'han sigan', '1 hour'), dir: 'right' },
          { id: 'entrance', text: k('입구', 'ipgu', 'entrance'), dir: 'left' },
          { id: 'exit', text: k('출구', 'chulgu', 'exit'), dir: 'left' },
        ],
        altEn: 'A trail sign with boards pointing to the summit, the entrance and the exit',
      },
      rounds: [
        {
          id: 'q1',
          questionEn: 'Which way is the summit?',
          key: k('정상', 'jeongsang', 'summit'),
          options: [
            { id: 'left', text: k('왼쪽', 'oenjjok', 'left') },
            { id: 'right', text: k('오른쪽', 'oreunjjok', 'right') },
          ],
          answerId: 'right',
          answerEntryId: 'summit',
        },
      ],
    },
  },
  priceCards: {
    kind: 'realia-read',
    realiaRead: {
      realia: {
        ref: 'realia:e2e-price-cards',
        kind: 'price-card',
        entries: [
          { id: 'apple', text: k('사과', 'sagwa', 'apples'), value: k('3개 2,000원', 'se gae icheon won', '3 for 2,000 won'), goods: 'apples' },
          { id: 'fan', text: k('부채', 'buchae', 'folding fan'), value: k('5,000원', 'ocheon won', '5,000 won'), goods: 'fan' },
          { id: 'hanji', text: k('한지', 'hanji', 'Korean paper'), value: k('1,000원', 'cheon won', '1,000 won'), goods: 'hanji' },
        ],
        altEn: 'Three price cards at a market stall: apples, a folding fan and paper',
      },
      rounds: [
        {
          id: 'q1',
          questionEn: 'How many apples?',
          key: k('사과', 'sagwa', 'apples'),
          options: [
            { id: 'one', text: k('한 개', 'han gae', 'one') },
            { id: 'three', text: k('세 개', 'se gae', 'three') },
            { id: 'five', text: k('다섯 개', 'daseot gae', 'five') },
          ],
          answerId: 'three',
          answerEntryId: 'apple',
        },
      ],
    },
  },
} satisfies Record<string, MinigameScope>;

export type RealiaFixtureKey = keyof typeof REALIA_FIXTURES;
