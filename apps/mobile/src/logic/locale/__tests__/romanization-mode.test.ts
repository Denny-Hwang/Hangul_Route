import type { RomanizationChoice } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  ROMANIZATION_DEFAULT_CHOICE,
  resolveRomanizationMode,
  romanizationChoiceOf,
  romanizationMirrorOf,
  romanizationResolver,
  type FadeContext,
} from '../romanization-mode';
import type { FadePhase } from '../romanization-fade';

const PHASES: readonly FadePhase[] = ['letters', 'reading', 'all'];

/** The symbols a learner who has met 산 (ㅅ ㅏ ㄴ-final) has: 산 is decodable, 까치 and 강 (no ㅇ-final yet) are not. */
const MET: ReadonlySet<string> = new Set(['jamo:siot', 'jamo:a', 'jamo:nieun-batchim']);

function fade(phase: FadePhase, screenReader = false, met: ReadonlySet<string> = MET): FadeContext {
  return { phase, met, screenReader };
}

const DECODABLE = '산';
const OTHER = '까치';

/**
 * F-BROWSE-001 §4.9 (BR-5c): one rule for the romanization mode a screen shows.
 * An override (the All lessons display setting, given by a provider) wins; else
 * the profile's own setting; else `always`, as every screen did before.
 */
describe('resolveRomanizationMode', () => {
  it('falls back to always with no override and no profile settings', () => {
    expect(resolveRomanizationMode(null, undefined)).toBe('always');
  });

  it('reads the profile setting when there is no override', () => {
    expect(resolveRomanizationMode(null, { romanizationMode: 'tap' })).toBe('tap');
    expect(resolveRomanizationMode(null, { romanizationMode: 'always' })).toBe('always');
  });

  it('lets the override win over the profile setting', () => {
    expect(resolveRomanizationMode('tap', { romanizationMode: 'always' })).toBe('tap');
    expect(resolveRomanizationMode('always', { romanizationMode: 'tap' })).toBe('always');
    expect(resolveRomanizationMode('tap', undefined)).toBe('tap');
  });

  it('keeps the two-argument call as it was and takes the fade as a third', () => {
    expect(resolveRomanizationMode(null, { romanizationChoice: 'auto' }, fade('all'))).toBe('tap');
    expect(resolveRomanizationMode(null, { romanizationChoice: 'auto' })).toBe('always');
  });
});

/** AMENDMENTS-ROMANIZATION-FADE section 3.2: the migration. */
describe('romanizationChoiceOf', () => {
  it('the default choice is As I learn (RF-2 turned the fade on)', () => {
    expect(ROMANIZATION_DEFAULT_CHOICE).toBe('auto');
  });

  it('migration, built-in default (OD-RF-1): a stored always reads as the default, a stored tap stays tap, a stored choice stays', () => {
    // no record, an empty record, the old switch's Off, and a value another writer filled in (Read to me, Challenge, clock)
    expect(romanizationChoiceOf(undefined)).toBe('auto');
    expect(romanizationChoiceOf({})).toBe('auto');
    expect(romanizationChoiceOf({ romanizationMode: 'always' })).toBe('auto');
    // the old switch's On: the one value that recorded a choice
    expect(romanizationChoiceOf({ romanizationMode: 'tap' })).toBe('tap');
    // a choice this build wrote, with its mirror
    expect(romanizationChoiceOf({ romanizationChoice: 'always', romanizationMode: 'always' })).toBe('always');
    expect(romanizationChoiceOf({ romanizationChoice: 'tap', romanizationMode: 'tap' })).toBe('tap');
    expect(romanizationChoiceOf({ romanizationChoice: 'auto', romanizationMode: 'always' })).toBe('auto');
  });

  it('an older cached build reads the mirror alone: it shows tap for a tap choice and always for the rest, as before', () => {
    // The older build's own rule (`override ?? settings.romanizationMode ?? 'always'`) applied to what this build writes.
    const olderBuildShows = (s: { romanizationMode?: 'always' | 'tap' }): 'always' | 'tap' => s.romanizationMode ?? 'always';
    for (const choice of ['auto', 'always', 'tap'] as const) {
      expect(olderBuildShows({ romanizationMode: romanizationMirrorOf(choice) })).toBe(choice === 'tap' ? 'tap' : 'always');
    }
  });

  it.each<RomanizationChoice>(['auto', 'always'])('with the default choice %s (what RF-2 flips)', (defaultChoice) => {
    // no record, a record that did not parse, an empty record
    expect(romanizationChoiceOf(undefined, defaultChoice)).toBe(defaultChoice);
    expect(romanizationChoiceOf({}, defaultChoice)).toBe(defaultChoice);
    // the old switch's Off, or a value another writer filled in: the default (OD-RF-1)
    expect(romanizationChoiceOf({ romanizationMode: 'always' }, defaultChoice)).toBe(defaultChoice);
    // the old switch's On: the only legacy value that was a choice, kept whatever the default
    expect(romanizationChoiceOf({ romanizationMode: 'tap' }, defaultChoice)).toBe('tap');
  });

  it.each<RomanizationChoice>(['auto', 'always'])('a stored choice wins over the legacy field and the default %s', (defaultChoice) => {
    for (const choice of ['auto', 'always', 'tap'] as const) {
      for (const mode of ['always', 'tap', undefined] as const) {
        expect(romanizationChoiceOf({ romanizationChoice: choice, romanizationMode: mode }, defaultChoice)).toBe(choice);
      }
    }
  });

  it('uses the built-in default when none is given', () => {
    expect(romanizationChoiceOf(undefined)).toBe(ROMANIZATION_DEFAULT_CHOICE);
    expect(romanizationChoiceOf({ romanizationMode: 'tap' })).toBe('tap');
  });

  it('the mirror an older cached build reads: tap for tap, its own default for the rest', () => {
    expect(romanizationMirrorOf('tap')).toBe('tap');
    expect(romanizationMirrorOf('always')).toBe('always');
    expect(romanizationMirrorOf('auto')).toBe('always');
  });

  it('reading a record back through the mirror alone (an older build rewrote it) keeps tap as tap', () => {
    for (const choice of ['auto', 'always', 'tap'] as const) {
      const legacyOnly = { romanizationMode: romanizationMirrorOf(choice) };
      expect(romanizationChoiceOf(legacyOnly, 'always')).toBe(choice === 'tap' ? 'tap' : 'always');
    }
  });
});

describe('romanizationResolver: surface (section 3.5, rows S1 to S7)', () => {
  it('S1: an override wins over every choice and phase', () => {
    for (const choice of ['auto', 'always', 'tap'] as const) {
      for (const phase of PHASES) {
        expect(romanizationResolver('tap', { romanizationChoice: choice }, fade(phase)).surface).toBe('tap');
        expect(romanizationResolver('always', { romanizationChoice: choice }, fade(phase)).surface).toBe('always');
      }
    }
  });

  it('S2 and S3: an explicit choice is the mode in every phase', () => {
    for (const phase of PHASES) {
      expect(romanizationResolver(null, { romanizationChoice: 'always' }, fade(phase)).surface).toBe('always');
      expect(romanizationResolver(null, { romanizationChoice: 'tap' }, fade(phase)).surface).toBe('tap');
    }
  });

  it('S4: auto with no fade (no profile, or progress not read yet) is always', () => {
    expect(romanizationResolver(null, { romanizationChoice: 'auto' }, null).surface).toBe('always');
  });

  it('S5: auto with a screen reader is always, in every phase', () => {
    for (const phase of PHASES) {
      expect(romanizationResolver(null, { romanizationChoice: 'auto' }, fade(phase, true)).surface).toBe('always');
    }
  });

  it('S6 and S7: auto is always in letters and reading, tap in all', () => {
    const auto = { romanizationChoice: 'auto' } as const;
    expect(romanizationResolver(null, auto, fade('letters')).surface).toBe('always');
    expect(romanizationResolver(null, auto, fade('reading')).surface).toBe('always');
    expect(romanizationResolver(null, auto, fade('all')).surface).toBe('tap');
  });

  it('a profile with no choice reads the default (As I learn): it follows the phase; a stored tap stays tap (OD-RF-1)', () => {
    const followsPhase: Record<FadePhase, 'always' | 'tap'> = { letters: 'always', reading: 'always', all: 'tap' };
    for (const phase of PHASES) {
      expect(romanizationResolver(null, undefined, fade(phase)).surface).toBe(followsPhase[phase]);
      // the old switch's Off, or a value another writer filled in: the default, not an explicit Always
      expect(romanizationResolver(null, { romanizationMode: 'always' }, fade(phase)).surface).toBe(followsPhase[phase]);
      expect(romanizationResolver(null, { romanizationMode: 'tap' }, fade(phase)).surface).toBe('tap');
    }
  });

  it('with no progress read yet (or no profile) the default shows everything, as S4 says', () => {
    expect(romanizationResolver(null, undefined, null).surface).toBe('always');
    expect(romanizationResolver(null, { romanizationMode: 'always' }, null).surface).toBe('always');
  });
});

describe('romanizationResolver: check (sections 3.5 and 3.7)', () => {
  it('is never tap for auto, whatever the phase and the screen reader', () => {
    for (const phase of PHASES) {
      for (const screenReader of [false, true]) {
        expect(romanizationResolver(null, { romanizationChoice: 'auto' }, fade(phase, screenReader)).check).toBe('always');
      }
    }
    expect(romanizationResolver(null, { romanizationChoice: 'auto' }, null).check).toBe('always');
  });

  it('is always for always, and tap only for an explicit tap (new or legacy), in every phase', () => {
    for (const phase of PHASES) {
      expect(romanizationResolver(null, { romanizationChoice: 'always' }, fade(phase)).check).toBe('always');
      expect(romanizationResolver(null, { romanizationChoice: 'tap' }, fade(phase)).check).toBe('tap');
      expect(romanizationResolver(null, { romanizationMode: 'tap' }, fade(phase)).check).toBe('tap');
    }
  });

  it('lets an override win', () => {
    expect(romanizationResolver('tap', { romanizationChoice: 'always' }, fade('all')).check).toBe('tap');
    expect(romanizationResolver('always', { romanizationChoice: 'tap' }, fade('all')).check).toBe('always');
  });

  it('equals the surface mode for a profile that chose Always or Only when I tap', () => {
    for (const settings of [{ romanizationMode: 'tap' as const }, { romanizationChoice: 'tap' as const }, { romanizationChoice: 'always' as const }]) {
      const r = romanizationResolver(null, settings, fade('all'));
      expect(r.check).toBe(r.surface);
    }
  });
});

describe('romanizationResolver: forText (section 3.5, the per-text table)', () => {
  const texts = [DECODABLE, OTHER, 'ㄱ', '', 'san'];
  const every = (r: ReturnType<typeof romanizationResolver>) => texts.map((t) => r.forText(t));

  it('always shows every text, in every phase', () => {
    for (const phase of PHASES) {
      expect(every(romanizationResolver(null, { romanizationChoice: 'always' }, fade(phase)))).toEqual(Array(texts.length).fill('always'));
    }
  });

  it('tap folds every text, in every phase', () => {
    for (const phase of PHASES) {
      expect(every(romanizationResolver(null, { romanizationChoice: 'tap' }, fade(phase)))).toEqual(Array(texts.length).fill('tap'));
    }
  });

  it('auto in letters shows every text', () => {
    expect(every(romanizationResolver(null, { romanizationChoice: 'auto' }, fade('letters')))).toEqual(Array(texts.length).fill('always'));
  });

  it('auto in reading folds only a decodable text; a word with an unmet letter, a lone letter and Latin letters stay shown', () => {
    const r = romanizationResolver(null, { romanizationChoice: 'auto' }, fade('reading'));
    expect(r.forText(DECODABLE)).toBe('tap');
    expect(r.forText('산 산')).toBe('tap');
    expect(r.forText('산!')).toBe('tap');
    expect(r.forText('강')).toBe('always');
    expect(r.forText(OTHER)).toBe('always');
    expect(r.forText('ㄱ')).toBe('always');
    expect(r.forText('san')).toBe('always');
    expect(r.forText('')).toBe('always');
    // the same word is shown while a letter of it is not met
    const fewer = fade('reading', false, new Set(['jamo:siot']));
    expect(romanizationResolver(null, { romanizationChoice: 'auto' }, fewer).forText(DECODABLE)).toBe('always');
  });

  it('auto in all folds every text, a lone letter included', () => {
    expect(every(romanizationResolver(null, { romanizationChoice: 'auto' }, fade('all')))).toEqual(Array(texts.length).fill('tap'));
  });

  it('auto with a screen reader shows every text, in every phase', () => {
    for (const phase of PHASES) {
      expect(every(romanizationResolver(null, { romanizationChoice: 'auto' }, fade(phase, true)))).toEqual(Array(texts.length).fill('always'));
    }
  });

  it('auto with no fade shows every text', () => {
    expect(every(romanizationResolver(null, { romanizationChoice: 'auto' }, null))).toEqual(Array(texts.length).fill('always'));
  });

  it('an override is every text, in every phase and choice', () => {
    for (const choice of ['auto', 'always', 'tap'] as const) {
      for (const phase of PHASES) {
        expect(every(romanizationResolver('tap', { romanizationChoice: choice }, fade(phase)))).toEqual(Array(texts.length).fill('tap'));
        expect(every(romanizationResolver('always', { romanizationChoice: choice }, fade(phase)))).toEqual(Array(texts.length).fill('always'));
      }
    }
  });
});
