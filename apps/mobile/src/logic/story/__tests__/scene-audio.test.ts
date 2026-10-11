import type { KoText } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { narrationSpeechLang, planSceneAudio, STORY_READER_AUDIO_SOURCE, type SceneAudioInput } from '../scene-audio';
import { buildSceneView } from '../scene-view';
import { readyStory } from './story-fixture';

const BOTH = { include: ['narration', 'korean'] } as const;

function kw(id: string, extra: Partial<KoText> = {}) {
  return { id, ko: '한글', romanization: 'hangeul', en: 'the Korean alphabet', kind: 'word' as const, ...extra };
}

function input(over: Partial<SceneAudioInput> = {}): SceneAudioInput {
  return { narrationParts: [], narrationLang: 'en-US', narrationAudioRef: null, korean: null, ...over };
}

describe('planSceneAudio: narration split at {kw} tokens (F-STORY-002 §3.2)', () => {
  it('English chunks are en-US narration steps, each term a Korean word step, then the Korean block', () => {
    const view = buildSceneView(readyStory(), 'listen', 1)!;
    expect(planSceneAudio(view, BOTH)).toEqual([
      { text: 'About 600 years ago, he and his helpers shared a new alphabet, ', language: 'en-US', kind: 'narration', source: 'story-reader' },
      { text: '한글', language: 'ko-KR', kind: 'word', source: 'story-reader' },
      { text: '한글', language: 'ko-KR', kind: 'word', source: 'story-reader' },
    ]);
  });

  it('a line scene ends with a sentence step; read-along tokens at the start and middle split cleanly', () => {
    const view = buildSceneView(readyStory(), 'read-along', 0)!;
    expect(planSceneAudio(view, BOTH).map((s) => [s.text, s.language, s.kind])).toEqual([
      ['세종', 'ko-KR', 'word'],
      [' made ', 'en-US', 'narration'],
      ['한글', 'ko-KR', 'word'],
      [' for everyone.', 'en-US', 'narration'],
      ['세종은 한글을 만들었어요', 'ko-KR', 'sentence'],
    ]);
  });

  it('skips English chunks with nothing to say (punctuation or spaces between tokens)', () => {
    const plan = planSceneAudio(
      input({ narrationParts: [{ text: 'Hoya cheers: ' }, { kw: kw('a') }, { text: '! ' }, { kw: kw('b') }, { text: ' ' }] }),
      BOTH,
    );
    expect(plan.map((s) => s.text)).toEqual(['Hoya cheers: ', '한글', '한글']);
  });

  it('a jamo term speaks its authored carrier (spokenKo), never the bare letter, as a word step', () => {
    const view = buildSceneView(readyStory(), 'listen', 2)!;
    const plain = planSceneAudio(view, { include: ['narration'] });
    expect(plain[1]).toEqual({ text: 'ㄱ', language: 'ko-KR', kind: 'word', source: 'story-reader' });
    const withCarrier = planSceneAudio(
      input({ narrationParts: [{ kw: { ...kw('jamo-g'), ko: 'ㄱ', kind: 'jamo', spokenKo: '그' } }] }),
      BOTH,
    );
    expect(withCarrier).toEqual([{ text: '그', language: 'ko-KR', kind: 'word', source: 'story-reader' }]);
  });
});

describe('planSceneAudio: spokenKo and audioRef precedence', () => {
  it('a term says spokenKo ?? ko and carries its audioRef first', () => {
    const plan = planSceneAudio(
      input({
        narrationParts: [{ kw: kw('a', { spokenKo: '한글이', audioRef: 'audio/story/demo/a.mp3' }) }, { kw: kw('b') }],
      }),
      BOTH,
    );
    expect(plan).toEqual([
      { text: '한글이', audioRef: 'audio/story/demo/a.mp3', language: 'ko-KR', kind: 'word', source: 'story-reader' },
      { text: '한글', language: 'ko-KR', kind: 'word', source: 'story-reader' },
    ]);
  });

  it('the Korean block says spokenKo ?? ko with its audioRef', () => {
    const korean = { kind: 'line' as const, text: { ko: '한글은 쉬워요', spokenKo: '한그른 쉬워요', romanization: 'r', en: 'e', audioRef: 'audio/story/demo/l.mp3' } };
    expect(planSceneAudio(input({ korean }), BOTH)).toEqual([
      { text: '한그른 쉬워요', audioRef: 'audio/story/demo/l.mp3', language: 'ko-KR', kind: 'sentence', source: 'story-reader' },
    ]);
  });

  it('the fixture scene with a narration clip plans one narration step carrying it', () => {
    const plan = planSceneAudio(buildSceneView(readyStory(), 'listen', 0)!, BOTH);
    expect(plan).toEqual([
      { text: 'Long ago, King sejong wanted everyone to learn to read.', audioRef: 'audio/stories/hangul-day/s1.mp3', language: 'en-US', kind: 'narration', source: 'story-reader' },
      { text: '세종', language: 'ko-KR', kind: 'word', source: 'story-reader' },
    ]);
  });

  it('a scene narration clip makes the narration one step (the recording cannot be split); TTS falls back to the shown words', () => {
    const plan = planSceneAudio(
      input({
        narrationParts: [{ text: 'Long ago, King ' }, { kw: kw('sejong', { romanization: 'Sejong' }) }, { text: ' wanted it.' }],
        narrationAudioRef: 'audio/story/demo/s1.mp3',
        korean: { kind: 'word', text: { ko: '세종', romanization: 'sejong', en: 'King Sejong' } },
      }),
      BOTH,
    );
    expect(plan).toEqual([
      { text: 'Long ago, King Sejong wanted it.', audioRef: 'audio/story/demo/s1.mp3', language: 'en-US', kind: 'narration', source: 'story-reader' },
      { text: '세종', language: 'ko-KR', kind: 'word', source: 'story-reader' },
    ]);
  });
});

describe('planSceneAudio: displayed-language rule, include options, no rate', () => {
  it('narration steps use the language of the text shown (an overlay), Korean steps stay ko-KR', () => {
    const plan = planSceneAudio(input({ narrationParts: [{ text: 'Hace mucho, ' }, { kw: kw('a') }], narrationLang: 'es-US' }), BOTH);
    expect(plan.map((s) => s.language)).toEqual(['es-US', 'ko-KR']);
  });

  it('narrationSpeechLang: the overlay locale when its text is shown, else en-US (never the UI locale on a missing overlay)', () => {
    expect(narrationSpeechLang('es-US', true)).toBe('es-US');
    expect(narrationSpeechLang('es-US', false)).toBe('en-US');
    expect(narrationSpeechLang('ko-KR', false)).toBe('en-US');
    expect(narrationSpeechLang('en-US', true)).toBe('en-US');
  });

  it('include picks narration, Korean, both or nothing, always in narration-then-Korean order', () => {
    const view = buildSceneView(readyStory(), 'read-along', 0)!;
    const kinds = (include: ReadonlyArray<'narration' | 'korean'>) => planSceneAudio(view, { include }).map((s) => s.kind);
    expect(kinds(['narration'])).toEqual(['word', 'narration', 'word', 'narration']);
    expect(kinds(['korean'])).toEqual(['sentence']);
    expect(kinds(['korean', 'narration'])).toEqual(['word', 'narration', 'word', 'narration', 'sentence']);
    expect(kinds([])).toEqual([]);
  });

  it('a scene without a Korean block plans only the narration', () => {
    expect(planSceneAudio(input({ narrationParts: [{ text: 'Hello.' }] }), BOTH)).toEqual([
      { text: 'Hello.', language: 'en-US', kind: 'narration', source: 'story-reader' },
    ]);
  });

  it('never sets a rate, pitch or slow flag (F-AUDIO-004 speechParams owns them) and tags every step story-reader', () => {
    const story = readyStory();
    for (const tier of story.tiers) {
      tier.scenes.forEach((_, i) => {
        for (const step of planSceneAudio(buildSceneView(story, tier.level, i)!, BOTH)) {
          expect(Object.keys(step).sort()).toEqual(expect.arrayContaining(['kind', 'language', 'source', 'text']));
          expect(step).not.toHaveProperty('rate');
          expect(step).not.toHaveProperty('pitch');
          expect(step).not.toHaveProperty('slow');
          expect(step.source).toBe(STORY_READER_AUDIO_SOURCE);
          expect(step.text.trim()).not.toBe('');
        }
      });
    }
  });
});
