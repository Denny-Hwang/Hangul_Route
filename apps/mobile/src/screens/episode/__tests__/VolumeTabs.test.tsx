import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, hostNodes, press, render, resetPlatform, screenTexts } from '../../../test-support/render';
import { VolumeTabs } from '../VolumeTabs';

/** "Vol 1" and "Vol 2" on a cell's page (F-CURR-002 row CM-40; wireframe `journey/volumes.md` B). */
afterEach(async () => {
  await cleanup();
  resetPlatform();
});

const volumes = [
  { id: 'episode:stage2-nature', volume: 1 },
  { id: 'episode:stage2-nature-v2', volume: 2 },
];

describe('VolumeTabs', () => {
  it('draws a named tab row, Vol 1 and Vol 2 read as Volume 1 and Volume 2, the shown volume selected', async () => {
    const r = await render(<VolumeTabs volumes={volumes} currentId="episode:stage2-nature-v2" />);
    expect(screenTexts(r.root)).toEqual(expect.arrayContaining(['Vol 1', 'Vol 2']));
    const [list] = hostNodes(r.root, (n) => n.props.role === 'tablist');
    expect((list as ReactTestInstance).props['aria-label']).toBe('Volumes');
    const tabs = hostNodes(r.root, (n) => n.props.role === 'tab');
    expect(tabs.map((t) => t.props['aria-label'])).toEqual(['Volume 1', 'Volume 2']);
    expect(tabs.map((t) => t.props['aria-selected'])).toEqual([false, true]);
  });

  it('a tap on the other volume opens its page; the shown one does nothing', async () => {
    const opened: string[] = [];
    const r = await render(<VolumeTabs volumes={volumes} currentId="episode:stage2-nature" onOpenVolume={(id) => opened.push(id)} />);
    const tabs = hostNodes(r.root, (n) => n.props.role === 'tab');
    await press(tabs[0] as ReactTestInstance);
    await press(tabs[1] as ReactTestInstance);
    expect(opened).toEqual(['episode:stage2-nature-v2']);
  });

  it('draws nothing for a cell of one volume', async () => {
    const r = await render(<VolumeTabs volumes={volumes.slice(0, 1)} currentId="episode:stage2-nature" />);
    expect(hostNodes(r.root, (n) => n.props.role === 'tablist')).toHaveLength(0);
  });
});
