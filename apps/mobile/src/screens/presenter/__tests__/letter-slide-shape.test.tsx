import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Circle, Path, Text as SvgText } from 'react-native-svg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jamoKnown } from '../../../content/jamo';
import { strokesForJamo } from '../../../content/jamo-strokes';
import type { BuildName } from '../../../logic/lecture/build-steps';
import { lectureBundle } from '../../../logic/lecture/content';
import { expandDeck, type Slide } from '../../../logic/lecture/deck-builder';
import { STROKE_LINE } from '../../../logic/lecture/stage-constants';
import { render, textOf, unmount } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { LetterSlide } from '../slides/LetterSlide';

/**
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD §6 test 9, OD-SO2 (design: presenter/slide-letter.md): an untaught letter's
 * stroke panel has no numbered start dots; on the stroke build the panel letter steps aside while `StrokeHint` plays
 * the shape reveal (`orderTaught` false, the slide's romanization) and comes back when it ends; under reduced motion
 * the unnumbered panel letter stays alone. The caption "Simplified stroke guide" is unchanged.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
interface HintProps {
  orderTaught: boolean;
  romanization: string;
  onShow?: (mode: 'animated' | 'static') => void;
  onComplete?: () => void;
}
const hint = vi.hoisted(() => ({ last: null as HintProps | null, mounted: 0 }));
vi.mock('../../../components/StrokeHint', () => ({
  StrokeHint: (props: HintProps) => {
    hint.last = props;
    hint.mounted += 1;
    return null;
  },
}));

type LetterBody = Extract<Slide, { kind: 'letter' }>;
const ALL: ReadonlySet<BuildName> = new Set(['ko', 'rom', 'stroke', 'sound', 'name', 'example']);
const mounted: ReactTestRenderer[] = [];
beforeEach(() => {
  hint.last = null;
  hint.mounted = 0;
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

function letter(jamoId: string): LetterBody {
  const blocks: LectureBlock[] = [{ kind: 'jamo-set', jamoIds: [jamoId] }];
  const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:letter01', title: 'Letters', createdAt: '2026-10-29T09:00:00Z', seed: 3, blocks });
  const bundle = { ...lectureBundle('en'), jamoAll: jamoKnown };
  return expandDeck(deck, bundle, { canPlayKorean: true }).slides.find((s): s is LetterBody => s.kind === 'letter')!;
}

const element = (slide: LetterBody, strokeToken: number) => (
  <PresenterViewProvider value={{ messages: getMessages('en'), locale: 'en', unit: 1, reducedMotion: false }}>
    <LetterSlide slide={slide} shown={ALL} strokeToken={strokeToken} onPlaySound={() => undefined} />
  </PresenterViewProvider>
);

const panelStrokes = (root: ReactTestInstance): number => root.findAll((n) => n.type === Path && n.props.strokeWidth === STROKE_LINE).length;
const numerals = (root: ReactTestInstance): number => root.findAll((n) => n.type === SvgText || n.type === Circle).length;

describe('LetterSlide stroke panel, untaught letter (§6 test 9)', () => {
  const slide = letter('jamo:mieum');
  const n = strokesForJamo('jamo:mieum')!.length;

  it('the slide is untaught and its panel shows the letter with no numbered start dots, captioned as before', async () => {
    expect(slide.strokeReviewed).toBe(false);
    const r = await render(element(slide, 0));
    mounted.push(r);
    expect(panelStrokes(r.root)).toBe(n);
    expect(numerals(r.root)).toBe(0);
    expect(textOf(r.root)).toContain('Simplified stroke guide');
    expect(textOf(r.root)).not.toContain('Shape guide');
    expect(hint.mounted).toBe(0);
  });

  it('the stroke build: a shape reveal (orderTaught false, the romanization); the panel letter steps aside, then is back', async () => {
    const r = await render(element(slide, 1));
    mounted.push(r);
    expect(hint.last).toMatchObject({ orderTaught: false, romanization: 'm' });
    await act(async () => hint.last!.onShow?.('animated'));
    expect(panelStrokes(r.root)).toBe(0);
    await act(async () => hint.last!.onComplete?.());
    expect(panelStrokes(r.root)).toBe(n);
    expect(numerals(r.root)).toBe(0);
    // R plays it again.
    await act(async () => r.update(element(slide, 2)));
    await act(async () => hint.last!.onShow?.('animated'));
    expect(panelStrokes(r.root)).toBe(0);
  });

  it('reduced motion: the unnumbered panel letter stays alone (the still is not laid over it)', async () => {
    const r = await render(element(slide, 1));
    mounted.push(r);
    await act(async () => hint.last!.onShow?.('static'));
    const after = hint.mounted;
    await act(async () => r.update(element(slide, 1)));
    // The hint is gone for this play: a re-render of the slide does not render it again.
    expect(hint.mounted).toBe(after);
    expect(panelStrokes(r.root)).toBe(n);
    expect(numerals(r.root)).toBe(0);
  });
});

describe('LetterSlide stroke panel, taught letter (after SO-3)', () => {
  it('keeps the numbered start dots and today\'s demo over the letter', async () => {
    const slide = { ...letter('jamo:mieum'), strokeReviewed: true };
    const r = await render(element(slide, 1));
    mounted.push(r);
    expect(hint.last).toMatchObject({ orderTaught: true });
    await act(async () => hint.last!.onShow?.('animated'));
    expect(panelStrokes(r.root)).toBe(3);
    expect(r.root.findAll((n) => n.type === SvgText).map((t) => t.props.children)).toEqual(['1', '2', '3']);
  });
});
