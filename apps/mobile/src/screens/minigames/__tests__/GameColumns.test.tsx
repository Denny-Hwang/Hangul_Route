import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameArrangement } from '../../../logic/layout/game-layout';
import { resetPlatform, setPlatform, type RenderPlatform } from '../../../test-support/render';
import { GameColumns } from '../GameColumns';

/**
 * F-CURR-001 G-2 follow-up 2 (D-2 D7 parity): side by side with `stickyPrompt`, native keeps the
 * prompt column in view by scrolling each column on its own (no CSS sticky there); the web keeps
 * CSS sticky inside the page scroll; stacked windows are unchanged on every platform.
 */

const mounted: ReactTestRenderer[] = [];

async function draw(os: RenderPlatform, arrangement: GameArrangement, stickyPrompt: boolean): Promise<ReactTestInstance> {
  setPlatform(os);
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <GameColumns
        arrangement={arrangement}
        stickyPrompt={stickyPrompt}
        prompt={<View testID="prompt"><Text>sheet</Text></View>}
        answers={<View testID="answers"><Text>options</Text></View>}
        feedback={<View testID="feedback"><Text>hint</Text></View>}
      />,
    );
  });
  mounted.push(r);
  return r.root;
}

/** The ScrollView (composite) that holds the view with `testID`, or undefined. */
function scrollOf(root: ReactTestInstance, testID: string): ReactTestInstance | undefined {
  const node = root.find((n) => typeof n.type !== 'string' && n.props.testID === testID);
  for (let p: ReactTestInstance | null = node.parent; p; p = p.parent) if (p.type === ScrollView) return p;
  return undefined;
}

const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean)) as Record<string, unknown>;

afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  resetPlatform();
});

describe('GameColumns: the prompt stays in view beside the answers (D-2 D7)', () => {
  it.each(['ios', 'android'] as const)('%s side by side: the row fills the height, the prompt and the answers each scroll on their own', async (os) => {
    const root = await draw(os, 'side', true);
    const pinned = root.find((n) => typeof n.type !== 'string' && n.props.testID === 'game-columns-pinned');
    expect(flat(pinned.props.style)).toMatchObject({ flex: 1, flexDirection: 'row' });
    const promptScroll = scrollOf(root, 'prompt');
    const answersScroll = scrollOf(root, 'answers');
    expect(promptScroll?.props.testID).toBe('game-columns-prompt-scroll');
    expect(answersScroll?.props.testID).toBe('game-columns-answers-scroll');
    expect(promptScroll).not.toBe(answersScroll);
    // Hoya's feedback stays under the prompt, beside the answers.
    expect(scrollOf(root, 'feedback')).toBe(promptScroll);
    expect(root.findAllByType(ScrollView)).toHaveLength(2);
  });

  it('web side by side: no scroll views of its own, the prompt column is CSS sticky', async () => {
    const root = await draw('web', 'side', true);
    expect(root.findAllByType(ScrollView)).toHaveLength(0);
    const sticky = root.findAll((n) => typeof n.type !== 'string' && n.type !== GameColumns && flat(n.props.style).position === 'sticky');
    expect(sticky.length).toBeGreaterThan(0);
    expect(sticky[0]!.find((n) => n.props.testID === 'prompt')).toBeDefined();
    expect(sticky[0]!.findAll((n) => n.props.testID === 'answers')).toHaveLength(0);
  });

  it.each(['ios', 'android', 'web'] as const)('%s stacked, or side by side without stickyPrompt: the plain columns, no scroll views', async (os) => {
    for (const [arrangement, sticky] of [['stacked', true], ['side', false]] as const) {
      const root = await draw(os, arrangement, sticky);
      expect(root.findAllByType(ScrollView), `${arrangement} ${sticky}`).toHaveLength(0);
      expect(root.findAll((n) => n.props.testID === 'game-columns-pinned')).toHaveLength(0);
    }
  });
});

describe('GameColumns native columns: the round starts at the top, a new nudge comes into view', () => {
  type Scroll = { top: number; left: number };
  const calls: Record<string, Scroll[]> = {};
  const nodeMock = (el: { props: Record<string, unknown> }): object => {
    const id = String(el.props['data-testid'] ?? '');
    return { scrollHeight: 900, scrollWidth: 300, scroll: vi.fn((o: Scroll) => void (calls[id] ??= []).push({ top: o.top, left: o.left })) };
  };
  const tree = (resetKey: string, feedbackKey: string | undefined): React.ReactElement => (
    <GameColumns
      arrangement="side"
      stickyPrompt
      resetKey={resetKey}
      feedbackKey={feedbackKey}
      prompt={<View testID="prompt"><Text>sheet</Text></View>}
      answers={<View testID="answers"><Text>options</Text></View>}
      feedback={feedbackKey ? <View testID="feedback"><Text>hint</Text></View> : null}
    />
  );

  it('a new feedbackKey scrolls the prompt column to its end; a new resetKey sends both columns to the top', async () => {
    setPlatform('ios');
    for (const k of Object.keys(calls)) delete calls[k];
    let r!: ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(tree('q1', undefined), { createNodeMock: nodeMock });
    });
    mounted.push(r);
    const prompt = (): Scroll[] => calls['game-columns-prompt-scroll'] ?? [];
    const answers = (): Scroll[] => calls['game-columns-answers-scroll'] ?? [];
    // Mount: both at the top, nothing revealed yet.
    expect(prompt().at(-1)).toEqual({ top: 0, left: 0 });
    expect(answers().at(-1)).toEqual({ top: 0, left: 0 });
    const before = prompt().length;

    await act(async () => {
      r.update(tree('q1', '1|hint|'));
    });
    expect(prompt().slice(before)).toContainEqual({ top: 900, left: 0 });
    // The answers column the learner is using does not move.
    expect(answers()).toHaveLength(1);

    await act(async () => {
      r.update(tree('q2', undefined));
    });
    expect(prompt().at(-1)).toEqual({ top: 0, left: 0 });
    expect(answers().at(-1)).toEqual({ top: 0, left: 0 });
    expect(answers()).toHaveLength(2);
  });
});
