import { touchTarget } from '@hangul-route/design-system';
import type { ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';
import { hostNodes, render, unmount } from '../../../test-support/render';
import { PREVIOUS_TEST_ID, StepActions } from '../StepActions';

/**
 * [TC] AMENDMENTS-STAGE1-TRACE-COVERAGE TC-1b (design/screens/discover-trace/trace-new-letters.md, "For TC-1b"):
 * `StepActions` gets a row size. `lg` (80 high) is the default every step uses; the trace page's short arrangements draw
 * Previous and Continue `md` (`touchTarget.min`, 64 high, owner decision 2026-11-26).
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const mounted: ReactTestRenderer[] = [];
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

const minHeights = (r: ReactTestRenderer): number[] =>
  hostNodes(r.root, (n) => n.props.role === 'button').map((n) => {
    const style = ([] as unknown[])
      .concat(n.props.style)
      .flat(3)
      .reduce<Record<string, unknown>>((acc, s) => ({ ...acc, ...(s as object) }), {});
    return parseFloat(String(style.minHeight));
  });

async function draw(rowSize?: 'lg' | 'md'): Promise<ReactTestRenderer> {
  const r = await render(
    <StepActions main={{ label: 'Continue', size: 'lg', onPress: () => undefined }} previousLabel="Previous" onPrevious={() => undefined} {...(rowSize ? { rowSize } : {})} />,
  );
  mounted.push(r);
  return r;
}

describe('StepActions row size (TC-1b)', () => {
  it('draws Previous and Continue 80 high by default', async () => {
    const r = await draw();
    expect(minHeights(r)).toEqual([touchTarget.child, touchTarget.child]);
  });

  it('draws both 64 high with rowSize "md": still a touch target', async () => {
    const r = await draw('md');
    expect(minHeights(r)).toEqual([touchTarget.min, touchTarget.min]);
  });

  it('keeps Previous reachable by its test id in both sizes', async () => {
    for (const size of ['lg', 'md'] as const) {
      const r = await draw(size);
      expect(hostNodes(r.root, (n) => n.props['data-testid'] === PREVIOUS_TEST_ID).length).toBeGreaterThan(0);
      await unmount(mounted.pop()!);
    }
  });

  it('a lone main button (no Previous) takes its own size and ignores rowSize', async () => {
    const r = await render(<StepActions main={{ label: 'Continue', size: 'hero', onPress: () => undefined }} previousLabel="Previous" rowSize="md" />);
    mounted.push(r);
    expect(minHeights(r)).toEqual([touchTarget.hero]);
  });
});
