import { describe, expect, it } from 'vitest';
import { afterGateHandoff, gateLessonsStep } from '../gate-entry';

describe('gateLessonsStep (F-BROWSE-001 section 4.3, BR-12a)', () => {
  it('opens All lessons at once while the grown-up gate opens directly', () => {
    expect(gateLessonsStep(true)).toBe('open');
  });

  it('asks for the PIN when the grown-up session has lapsed, so a page left open never writes a pass', () => {
    expect(gateLessonsStep(false)).toBe('pin');
  });
});

describe('afterGateHandoff', () => {
  it('leaves for All lessons when the pass was written', () => {
    expect(afterGateHandoff(true)).toBe('leave');
  });

  it('opens the dashboard, with the storage line, when the browser refused the pass', () => {
    expect(afterGateHandoff(false)).toBe('dashboard');
  });
});
