import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseStory, type Story } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { buildSceneView, isTraditionalTale, sceneCaption } from '../scene-view';
import { readyStory } from './story-fixture';

const HANGUL = /[ㄱ-㆏가-힣]/;
const ROOT = join(__dirname, '../../../../../..');

function listen(story: Story) {
  return story.tiers.find((t) => t.level === 'listen')!;
}

describe('buildSceneView: position, art and labels', () => {
  const story = readyStory();

  it('describes scene 1 of the listen tier', () => {
    const v = buildSceneView(story, 'listen', 0)!;
    expect(v.sceneId).toBe('s1');
    expect(v.level).toBe('listen');
    expect(v.position).toBe(1);
    expect(v.total).toBe(5);
    expect(v.isFirst).toBe(true);
    expect(v.isLast).toBe(false);
    expect(v.art?.setting).toBe('scene:palace-hall');
    expect(v.altEn).toBe('King Sejong sits in a palace hall while Hoya waves.');
    expect(v.captionEn).toBe("A king's wish");
    expect(v.labels).toEqual({
      position: '1 / 5',
      scene: 'Scene 1 of 5',
      announcement: 'Scene 1 of 5. King Sejong sits in a palace hall while Hoya waves.',
      next: 'Next',
    });
  });

  it('the last scene says Finish and is last', () => {
    const v = buildSceneView(story, 'listen', 4)!;
    expect(v.isLast).toBe(true);
    expect(v.labels.next).toBe('Finish');
    expect(v.labels.position).toBe('5 / 5');
  });

  it('a scene with no art (or art pending) has no art object and still has a description', () => {
    const copy = readyStory();
    const scene = listen(copy).scenes[2]!; // s3 has no art in the fixture
    expect(scene.art).toBeUndefined();
    const v = buildSceneView(copy, 'listen', 2)!;
    expect(v.art).toBeNull();
    expect(v.altEn).toBe(scene.captionEn);
    expect(v.labels.announcement).toBe(`Scene 3 of 5. ${scene.captionEn}`);

    const pending = readyStory();
    const withArt = listen(pending).scenes[0]!;
    withArt.artPending = true;
    const p = buildSceneView(pending, 'listen', 0)!;
    expect(p.art).toBeNull();
    expect(p.altEn).toBe(withArt.art!.altEn);
  });

  it('falls back to an empty description when there is neither art nor caption', () => {
    const copy = readyStory();
    const scene = listen(copy).scenes[2]!;
    delete scene.captionEn;
    const v = buildSceneView(copy, 'listen', 2)!;
    expect(v.altEn).toBe('');
    expect(v.labels.announcement).toBe('Scene 3 of 5');
  });

  it('returns null for a missing tier or an index outside the tier, and never throws', () => {
    expect(buildSceneView(story, 'read', 0)).toBeNull();
    expect(buildSceneView(story, 'listen', 99)).toBeNull();
    expect(buildSceneView(story, 'listen', -1)).toBeNull();
    expect(buildSceneView(story, 'listen', 1.5)).toBeNull();
  });
});

describe('buildSceneView: narration tokens', () => {
  it('splits the narration around {kw} tokens and hands over the keyword', () => {
    const story = readyStory();
    const v = buildSceneView(story, 'listen', 0)!;
    expect(v.narrationParts).toEqual([
      { text: 'Long ago, King ' },
      { kw: story.keywords.find((k) => k.id === 'sejong') },
      { text: ' wanted everyone to learn to read.' },
    ]);
  });

  it('keeps adjacent tokens and a token at either end', () => {
    const story = readyStory();
    listen(story).scenes[0]!.narrationEn = '{kw:sejong}{kw:hangeul} is {kw:hangeul}';
    const parts = buildSceneView(story, 'listen', 0)!.narrationParts;
    expect(parts.map((p) => ('kw' in p ? `kw:${p.kw.id}` : p.text))).toEqual(['kw:sejong', 'kw:hangeul', ' is ', 'kw:hangeul']);
  });

  it('a token whose keyword is missing from the bundle never throws and never shows {kw:...} (§3.14 #10)', () => {
    const story = readyStory();
    listen(story).scenes[0]!.narrationEn = 'The {kw:ghost} came {kw:sejong} home.';
    const v = buildSceneView(story, 'listen', 0)!;
    const rendered = v.narrationParts.map((p) => ('kw' in p ? `[${p.kw.id}]` : p.text)).join('');
    expect(rendered).toBe('The ghost came [sejong] home.');
    expect(rendered).not.toContain('{');
    for (const p of v.narrationParts) if ('text' in p) expect(p.text).not.toMatch(HANGUL);
  });

  it('a missing keyword that the scene itself carries still renders as a chip (the bare Korean, via KoreanText)', () => {
    const story = readyStory();
    const scene = listen(story).scenes[0]!;
    story.keywords = story.keywords.filter((k) => k.id !== 'sejong');
    const v = buildSceneView(story, 'listen', 0)!;
    expect(v.narrationParts.some((p) => 'kw' in p && p.kw.id === 'sejong' && p.kw.ko === scene.keyword!.ko)).toBe(true);
  });

  it('a malformed brace never throws and never leaks a raw token', () => {
    const story = readyStory();
    listen(story).scenes[0]!.narrationEn = 'Hello {kw:sejong and {oops} world';
    const v = buildSceneView(story, 'listen', 0)!;
    expect(v.narrationParts).toEqual([{ text: 'Hello world' }]);
  });

  it('a narration that is nothing but a broken token shows nothing rather than the raw text', () => {
    const story = readyStory();
    listen(story).scenes[1]!.narrationEn = '{broken}} ';
    expect(buildSceneView(story, 'listen', 1)!.narrationParts).toEqual([]);
  });
});

describe('buildSceneView: the Korean block', () => {
  it('a keyword scene shows one word', () => {
    const story = readyStory();
    const v = buildSceneView(story, 'listen', 0)!;
    expect(v.korean).toEqual({
      kind: 'word',
      text: { ko: '세종', romanization: 'Sejong', en: 'King Sejong the Great' },
    });
  });

  it('a line scene shows a line, with its words only when authored', () => {
    const story = readyStory();
    const line = listen(story).scenes[4]!.line!;
    delete line.words;
    const v = buildSceneView(story, 'listen', 4)!;
    expect(v.korean?.kind).toBe('line');
    expect(v.korean?.words).toBeUndefined();
    expect(v.korean?.text).toEqual({ ko: line.ko, romanization: line.romanization, en: line.en });

    line.words = [
      { ko: '한글날', romanization: 'hangeullal', en: 'Hangeul Day' },
      { ko: '축하해요', romanization: 'chukahaeyo', en: 'congratulations' },
    ];
    expect(buildSceneView(story, 'listen', 4)!.korean?.words).toEqual(line.words);
  });

  it('carries spokenKo, audioRef and syllables through, and nothing else from the scene object', () => {
    const story = readyStory();
    const kw = listen(story).scenes[0]!.keyword!;
    kw.spokenKo = '세종대왕';
    kw.audioRef = 'audio/story/hangul-day/sejong.mp3';
    kw.syllables = ['Se', 'jong'];
    const text = buildSceneView(story, 'listen', 0)!.korean!.text;
    expect(text).toEqual({
      ko: '세종',
      romanization: 'Sejong',
      en: 'King Sejong the Great',
      spokenKo: '세종대왕',
      audioRef: 'audio/story/hangul-day/sejong.mp3',
      syllables: ['Se', 'jong'],
    });
    expect(Object.keys(text)).not.toContain('kind');
    expect(Object.keys(text)).not.toContain('id');
  });

  it('is null for a scene with neither keyword nor line, and block order drops "korean"', () => {
    const story = readyStory();
    const scene = listen(story).scenes[0]!;
    delete scene.keyword;
    const v = buildSceneView(story, 'listen', 0)!;
    expect(v.korean).toBeNull();
    expect(v.blocks).toEqual(['art', 'narration']);
  });
});

describe('buildSceneView: levels change order and emphasis only', () => {
  const story = readyStory();

  it('listen: art, narration, Korean', () => {
    expect(buildSceneView(story, 'listen', 0)!.blocks).toEqual(['art', 'narration', 'korean']);
  });

  it('read-along: art, Korean line, then the English narration', () => {
    const v = buildSceneView(story, 'read-along', 0)!;
    expect(v.level).toBe('read-along');
    expect(v.total).toBe(4);
    expect(v.blocks).toEqual(['art', 'korean', 'narration']);
    expect(v.korean?.kind).toBe('line');
  });

  it('read: art, Korean line, one-line caption', () => {
    const copy = readyStory();
    copy.tiers.push({ ...copy.tiers[1]!, level: 'read' });
    const v = buildSceneView(copy, 'read', 0)!;
    expect(v.blocks).toEqual(['art', 'korean', 'caption']);
    expect(v.captionEn).toBe(copy.tiers[1]!.scenes[0]!.captionEn);
    expect(v.narrationParts.length).toBeGreaterThan(0); // Read to me still narrates it
  });
});

describe('buildSceneView: culture note, checkpoint, audio and tale flags', () => {
  const story = readyStory();

  it('attaches the culture note of the scene, or null', () => {
    expect(buildSceneView(story, 'listen', 0)!.cultureNote?.id).toBe('cn-hangul-day');
    expect(buildSceneView(story, 'listen', 1)!.cultureNote).toBeNull();
    const copy = readyStory();
    listen(copy).scenes[1]!.cultureNoteId = 'cn-missing';
    expect(buildSceneView(copy, 'listen', 1)!.cultureNote).toBeNull();
  });

  it('attaches the checkpoint of the scene, or null (also when the id is not in the tier)', () => {
    expect(buildSceneView(story, 'listen', 2)!.checkpoint?.id).toBe('cp1');
    expect(buildSceneView(story, 'listen', 0)!.checkpoint).toBeNull();
    const copy = readyStory();
    listen(copy).scenes[0]!.checkpointId = 'cp-missing';
    expect(buildSceneView(copy, 'listen', 0)!.checkpoint).toBeNull();
  });

  it('narration language defaults to en-US and follows the displayed text (ctx)', () => {
    expect(buildSceneView(story, 'listen', 0)!.narrationLang).toBe('en-US');
    expect(buildSceneView(story, 'listen', 0, { narrationLang: 'es-US' })!.narrationLang).toBe('es-US');
  });

  it('carries the narration clip of the scene, or null', () => {
    expect(buildSceneView(story, 'listen', 0)!.narrationAudioRef).toBe('audio/stories/hangul-day/s1.mp3');
    expect(buildSceneView(story, 'listen', 1)!.narrationAudioRef).toBeNull();
  });

  it('flags traditional and adapted tales for the "Traditional tale" pill', () => {
    expect(isTraditionalTale(story)).toBe(false);
    expect(buildSceneView(story, 'listen', 0)!.traditional).toBe(false);
    for (const type of ['traditional', 'adapted'] as const) {
      const tale = readyStory();
      tale.origin.type = type;
      expect(isTraditionalTale(tale)).toBe(true);
      expect(buildSceneView(tale, 'listen', 0)!.traditional).toBe(true);
    }
    const original = readyStory();
    original.origin.type = 'original';
    expect(isTraditionalTale(original)).toBe(false);
  });
});

describe('sceneCaption', () => {
  it('is the authored caption', () => {
    const story = readyStory();
    expect(sceneCaption(story, listen(story).scenes[0]!)).toBe("A king's wish");
  });

  it('else the first six words of the narration, tokens read as their romanization', () => {
    const story = readyStory();
    const scene = listen(story).scenes[0]!;
    delete scene.captionEn;
    expect(sceneCaption(story, scene)).toBe('Long ago, King sejong wanted everyone');
    scene.narrationEn = 'One two three four five six seven eight.';
    expect(sceneCaption(story, scene)).toBe('One two three four five six');
    scene.narrationEn = '';
    expect(sceneCaption(story, scene)).toBe('');
  });

  it('copes with an unknown token', () => {
    const story = readyStory();
    const scene = listen(story).scenes[0]!;
    delete scene.captionEn;
    scene.narrationEn = 'See {kw:ghost} now';
    expect(sceneCaption(story, scene)).toBe('See ghost now');
  });
});

describe('every story in the repo: no Hangul outside a keyword token (§3.5)', () => {
  const files = readdirSync(join(ROOT, 'content/stories')).filter((f) => f.endsWith('.json'));
  const stories: Story[] = files.map((f) => parseStory(JSON.parse(readFileSync(join(ROOT, 'content/stories', f), 'utf8')) as unknown));
  stories.push(readyStory());

  it('has stories to check', () => {
    expect(stories.length).toBeGreaterThanOrEqual(25);
  });

  it('every scene of every tier builds, never throws, and its {text} parts are Hangul-free', () => {
    let scenes = 0;
    for (const story of stories) {
      for (const tier of story.tiers) {
        tier.scenes.forEach((_, i) => {
          const v = buildSceneView(story, tier.level, i);
          expect(v, `${story.id} ${tier.level} ${i}`).not.toBeNull();
          scenes += 1;
          for (const p of v!.narrationParts) {
            if ('text' in p) expect(p.text, `${story.id} ${v!.sceneId}`).not.toMatch(HANGUL);
          }
          expect(v!.captionEn, `${story.id} ${v!.sceneId}`).not.toMatch(HANGUL);
          expect(v!.labels.announcement).not.toMatch(HANGUL);
        });
      }
    }
    expect(scenes).toBeGreaterThanOrEqual(182);
  });
});
