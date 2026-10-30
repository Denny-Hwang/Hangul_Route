import type { RolePlayScene } from '../../schemas/role-play';

/**
 * Role Play fixture scenes (row CM-35; the example scene of design/wireframes/minigame/role-play.md). Fixture words
 * only: the Stage 4 and pack rows author the real scenes in lesson JSON with their es and ko overlays. Polite
 * register (해요체 and 합니다체 to a librarian) as the National Institute of Korean Language guide 「표준 언어 예절」
 * sets for speaking to an adult you do not know. Romanization is the repo converter's (`romanization/rr.ts`; a test
 * holds every line to it). The partner is named by role, never by a personal name.
 *
 * Read by three suites, so all play the same chat: the schema tests here, the app's branch reducer and renderer
 * tests (`apps/mobile/src/logic/role-play/`), and the Playwright suite (`apps/mobile/e2e/web/sentence-builder-role-play.spec.ts`;
 * the prefix lets the fixture e2e run's file-name filter select it until the owner adds a `role-play` entry), which
 * hands the scene to the fixture build's `window.__hrRolePlayE2E`.
 */

const ko = (k: string, romanization: string, en: string) => ({ ko: k, romanization, en });

/**
 * At the library desk: 4 turns; turn 2 has two natural replies (two branches, 3a and 3b, that meet again at turn 4),
 * so there are two ways through it, each with 4 turns; every turn has one less natural reply with Hoya's reason.
 */
export const LIBRARY_SCENE: RolePlayScene = {
  title: ko('도서관', 'doseogwan', 'At the library'),
  partner: ko('사서', 'saseo', 'librarian'),
  start: 't1',
  nodes: [
    {
      id: 't1',
      line: ko('안녕하세요!', 'annyeonghaseyo', 'Hello!'),
      replies: [
        { id: 'hello', text: ko('안녕하세요!', 'annyeonghaseyo', 'Hello!'), kind: 'natural', next: 't2' },
        { id: 'meal', text: ko('잘 먹겠습니다!', 'jal meokgetseumnida', 'I will eat well. (said before eating)'), kind: 'lessNatural', whyEn: 'That one is for the start of a meal. Try a greeting.' },
      ],
    },
    {
      id: 't2',
      line: ko('무슨 책을 찾아요?', 'museun chaegeul chajayo', 'What book are you looking for?'),
      replies: [
        { id: 'storybook', text: ko('동화책을 찾아요.', 'donghwachaegeul chajayo', 'I am looking for a storybook.'), kind: 'natural', next: 't3a' },
        { id: 'hangeul', text: ko('한글 책을 찾아요.', 'hangeul chaegeul chajayo', 'I am looking for a Hangul book.'), kind: 'natural', next: 't3b' },
        { id: 'fine', text: ko('괜찮아요.', 'gwaenchanayo', 'It is okay.'), kind: 'lessNatural', whyEn: 'They asked which book. Tell them the book you want.' },
      ],
    },
    {
      id: 't3a',
      line: ko('동화책은 여기 있어요.', 'donghwachaegeun yeogi isseoyo', 'The storybooks are here.'),
      replies: [
        { id: 'thanks', text: ko('감사합니다!', 'gamsahamnida', 'Thank you!'), kind: 'natural', next: 't4' },
        { id: 'sorry', text: ko('미안합니다.', 'mianhamnida', 'I am sorry.'), kind: 'lessNatural', whyEn: 'Here a thank-you fits better.' },
      ],
    },
    {
      id: 't3b',
      line: ko('한글 책은 여기 있어요.', 'hangeul chaegeun yeogi isseoyo', 'The Hangul books are here.'),
      replies: [
        { id: 'thanks', text: ko('감사합니다!', 'gamsahamnida', 'Thank you!'), kind: 'natural', next: 't4' },
        { id: 'sorry', text: ko('미안합니다.', 'mianhamnida', 'I am sorry.'), kind: 'lessNatural', whyEn: 'Here a thank-you fits better.' },
      ],
    },
    {
      id: 't4',
      line: ko('또 오세요!', 'tto oseyo', 'Come again!'),
      replies: [
        { id: 'stay', text: ko('안녕히 계세요!', 'annyeonghi gyeseyo', 'Goodbye! (to someone who stays)'), kind: 'natural', next: 'end' },
        {
          id: 'go',
          text: ko('안녕히 가세요!', 'annyeonghi gaseyo', 'Goodbye! (to someone who leaves)'),
          kind: 'lessNatural',
          whyEn: 'You are the one leaving, so {ko:안녕히 계세요} fits: it is said to the one who stays.',
        },
      ],
    },
    { id: 'end', end: true, closingEn: 'You found your book!' },
  ],
};
