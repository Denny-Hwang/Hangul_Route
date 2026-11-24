import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { DeviceFamily } from '../../device-family';
import { voiceHelpContent } from '../voice-help';

/** AMENDMENTS-AUDIO-CANT-HEAR section 3.9 and test 7: "Add a Korean voice" shows one device's section (P2-22). */

const COPY = getMessages('en').learner.audio.voiceHelp;
const FAMILIES: readonly DeviceFamily[] = ['apple', 'android', 'computer'];

describe('voiceHelpContent(copy, family)', () => {
  it.each(FAMILIES)('%s: exactly one section, that family\'s', (family) => {
    const help = voiceHelpContent(COPY, family);
    expect(help.sections.map((s) => s.id)).toEqual([family]);
    expect(help.sections[0]!.steps).toEqual(COPY.sections[family].steps);
    expect(help.sections[0]!.title).toBe(COPY.sections[family].title);
  });

  it('the title, note and footer do not change with the family', () => {
    const all = voiceHelpContent(COPY);
    for (const family of FAMILIES) {
      const one = voiceHelpContent(COPY, family);
      expect(one.title).toBe(all.title);
      expect(one.note).toBe(all.note);
      expect(one.footer).toBe(all.footer);
    }
  });

  it('with no family it still returns the three sections, in the wireframe order', () => {
    expect(voiceHelpContent(COPY).sections.map((s) => s.id)).toEqual(['apple', 'android', 'computer']);
  });
});
