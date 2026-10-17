import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-AUDIO-004 §3.9: one entry point. No screen imports the low-level `speak`
 * or the removed `playJamoSound` from `platform/audio`; a screen plays sound
 * with `playPrompt` / `playJamo` and shows the text fallback through the
 * prompt slot. Source scan, because the vitest lanes do not render screens.
 */
const SCREENS = join(__dirname, '..', '..', 'screens');

/**
 * The screens PR A-5b (spec §6, the other rows of §3.9) moved to the one entry
 * point: each plays through a prompt slot (`usePromptSlot`) and shows the
 * slot's status (why there is no sound, and the one action) in a
 * `PromptPanel`, because the Korean text itself is already printed next to the
 * speaker. Culture Quiz gained its Hear-it button in the same PR.
 */
const SLOT_SCREENS = [
  'minigames/BuildLetterGame.tsx',
  'minigames/CardMatchGame.tsx',
  'minigames/TapRespondGame.tsx',
  'minigames/VoiceEchoGame.tsx',
  'minigames/CultureQuizGame.tsx',
  'library/CardDetailView.tsx',
  // F-VOC-004 S-4b: the vocabulary question's prompt word (source vocab-speed / vocab-card).
  'vocab/VocabQuestionView.tsx',
  // The learner audio pass (2026-10-17): every printed word with a speaker says why it is silent.
  'episode/StoryEpisodeDetail.tsx',
  'story/CultureNotesScreen.tsx',
  'quest/DiscoverStep.tsx',
  'minigames/TraceWordGame.tsx',
  'minigames/TraceStrokeGame.tsx',
  'minigames/PicWordMatchGame.tsx',
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(full);
    return /\.tsx?$/.test(e.name) ? [full] : [];
  });
}

/** Names imported from a `platform/audio` module in one file. */
function audioImports(source: string): string[] {
  const names: string[] = [];
  for (const m of source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][^'"]*platform\/audio(?:\.web)?['"]/g)) {
    names.push(...m[1]!.split(',').map((n) => n.trim().split(/\s+as\s+/)[0]!.replace(/^type\s+/, '')).filter(Boolean));
  }
  return names;
}

const files = sourceFiles(SCREENS).map((f) => ({ rel: relative(SCREENS, f).split('\\').join('/'), source: readFileSync(f, 'utf8') }));

describe('no direct speak from screens', () => {
  it('scans the screens', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('no screen imports playJamoSound', () => {
    expect(files.filter((f) => audioImports(f.source).includes('playJamoSound')).map((f) => f.rel)).toEqual([]);
  });

  it('no screen imports speak', () => {
    expect(files.filter((f) => audioImports(f.source).includes('speak')).map((f) => f.rel)).toEqual([]);
  });

  it.each(SLOT_SCREENS)('%s plays through a prompt slot and shows its status panel', (rel) => {
    const file = files.find((f) => f.rel === rel);
    expect(file, rel).toBeDefined();
    const source = file!.source;
    expect(audioImports(source).some((n) => n === 'playPrompt' || n === 'playJamo')).toBe(true);
    expect(source).toMatch(/usePromptSlot\(\{\s*source:/);
    // Props in any order: an arrow-function prop before `variant` must not end the match at its `>`.
    expect(source).toMatch(/<PromptPanel\b[\s\S]*?variant="status"[\s\S]*?\/>/);
  });

  /**
   * Screens that speak without a tap on every open (a Tap & Respond turn) or
   * that can be closed mid-word (the card detail) stop the speech when they
   * unmount, as Listen & Pick and Story Order do, so Korean never keeps
   * playing over the next screen.
   */
  it.each([
    'minigames/TapRespondGame.tsx',
    'library/CardDetailView.tsx',
    'minigames/ListenPickGame.tsx',
    'vocab/VocabQuestionView.tsx',
    // Leaving a quest step, a game or the word cards stops a word or sentence mid-way (2026-10-17).
    'quest/QuestPlayerView.tsx',
    'minigames/MinigameScreen.tsx',
    'vocab/VocabCardsScreen.tsx',
    'minigames/TraceWordGame.tsx',
    'minigames/TraceStrokeGame.tsx',
  ])(
    '%s stops its speech on unmount',
    (rel) => {
      const file = files.find((f) => f.rel === rel);
      expect(file, rel).toBeDefined();
      expect(audioImports(file!.source)).toContain('stop');
      expect(file!.source).toMatch(/\bstop\(\)/);
    },
  );

  it('the trace games play their block speakers and Show me through the slot', () => {
    const word = files.find((f) => f.rel === 'minigames/TraceWordGame.tsx')!;
    expect(word.source).toMatch(/onPress=\{\(\) => say\(b\.syllable\)\}/);
    expect(word.source).toMatch(/void soundPlay\(\(\) => playPrompt\(blockSpeech\(syllable\)\)\)/);
    const stroke = files.find((f) => f.rel === 'minigames/TraceStrokeGame.tsx')!;
    expect(stroke.source).toMatch(/setHintPlaying\(true\);[\s\S]{0,200}void soundPlay\(\(\) => playJamo\(round\.jamo, 'sound'\)\)/);
  });

  it('the quest player stops the speech when its step changes, and Discover when it unmounts', () => {
    const player = files.find((f) => f.rel === 'quest/QuestPlayerView.tsx')!;
    expect(player.source).toMatch(/useEffect\(\(\) => \(\) => stop\(\), \[stepIndex\]\)/);
    const discover = files.find((f) => f.rel === 'quest/DiscoverStep.tsx')!;
    expect(audioImports(discover.source)).toContain('stop');
    expect(discover.source).toMatch(/\(\) => \(\) => \{[^}]*stopAudio\(\);/);
  });

  it('Listen & Pick plays through a prompt slot and shows the text panel (the prompt as text, why, the one action)', () => {
    const file = files.find((f) => f.rel === 'minigames/ListenPickGame.tsx')!;
    expect(file.source).toMatch(/usePromptSlot\(\{\s*source: LISTEN_PICK_AUDIO_SOURCE,\s*hasClip: hasClip\(/);
    expect(file.source).toMatch(/<PromptPanel\b[\s\S]*?testID="listen-pick-prompt"[\s\S]*?\/>/);
    expect(file.source).not.toMatch(/void playPrompt\(/);
  });

  /**
   * No play is fire-and-forget on these screens any more: a silent speaker always says why. (The trace
   * games keep one: a round's opening sound, whose late result must not move the canvas mid-stroke; their
   * speakers and Show me play through the slot, which the slot-screen test above checks.)
   */
  it.each(['minigames/PicWordMatchGame.tsx', 'quest/DiscoverStep.tsx'])(
    '%s has no bare void playPrompt / playJamo',
    (rel) => {
      const file = files.find((f) => f.rel === rel)!;
      expect(file.source).not.toMatch(/void play(Prompt|Jamo)\(/);
    },
  );

  /**
   * A-6 (§3.10): Match Sound and Discover warm their clips on mount, and Match
   * Sound tells its prompt slot when the round's sound has a bundled recording,
   * so a device with no Korean voice is not told "no sound" while a clip plays.
   */
  it.each(['minigames/MatchSoundGame.tsx', 'quest/DiscoverStep.tsx'])(
    '%s warms its clips on mount',
    (rel) => {
      const file = files.find((f) => f.rel === rel);
      expect(file, rel).toBeDefined();
      expect(audioImports(file!.source)).toContain('warmClips');
      expect(file!.source).toMatch(/warmClips\(clipRefsOf\(/);
    },
  );

  it('the vocabulary question view passes hasClip and its per-mode source to its prompt slot', () => {
    const file = files.find((f) => f.rel === 'vocab/VocabQuestionView.tsx');
    expect(audioImports(file!.source)).toContain('hasClip');
    expect(file!.source).toMatch(/usePromptSlot\(\{\s*source: QUESTION_AUDIO_SOURCE\[mode\],\s*hasClip: hasClip\(/);
  });

  it('Match Sound passes hasClip to its prompt slot', () => {
    const file = files.find((f) => f.rel === 'minigames/MatchSoundGame.tsx');
    expect(audioImports(file!.source)).toContain('hasClip');
    expect(file!.source).toMatch(/usePromptSlot\(\{\s*source: 'match-sound',\s*hasClip: hasClip\(/);
  });

  /**
   * Sentence Builder plays each round's sentence (`playPrompt` with its `audioRef`), so, as Match
   * Sound does, its prompt slot is told when the current round's sentence has a bundled recording:
   * a device with no Korean voice is then not told "no sound" while the clip plays.
   */
  it('Sentence Builder passes hasClip for the current round to its prompt slot', () => {
    const file = files.find((f) => f.rel === 'minigames/SentenceBuilderGame.tsx');
    expect(file).toBeDefined();
    expect(audioImports(file!.source)).toContain('hasClip');
    expect(file!.source).toMatch(
      /usePromptSlot\(\{\s*source: 'sentence-builder',\s*hasClip: hasClip\(rounds\[state\.roundIdx\]\?\.sentence\.audioRef\),\s*textOnScreen: true\s*\}\)/,
    );
    expect(audioImports(file!.source)).toContain('warmClips');
    expect(file!.source).toMatch(/warmClips\(clipRefsOf\(rounds\.map\(\(r\) => r\.sentence\)\)\)/);
  });
});
