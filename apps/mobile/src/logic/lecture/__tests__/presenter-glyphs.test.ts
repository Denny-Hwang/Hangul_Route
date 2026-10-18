import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LectureDeckSchema, type LectureBlock } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../../content';
import { storiesAll } from '../../../content/stories';
import { buildStoryIndex } from '../../story/story-index';
import { VOCAB_TOPICS } from '../../../content/__generated__/vocab';
import { PAUSE_WORD, lectureBundle } from '../content';
import { expandDeck } from '../deck-builder';

/**
 * The presenter font holds every Hangul glyph the deck builder projects (F-TCH-004 §3.6, TD4).
 *
 * `scripts/build-presenter-font.mjs` derives its glyph list from content fields; this test
 * ties that list to what `expandDeck` really puts on slides. It expands every shipped
 * episode and quest, with a Korean voice and without one (the teacher-says text and the
 * Match Sound text prompts of §3.7 / §3.3), walks every string in the slides and fails on a
 * Hangul code point missing from the committed sidecar. Every story the Library lists
 * joins as a story block with its checks (PR 11); every vocabulary topic joins as a
 * vocab block (PR 12).
 *
 * Only taught Korean is drawn in the presenter font. Text in the UI language (titles,
 * card facts, glosses; the teacher-typed deck title) uses the system stack, so those
 * fields are left out, and so is the slide key (an id, never drawn).
 */

const SIDECAR = join(__dirname, '..', '..', '..', '..', 'public', 'fonts', 'hr-presenter-kr.glyphs.txt');

function sidecarCodePoints(): Set<number> {
  return new Set(
    readFileSync(SIDECAR, 'utf8')
      .split('\n')
      .map((line) => line.split('#')[0]!.trim())
      .filter((part) => /^U\+[0-9A-F]{4,6}$/i.test(part))
      .map((part) => parseInt(part.slice(2), 16)),
  );
}

/** Hangul syllables, Hangul jamo and compatibility jamo. */
const isHangul = (cp: number): boolean =>
  (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0x1100 && cp <= 0x11ff) || (cp >= 0x3130 && cp <= 0x318f);

/**
 * Slide fields that are not taught Korean: UI-language text (a read-along speaker's name and a
 * realia sheet's accessible text among them, LV-S1) and the slide key.
 */
const NOT_TAUGHT_KOREAN = new Set(['key', 'title', 'fact', 'gloss', 'speaker', 'alt']);

/** Every string in a slide except the fields above, at any depth. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => strings(v, out));
  else if (value !== null && typeof value === 'object') {
    for (const [field, v] of Object.entries(value)) if (!NOT_TAUGHT_KOREAN.has(field)) strings(v, out);
  }
  return out;
}

const deck = (blocks: LectureBlock[]) =>
  LectureDeckSchema.parse({ v: 1, id: 'lecture:glyphs1', title: 'Every block', createdAt: '2026-10-12T09:00:00Z', seed: 1, blocks });

const blocks: LectureBlock[] = [
  ...episodesAll.filter((e) => e.status !== 'preview' && e.questIds.length > 0).map((e): LectureBlock => ({ kind: 'episode', id: e.id })),
  ...questsAll.map((q): LectureBlock => ({ kind: 'quest', id: q.id })),
  ...[...new Set(buildStoryIndex({ stories: storiesAll, episodes: episodesAll, quests: questsAll, showUnreviewed: false }).map((e) => e.storyId))].map(
    (storyId): LectureBlock => ({ kind: 'story', storyId, checks: true }),
  ),
  ...VOCAB_TOPICS.map((t): LectureBlock => ({ kind: 'vocab', topicId: t.id })),
];

describe('the presenter font covers the projected Hangul (F-TCH-004 §3.6)', () => {
  const font = sidecarCodePoints();

  it('reads a non-empty sidecar', () => {
    expect(font.size).toBeGreaterThan(30);
  });

  it.each([true, false])('every Hangul glyph of every shipped episode and quest is in the font (Korean voice: %s)', (canPlayKorean) => {
    const missing = new Map<string, string>();
    for (let i = 0; i < blocks.length; i += 30) {
      const { slides } = expandDeck(deck(blocks.slice(i, i + 30)), lectureBundle('en'), { canPlayKorean });
      for (const slide of slides) {
        for (const s of strings(slide)) {
          for (const ch of s) {
            const cp = ch.codePointAt(0)!;
            if (isHangul(cp) && !font.has(cp) && !missing.has(ch)) missing.set(ch, `${slide.key}: ${s}`);
          }
        }
      }
    }
    expect([...missing.entries()]).toEqual([]);
  });

  it.each(['es', 'ko'] as const)(
    'every Korean chip of the pattern notes and realia captions of a deck in %s (the content overlays) is in the font',
    (locale) => {
      // The rest of an overlay deck is the same taught Korean as the English walk above, or UI-language text in the system stack.
      const missing = new Map<string, string>();
      let chips = 0;
      for (let i = 0; i < blocks.length; i += 30) {
        const { slides } = expandDeck(deck(blocks.slice(i, i + 30)), lectureBundle(locale), { canPlayKorean: true });
        for (const slide of slides) {
          const pieces = slide.kind === 'pattern' ? (slide.note ?? []) : slide.kind === 'realia' ? (slide.caption ?? []) : [];
          for (const piece of pieces) {
            if (!('ko' in piece)) continue;
            chips += 1;
            for (const ch of piece.ko) {
              const cp = ch.codePointAt(0)!;
              if (isHangul(cp) && !font.has(cp) && !missing.has(ch)) missing.set(ch, `${slide.key}: ${piece.ko}`);
            }
          }
        }
      }
      expect(chips).toBeGreaterThan(0);
      expect([...missing.entries()]).toEqual([]);
    },
  );

  it('the walk reaches every reading slide (LV-S1): sentences, patterns with their frames and notes, read alongs, realia sheets and captions', () => {
    const { slides } = expandDeck(deck(blocks.filter((b) => b.kind === 'episode').slice(0, 30)), lectureBundle('en'), { canPlayKorean: true });
    const all = [...slides, ...expandDeck(deck(blocks.filter((b) => b.kind === 'episode').slice(30)), lectureBundle('en'), { canPlayKorean: true }).slides];
    for (const kind of ['sentence', 'pattern', 'read-along', 'realia'] as const) expect(all.some((s) => s.kind === kind), kind).toBe(true);
    // The Korean only these slides draw is in the walk: a frame between its gaps, a note's chips, a sheet's heading and lines.
    const drawn = new Set(all.flatMap((s) => strings(s)));
    expect([...drawn].some((t) => t.includes('을/를'))).toBe(true);
    expect(all.some((s) => s.kind === 'pattern' && s.note?.some((p) => 'ko' in p) === true)).toBe(true);
    expect(all.some((s) => s.kind === 'realia' && s.sheet.heading !== undefined && drawn.has(s.sheet.heading.ko))).toBe(true);
  });

  it('the deck covers every listed story', () => {
    expect(blocks.filter((b) => b.kind === 'story').length).toBeGreaterThan(0);
  });

  it('the deck covers every vocabulary topic', () => {
    expect(blocks.filter((b) => b.kind === 'vocab').length).toBe(VOCAB_TOPICS.length);
  });

  it('holds the Pause word', () => {
    for (const ch of PAUSE_WORD.ko) expect(font.has(ch.codePointAt(0)!), ch).toBe(true);
  });
});
