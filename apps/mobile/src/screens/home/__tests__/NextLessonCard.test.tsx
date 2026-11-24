import { ConfirmSheet, type ConfirmSheetProps } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import type { ReactElement } from 'react';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import type { HomeNextLesson } from '../../../logic/placement/home-card';
import { byTestId, hostNodes, press, render, screenTexts, textOf } from '../../../test-support/render';
import { NextLessonCard } from '../NextLessonCard';

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-2 (section 3.2, tests 13-15; wireframe `home/next-lesson-resume.md`): the hero
 * of a lesson left in the middle. The ConfirmSheet is a Modal that the Node renderer cannot show; its element is read
 * for its props, as MinigameScreen-leave.test.tsx reads the Keep playing sheet.
 */
const copy = getMessages('en').learner.home.next;
const LESSON: HomeNextLesson = { questId: 'quest:q1', episodeId: 'episode:e1', minutes: 4, cta: 'continue' };
const FIRST_DAY: HomeNextLesson = { ...LESSON, cta: 'start' };
const TITLE = 'Meet o, u, m and the circle';

interface Over {
  lesson?: HomeNextLesson;
  resume?: { step: number; total: number } | null;
  onStart?: () => void;
  onStartAgain?: () => void;
  onRoute?: (() => void) | null;
}

function card({ lesson = LESSON, resume = null, onStart = () => undefined, onStartAgain, onRoute = () => undefined }: Over = {}): ReactElement {
  return <NextLessonCard lesson={lesson} title={TITLE} where="Stage 1 · Meet the Letters · lesson 2 of 3" goal={null} week={null} resume={resume} onStart={onStart} onStartAgain={onStartAgain} onRoute={onRoute} />;
}

const button = (r: ReactTestRenderer): ReactTestInstance => byTestId(r.root, 'home-next-lesson-start')[0]!;
const sheet = (r: ReactTestRenderer): ConfirmSheetProps => r.root.findAllByType(ConfirmSheet)[0]!.props as ConfirmSheetProps;
const sheets = (r: ReactTestRenderer): number => r.root.findAllByType(ConfirmSheet).length;

/** Every host node's test id, text and role before the hero button, in order: what must not move when the read lands. */
function beforeTheButton(r: ReactTestRenderer): string[] {
  const nodes = hostNodes(r.root, () => true);
  const target = nodes.find((n) => n.props['data-testid'] === 'home-next-lesson-start')!;
  const at = nodes.indexOf(target);
  // The ancestors of the button hold what comes after it too (their text), so they are not what is compared.
  const holdsButton = (n: ReactTestInstance): boolean => n.findAll((d) => d === target).length > 0;
  return nodes.slice(0, at).filter((n) => !holdsButton(n)).map((n) => `${String(n.type)}|${String(n.props['data-testid'] ?? '')}|${n.props.role ?? ''}|${textOf(n)}`);
}

describe('the plain hero (no resume variant)', () => {
  it('is as it was: Start on a first day, Continue after, no caption, no Start again, no sheet', async () => {
    const first = await render(card({ lesson: FIRST_DAY }));
    expect(textOf(button(first))).toContain(copy.start.cta);
    const after = await render(card());
    expect(textOf(button(after))).toContain(copy.continue.cta);
    for (const r of [first, after]) {
      expect(byTestId(r.root, 'home-next-lesson-resume')).toHaveLength(0);
      expect(byTestId(r.root, 'home-next-lesson-start-again')).toHaveLength(0);
      expect(sheets(r)).toBe(0);
      expect(byTestId(r.root, 'home-next-lesson-route')).toHaveLength(1);
    }
    expect(button(first).props['aria-describedby']).toBeUndefined();
  });
});

describe('the resume variant', () => {
  it('reads Continue whatever the learner has done, with the line "You can go on from step 3 of 5." and Start again', async () => {
    for (const lesson of [LESSON, FIRST_DAY]) {
      const r = await render(card({ lesson, resume: { step: 3, total: 5 } }));
      expect(textOf(button(r))).toContain(copy.continue.cta);
      expect(textOf(button(r))).not.toContain(copy.start.cta);
      expect(textOf(byTestId(r.root, 'home-next-lesson-resume')[0]!)).toBe('You can go on from step 3 of 5.');
      expect(byTestId(r.root, 'home-next-lesson-start-again')[0]!.props['aria-label']).toBe('Start again');
    }
  });

  it('Continue carries the line as its hint; Start again has the button role and a touch target', async () => {
    const r = await render(card({ resume: { step: 3, total: 5 } }));
    // The web button describes itself by a hidden copy of the hint (react-native-web drops accessibilityHint).
    const describedBy = String(button(r).props['aria-describedby']);
    const hint = hostNodes(r.root, (n) => n.props.id === describedBy)[0];
    expect(hint && textOf(hint)).toBe('You can go on from step 3 of 5.');
    expect(screenTexts(r.root)).toContain('You can go on from step 3 of 5.');
    const again = byTestId(r.root, 'home-next-lesson-start-again')[0]!;
    expect(again.props.role).toBe('button');
    expect(String(again.props['aria-label'])).toBe('Start again');
  });

  it('keeps the order title, where, minutes, Continue, caption, Start again, Learning Route link', async () => {
    const r = await render(card({ resume: { step: 3, total: 5 } }));
    const ids = hostNodes(r.root, (n) => typeof n.props['data-testid'] === 'string').map((n) => String(n.props['data-testid']));
    const order = ['home-next-lesson-where', 'home-next-lesson-start', 'home-next-lesson-resume', 'home-next-lesson-start-again', 'home-next-lesson-route'];
    expect(ids.filter((id) => order.includes(id))).toEqual(order);
  });

  it('the hero button never moves when the read lands: nothing before it changes', async () => {
    const plain = await render(card({ lesson: FIRST_DAY }));
    const resumed = await render(card({ lesson: FIRST_DAY, resume: { step: 3, total: 5 } }));
    expect(beforeTheButton(resumed)).toEqual(beforeTheButton(plain));
    // And the same card, re-rendered with the read landing, keeps the same button instance in place.
    const live = await render(card());
    const before = beforeTheButton(live);
    await act(async () => live.update(card({ resume: { step: 3, total: 5 } })));
    expect(beforeTheButton(live)).toEqual(before);
    expect(byTestId(live.root, 'home-next-lesson-resume')).toHaveLength(1);
  });

  it('Continue is the same tap as Start', async () => {
    const onStart = vi.fn();
    const r = await render(card({ resume: { step: 3, total: 5 }, onStart }));
    await press(button(r));
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});

describe('Start again asks first', () => {
  const open = async (over: Over = {}): Promise<ReactTestRenderer> => {
    const r = await render(card({ resume: { step: 3, total: 5 }, ...over }));
    await press(byTestId(r.root, 'home-next-lesson-start-again')[0]!);
    return r;
  };

  it('opens a ConfirmSheet "home-start-again": Keep my place first and filled, Start again plain, never danger', async () => {
    const r = await render(card({ resume: { step: 3, total: 5 } }));
    expect(sheet(r).visible).toBe(false);
    await press(byTestId(r.root, 'home-next-lesson-start-again')[0]!);
    expect(sheet(r)).toMatchObject({
      visible: true,
      testID: 'home-start-again',
      title: 'Start this lesson again?',
      message: 'You go back to the first step. Your stars and cards stay.',
      cancelLabel: 'Keep my place',
      confirmLabel: 'Start again',
      safeFilled: true,
    });
    expect(sheet(r).confirmTone).toBeUndefined();
    expect(sheet(r).confirmFirst).toBeUndefined();
  });

  it('Keep my place closes the sheet and changes nothing', async () => {
    const onStart = vi.fn();
    const onStartAgain = vi.fn();
    const r = await open({ onStart, onStartAgain });
    await act(async () => sheet(r).onCancel());
    expect(sheet(r).visible).toBe(false);
    expect(onStart).not.toHaveBeenCalled();
    expect(onStartAgain).not.toHaveBeenCalled();
    expect(byTestId(r.root, 'home-next-lesson-resume')).toHaveLength(1);
  });

  it('Start again closes the sheet and runs the screen\'s start-again once; the tap on the hero itself is not run', async () => {
    const onStart = vi.fn();
    const onStartAgain = vi.fn();
    const r = await open({ onStart, onStartAgain });
    await act(async () => sheet(r).onConfirm());
    expect(sheet(r).visible).toBe(false);
    expect(onStartAgain).toHaveBeenCalledTimes(1);
    expect(onStart).not.toHaveBeenCalled();
  });

  it('a sheet is drawn only with the resume variant', async () => {
    const r = await render(card());
    expect(sheets(r)).toBe(0);
  });
});
