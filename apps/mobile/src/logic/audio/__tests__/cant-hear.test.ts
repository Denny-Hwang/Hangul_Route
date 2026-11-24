import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { DeviceFamily } from '../../device-family';
import { cantHearLine } from '../cant-hear';

/** AMENDMENTS-AUDIO-CANT-HEAR test 8: the sheet's one line is the family's own. */

const FAMILIES: readonly DeviceFamily[] = ['apple', 'android', 'computer'];

describe('cantHearLine', () => {
  it.each(FAMILIES)('%s gets its own line and no other', (family) => {
    const copy = getMessages('en').learner.audio;
    expect(cantHearLine(family, copy)).toBe(copy.cantHear.lines[family]);
    for (const other of FAMILIES.filter((f) => f !== family)) expect(cantHearLine(family, copy)).not.toBe(copy.cantHear.lines[other]);
  });

  it('the English lines (the spec) say the device step in plain words', () => {
    const copy = getMessages('en').learner.audio;
    expect(cantHearLine('apple', copy)).toBe('Turn off silent mode. Then turn the volume up.');
    expect(cantHearLine('android', copy)).toBe('Turn up the media volume with the volume buttons.');
    expect(cantHearLine('computer', copy)).toBe('Turn the volume up. Check that this page is not muted.');
  });

  it.each(['es', 'ko'] as const)('%s has all three lines, each different', (locale) => {
    const copy = getMessages(locale).learner.audio;
    const lines = FAMILIES.map((f) => cantHearLine(f, copy));
    expect(new Set(lines).size).toBe(3);
    for (const line of lines) expect(line.length).toBeGreaterThan(0);
  });
});
