import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ReactElement } from 'react';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jamoKnown } from '../../../content/jamo';
import type { BuildName } from '../../../logic/lecture/build-steps';
import { lectureBundle } from '../../../logic/lecture/content';
import { expandDeck, type Slide } from '../../../logic/lecture/deck-builder';
import { byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import { PresenterViewProvider } from '../presenter-context';
import { LetterSlide } from '../slides/LetterSlide';

/**
 * The lecture letter slide says what a letter question asks (AMENDMENTS-AUDIO-CLIPS JV-A1, JV-A4, row JV-2):
 * the main speaker an initial's or a vowel's name (니은 nieun), a second speaker beside the letter-name line
 * for a consonant's sound on a vowel (나 = ㄴ + ㅏ na), and on a final one speaker, its closed syllable, with
 * the `finalLine` (ㄴ at the bottom: 안 · an) and no letter name. The Korean line names the letter in Hangul.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;
vi.mock('../../../components/StrokeHint', () => ({ StrokeHint: () => null }));

type LetterBody = Extract<Slide, { kind: 'letter' }>;
const ALL: ReadonlySet<BuildName> = new Set(['ko', 'rom', 'stroke', 'sound', 'name', 'example']);
const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

function letters(jamoIds: string[]): LetterBody[] {
  const blocks: LectureBlock[] = [{ kind: 'jamo-set', jamoIds }];
  const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:letter01', title: 'Letters', createdAt: '2026-10-29T09:00:00Z', seed: 3, blocks });
  const bundle = { ...lectureBundle('en'), jamoAll: jamoKnown };
  return expandDeck(deck, bundle, { canPlayKorean: true }).slides.filter((s): s is LetterBody => s.kind === 'letter');
}

async function draw(
  slide: LetterBody,
  locale: UiLocale = 'en',
  handlers: { sound?: () => void; second?: () => void } = {},
  sayIt = false,
): Promise<ReactTestInstance> {
  const el: ReactElement = (
    <PresenterViewProvider value={{ messages: getMessages(locale), locale, unit: 1, reducedMotion: true }}>
      <LetterSlide slide={slide} shown={ALL} strokeToken={0} sayIt={sayIt} onPlaySound={handlers.sound ?? (() => undefined)} onPlayLetterSound={handlers.second ?? (() => undefined)} />
    </PresenterViewProvider>
  );
  const r = await render(el);
  mounted.push(r);
  return r.root;
}

const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};

describe('LetterSlide: name first, then the sound on a vowel; a final by its syllable (JV-A4)', () => {
  const [nieun, a, finalN, finalJ] = letters(['jamo:nieun', 'jamo:a', 'jamo:nieun-batchim', 'jamo:jieut-batchim']);

  it('ㄴ: the main row says 니은 nieun, the letter-name line, and a second speaker for 나 = ㄴ + ㅏ', async () => {
    const played: string[] = [];
    const root = await draw(nieun!, 'en', { sound: () => played.push('main'), second: () => played.push('second') });
    const text = textOf(root);
    expect(text).toContain('니은');
    expect(text).toContain('nieun');
    expect(textOf(byTestId(root, 'presenter-letter-name')[0]!)).toBe('Letter name: nieun');
    expect(text).toContain('나 = ㄴ + ㅏ');
    expect(byTestId(root, 'presenter-final-line')).toHaveLength(0);
    await press(pressable(root, 'presenter-letter-sound'));
    expect(played).toEqual(['second']);
  });

  it('the two speakers have different accessible names, in every UI language', async () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const root = await draw(nieun!, locale);
      const m = getMessages(locale);
      const labels = root.findAll((n) => typeof n.props.onClick === 'function' && typeof n.props['aria-label'] === 'string').map((n) => n.props['aria-label'] as string);
      expect(labels).toContain(m.learner.presenter.quiz.playPrompt);
      expect(pressable(root, 'presenter-letter-sound').props['aria-label']).toBe(m.learner.quest.discover.soundWith.cta);
      expect(m.learner.quest.discover.soundWith.cta).not.toBe(m.learner.presenter.quiz.playPrompt);
    }
  });

  it('the Korean UI names the letter in Hangul with its romanization', async () => {
    const root = await draw(nieun!, 'ko');
    expect(textOf(byTestId(root, 'presenter-letter-name')[0]!)).toBe('글자 이름: 니은 (nieun)');
  });

  it('Say it: the box says the name; a consonant\'s IPA sits beside its sound on a vowel, a vowel\'s in the box', async () => {
    const root = await draw(nieun!, 'en', {}, true);
    const say = textOf(byTestId(root, 'presenter-say-it')[0]!);
    expect(say).toContain('니은');
    expect(say).not.toContain('[');
    expect(byTestId(root, 'presenter-letter-sound')).toHaveLength(0);
    expect(textOf(byTestId(root, 'presenter-letter-sound-ipa')[0]!)).toBe(`[${nieun!.ipa}]`);
    const vowel = await draw(a!, 'en', {}, true);
    expect(byTestId(vowel, 'presenter-letter-sound-ipa')).toHaveLength(0);
    if (a!.ipa !== undefined) expect(textOf(byTestId(vowel, 'presenter-say-it')[0]!)).toContain(`[${a!.ipa}]`);
  });

  it('a vowel has one speaker: its name is its sound', async () => {
    const root = await draw(a!);
    expect(byTestId(root, 'presenter-letter-sound')).toHaveLength(0);
    expect(textOf(byTestId(root, 'presenter-letter-name')[0]!)).toBe('Letter name: a');
  });

  it('a final: one speaker, its closed syllable, the finalLine and no letter name', async () => {
    const root = await draw(finalN!);
    expect(byTestId(root, 'presenter-letter-name')).toHaveLength(0);
    expect(byTestId(root, 'presenter-letter-sound')).toHaveLength(0);
    expect(textOf(byTestId(root, 'presenter-final-line')[0]!)).toBe('ㄴ at the bottom: 안 · an');
    const es = await draw(finalN!, 'es');
    expect(textOf(byTestId(es, 'presenter-final-line')[0]!)).toBe('ㄴ abajo: 안 · an');
    const ko = await draw(finalN!, 'ko');
    expect(textOf(byTestId(ko, 'presenter-final-line')[0]!)).toBe('받침 ㄴ: 안 · an');
  });

  it('a Word Builder final is shown spelled (앚) with its pronounced romanization, though the voice says 앋', async () => {
    expect(finalJ!.spoken.text).toBe('앋');
    const root = await draw(finalJ!);
    expect(textOf(byTestId(root, 'presenter-final-line')[0]!)).toBe('ㅈ at the bottom: 앚 · at');
    expect(textOf(root)).not.toContain('앋');
  });
});
