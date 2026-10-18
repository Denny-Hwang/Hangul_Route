import { CATALOG, type LectureDeck, type LecturePreset, type PresetContext, type PresetMinutes, type StageKey } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import React, { useState } from 'react';
import { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { ReactTestInstance } from 'react-test-renderer';
import { HOME_DEFAULT, type HomeSnapshot } from '../../../logic/lecture/home-state';
import { lectureBundle } from '../../../logic/lecture/content';
import { presenterPresetContext, resolveOnPresenter } from '../../../logic/lecture/preset-source';
import { presenterChooserGroups, wordReviewWordsOn } from '../../../logic/lecture/quick-source';
import { emptyRecent, rememberDeck } from '../../../logic/lecture/recent';
import { byTestId, hostNodes, press, render, screenTexts, textOf } from '../../../test-support/render';
import { PresenterHomeScreen, type PresenterHomeProps } from '../HomeScreen';
import { presetColumns } from '../PresetCards';
import { PresenterViewProvider } from '../presenter-context';
import { StartScreen, type StartScreenProps } from '../StartScreen';

/**
 * The presenter home of AMENDMENTS-LECTURE-V2 row LV-3 (sections 4, 7 item 3, 10 and 18; design
 * `presets.md`): Ready-made lessons first as disclosure cards with their length and stage chips,
 * Recent beside or below, Customize folded with the grouped chooser (tabs, tri-state episodes,
 * Show more, Your lesson, the sticky footer), the one Back, and the preview on the start screen.
 */

const en = getMessages('en');
const p = en.learner.presenter;
const NOW = new Date('2026-10-17T12:00:00.000Z');
const groups = presenterChooserGroups('en', { consonants: p.home.quick.consonants, vowels: p.home.quick.vowels });
const bundle = lectureBundle('en');
/** The presenter's resolver over a context (`PresenterApp`'s `resolveHere`). */
const resolverOf =
  (ctx: PresetContext): PresenterHomeProps['resolve'] =>
  (preset, minutes, stage) =>
    resolveOnPresenter(preset, minutes, { ...ctx, stage }, (block) => wordReviewWordsOn(bundle, block));

interface HarnessProps extends Partial<PresenterHomeProps> {
  initial?: HomeSnapshot;
  onPresetSpy?: (preset: LecturePreset, minutes: PresetMinutes, stage: StageKey) => void;
}

function Harness({ initial = HOME_DEFAULT, onPresetSpy, ...over }: HarnessProps): React.ReactElement {
  const [state, setState] = useState<HomeSnapshot>(initial);
  const ctx = over.presetCtx ?? presenterPresetContext(null, NOW);
  return (
    <PresenterHomeScreen
      messages={en}
      locale="en"
      recent={{ status: 'ready', list: emptyRecent() }}
      onResume={() => undefined}
      onStartOver={() => undefined}
      onRemove={() => undefined}
      presetCtx={ctx}
      resolve={resolverOf(ctx)}
      onPreset={onPresetSpy ?? (() => undefined)}
      groups={groups}
      onBuild={() => undefined}
      state={state}
      onState={(patch) => setState((s) => ({ ...s, ...patch }))}
      backHref="/"
      now={() => NOW}
      rng={() => 0.5}
      {...over}
    />
  );
}

/** A host node's accessible name: the texts its `aria-labelledby` ids name, else its `aria-label`. */
const nameOf = (root: ReactTestInstance, node: ReactTestInstance): string | undefined => {
  const by = node.props['aria-labelledby'] as string | undefined;
  if (by === undefined) return node.props['aria-label'] as string | undefined;
  return by
    .split(' ')
    .map((id) => textOf(hostNodes(root, (n) => n.props.id === id)[0]!))
    .join(' ');
};

/** A key pressed on a host node, as react-native-web's press responder and the node's own handler receive it. */
async function key(node: ReactTestInstance, name: string): Promise<{ prevented: boolean }> {
  const onKeyDown = node.props.onKeyDown as ((event: unknown) => void) | undefined;
  if (onKeyDown === undefined) throw new Error('no key handler');
  const target = { getAttribute: (attr: string): unknown => node.props[attr] ?? null, tagName: String(node.type) };
  const out = { prevented: false };
  const event = { key: name, target, currentTarget: target, nativeEvent: {}, preventDefault: () => (out.prevented = true), stopPropagation: () => undefined };
  await act(async () => {
    onKeyDown(event);
  });
  return out;
}

const one = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const found = byTestId(root, id);
  expect(found, id).toHaveLength(1);
  return found[0]!;
};

describe('Ready-made lessons (sections 4.1 and 10)', () => {
  it('draws the six cards in the section 4.1 order; with nothing to follow, Next lesson is last', async () => {
    const r = await render(<Harness />);
    const cards = hostNodes(r.root, (n) => typeof n.props['data-testid'] === 'string' && /^presenter-preset-[a-z0-9-]+$/.test(n.props['data-testid']) && n.props.role === 'button');
    expect(cards.map((c) => c.props['data-testid'])).toEqual([
      'presenter-preset-hangul-week-1',
      'presenter-preset-by-stage',
      'presenter-preset-story-time',
      'presenter-preset-word-review',
      'presenter-preset-warm-up',
      'presenter-preset-next-lesson',
    ]);
    // h2 Ready-made lessons comes before Recent lessons.
    const texts = screenTexts(r.root);
    expect(texts.indexOf(p.presets.title)).toBeLessThan(texts.indexOf(p.home.recent.title));
  });

  it('puts Next lesson first when Recent has something to follow', async () => {
    const deck = { v: 1, id: 'lecture:recent0001', title: 'Week 3 letters', createdAt: '2026-10-01T09:00:00.000Z', seed: 1, blocks: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }], options: { romanization: 'always', strokeGuide: true, quizRounds: 5, sound: true }, picker: null } as LectureDeck;
    const list = rememberDeck(emptyRecent(), deck, '2026-10-16T09:00:00.000Z');
    const r = await render(<Harness presetCtx={presenterPresetContext(list, NOW)} recent={{ status: 'ready', list }} />);
    const first = hostNodes(r.root, (n) => n.props.role === 'button' && typeof n.props['data-testid'] === 'string' && n.props['data-testid'].startsWith('presenter-preset-'))[0]!;
    expect(first.props['data-testid']).toBe('presenter-preset-next-lesson');
    expect(textOf(first)).toContain(p.presets.next.device);
  });

  it('each card is one disclosure button named "{title}, about {n} minutes", controlling its panel', async () => {
    const r = await render(<Harness />);
    const story = one(r.root, 'presenter-preset-story-time');
    expect(story.props['aria-label']).toBe('Story time, about 20 minutes');
    expect(story.props['aria-expanded']).toBe(false);
    expect(story.props['aria-controls']).toBe('presenter-preset-panel-story-time');
    expect(story.props['aria-pressed']).toBeUndefined();
    expect(one(r.root, 'presenter-preset-word-review').props['aria-label']).toBe('Word review, about 10 minutes');
    expect(one(r.root, 'presenter-preset-warm-up').props['aria-label']).toBe('Quick 10-minute warm-up, about 10 minutes');
  });

  it('opening a card opens its panel with the length chips and Start, and closes the others', async () => {
    const onPresetSpy = vi.fn();
    const r = await render(<Harness onPresetSpy={onPresetSpy} />);
    await press(one(r.root, 'presenter-preset-story-time'));
    expect(one(r.root, 'presenter-preset-story-time').props['aria-expanded']).toBe(true);
    await press(one(r.root, 'presenter-preset-hangul-week-1'));
    expect(one(r.root, 'presenter-preset-story-time').props['aria-expanded']).toBe(false);
    expect(one(r.root, 'presenter-preset-hangul-week-1').props['aria-expanded']).toBe(true);
    const panel = one(r.root, 'presenter-preset-panel-hangul-week-1');
    const group = hostNodes(panel, (n) => n.props.role === 'radiogroup')[0]!;
    expect(group.props['aria-label']).toBe(p.presets.length.title);
    const radios = hostNodes(group, (n) => n.props.role === 'radio');
    expect(radios.map((n) => textOf(n))).toEqual(['10 min', '20 min', '30 min']);
    expect(radios.map((n) => n.props['aria-checked'])).toEqual([false, true, false]);
    // One tab stop: only the chosen chip is in the tab order.
    expect(radios.map((n) => n.props.tabIndex)).toEqual([-1, 0, -1]);
    await press(one(r.root, 'presenter-preset-length-hangul-week-1-30'));
    expect(one(r.root, 'presenter-preset-hangul-week-1').props['aria-label']).toBe('Start from zero: Hangul week 1, about 30 minutes');
    await press(one(r.root, 'presenter-preset-start-hangul-week-1'));
    expect(onPresetSpy).toHaveBeenCalledWith('hangul-week-1', 30, 'stage1');
  });

  it('the length chips are one radiogroup for the keyboard: the arrows, Home and End move and select', async () => {
    const r = await render(<Harness />);
    await press(one(r.root, 'presenter-preset-hangul-week-1'));
    const radios = () => hostNodes(one(r.root, 'presenter-preset-length-hangul-week-1'), (n) => n.props.role === 'radio');
    const checked = () => radios().map((n) => n.props['aria-checked']);
    const stops = () => radios().map((n) => n.props.tabIndex);
    expect(await key(one(r.root, 'presenter-preset-length-hangul-week-1-20'), 'ArrowRight')).toEqual({ prevented: true });
    expect([checked(), stops()]).toEqual([
      [false, false, true],
      [-1, -1, 0],
    ]);
    await key(one(r.root, 'presenter-preset-length-hangul-week-1-30'), 'Home');
    expect(checked()).toEqual([true, false, false]);
    await key(one(r.root, 'presenter-preset-length-hangul-week-1-10'), 'ArrowLeft');
    expect(checked()).toEqual([false, false, true]);
    await key(one(r.root, 'presenter-preset-length-hangul-week-1-30'), 'End');
    expect(stops()).toEqual([-1, -1, 0]);
    // Another key keeps its browser meaning.
    expect(await key(one(r.root, 'presenter-preset-length-hangul-week-1-30'), 'Tab')).toEqual({ prevented: false });
    expect(one(r.root, 'presenter-preset-hangul-week-1').props['aria-label']).toBe('Start from zero: Hangul week 1, about 30 minutes');
  });

  it('Word review after Hangul week 1 (3 words) says it is the warm-up instead, and is named for what it builds', async () => {
    const deck = { v: 1, id: 'lecture:recent0002', title: 'Hangul week 1', createdAt: '2026-10-01T09:00:00.000Z', seed: 1, blocks: [{ kind: 'episode', id: 'episode:stage1-letters' }], options: { romanization: 'always', strokeGuide: true, quizRounds: 5, sound: true }, picker: null } as LectureDeck;
    const list = rememberDeck(emptyRecent(), deck, '2026-10-16T09:00:00.000Z');
    const onPresetSpy = vi.fn();
    const r = await render(<Harness presetCtx={presenterPresetContext(list, NOW)} recent={{ status: 'ready', list }} onPresetSpy={onPresetSpy} />);
    await press(one(r.root, 'presenter-preset-word-review'));
    expect(textOf(one(r.root, 'presenter-preset-fallback-word-review'))).toBe(p.presets.fallback.warmUp);
    await press(one(r.root, 'presenter-preset-length-word-review-20'));
    // The 20-minute chip still builds the 10-minute warm-up, and the card says so.
    expect(one(r.root, 'presenter-preset-word-review').props['aria-label']).toBe('Word review, about 10 minutes');
  });

  it('Stage by stage has the stage chips of the ready stages; Word review offers 10 and 20; the warm-up no chips', async () => {
    const onPresetSpy = vi.fn();
    const r = await render(<Harness onPresetSpy={onPresetSpy} />);
    await press(one(r.root, 'presenter-preset-by-stage'));
    const stages = hostNodes(one(r.root, 'presenter-preset-stage'), (n) => n.props.role === 'radio');
    const ready = [...new Set(CATALOG.cells.filter((c) => c.status === 'shipped' || c.status === 'ready').map((c) => c.stage))];
    expect(stages.map((n) => textOf(n))).toEqual(ready.map((s) => `Stage ${s.slice(-1)}`));
    await press(one(r.root, 'presenter-preset-stage-stage3'));
    await press(one(r.root, 'presenter-preset-start-by-stage'));
    expect(onPresetSpy).toHaveBeenLastCalledWith('by-stage', 20, 'stage3');
    await press(one(r.root, 'presenter-preset-word-review'));
    expect(hostNodes(one(r.root, 'presenter-preset-length-word-review'), (n) => n.props.role === 'radio').map((n) => textOf(n))).toEqual(['10 min', '20 min']);
    // No words this week: the warm-up line.
    expect(textOf(one(r.root, 'presenter-preset-fallback-word-review'))).toBe(p.presets.fallback.warmUp);
    await press(one(r.root, 'presenter-preset-warm-up'));
    expect(byTestId(r.root, 'presenter-preset-length-warm-up')).toHaveLength(0);
    await press(one(r.root, 'presenter-preset-next-lesson'));
    expect(textOf(one(r.root, 'presenter-preset-fallback-next-lesson'))).toBe(p.presets.fallback.zero);
  });

  it('lays the cards out in one column below 30rem, two from 30rem, three from 46rem (rem follows the text size)', () => {
    expect(presetColumns(400, 1)).toBe(1);
    expect(presetColumns(480, 1)).toBe(2);
    expect(presetColumns(736, 1)).toBe(3);
    expect(presetColumns(736, 1.5)).toBe(2);
    expect(presetColumns(0, 0)).toBe(1);
  });
});

describe('the one Back and the Display control (sections 7 item 3 and 18.4)', () => {
  it('is a plain link to / when the tab has no app page before /present', async () => {
    const r = await render(<Harness />);
    const back = one(r.root, 'presenter-home-back');
    expect(back.props.role).toBe('link');
    expect(back.props.href).toBe('/');
    expect(back.props['aria-label']).toBe(en.common.buttons.back);
  });

  it('is a button that goes back when it has one', async () => {
    const onBack = vi.fn();
    const r = await render(<Harness backHref={undefined} onBack={onBack} />);
    const back = one(r.root, 'presenter-home-back');
    expect(back.props.role).toBe('button');
    await press(back);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('draws no language chips: the h1 is Lecture mode and the Aa control replaces them', async () => {
    const r = await render(<Harness onDisplay={() => undefined} />);
    expect(textOf(one(r.root, 'presenter-home-title'))).toBe('Lecture mode');
    expect(hostNodes(r.root, (n) => n.props.role === 'radiogroup')).toHaveLength(0);
    expect(byTestId(r.root, 'presenter-home-display')).toHaveLength(1);
  });
});

describe('Customize: the grouped chooser (section 18.3)', () => {
  async function opened(over: HarnessProps = {}) {
    const r = await render(<Harness {...over} />);
    const toggle = one(r.root, 'presenter-home-customize-toggle');
    expect(toggle.props['aria-expanded']).toBe(false);
    expect(toggle.props['aria-controls']).toBe('presenter-customize-panel');
    expect(byTestId(r.root, 'presenter-home-quick')).toHaveLength(0);
    await press(toggle);
    expect(one(r.root, 'presenter-home-customize-toggle').props['aria-expanded']).toBe(true);
    return r;
  }

  it('shows four tabs, one panel at a time; the tabs are one tab stop', async () => {
    const r = await opened();
    const tabs = hostNodes(one(r.root, 'presenter-chooser-tabs'), (n) => n.props.role === 'tab');
    expect(tabs.map((t) => textOf(t))).toEqual(['Lessons', 'Stories', 'Word topics', 'Letters']);
    expect(tabs.map((t) => t.props['aria-selected'])).toEqual([true, false, false, false]);
    expect(tabs.map((t) => t.props.tabIndex)).toEqual([0, -1, -1, -1]);
    expect(byTestId(r.root, 'presenter-chooser-panel-lessons')).toHaveLength(1);
    await press(one(r.root, 'presenter-chooser-tab-letters'));
    expect(byTestId(r.root, 'presenter-chooser-panel-lessons')).toHaveLength(0);
    expect(textOf(one(r.root, 'presenter-chooser-panel-letters'))).toContain('Consonants');
  });

  it('the tablist for the keyboard: the arrows, Home and End move and select, one tab stop, one panel', async () => {
    const r = await opened();
    const tabs = () => hostNodes(one(r.root, 'presenter-chooser-tabs'), (n) => n.props.role === 'tab');
    const selected = () => tabs().map((t) => t.props['aria-selected']);
    const panels = () => hostNodes(r.root, (n) => n.props.role === 'tabpanel');
    expect(await key(one(r.root, 'presenter-chooser-tab-lessons'), 'ArrowRight')).toEqual({ prevented: true });
    expect(selected()).toEqual([false, true, false, false]);
    expect(tabs().map((t) => t.props.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(panels()).toHaveLength(1);
    expect(panels()[0]!.props['aria-labelledby']).toBe('presenter-chooser-tab-stories');
    await key(one(r.root, 'presenter-chooser-tab-stories'), 'End');
    expect(selected()).toEqual([false, false, false, true]);
    await key(one(r.root, 'presenter-chooser-tab-letters'), 'ArrowRight');
    expect(selected()).toEqual([true, false, false, false]);
    await key(one(r.root, 'presenter-chooser-tab-lessons'), 'ArrowLeft');
    expect(selected()).toEqual([false, false, false, true]);
    await key(one(r.root, 'presenter-chooser-tab-letters'), 'Home');
    expect(selected()).toEqual([true, false, false, false]);
    expect(byTestId(r.root, 'presenter-chooser-panel-lessons')).toHaveLength(1);
  });

  it('Space toggles a row as a checkbox does (and never scrolls the page); Enter is the press', async () => {
    const r = await opened();
    await press(one(r.root, 'presenter-chooser-tab-stories'));
    const row = () => hostNodes(one(r.root, 'presenter-chooser-panel-stories'), (n) => n.props.role === 'checkbox')[0]!;
    expect(row().props['aria-checked']).toBe(false);
    expect(await key(row(), ' ')).toEqual({ prevented: true });
    expect(row().props['aria-checked']).toBe(true);
    await key(row(), 'Spacebar');
    expect(row().props['aria-checked']).toBe(false);
    expect(await key(row(), 'ArrowDown')).toEqual({ prevented: false });
    expect(row().props['aria-checked']).toBe(false);
  });

  it('a full lesson: the count and the full line are two lines of the one status, and a box that would add is off', async () => {
    const stories = groups.find((g) => g.id === 'stories')!.rows.map((row) => row.key);
    const topics = groups.find((g) => g.id === 'topics')!.rows.map((row) => row.key);
    const chosen = [...stories, ...topics].slice(0, 30);
    expect(chosen).toHaveLength(30);
    const r = await opened({ initial: { ...HOME_DEFAULT, tab: 'stories', chosen } });
    const status = one(r.root, 'presenter-home-chosen');
    const lines = hostNodes(status, (n) => n.type === 'div' && n.children.some((c) => typeof c === 'string'));
    expect(lines.map((n) => textOf(n))).toEqual([expect.stringMatching(/^30 parts · about \d+ min$/), p.home.quick.full]);
    expect(textOf(one(r.root, 'presenter-home-chosen-full'))).toBe(p.home.quick.full);
    await press(one(r.root, 'presenter-chooser-tab-letters'));
    expect(one(r.root, 'presenter-chooser-row-letters:vowels').props['aria-disabled']).toBe(true);
  });

  it('Customize is the h2 of its region, so Your lesson (h3) sits under it', async () => {
    const r = await opened();
    const region = one(r.root, 'presenter-home-customize');
    const heading = hostNodes(region, (n) => n.type === 'h2')[0]!;
    expect(byTestId(heading, 'presenter-home-customize-toggle')).toHaveLength(1);
    expect(hostNodes(one(r.root, 'presenter-chooser-tray'), (n) => n.props['aria-level'] === 3).map((n) => textOf(n))).toEqual([p.presets.chooser.tray.title]);
  });

  it('the Lessons tab: a stage\'s episodes, "{n} lessons inside", and the tri-state episode', async () => {
    const r = await opened();
    await press(one(r.root, 'presenter-chooser-stage-stage2'));
    const inside = one(r.root, 'presenter-chooser-inside-episode:stage2-letters');
    // Named by its episode and its count, so no two disclosures read the same.
    expect(inside.props['aria-label']).toBeUndefined();
    expect(nameOf(r.root, inside)).toBe(`${groups.flatMap((g) => g.rows).find((row) => row.key === 'episode:stage2-letters')!.title} 6 lessons inside`);
    const names = hostNodes(one(r.root, 'presenter-chooser-panel-lessons'), (n) => typeof n.props['data-testid'] === 'string' && n.props['data-testid'].startsWith('presenter-chooser-inside-')).map((n) => nameOf(r.root, n));
    expect(new Set(names).size).toBe(names.length);
    expect(inside.props['aria-expanded']).toBe(false);
    await press(inside);
    const lessons = byTestId(r.root, 'presenter-chooser-lesson-quest:stage2-letters-q2');
    expect(lessons).toHaveLength(1);
    await press(lessons[0]!);
    expect(one(r.root, 'presenter-chooser-row-episode:stage2-letters').props['aria-checked']).toBe('mixed');
    await press(one(r.root, 'presenter-chooser-row-episode:stage2-letters'));
    expect(one(r.root, 'presenter-chooser-row-episode:stage2-letters').props['aria-checked']).toBe(true);
    // The whole episode locks its lessons.
    const locked = one(r.root, 'presenter-chooser-lesson-quest:stage2-letters-q1');
    expect(locked.props['aria-checked']).toBe(true);
    expect(locked.props['aria-disabled']).toBe(true);
    // The tray shows the episode once.
    expect(byTestId(r.root, 'presenter-chooser-tray-episode:stage2-letters')).toHaveLength(1);
    expect(byTestId(r.root, 'presenter-chooser-tray-quest:stage2-letters-q2')).toHaveLength(0);
  });

  it('Stories page 8 rows at a time with Show {n} more', async () => {
    const r = await opened();
    await press(one(r.root, 'presenter-chooser-tab-stories'));
    const rows = () => hostNodes(one(r.root, 'presenter-chooser-panel-stories'), (n) => n.props.role === 'checkbox');
    expect(rows()).toHaveLength(8);
    const more = one(r.root, 'presenter-chooser-more-stories');
    expect(more.props['aria-label']).toBe('Show 8 more');
    await press(more);
    expect(rows().length).toBeGreaterThan(8);
    expect(rows().length).toBeLessThanOrEqual(16);
  });

  it('Your lesson lists the choices with their remove buttons; the footer says the parts and minutes; Build lesson builds the deck', async () => {
    const onBuild = vi.fn();
    const r = await opened({ onBuild });
    expect(textOf(one(r.root, 'presenter-chooser-tray-empty'))).toBe(p.presets.chooser.tray.empty);
    const status = one(r.root, 'presenter-home-chosen');
    expect(status.props.role).toBe('status');
    expect(status.props['aria-live']).toBe('polite');
    expect(textOf(status)).toBe(p.home.quick.nothing);
    expect(one(r.root, 'presenter-home-build').props['aria-disabled']).toBe(true);
    await press(one(r.root, 'presenter-chooser-row-episode:stage1-letters'));
    await press(one(r.root, 'presenter-chooser-tab-letters'));
    await press(one(r.root, 'presenter-chooser-row-letters:vowels'));
    expect(textOf(one(r.root, 'presenter-home-chosen'))).toBe('2 parts · about 20 min');
    const remove = one(r.root, 'presenter-chooser-remove-letters:vowels');
    expect(remove.props['aria-label']).toBe('Remove Vowels');
    await press(remove);
    expect(textOf(one(r.root, 'presenter-home-chosen'))).toBe('1 part · about 15 min');
    await press(one(r.root, 'presenter-home-build'));
    expect(onBuild).toHaveBeenCalledTimes(1);
    const deck = onBuild.mock.calls[0]![0] as LectureDeck;
    expect(deck.blocks).toEqual([{ kind: 'episode', id: 'episode:stage1-letters' }]);
    expect(deck.source).toBe('quick');
    expect(deck.options.uiLocale).toBeUndefined();
  });

  it('opens on the kept state: the tab, the stage, the choices and the open episodes come back as they were (section 18.2)', async () => {
    const initial: HomeSnapshot = {
      ...HOME_DEFAULT,
      open: 'by-stage',
      stage: 'stage4',
      customize: true,
      tab: 'lessons',
      chooserStage: 'stage2',
      chosen: ['quest:stage2-life-q1'],
      expanded: ['episode:stage2-life'],
    };
    const r = await render(<Harness initial={initial} />);
    expect(one(r.root, 'presenter-preset-by-stage').props['aria-expanded']).toBe(true);
    expect(one(r.root, 'presenter-preset-stage-stage4').props['aria-checked']).toBe(true);
    expect(one(r.root, 'presenter-chooser-stage-stage2').props['aria-checked']).toBe(true);
    expect(one(r.root, 'presenter-chooser-lesson-quest:stage2-life-q1').props['aria-checked']).toBe(true);
    expect(one(r.root, 'presenter-chooser-row-episode:stage2-life').props['aria-checked']).toBe('mixed');
  });

  it('without a chooser stage, the Lessons tab opens on the stage of the open preset\'s first lesson', async () => {
    const r = await render(<Harness initial={{ ...HOME_DEFAULT, open: 'by-stage', stage: 'stage3', customize: true }} />);
    expect(one(r.root, 'presenter-chooser-stage-stage3').props['aria-checked']).toBe(true);
  });
});

describe('the preview on the start screen (design presets.md V4)', () => {
  function start(over: Partial<StartScreenProps> = {}): React.ReactElement {
    const props: StartScreenProps = {
      deckTitle: 'Hangul week 1',
      slides: 46,
      minutes: 19,
      parts: [],
      partTitle: () => null,
      offlineReady: true,
      voice: { kind: 'local', name: 'Yuna' },
      fullscreenSupported: true,
      wakeLockSupported: true,
      fontReady: true,
      onStart: () => undefined,
      ...over,
    };
    return (
      <PresenterViewProvider value={{ messages: en, locale: 'en', unit: 1, reducedMotion: true }}>
        <StartScreen {...props} />
      </PresenterViewProvider>
    );
  }
  const rows = [
    { title: 'Meet a, eo, g, n', minutes: 5 },
    { title: 'Quick quiz: 4 questions', minutes: 4 },
  ];

  it.each([false, true])('lists What\'s in this lesson and offers Customize (phone: %s)', async (phone) => {
    const onCustomize = vi.fn();
    const r = await render(start({ phone, preview: { rows, onCustomize } }));
    const preview = one(r.root, 'presenter-preview');
    expect(textOf(preview)).toContain(p.presets.preview.title);
    expect(textOf(one(r.root, 'presenter-preview-row-0'))).toBe('1 Meet a, eo, g, n about 5 min');
    expect(textOf(one(r.root, 'presenter-preview-row-1'))).toBe('2 Quick quiz: 4 questions about 4 min');
    const customize = one(r.root, 'presenter-preview-customize');
    expect(customize.props['aria-label']).toBe(p.presets.customize.cta);
    await press(customize);
    expect(onCustomize).toHaveBeenCalledTimes(1);
  });

  it('is not drawn for a deck that is not a ready-made lesson', async () => {
    const r = await render(start());
    expect(byTestId(r.root, 'presenter-preview')).toHaveLength(0);
    expect(byTestId(r.root, 'presenter-preview-customize')).toHaveLength(0);
  });
});
