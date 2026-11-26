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
  // The menu, ticket and sign lines and options, and the Story Order replay line (review of #740).
  'minigames/RealiaReadGame.tsx',
  'minigames/StorySequenceGame.tsx',
  // F-CURR-002 row CM-35: Role Play says each partner line without a tap, and each reply as it is sent.
  'minigames/role-play/RolePlayGame.tsx',
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
    'minigames/role-play/RolePlayGame.tsx',
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
    // [QS] AMENDMENTS-QUEST-SOUND-BACK QS-3: the slot's play is handed to the screen's sound pacing (a tap drops the opening sound).
    // [FU] FU-3: and the play tells the slot what it says, so the syllable's say clip counts as sound.
    expect(word.source).toMatch(/const spec = blockSpeech\(syllable\);\s*void pacing\.track\(soundPlay\(\(\) => playPrompt\(spec\), spec\)\)/);
    const stroke = files.find((f) => f.rel === 'minigames/TraceStrokeGame.tsx')!;
    // A letter says its name and a final its closed syllable (AMENDMENTS-AUDIO-CLIPS M11).
    expect(stroke.source).toMatch(/setHintPlaying\(true\);[\s\S]{0,300}void pacing\.track\(soundPlay\(\(\) => playJamo\(round\.jamo, loneLetterQuestion\(round\.jamo\)\), loneLetterVoice\(round\.jamo\)\)\)/);
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
    // The spelling round (F-CURR-002 row CM-31) reports under its own source; every other round under Listen & Pick's.
    // The slot asks with the round's own spec, so a say clip of its text counts (AMENDMENTS-AUDIO-CLIPS AC-B7).
    expect(file.source).toMatch(
      /usePromptSlot\(\{\s*source: (?:spellingNow \? spelling\.SPELLING_AUDIO_SOURCE : )?LISTEN_PICK_AUDIO_SOURCE,\s*(?:\/\/[^\n]*\n\s*)?hasClip: current !== undefined && hasClipFor\(listenPickSpeech\(current\)\)/,
    );
    expect(file.source).toMatch(/<PromptPanel\b[\s\S]*?testID="listen-pick-prompt"[\s\S]*?\/>/);
    expect(file.source).not.toMatch(/void playPrompt\(/);
  });

  /**
   * No play is fire-and-forget on these screens any more: a silent speaker always says why. (The trace
   * games keep one: a round's opening sound, whose late result must not move the canvas mid-stroke; their
   * speakers and Show me play through the slot, which the slot-screen test above checks.)
   */
  it.each(['minigames/PicWordMatchGame.tsx', 'quest/DiscoverStep.tsx', 'minigames/RealiaReadGame.tsx', 'minigames/StorySequenceGame.tsx'])(
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

  it('the vocabulary question view passes hasClip (its word\'s text and clip) and its per-mode source to its prompt slot', () => {
    const file = files.find((f) => f.rel === 'vocab/VocabQuestionView.tsx');
    expect(audioImports(file!.source)).toContain('hasClipFor');
    expect(file!.source).toMatch(/usePromptSlot\(\{\s*source: QUESTION_AUDIO_SOURCE\[mode\],\s*hasClip: question\.prompt\.ko !== undefined && hasClipFor\(\{ text: question\.prompt\.spokenKo \?\? question\.prompt\.ko, audioRef: question\.prompt\.audioRef \}\)/);
  });

  it('Discover and the vocabulary cards ask hasClipFor with what plays, so a say clip of the text counts (AMENDMENTS-AUDIO-CLIPS AC-B7)', () => {
    const discover = files.find((f) => f.rel === 'quest/DiscoverStep.tsx')!;
    expect(audioImports(discover.source)).toContain('hasClipFor');
    // [SF-3] Every spec of every button (Hear it with vowels says three), each with its text.
    expect(discover.source).toMatch(/\.flatMap\(actionSpecs\);\s*const clip = specs\.length > 0 && specs\.every\(\(spec\) => hasClipFor\(spec\)\)/);
    const cards = files.find((f) => f.rel === 'vocab/VocabCardsScreen.tsx')!;
    expect(cards.source).toMatch(/hasClip: hasClipFor\(\{ text: item\.spokenKo \?\? item\.ko, audioRef: item\.audioRef \}\)/);
  });

  it('Match Sound passes hasClip (the letter voice it plays) to its prompt slot', () => {
    const file = files.find((f) => f.rel === 'minigames/MatchSoundGame.tsx');
    expect(audioImports(file!.source)).toContain('hasClipFor');
    expect(file!.source).toMatch(/usePromptSlot\(\{\s*source: 'match-sound',\s*hasClip: voice !== undefined && hasClipFor\(voice\)/);
  });

  /**
   * Sentence Builder plays each round's sentence (`playPrompt` with its `audioRef`), so, as Match
   * Sound does, its prompt slot is told when the current round's sentence has a bundled recording:
   * a device with no Korean voice is then not told "no sound" while the clip plays.
   */
  it('Sentence Builder passes hasClip for the current round to its prompt slot', () => {
    const file = files.find((f) => f.rel === 'minigames/SentenceBuilderGame.tsx');
    expect(file).toBeDefined();
    expect(audioImports(file!.source)).toContain('hasClipFor');
    expect(file!.source).toMatch(
      /usePromptSlot\(\{\s*source: 'sentence-builder',\s*hasClip: slotRound !== undefined && hasClipFor\(sentenceSpeech\(slotRound\.sentence\)\),\s*textOnScreen: true\s*\}\)/,
    );
    expect(audioImports(file!.source)).toContain('warmClips');
    expect(file!.source).toMatch(/warmClips\(clipRefsOf\(rounds\.map\(\(r\) => sentenceSpeech\(r\.sentence\)\)\)\)/);
    // What the slot asks about is what plays.
    expect(file!.source).toMatch(/playPrompt\(sentenceSpeech\(sentence\)\)/);
  });
});

/**
 * [FU] AMENDMENTS-FOLLOWUPS-2026-11 FU-3: every Korean sound plays the recording when one exists (F-AUDIO-004 AD4, clip
 * then voice then text). `playPrompt` / `playJamo` already try the record's clip and then the say clip of the spoken
 * text (AMENDMENTS-AUDIO-CLIPS AC-B7), so a screen keeps that order by (1) never speaking past them and (2) telling its
 * prompt slot when what plays has a recording, else the slot shows "No Korean voice on this device.", skips its
 * replays and, on a screen that decides from it (dictation, Syllable Build), switches the sound off (AU-13).
 */
describe('[FU] FU-3: every Korean sound asks for the recording first', () => {
  const APP_ROOT = join(__dirname, '..', '..', '..');
  /** Every source file of the learner app, the presenter and the browse app, outside the audio platform itself. */
  const appFiles = [
    ...sourceFiles(join(APP_ROOT, 'src')).filter((f) => !/[\\/]src[\\/](platform|test-support)[\\/]/.test(f)),
    ...['App.tsx', 'PresenterApp.tsx', 'BrowseApp.tsx'].map((f) => join(APP_ROOT, f)),
  ].map((f) => ({ rel: relative(APP_ROOT, f).split('\\').join('/'), source: readFileSync(f, 'utf8') }));

  it('nothing outside platform/audio speaks through the device voice directly', () => {
    const direct = /\bspeechSynthesis\s*\.\s*speak\b|new\s+SpeechSynthesisUtterance\b|from\s+['"]expo-speech['"]|\bSpeech\.speak\(|new\s+Audio\(/;
    expect(appFiles.length).toBeGreaterThan(100);
    expect(appFiles.filter((f) => direct.test(f.source)).map((f) => f.rel)).toEqual([]);
  });

  it('a screen asks hasClipFor with what plays, never hasClip of a bare record ref (which misses the say clip of the text)', () => {
    expect(files.filter((f) => audioImports(f.source).includes('hasClip')).map((f) => f.rel)).toEqual([]);
  });

  /** The names a file calls its prompt slots' play by: `slot.play`, or a destructured `play` / `play: slotPlay`. */
  function playNames(source: string): string[] {
    const names: string[] = [];
    for (const m of source.matchAll(/const\s+(\w+)\s*=\s*usePromptSlot\(/g)) names.push(`${m[1]!}.play`);
    for (const m of source.matchAll(/const\s*\{([^}]*)\}\s*=\s*(?:\w+|usePromptSlot\([^)]*\))\s*;/g)) {
      for (const part of m[1]!.split(',')) {
        const [key, alias] = part.split(':').map((t) => t.trim());
        if (key === 'play') names.push(alias ?? 'play');
      }
    }
    return [...new Set(names)];
  }

  /** The calls of `name(...)` in a source, each with whether it passes a second argument (top-level comma). */
  function callsOf(source: string, name: string): Array<{ at: number; says: boolean }> {
    const calls: Array<{ at: number; says: boolean }> = [];
    const re = new RegExp(`(?<![\\w.])${name.replace('.', '\\.')}\\(`, 'g');
    for (const m of source.matchAll(re)) {
      let depth = 0;
      let says = false;
      for (let i = m.index + m[0].length - 1; i < source.length; i += 1) {
        const c = source[i]!;
        if (c === '(' || c === '[' || c === '{') depth += 1;
        else if (c === ')' || c === ']' || c === '}') {
          depth -= 1;
          if (depth === 0) break;
        } else if (c === ',' && depth === 1) says = true;
      }
      calls.push({ at: source.slice(0, m.index).split('\n').length, says });
    }
    return calls;
  }

  /**
   * Each prompt slot learns whether what plays has a recording: from `hasClip` (its one word, `hasClipFor(<spec>)`), or
   * from each play, which passes what it says (`slot.play(run, spec)`). Allow-list: none.
   */
  it('every prompt slot is told whether what plays has a recording', () => {
    const gaps: string[] = [];
    for (const f of [...files.map((x) => ({ rel: `src/screens/${x.rel}`, source: x.source })), ...appFiles.filter((x) => !x.rel.startsWith('src/screens/'))]) {
      const slots = [...f.source.matchAll(/usePromptSlot\(\{([^}]*)\}\)/g)];
      if (slots.length === 0 || slots.every((m) => /\bhasClip:/.test(m[1]!))) continue;
      const names = playNames(f.source);
      if (names.length === 0) gaps.push(`${f.rel}: a prompt slot without hasClip whose play is not found`);
      for (const name of names) for (const call of callsOf(f.source, name)) if (!call.says) gaps.push(`${f.rel}:${call.at} ${name}(...) does not say what plays`);
    }
    expect(gaps).toEqual([]);
  });
});
