import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { colors, presenter } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import React from 'react';
import { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { lectureBundle } from '../../../logic/lecture/content';
import { expandDeck, type Slide } from '../../../logic/lecture/deck-builder';
import { byTestId, hostNodes, render, screenTexts, textOf } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { Stage } from '../Stage';
import { SentenceBuildSlide, type SentenceBuildBody } from '../slides/SentenceBuildSlide';

/**
 * The sentence-build slide on the stage (AMENDMENTS-LECTURE-V2 sections 5.2 and 10, LV-S3; design/screens/presenter/
 * slide-sentence-build.md, V9), drawn from shipped Stage 3 and Stage 7 lessons: the bank, each tile moving to the line
 * and leaving its ghost, a particle tile with both endings, the whole build's romanization and meaning, the distractor
 * set back (never marked, nothing red), and the live region saying each move. Nothing on the slide takes input.
 */

// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;
// The letter slide's animated stroke guide needs Reanimated's animated SVG, which the render setup stills; no build slide draws it.
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));

const en = getMessages('en');

function slidesOf(blocks: LectureBlock[], locale: UiLocale = 'en'): Slide[] {
  const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:build01', title: 'Build', createdAt: '2026-10-20T09:00:00Z', seed: 3, blocks });
  return expandDeck(deck, lectureBundle(locale), { canPlayKorean: true }).slides;
}

function inView(child: React.ReactElement, locale: UiLocale = 'en'): React.ReactElement {
  return <PresenterViewProvider value={{ messages: getMessages(locale), locale, unit: 1, reducedMotion: true }}>{child}</PresenterViewProvider>;
}

/** Whether a host node, or a host above it, is hidden from assistive tech (a build not reached yet, a ghost). */
function hiddenNow(node: { props: Record<string, unknown>; parent: unknown }): boolean {
  let at: { props: Record<string, unknown>; parent: unknown } | null = node;
  while (at) {
    if (at.props['aria-hidden'] === true) return true;
    at = (at.parent as typeof at) ?? null;
  }
  return false;
}

/** The flattened style of a host node (react-native-web passes it through to the test host). */
const styleOf = (node: { props: Record<string, unknown> }): Record<string, unknown> => {
  const flat = (s: unknown): Record<string, unknown> => (Array.isArray(s) ? Object.assign({}, ...s.map(flat)) : ((s ?? {}) as Record<string, unknown>));
  return flat(node.props.style);
};

const builds = (slides: Slide[]) => slides.filter((s): s is SentenceBuildBody => s.kind === 'sentence-build');
const stage3 = slidesOf([{ kind: 'quest', id: 'quest:stage3-life-q3' }]);
const stage7 = slidesOf([{ kind: 'quest', id: 'quest:stage7-life-q2' }]);
const plain = builds(stage3).find((s) => s.sentence.ko === '친구가 학교에 가요.')!;
const particle = builds(stage7).find((s) => s.sentence.ko === '저녁에 달걀을 먹어요.')!;

const bankWords = (root: Parameters<typeof byTestId>[0]) => byTestId(root, 'presenter-build-bank-tile').map((n) => ({ look: (n.props as { 'data-look'?: string })['data-look'], hidden: hiddenNow(n), text: screenTexts(n).join('') }));

describe('SentenceBuildSlide (LV-S3)', () => {
  it('the bank build: the kind label, the next-word question, an empty place per tile, every tile in the bank, no meaning yet', async () => {
    const r = await render(inView(<SentenceBuildSlide slide={plain} reveal={0} />));
    expect(textOf(byTestId(r.root, 'presenter-kind-label')[0]!)).toBe(en.learner.presenter.slide.build.title);
    expect(textOf(byTestId(r.root, 'presenter-build-ask')[0]!)).toBe(en.learner.presenter.slide.build.next);
    expect(byTestId(r.root, 'presenter-build-slot')).toHaveLength(3);
    expect(byTestId(r.root, 'presenter-build-placed')).toHaveLength(0);
    expect(bankWords(r.root).map((t) => t.text).sort()).toEqual(['가요', '와요', '친구가', '학교에']);
    expect(bankWords(r.root).every((t) => t.look === 'tile' && !t.hidden)).toBe(true);
    // The romanization and the meaning keep their place, unread, until the whole build.
    expect(hiddenNow(byTestId(r.root, 'presenter-build-whole')[0]!)).toBe(true);
    // Never already in order: the bank's words are not the sentence.
    expect(bankWords(r.root).filter((t) => t.text !== '와요').map((t) => t.text)).not.toEqual(['친구가', '학교에', '가요']);
  });

  it('two tiles placed: they stand on the line in order, their bank places are dashed ghosts, unread', async () => {
    const r = await render(inView(<SentenceBuildSlide slide={plain} reveal={2} />));
    expect(byTestId(r.root, 'presenter-build-placed').map((n) => screenTexts(n).join(''))).toEqual(['친구가', '학교에']);
    expect(byTestId(r.root, 'presenter-build-slot')).toHaveLength(1);
    const ghosts = bankWords(r.root).filter((t) => t.look === 'ghost');
    expect(ghosts.map((t) => t.text).sort()).toEqual(['친구가', '학교에']);
    expect(ghosts.every((t) => t.hidden)).toBe(true);
    // A ghost keeps its tile's size, so nothing in the bank reflows.
    expect(byTestId(r.root, 'presenter-build-bank-tile')).toHaveLength(4);
  });

  it('the whole build: the romanization and the meaning, no question, the distractor set back at dimOpacity and never marked', async () => {
    const r = await render(inView(<SentenceBuildSlide slide={plain} reveal={plain.builds.length - 1} />));
    const whole = byTestId(r.root, 'presenter-build-whole')[0]!;
    expect(hiddenNow(whole)).toBe(false);
    expect(screenTexts(whole)).toEqual([plain.sentence.romanization, plain.sentence.gloss]);
    expect(hiddenNow(byTestId(r.root, 'presenter-build-ask')[0]!)).toBe(true);
    const tiles = byTestId(r.root, 'presenter-build-bank-tile');
    const distractor = tiles.find((n) => screenTexts(n).join('') === '와요')!;
    expect((distractor.props as { 'data-look'?: string })['data-look']).toBe('set-back');
    expect(styleOf(distractor).opacity).toBe(presenter.dimOpacity);
    expect(hiddenNow(distractor)).toBe(false);
    // No red, no cross: no danger colour anywhere on the slide.
    const danger = new Set<unknown>([colors.feedback.danger]);
    expect(hostNodes(r.root, (n) => Object.values(styleOf(n)).some((v) => danger.has(v)))).toHaveLength(0);
  });

  it('a particle tile on the line shows its stem and both endings and asks which fits; the next build keeps the one that fits', async () => {
    const choosing = await render(inView(<SentenceBuildSlide slide={particle} reveal={2} />));
    expect(textOf(byTestId(choosing.root, 'presenter-build-ask')[0]!)).toBe(en.learner.presenter.slide.build.particle);
    const tile = byTestId(choosing.root, 'presenter-build-particle')[0]!;
    expect(screenTexts(tile).filter((t) => t !== '/')).toEqual(['달걀', '을', '를']);
    expect(byTestId(choosing.root, 'presenter-build-choice')).toHaveLength(2);
    // In the bank the particle word is its stem.
    expect(bankWords(choosing.root).map((t) => t.text)).toContain('달걀');
    const kept = await render(inView(<SentenceBuildSlide slide={particle} reveal={3} />));
    expect(byTestId(kept.root, 'presenter-build-particle')).toHaveLength(0);
    expect(byTestId(kept.root, 'presenter-build-placed').map((n) => screenTexts(n).join(''))).toEqual(['저녁에', '달걀을']);
    expect(textOf(byTestId(kept.root, 'presenter-build-ask')[0]!)).toBe(en.learner.presenter.slide.build.next);
  });

  it.each(['es', 'ko'] as const)('in %s: the kind label, the question and the meaning are in the slide language', async (locale) => {
    const m = getMessages(locale);
    const slide = builds(slidesOf([{ kind: 'quest', id: 'quest:stage3-life-q3' }], locale)).find((s) => s.sentence.ko === '친구가 학교에 가요.')!;
    expect(slide.sentence.gloss).not.toBe(plain.sentence.gloss);
    const r = await render(inView(<SentenceBuildSlide slide={slide} reveal={slide.builds.length - 1} />, locale));
    expect(textOf(byTestId(r.root, 'presenter-kind-label')[0]!)).toBe(m.learner.presenter.slide.build.title);
    expect(screenTexts(byTestId(r.root, 'presenter-build-whole')[0]!)).toContain(slide.sentence.gloss);
  });
});

describe('Stage: the live region says each move of a sentence build (section 10)', () => {
  const scale = { unit: 1, logicalWidth: 1280, logicalHeight: 600, stageWidth: 1280, stageHeight: 600, offsetX: 0, offsetY: 0, letterboxed: false, portrait: false, tooSmall: false };
  const stage = (slides: Slide[], idx: number, reveal: number) =>
    inView(
      <Stage
        scale={scale}
        slides={slides}
        slideIdx={idx}
        reveal={reveal}
        deckTitle="Build"
        strokeToken={0}
        joinCta="Join"
        onCommand={() => undefined}
        onPlaySound={() => undefined}
        romanization="always"
        sayIt={false}
        storyScene={() => undefined}
      />,
    );

  it('arriving names the slide by its question; each click forward says the tile placed, then the sentence', async () => {
    const idx = stage7.indexOf(particle);
    const r = await render(stage(stage7, idx, 0));
    const live = () => textOf(byTestId(r.root, 'presenter-live')[0]!);
    expect(live()).toBe(`Slide ${idx + 1} of ${stage7.length}, ${en.learner.presenter.grid.kind.build}, ${en.learner.presenter.slide.build.next}`);
    const said: string[] = [];
    for (let reveal = 1; reveal < particle.builds.length; reveal += 1) {
      await act(async () => r.update(stage(stage7, idx, reveal)));
      said.push(live());
    }
    expect(said).toEqual([
      en.a11y.presenter.tilePlaced('저녁에, jeonyeoge'),
      en.a11y.presenter.tilePlaced('달걀'),
      en.a11y.presenter.tilePlaced('달걀을, dalgyareul'),
      en.a11y.presenter.tilePlaced('먹어요, meogeoyo'),
      `${particle.sentence.ko}, ${particle.sentence.romanization}, ${particle.sentence.gloss}`,
    ]);
    // A redraw at the same build says the same; stepping back names the slide again.
    await act(async () => r.update(stage(stage7, idx, particle.builds.length - 1)));
    expect(live()).toBe(said[said.length - 1]);
    await act(async () => r.update(stage(stage7, idx, 2)));
    expect(live()).toContain(`Slide ${idx + 1} of ${stage7.length}`);
    // Nothing on the slide takes input.
    expect(hostNodes(byTestId(r.root, 'presenter-stage')[0]!, (n) => n.props.role === 'button')).toHaveLength(0);
  });
});
