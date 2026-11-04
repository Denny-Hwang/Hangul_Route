import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { attributeValue, openingTagEnd, rawPressableRatchet, rawPressables, type RawPressable } from '../raw-pressables';

/**
 * The KT-9 scan (docs/specs/AMENDMENTS-TOUCH.md section 6.9 and 11.1): no file under `screens/minigames/`,
 * `screens/quest/`, `screens/placement/` or `screens/vocab/` puts an answer `onPress` on a raw `Pressable` (or a
 * `GuardedPressable`, which also commits on the browser's click) outside a `TapBoard`. Every one there is either a control on CONTROLS (a speaker, a reveal, a setting, a way out:
 * none of them answers) or an answer on PENDING, named with the row that moves it onto a board. A new raw Pressable
 * fails until it is a `TapTarget` in a board or, if it answers nothing, a listed control; a listed line that is no
 * longer found fails too, so PENDING only shrinks as KT-4b and KT-5 land (KT-3 and KT-6 have).
 */
const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FOLDERS = ['screens/minigames', 'screens/quest', 'screens/placement', 'screens/vocab'] as const;

/** Pressables and GuardedPressables that answer nothing; named by their `testID` (or `onPress`) as written. */
const CONTROLS: Readonly<Record<string, readonly string[]>> = {
  'screens/minigames/BuildLetterGame.tsx': ['build-letter-speaker'],
  'screens/minigames/ListenPickGame.tsx': ['listen-pick-speaker'],
  'screens/minigames/MatchSoundGame.tsx': ['match-sound-speaker'],
  'screens/minigames/MyStoryGame.tsx': ['my-story-so-far-folded'],
  'screens/minigames/SyllableBuildBoard.tsx': ['`${testID}-speaker`', '`${testID}-meaning`'],
  'screens/minigames/TraceWordGame.tsx': ['`trace-word-chip-${state}`'],
  'screens/minigames/VoiceEchoGame.tsx': ['voice-echo-speaker'],
  'screens/minigames/WriteFrameGame.tsx': ['write-frame-tile-delete'],
  'screens/minigames/dictation-chunk.tsx': ['`${testID}-speaker`', '`${testID}-meaning`'],
  'screens/quest/quest-review-chunk.tsx': ['quest-review-speaker'],
  'screens/placement/HandoffScreen.tsx': ['placement-hoya-start'],
  'screens/placement/OptionsScreen.tsx': [
    '() => void say(`${copy.takeMyTime.label}. ${copy.takeMyTime.help}`)',
    '() => void say(`${copy.screenReader.label}. ${copy.screenReader.help}`)',
    '`placement-why-${motivation}`',
  ],
  'screens/placement/PlanParts.tsx': ['`${testIDPrefix}-${id}`'],
  // SpeakerButton, then the options screen's choice card.
  'screens/placement/parts.tsx': ['testID', 'testID #2'],
  'screens/vocab/ChallengeControls.tsx': ['`${testID}-${String(c.value)}`', 'testID'],
  'screens/vocab/TopicTile.tsx': ['testID'],
  'screens/vocab/VocabCardsScreen.tsx': ['vocab-cards-reading-practice', 'vocab-card-speaker', 'onKeep'],
  'screens/vocab/VocabQuestionView.tsx': ['`${testID}-speaker`'],
  'screens/vocab/VocabSpeedRoundScreen.tsx': ['onKeep'],
  'screens/vocab/WordWall.tsx': ['`vocab-wall-${tile.id}`'],
};

/** Answers still on a raw Pressable, each with the AMENDMENTS-TOUCH row (section 12) that puts it on a board. */
const PENDING: Readonly<Record<string, ReadonlyArray<readonly [name: string, row: 'KT-4b' | 'KT-5']>>> = {
  'screens/minigames/CardMatchGame.tsx': [
    ['`card-match-ko-${p.idx}`', 'KT-4b'],
    ['`card-match-en-${p.idx}`', 'KT-4b'],
  ],
  'screens/minigames/SentenceBuilderGame.tsx': [['`sentence-builder-tile-${tile.id}`', 'KT-5']],
  'screens/placement/ItemScreen.tsx': [['placement-not-sure', 'KT-5']],
};

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path);
    return /\.tsx$/.test(name) ? [path] : [];
  });
}

function allowedLists(): Map<string, string[]> {
  const allowed = new Map<string, string[]>();
  for (const [file, names] of Object.entries(CONTROLS)) allowed.set(file, [...names]);
  for (const [file, entries] of Object.entries(PENDING)) allowed.set(file, [...(allowed.get(file) ?? []), ...entries.map(([name]) => name)]);
  return allowed;
}

describe('no raw answer Pressable outside a TapBoard in the learner game folders (AMENDMENTS-TOUCH 6.9, KT-9)', () => {
  const found = new Map<string, RawPressable[]>();
  for (const path of FOLDERS.flatMap((folder) => sources(join(srcDir, folder)))) {
    const list = rawPressables(readFileSync(path, 'utf8'));
    if (list.length > 0) found.set(relative(srcDir, path).split(sep).join('/'), list);
  }

  it('finds Pressables to check in each folder', () => {
    for (const folder of FOLDERS) expect([...found.keys()].some((file) => file.startsWith(`${folder}/`)), folder).toBe(true);
  });

  it('every raw Pressable outside a board is a listed control or a pending answer, and every line is still found', () => {
    expect(rawPressableRatchet(found, allowedLists())).toEqual({ unlisted: [], stale: [] });
  });

  it('a name is never both a control and a pending answer', () => {
    for (const [file, entries] of Object.entries(PENDING)) {
      for (const [name] of entries) expect(CONTROLS[file] ?? [], `${file} | ${name}`).not.toContain(name);
    }
  });
});

describe('raw Pressable scan rules', () => {
  it('reads an opening tag to its own >, past arrows, braces and strings', () => {
    const src = '<Pressable onPress={() => go(">")} style={{ a: 1 }}>x</Pressable>';
    expect(src.slice(0, openingTagEnd(src, 0))).toBe('<Pressable onPress={() => go(">")} style={{ a: 1 }}>');
    expect(openingTagEnd('<Pressable a="{"', 0)).toBe('<Pressable a="{"'.length);
    expect(openingTagEnd('<Pressable a={`x\\`}`}>', 0)).toBe('<Pressable a={`x\\`}`}>'.length);
  });

  it('reads an attribute as written, in quotes or braces, whitespace folded', () => {
    expect(attributeValue('<P testID="a-b" />', 'testID')).toBe('a-b');
    expect(attributeValue("<P testID='a' />", 'testID')).toBe('a');
    expect(attributeValue('<P onPress={() => {\n  go(1);\n}} />', 'onPress')).toBe('() => { go(1); }');
    expect(attributeValue('<P myTestID="x" />', 'testID')).toBeNull();
    expect(attributeValue('<P testID=x />', 'testID')).toBeNull();
    expect(attributeValue('<P testID="x />', 'testID')).toBeNull();
    expect(attributeValue('<P onPress={() => go( />', 'onPress')).toBeNull();
  });

  it('names a Pressable by testID, else onPress, else its order; repeats are numbered', () => {
    const src = [
      '<Pressable testID="a" onPress={x} />',
      '<Pressable onPress={y} />',
      '<Pressable style={{}} />',
      '<Pressable testID="a" />',
      '<PressableThing onPress={z} />',
      '<GuardedPressable setsLock={false} testID="speaker" />',
    ].join('\n');
    expect(rawPressables(src).map((p) => p.name)).toEqual(['a', 'y', '#3', 'a #2', 'speaker']);
  });

  it('a Pressable inside an open TapBoard or TapControl is in a board; after it closes, or a self-closing one, it is not', () => {
    const src = [
      '<TapBoard scope="board">',
      '  <TapControl><Pressable testID="in-control" /></TapControl>',
      '  <Pressable testID="in-board" />',
      '</TapBoard>',
      '<TapBoard scope="board" />',
      '<Pressable testID="outside" />',
    ].join('\n');
    expect(rawPressables(src)).toEqual([
      { name: 'in-control', inBoard: true },
      { name: 'in-board', inBoard: true },
      { name: 'outside', inBoard: false },
    ]);
  });

  it('the ratchet reports unlisted raw Pressables and stale lines, and ignores ones in a board', () => {
    const found = new Map<string, RawPressable[]>([
      ['a.tsx', [{ name: 'speaker', inBoard: false }, { name: 'answer', inBoard: false }, { name: 'tile', inBoard: true }]],
    ]);
    const allowed = new Map<string, string[]>([
      ['a.tsx', ['speaker', 'tile']],
      ['gone.tsx', ['old']],
    ]);
    expect(rawPressableRatchet(found, allowed)).toEqual({ unlisted: ['a.tsx | answer'], stale: ['a.tsx | tile', 'gone.tsx | old'] });
  });
});
