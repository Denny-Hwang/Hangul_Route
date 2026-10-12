import type { Story } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import type { PlaySpec } from '../../audio/controller';
import { initReader, reduceReader } from '../reader-state';
import {
  KOREAN_BLOCK_ID,
  MIN_READER_SCENES,
  glossTarget,
  hasKoreanStep,
  planSceneChange,
  readFinishedPayload,
  readerAvailability,
  readerCheckpoints,
  readerKeyAction,
  sayItYourselfShown,
  stepsForVoice,
  termId,
  wordId,
} from '../reader-effects';
import { buildSceneView } from '../scene-view';
import { readyStory } from './story-fixture';

function tierOf(story: Story, level: 'listen' | 'read-along') {
  return story.tiers.find((t) => t.level === level)!;
}

describe('readerAvailability (§3.3 fallback, §3.11)', () => {
  it('opens a story whose tier has at least four scenes', () => {
    const story = readyStory();
    expect(readerAvailability(story, 'listen')).toEqual({ ok: true, sceneCount: 5 });
    expect(readerAvailability(story, 'read-along')).toEqual({ ok: true, sceneCount: 4 });
    expect(MIN_READER_SCENES).toBe(4);
  });

  it('says why it cannot: no story, no tier for the level, or fewer than four scenes', () => {
    const story = readyStory();
    expect(readerAvailability(undefined, 'listen')).toEqual({ ok: false, reason: 'no-story' });
    expect(readerAvailability(story, 'read')).toEqual({ ok: false, reason: 'no-tier' });
    tierOf(story, 'read-along').scenes.splice(3);
    expect(readerAvailability(story, 'read-along')).toEqual({ ok: false, reason: 'too-short' });
  });
});

describe('readerCheckpoints (§3.7: inline checkpoint cards, PR 2.9)', () => {
  it('maps each scene to its checkpoint id', () => {
    const tier = tierOf(readyStory(), 'listen');
    expect(tier.scenes[2]!.checkpointId).toBe('cp1');
    expect(readerCheckpoints(tier)).toEqual([null, null, 'cp1', null, null]);
  });

  it('a checkpoint id the tier does not define reads straight through', () => {
    const tier = tierOf(readyStory(), 'listen');
    tier.checkpoints = [];
    expect(readerCheckpoints(tier)).toEqual([null, null, null, null, null]);
  });
});

describe('planSceneChange (§3.4 Read to me, §3.6 bookmarks, §3.10 focus)', () => {
  const base = { mode: 'quest' as const, index: 2, via: 'next' as const, readToMe: true, unlocked: true };

  it('quest mode saves the bookmark from scene 2 on; scene 1 and replay never save', () => {
    expect(planSceneChange(base).saveBookmark).toBe(true);
    expect(planSceneChange({ ...base, index: 1 }).saveBookmark).toBe(true);
    expect(planSceneChange({ ...base, index: 0 }).saveBookmark).toBe(false);
    expect(planSceneChange({ ...base, mode: 'replay' }).saveBookmark).toBe(false);
  });

  it('Read to me plays once when a scene opens, never when returning with Back', () => {
    expect(planSceneChange(base).autoplay).toBe('now');
    expect(planSceneChange({ ...base, via: 'open' }).autoplay).toBe('now');
    expect(planSceneChange({ ...base, via: 'restart' }).autoplay).toBe('now');
    expect(planSceneChange({ ...base, via: 'goTo' }).autoplay).toBe('now');
    expect(planSceneChange({ ...base, via: 'back' }).autoplay).toBe('none');
    expect(planSceneChange({ ...base, readToMe: false }).autoplay).toBe('none');
  });

  it('before the first gesture the browser blocks audio, so autoplay waits for the unlock', () => {
    expect(planSceneChange({ ...base, via: 'open', unlocked: false }).autoplay).toBe('on-unlock');
    expect(planSceneChange({ ...base, via: 'back', unlocked: false }).autoplay).toBe('none');
  });

  it('moves focus to the narration on every change but the first open', () => {
    expect(planSceneChange(base).moveFocus).toBe(true);
    expect(planSceneChange({ ...base, via: 'back' }).moveFocus).toBe(true);
    expect(planSceneChange({ ...base, via: 'open' }).moveFocus).toBe(false);
  });
});

describe('stepsForVoice (§3.4: no Korean voice, English narration still plays)', () => {
  const steps: PlaySpec[] = [
    { text: 'Long ago, King', language: 'en-US', kind: 'narration', source: 'story-reader' },
    { text: '세종', language: 'ko-KR', kind: 'word', source: 'story-reader' },
    { text: 'wanted everyone to read.', language: 'en-US', kind: 'narration', source: 'story-reader' },
    { text: '세종', kind: 'word', source: 'story-reader' },
  ];

  it('keeps every step when a Korean voice (or a clip) can play', () => {
    expect(stepsForVoice(steps, true)).toEqual(steps);
  });

  it('drops the Korean steps (language ko-KR, the PlaySpec default) when it cannot', () => {
    expect(stepsForVoice(steps, false).map((s) => s.text)).toEqual(['Long ago, King', 'wanted everyone to read.']);
  });
});

describe('hasKoreanStep (only a chain that asks for Korean reports to the Korean prompt slot)', () => {
  it('is true when any step is Korean (ko-KR or the PlaySpec default)', () => {
    expect(hasKoreanStep([{ text: 'a', language: 'en-US', kind: 'narration', source: 's' }, { text: '세종', kind: 'word', source: 's' }])).toBe(true);
    expect(hasKoreanStep([{ text: '세종', language: 'ko-KR', kind: 'word', source: 's' }])).toBe(true);
  });

  it('is false for an English-only chain or nothing', () => {
    expect(hasKoreanStep([{ text: 'a', language: 'en-US', kind: 'narration', source: 's' }])).toBe(false);
    expect(hasKoreanStep([])).toBe(false);
  });
});

describe('sayItYourselfShown (§3.4, §3.14 row 7: the chip follows the device, not the last play)', () => {
  it('shows on a scene with Korean when the device has no Korean voice, whatever the last play said', () => {
    expect(sayItYourselfShown({ canPlayKorean: false, reason: null, hasKorean: true })).toBe(true);
    expect(sayItYourselfShown({ canPlayKorean: false, reason: 'no_voice', hasKorean: true })).toBe(true);
  });

  it('shows when a play just learned there is no Korean voice, before the check settles', () => {
    expect(sayItYourselfShown({ canPlayKorean: true, reason: 'no_voice', hasKorean: true })).toBe(true);
  });

  it('hides with a Korean voice, for sound off or a play error, and on a scene with no Korean', () => {
    expect(sayItYourselfShown({ canPlayKorean: true, reason: null, hasKorean: true })).toBe(false);
    expect(sayItYourselfShown({ canPlayKorean: true, reason: 'muted', hasKorean: true })).toBe(false);
    expect(sayItYourselfShown({ canPlayKorean: true, reason: 'error', hasKorean: true })).toBe(false);
    expect(sayItYourselfShown({ canPlayKorean: false, reason: 'no_voice', hasKorean: false })).toBe(false);
  });
});

describe('readFinishedPayload (§3.12: ids and counts only)', () => {
  it('reports the scenes reached and the learner-started plays and glosses', () => {
    expect(
      readFinishedPayload({
        storyId: 'story:hangul-day',
        level: 'listen',
        mode: 'replay',
        sceneCount: 5,
        furthest: 4,
        linesPlayed: 3,
        termsOpened: 2,
      }),
    ).toEqual({
      storyId: 'story:hangul-day',
      level: 'listen',
      mode: 'replay',
      scenes: 5,
      scenesSeen: 5,
      linesPlayed: 3,
      termsOpened: 2,
    });
  });

  it('counts only the scenes shown when the reader opened past scene 1 (lowest index reached)', () => {
    const base = { storyId: 's', level: 'listen' as const, mode: 'replay' as const, sceneCount: 5, linesPlayed: 0, termsOpened: 0 };
    // Opened on scene 4 and read to the end: scenes 4 and 5.
    expect(readFinishedPayload({ ...base, furthest: 4, lowest: 3 }).scenesSeen).toBe(2);
    // Went back to scene 2 before finishing: scenes 2-5.
    expect(readFinishedPayload({ ...base, furthest: 4, lowest: 1 }).scenesSeen).toBe(4);
    // Without a lowest index the reader opened on scene 1.
    expect(readFinishedPayload({ ...base, furthest: 4 }).scenesSeen).toBe(5);
    // A lowest index past furthest (never happens) still reports one scene, never zero or less.
    expect(readFinishedPayload({ ...base, furthest: 1, lowest: 3 }).scenesSeen).toBe(1);
  });

  it('never reports more scenes seen than the tier has, nor negative counts', () => {
    const p = readFinishedPayload({
      storyId: 's',
      level: 'read',
      mode: 'quest',
      sceneCount: 4,
      furthest: 9,
      linesPlayed: -1,
      termsOpened: Number.NaN,
    });
    expect(p.scenesSeen).toBe(4);
    expect(p.linesPlayed).toBe(0);
    expect(p.termsOpened).toBe(0);
  });
});

describe('glossTarget (§3.5: one gloss card at a time)', () => {
  const story = readyStory();

  it('resolves an inline term chip to its keyword', () => {
    const view = buildSceneView(story, 'listen', 0)!;
    expect(glossTarget(view, termId('sejong'))).toEqual({
      id: 'kw:sejong',
      text: { ko: '세종', romanization: 'sejong', en: 'King Sejong' },
    });
  });

  it('keeps what the speaker needs: spokenKo and audioRef', () => {
    const withAudio = readyStory();
    const kw = withAudio.keywords.find((k) => k.id === 'sejong')!;
    kw.spokenKo = '세종대왕';
    kw.audioRef = 'audio/story/hangul-day/sejong.mp3';
    const view = buildSceneView(withAudio, 'listen', 0)!;
    expect(glossTarget(view, termId('sejong'))?.text).toEqual({
      ko: '세종',
      romanization: 'sejong',
      en: 'King Sejong',
      spokenKo: '세종대왕',
      audioRef: 'audio/story/hangul-day/sejong.mp3',
    });
  });

  it('resolves an authored word of the Korean line', () => {
    const view = buildSceneView(story, 'listen', 4)!;
    expect(glossTarget(view, wordId(1))).toEqual({
      id: 'word:1',
      text: { ko: '축하해요', romanization: 'chukahaeyo', en: 'congratulations' },
    });
  });

  it('is null for no open term, an unknown id, a word the line does not have, or the Korean block', () => {
    const view = buildSceneView(story, 'listen', 4)!;
    expect(glossTarget(view, null)).toBeNull();
    expect(glossTarget(view, termId('nope'))).toBeNull();
    expect(glossTarget(view, wordId(7))).toBeNull();
    expect(glossTarget(view, 'word:x')).toBeNull();
    expect(glossTarget(view, KOREAN_BLOCK_ID)).toBeNull();
    const noLine = buildSceneView(story, 'listen', 0)!;
    expect(glossTarget(noLine, wordId(0))).toBeNull();
  });
});

describe('readerKeyAction (§3.10 keyboard on the web)', () => {
  const scene = initReader(5, 0, []);

  it('Right and Left arrows turn the page, never past either end', () => {
    expect(readerKeyAction('ArrowRight', scene)).toEqual({ type: 'next' });
    expect(readerKeyAction('ArrowLeft', scene)).toBeNull();
    const second = reduceReader(scene, { type: 'next' }).state;
    expect(readerKeyAction('ArrowLeft', second)).toEqual({ type: 'back' });
    const end = { ...second, phase: 'end' as const };
    expect(readerKeyAction('ArrowRight', end)).toBeNull();
    expect(readerKeyAction('ArrowLeft', end)).toEqual({ type: 'back' });
  });

  it('Escape closes the open gloss card, and does nothing otherwise', () => {
    expect(readerKeyAction('Escape', scene)).toBeNull();
    const open = reduceReader(scene, { type: 'tapTerm', id: 'kw:sejong' }).state;
    expect(readerKeyAction('Escape', open)).toEqual({ type: 'closeTerm' });
  });

  it('ignores other keys and a checkpoint card (it owns its keys)', () => {
    expect(readerKeyAction('Enter', scene)).toBeNull();
    const cp = { ...scene, phase: 'checkpoint' as const, checkpointId: 'cp1' };
    expect(readerKeyAction('ArrowRight', cp)).toBeNull();
    expect(readerKeyAction('ArrowLeft', cp)).toEqual({ type: 'back' });
  });
});
