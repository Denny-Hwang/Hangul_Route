import { LectureDeckSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { isLoneJamo } from '../../audio/speech-guard';
import { lectureBundle } from '../content';
import { expandDeck, type Slide } from '../deck-builder';
import { slideSound } from '../slide-view';
import { readToMePlan } from '../story-slides';

/**
 * The presenter's story slides say a letter by its name (AMENDMENTS-AUDIO-CLIPS M8): the story
 * `shapes-of-hangeul` shows ㄱ, ㅁ, ㅣ ... and gives each its name as `spokenKo`, so Read-to-me, the
 * keyword chips and the check target's Sound never hand a bare letter to the voice.
 */

const deck = LectureDeckSchema.parse({
  v: 1,
  id: 'lecture:shapes01',
  title: 'Shapes',
  createdAt: '2026-10-29T09:00:00Z',
  seed: 2,
  blocks: [{ kind: 'story', storyId: 'story:shapes-of-hangeul', checks: true }],
});
const { slides } = expandDeck(deck, lectureBundle('en'), { canPlayKorean: true });

describe('the shapes-of-hangeul story on the presenter', () => {
  it('its letter keywords and targets carry their names', () => {
    const pieces = slides.flatMap((s) => (s.kind === 'story' ? s.narration.flatMap((p) => ('ko' in p ? [p] : [])) : []));
    const letters = pieces.filter((p) => isLoneJamo(p.ko));
    expect(letters.length).toBeGreaterThan(5);
    for (const p of letters) expect(p.spokenKo, p.ko).toMatch(/^[가-힣]+$/u);
  });

  it('Read-to-me on every scene says no bare letter', () => {
    for (const s of slides.filter((x): x is Extract<Slide, { kind: 'story' }> => x.kind === 'story')) {
      const plan = readToMePlan(s, { sound: true, canPlayKorean: true, voiceChecked: true, narrationLang: 'en-US' });
      for (const step of plan?.steps ?? []) expect(isLoneJamo(step.text), `${s.key}: ${step.text}`).toBe(false);
    }
  });

  it("a check whose target is a letter plays the letter's name", () => {
    const checks = slides.filter((s): s is Extract<Slide, { kind: 'quiz' }> => s.kind === 'quiz' && s.prompt.ask === 'check' && s.prompt.target !== undefined);
    const letterChecks = checks.filter((s) => s.prompt.ask === 'check' && isLoneJamo(s.prompt.target!.ko));
    expect(letterChecks.length).toBeGreaterThan(0);
    for (const s of letterChecks) {
      const sound = slideSound(s);
      expect(isLoneJamo(sound!.spoken.text), sound!.spoken.text).toBe(false);
    }
  });
});
