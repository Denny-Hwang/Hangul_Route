import type { Overlays } from '@hangul-route/content-schema';
import { LOCALE_META, UI_LOCALES } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { readerStory, uiSpeechLang } from '../reader-locale';
import { buildSceneView } from '../scene-view';
import { planSceneAudio } from '../scene-audio';
import { readyStory } from './story-fixture';

/**
 * F-STORY-002 PR 2.8, the open item from 2.6b: both reader hosts show the story
 * in the UI language (`localizeStory`, F-I18N-001 §3.6) and pass the voice of
 * the narration actually shown (§3.2 `scene-view.ts`, `scene-audio.ts`).
 */

const story = readyStory();

const overlays: Overlays = {
  es: {
    [story.id]: {
      'scenes.s2.narration': 'Hoya aprende el {kw:hangeul} contigo.',
      'cultureNotes.cn-hangul-day.title': 'Día del Hangul',
      'keywords.sejong.gloss': 'el rey Sejong',
    },
  },
  ko: {},
};

describe('uiSpeechLang', () => {
  it('is the voice of each UI locale', () => {
    expect(uiSpeechLang('en')).toBe('en-US');
    expect(uiSpeechLang('es')).toBe('es-US');
    expect(uiSpeechLang('ko')).toBe('ko-KR');
  });

  it('matches LOCALE_META for every UI locale', () => {
    for (const locale of UI_LOCALES) expect(uiSpeechLang(locale)).toBe(LOCALE_META[locale].speechLang);
  });
});

describe('readerStory (F-STORY-002 PR 2.8)', () => {
  it('is the very story in English, every scene read in en-US', () => {
    const out = readerStory(story, 'listen', 'en', overlays);
    expect(out.story).toBe(story);
    expect(out.narrationLangs).toEqual(['en-US', 'en-US', 'en-US', 'en-US', 'en-US']);
  });

  it('applies the overlay of the UI locale; taught Korean and romanization never change', () => {
    const out = readerStory(story, 'listen', 'es', overlays);
    const scene = out.story?.tiers[0]?.scenes[1];
    expect(scene?.narrationEn).toBe('Hoya aprende el {kw:hangeul} contigo.');
    expect(out.story?.cultureNotes[0]?.titleEn).toBe('Día del Hangul');
    const sejong = out.story?.keywords.find((k) => k.id === 'sejong');
    expect(sejong).toMatchObject({ ko: '세종', romanization: 'sejong', en: 'el rey Sejong' });
  });

  it('reads a translated scene in the UI voice and an untranslated one in English', () => {
    expect(readerStory(story, 'listen', 'es', overlays).narrationLangs).toEqual(['en-US', 'es-US', 'en-US', 'en-US', 'en-US']);
  });

  it('a locale without an overlay keeps the English story and voice', () => {
    const out = readerStory(story, 'listen', 'ko', overlays);
    expect(out.story).toBe(story);
    expect(out.narrationLangs.every((l) => l === 'en-US')).toBe(true);
  });

  it('lines up with the tier of the level read', () => {
    expect(readerStory(story, 'read-along', 'es', overlays).narrationLangs).toHaveLength(4);
    expect(readerStory(story, 'read', 'es', overlays).narrationLangs).toEqual([]);
  });

  it('passes an unknown story through, with no voices', () => {
    expect(readerStory(undefined, 'listen', 'es', overlays)).toEqual({ story: undefined, narrationLangs: [] });
  });

  it('defaults to the shipped overlays', () => {
    expect(readerStory(story, 'listen', 'en').story).toBe(story);
  });

  it('feeds the scene view and the audio plan the voice of the text shown', () => {
    const out = readerStory(story, 'listen', 'es', overlays);
    const view = buildSceneView(out.story!, 'listen', 1, { narrationLang: out.narrationLangs[1] })!;
    const steps = planSceneAudio(view, { include: ['narration'] });
    expect(steps.filter((s) => s.kind === 'narration').every((s) => s.language === 'es-US')).toBe(true);
    expect(steps.some((s) => s.language === 'ko-KR')).toBe(true);
  });
});

describe('readerStory on a two-tier story (tier-qualified scene overlays)', () => {
  // The read tier reuses the listen tier's scene ids with its own English: the untiered overlay is the listen tier's.
  const twoTier = {
    ...story,
    tiers: [
      story.tiers[0]!,
      { ...story.tiers[0]!, level: 'read' as const, scenes: story.tiers[0]!.scenes.map((s) => ({ ...s, narrationEn: `Read: ${s.narrationEn}` })) },
    ],
  };
  const s2 = story.tiers[0]!.scenes[1]!;
  const withTiers = (entry: Record<string, string>): Overlays => ({ es: { [story.id]: entry }, ko: {} });

  it('shows the untiered translation on the listen tier only; the read tier stays English and en-US', () => {
    const o = withTiers({ 'scenes.s2.narration': 'Hoya aprende el {kw:hangeul} contigo.' });
    expect(readerStory(twoTier, 'listen', 'es', o).narrationLangs[1]).toBe('es-US');
    const read = readerStory(twoTier, 'read', 'es', o);
    expect(read.story?.tiers[1]?.scenes[1]?.narrationEn).toBe(`Read: ${s2.narrationEn}`);
    expect(read.narrationLangs.every((lang) => lang === 'en-US')).toBe(true);
  });

  it('shows a tiers.read.* translation on the read tier, in the UI voice', () => {
    const o = withTiers({ 'tiers.read.scenes.s2.narration': 'Lee: Hoya aprende el {kw:hangeul}.' });
    const read = readerStory(twoTier, 'read', 'es', o);
    expect(read.story?.tiers[1]?.scenes[1]?.narrationEn).toBe('Lee: Hoya aprende el {kw:hangeul}.');
    expect(read.narrationLangs[1]).toBe('es-US');
    expect(readerStory(twoTier, 'listen', 'es', o).narrationLangs.every((lang) => lang === 'en-US')).toBe(true);
  });
});
