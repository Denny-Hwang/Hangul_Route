import { colors } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { BuildName } from '../../../logic/lecture/build-steps';
import { rolePlaySlides } from '../../../logic/lecture/__tests__/role-play-slides';
import { byTestId, hostNodes, render, screenTexts, textOf } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { Stage } from '../Stage';
import { RolePlaySlide } from '../slides/RolePlaySlide';

/**
 * The Role Play slide on the stage (F-CURR-002 section 8 "Role Play (a read-together chat; the class picks the reply)",
 * section 7.7, row CM-35; design/screens/presenter/slide-role-play.md), from the fixture library scene: the chat with
 * the exchange before the turn, the replies with their markers, what the question build keeps unread until the answer
 * (the meanings, Hoya's reasons, the closing line), the reveal (natural replies marked, the less natural ones in the
 * amber nudge, nothing red), the live region, and no speaking UI: nothing records, listens or asks the room to say it.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));

const en = getMessages('en');
const QUESTION: ReadonlySet<BuildName> = new Set(['question']);
const ANSWER: ReadonlySet<BuildName> = new Set(['question', 'answer']);
const turns = rolePlaySlides();

function inView(child: ReactElement, locale: UiLocale = 'en'): ReactElement {
  return <PresenterViewProvider value={{ messages: getMessages(locale), locale, unit: 1, reducedMotion: true }}>{child}</PresenterViewProvider>;
}

function hiddenNow(node: { props: Record<string, unknown>; parent: unknown }): boolean {
  let at: { props: Record<string, unknown>; parent: unknown } | null = node;
  while (at) {
    if (at.props['aria-hidden'] === true) return true;
    at = (at.parent as typeof at) ?? null;
  }
  return false;
}

const styleOf = (node: { props: Record<string, unknown> }): Record<string, unknown> => {
  const flat = (s: unknown): Record<string, unknown> => (Array.isArray(s) ? Object.assign({}, ...s.map(flat)) : ((s ?? {}) as Record<string, unknown>));
  return flat(node.props.style);
};

/** A token colour as react-native-web hands it to the host (`rgba(r,g,b,1.00)`); a shorthand border colour arrives per side. */
const rgba = (hex: string): string => {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},1.00)`;
};

const labelOf = (node: { props: Record<string, unknown> }): string => String(node.props.accessibilityLabel ?? node.props['aria-label'] ?? '');

describe('RolePlaySlide: the read-together chat (row CM-35)', () => {
  it('the first turn: the kind label, the scene, the partner line named by the role, the replies; no earlier exchange', async () => {
    const r = await render(inView(<RolePlaySlide slide={turns[0]!} shown={QUESTION} romanization="always" />));
    expect(textOf(byTestId(r.root, 'presenter-kind-label')[0]!)).toBe(en.learner.presenter.slide.rolePlay.label);
    expect(textOf(byTestId(r.root, 'presenter-role-play-scene')[0]!)).toBe('At the library');
    const line = byTestId(r.root, 'presenter-role-play-line')[0]!;
    expect(screenTexts(line)).toEqual(expect.arrayContaining(['librarian', '안녕하세요!']));
    expect(labelOf(line)).toBe('librarian: 안녕하세요!, annyeonghaseyo, Hello!');
    expect(byTestId(r.root, 'presenter-role-play-before')).toHaveLength(0);
    expect(byTestId(r.root, 'presenter-role-play-class')).toHaveLength(0);
    expect(textOf(byTestId(r.root, 'presenter-quiz-question')[0]!)).toBe(en.learner.presenter.quiz.reply);
    expect(byTestId(r.root, 'presenter-quiz-option-ko').map(textOf).sort()).toEqual(turns[0]!.replies.map((x) => x.ko).sort());
  });

  it('a later turn shows the exchange before it: the partner line and the reply the class gave, named "The class said", never a name', async () => {
    const r = await render(inView(<RolePlaySlide slide={turns[1]!} shown={QUESTION} romanization="always" />));
    expect(screenTexts(byTestId(r.root, 'presenter-role-play-before')[0]!)).toEqual(expect.arrayContaining(['librarian', '안녕하세요!']));
    const sent = byTestId(r.root, 'presenter-role-play-class')[0]!;
    expect(labelOf(sent)).toBe(`${en.a11y.presenter.rolePlayClass('안녕하세요!, annyeonghaseyo')}, Hello!`);
    expect(screenTexts(byTestId(r.root, 'presenter-role-play-line')[0]!)).toEqual(expect.arrayContaining(['무슨 책을 찾아요?']));
    // The chat is a list named as the learner's log is.
    expect(hostNodes(r.root, (n) => n.props.role === 'list' && labelOf(n) === en.a11y.minigame.rolePlay.log)).toHaveLength(1);
  });

  it('the question build keeps the meanings, the marks and Hoya\'s reasons unread; the answer marks every natural reply and shows each reason in amber', async () => {
    const slide = turns[1]!;
    const q = await render(inView(<RolePlaySlide slide={slide} shown={QUESTION} romanization="always" />));
    expect(byTestId(q.root, 'presenter-quiz-mark')).toHaveLength(0);
    expect(byTestId(q.root, 'presenter-quiz-option-gloss').every(hiddenNow)).toBe(true);
    expect(hiddenNow(byTestId(q.root, 'presenter-role-play-why')[0]!)).toBe(true);
    expect(hiddenNow(byTestId(q.root, 'presenter-quiz-answer')[0]!)).toBe(true);

    const a = await render(inView(<RolePlaySlide slide={slide} shown={ANSWER} romanization="always" />));
    const natural = slide.replies.flatMap((x, i) => (x.natural ? [i] : []));
    expect(byTestId(a.root, 'presenter-quiz-mark')).toHaveLength(natural.length);
    for (const i of natural) expect(byTestId(byTestId(a.root, `presenter-quiz-option-${i + 1}`)[0]!, 'presenter-quiz-mark')).toHaveLength(1);
    expect(byTestId(a.root, 'presenter-quiz-option-gloss').some(hiddenNow)).toBe(false);
    const why = byTestId(a.root, 'presenter-role-play-why')[0]!;
    expect(hiddenNow(why)).toBe(false);
    expect(styleOf(why).borderTopColor).toBe(rgba(colors.feedback.nudge));
    expect(styleOf(why).backgroundColor).toBe(rgba(colors.feedback.nudgeLight));
    expect(byTestId(why, 'presenter-role-play-why-row')).toHaveLength(slide.replies.length - natural.length);
    expect(screenTexts(why).join('')).toContain('They asked which book. Tell them the book you want.');
    // Hoya thinks, never frowns; and the reason's row carries the reply's marker, so colour is never the only cue.
    expect(hostNodes(why, (n) => labelOf(n) === en.a11y.hoya('thinking')).length).toBeGreaterThan(0);
    const lessNatural = slide.replies.findIndex((x) => !x.natural);
    expect(hostNodes(why, (n) => labelOf(n) === en.a11y.presenter.option(lessNatural + 1, en.a11y.presenter.shape[(['circle', 'triangle', 'square', 'star'] as const)[lessNatural]!]))).toHaveLength(1);
    // No red, no cross: no danger colour anywhere on the slide (section 7.7).
    const danger = new Set<unknown>([colors.feedback.danger, colors.feedback.dangerLight].flatMap((c) => [c, rgba(c)]));
    expect(hostNodes(a.root, (n) => Object.values(styleOf(n)).some((v) => danger.has(v)))).toHaveLength(0);
  });

  it('every turn ends well: only the last turn closes the chat, with its closing line at the answer build', async () => {
    for (const slide of turns.slice(0, -1)) {
      const r = await render(inView(<RolePlaySlide slide={slide} shown={ANSWER} romanization="always" />));
      expect(byTestId(r.root, 'presenter-role-play-closing')).toHaveLength(0);
    }
    const last = turns[turns.length - 1]!;
    const q = await render(inView(<RolePlaySlide slide={last} shown={QUESTION} romanization="always" />));
    expect(hiddenNow(byTestId(q.root, 'presenter-role-play-closing')[0]!)).toBe(true);
    const a = await render(inView(<RolePlaySlide slide={last} shown={ANSWER} romanization="always" />));
    const closing = byTestId(a.root, 'presenter-role-play-closing')[0]!;
    expect(hiddenNow(closing)).toBe(false);
    expect(textOf(closing)).toBe('You found your book!');
    expect(styleOf(closing).backgroundColor).toBe(rgba(colors.feedback.successLight));
  });

  it("with romanization 'tap' the partner line's romanization waits for the answer build; the earlier exchange keeps its own", async () => {
    const q = await render(inView(<RolePlaySlide slide={turns[1]!} shown={QUESTION} romanization="tap" />));
    const line = byTestId(q.root, 'presenter-role-play-line')[0]!;
    expect(labelOf(line)).toBe('librarian: 무슨 책을 찾아요?, What book are you looking for?');
    const rom = hostNodes(line, (n) => textOf(n) === 'museun chaegeul chajayo' && n.props['aria-hidden'] !== undefined);
    expect(rom.length).toBeGreaterThan(0);
    expect(rom.every((n) => n.props['aria-hidden'] === true)).toBe(true);
    expect(labelOf(byTestId(q.root, 'presenter-role-play-before')[0]!)).toContain('annyeonghaseyo');
    const a = await render(inView(<RolePlaySlide slide={turns[1]!} shown={ANSWER} romanization="tap" />));
    expect(labelOf(byTestId(a.root, 'presenter-role-play-line')[0]!)).toContain('museun chaegeul chajayo');
  });

  it('no speaking UI: no button, microphone, record or say-it affordance on any build of any turn (section 7.7)', async () => {
    const speak = /record|microphone|\bmic\b|say it|speak|grab/i;
    for (const slide of turns) {
      for (const shown of [QUESTION, ANSWER]) {
        const r = await render(inView(<RolePlaySlide slide={slide} shown={shown} romanization="always" />));
        expect(hostNodes(r.root, (n) => n.props.role === 'button')).toHaveLength(0);
        expect(screenTexts(r.root).some((t) => speak.test(t))).toBe(false);
        expect(hostNodes(r.root, (n) => speak.test(String(n.props['data-testid'] ?? n.props.testID ?? '')) || speak.test(labelOf(n)))).toHaveLength(0);
      }
    }
  });

  it('draws in the Korean and Spanish slide languages: the kind label and the class bubble follow the slide language', async () => {
    for (const locale of ['ko', 'es'] as const) {
      const m = getMessages(locale);
      const r = await render(inView(<RolePlaySlide slide={turns[1]!} shown={QUESTION} romanization="always" />, locale));
      expect(textOf(byTestId(r.root, 'presenter-kind-label')[0]!)).toBe(m.learner.presenter.slide.rolePlay.label);
      expect(labelOf(byTestId(r.root, 'presenter-role-play-class')[0]!)).toContain(m.a11y.presenter.rolePlayClass('안녕하세요!, annyeonghaseyo'));
      expect(textOf(byTestId(r.root, 'presenter-quiz-question')[0]!)).toBe(m.learner.presenter.quiz.reply);
    }
  });
});

describe('Stage: a Role Play turn (row CM-35)', () => {
  const scale = { unit: 1, logicalWidth: 1280, logicalHeight: 600, stageWidth: 1280, stageHeight: 600, offsetX: 0, offsetY: 0, letterboxed: false, portrait: false, tooSmall: false };
  it('draws the Role Play slide and names it in the live region by its kind, question and the partner line', async () => {
    const r = await render(
      inView(
        <Stage
          scale={scale}
          slides={turns}
          slideIdx={0}
          reveal={0}
          deckTitle="Role play"
          strokeToken={0}
          joinCta="Join"
          onCommand={() => undefined}
          onPlaySound={() => undefined}
          romanization="always"
          sayIt={false}
          storyScene={() => undefined}
        />,
      ),
    );
    expect(byTestId(r.root, 'presenter-role-play')).toHaveLength(1);
    expect(textOf(byTestId(r.root, 'presenter-live')[0]!)).toBe(
      `Slide 1 of ${turns.length}, ${en.learner.presenter.grid.kind.rolePlay}, ${en.learner.presenter.quiz.reply}, librarian, 안녕하세요!, annyeonghaseyo, Hello!`,
    );
  });
});
