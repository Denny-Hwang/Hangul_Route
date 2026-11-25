import { afterEach, describe, expect, it } from 'vitest';
import { AskedRomanization } from '../../components/AskedRomanization';
import { byTestId, render, textOf, unmount } from '../../test-support/render';

/**
 * A Check's asked text (AMENDMENTS-AUDIO-CANT-HEAR row CH-1e, section 3.12): the romanization alone, said as a sound
 * value by a screen reader ("g or k", never "slash"), and its own name when nothing differs.
 */

const mounted: Awaited<ReturnType<typeof render>>[] = [];
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

describe('AskedRomanization', () => {
  it('draws the romanization and nothing else', async () => {
    const r = await render(<AskedRomanization romanization="neo" testID="asked" />);
    mounted.push(r);
    expect(textOf(byTestId(r.root, 'asked')[0]!)).toBe('neo');
  });

  it('a letter with two sound values is named with "or" for a screen reader', async () => {
    const r = await render(<AskedRomanization romanization="g/k" testID="asked" />);
    mounted.push(r);
    const node = byTestId(r.root, 'asked')[0]!;
    expect(node.props['aria-label']).toBe('g or k');
  });

  it('a plain romanization carries no separate name: the text is its own name', async () => {
    const r = await render(<AskedRomanization romanization="bap" testID="asked" />);
    mounted.push(r);
    expect(byTestId(r.root, 'asked')[0]!.props['aria-label']).toBeUndefined();
  });
});
