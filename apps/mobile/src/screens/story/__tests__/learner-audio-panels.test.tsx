import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { foundNotes } from '../../../logic/story/culture-notes';
import { storyEpisodeEntries } from '../../../logic/story/story-episode';
import { defaultStoryIndex } from '../../../logic/story/story-index';
import { storiesAll } from '../../../content/stories';
import { useAudioStore } from '../../../store/audio-store';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { createAudioRig, rigAudio, type AudioRig } from '../../../test-support/audio-rig';
import { byTestId, press, render, textOf, unmount } from '../../../test-support/render';
import { StoryEpisodeDetail } from '../../episode/StoryEpisodeDetail';
import { CultureNotesScreen } from '../CultureNotesScreen';

/**
 * The story episode page's word chips and the Culture notes terms (F-AUDIO-004 §3.8, A-5b): with no
 * Korean voice a tap shows the status panel under what was tapped, and the real controller sends
 * `audio.fallback_shown` once. The adapter is the shipped web one over FakeSpeechSynthesis.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const rig = vi.hoisted(() => ({ current: null as AudioRig | null }));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  ...(await import('../../../test-support/audio-rig')).rigAudio(() => rig.current!),
}));
// No shipped story carries a culture note yet: the first story gets one, sourced by its first fact.
const NOTE_ID = vi.hoisted(() => 'cn-audio-test');
vi.mock('../../../content/stories', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../content/stories')>();
  const [first, ...rest] = real.storiesAll;
  if (!first?.facts[0]) throw new Error('a story with a fact ships');
  const note = {
    id: NOTE_ID,
    titleEn: 'Clothes for a holiday',
    bodyEn: 'Families wear them on holidays.',
    term: { ko: '한복', romanization: 'hanbok', en: 'traditional Korean clothes' },
    factIds: [first.facts[0].id],
  };
  return { ...real, storiesAll: [{ ...first, cultureNotes: [note] }, ...rest] };
});
const events = vi.hoisted(() => [] as Array<{ name: string; payload?: unknown }>);
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async (event: { name: string; payload?: unknown }) => {
    events.push(event);
  }),
}));

const AUDIO = getMessages('en').learner.audio;
const PROFILE_ID = 'profile:audio';
const mounted: ReactTestRenderer[] = [];

beforeEach(() => {
  events.length = 0;
  rig.current = createAudioRig({ voices: [] });
  useAudioStore.setState({ muted: false });
});

afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  useProfileStore.setState({ profiles: [], activeId: null });
  useProgressStore.setState({ byProfile: {} });
});

const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};
const pressable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
const fallbacks = (): unknown[] => events.filter((e) => e.name === 'audio.fallback_shown').map((e) => e.payload);

describe('StoryEpisodeDetail: a word chip with no Korean voice', () => {
  const found = episodesAll
    .map((episode) => ({ episode, entries: storyEpisodeEntries(episode, defaultStoryIndex()) }))
    // A single-story page lists its story's words.
    .find((e) => e.entries !== null && e.entries.length === 1);

  it('shows the status line under the word chips and sends audio.fallback_shown once', async () => {
    if (!found?.entries) throw new Error('a story episode ships');
    const noop = (): void => undefined;
    const r = await render(
      <StoryEpisodeDetail
        episode={found.episode}
        entries={found.entries}
        cellStoryCount={0}
        onOpenStory={noop}
        onOpenCard={noop}
        onOpenSources={noop}
        onOpenCultureNotes={noop}
        onOpenCellStories={noop}
        onOpenCellStoriesRow={noop}
      />,
    );
    mounted.push(r);
    const speakers = byTestId(r.root, 'story-episode-words')[0]!.findAll((n) => typeof n.props.onClick === 'function' && String(n.props['data-testid'] ?? '').startsWith('story-episode-hear-'));
    expect(speakers.length).toBeGreaterThan(1);

    // Nothing is said before a tap.
    expect(byTestId(r.root, 'story-episode-words-sound-detail')).toHaveLength(0);
    await press(speakers[0]!);
    await settle();
    const detail = byTestId(r.root, 'story-episode-words-sound-detail');
    expect(detail.length).toBeGreaterThan(0);
    expect(textOf(detail[0]!)).toBe(AUDIO.noKoreanVoiceSentence);
    expect(byTestId(r.root, 'story-episode-words-sound-help').length).toBeGreaterThan(0);
    // Only the panel under what was tapped speaks.
    expect(byTestId(r.root, 'story-episode-title-sound-detail')).toHaveLength(0);
    expect(fallbacks()).toEqual([{ source: 'story-episode', reason: 'no_voice' }]);

    await press(speakers[1]!);
    await settle();
    expect(fallbacks()).toHaveLength(1);
    expect(rig.current!.synth.spoken).toHaveLength(0);
  });
});

describe('CultureNotesScreen: a term with no Korean voice', () => {
  it('shows the status line under that term and sends audio.fallback_shown once', async () => {
    const withNotes = new Set(storiesAll.filter((story) => story.cultureNotes.length > 0).map((story) => story.id));
    const entry = defaultStoryIndex().find((e) => withNotes.has(e.storyId));
    if (!entry) throw new Error('a story with culture notes ships');
    useProfileStore.setState({
      profiles: [{ id: PROFILE_ID, displayName: 'Dami', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'self' }],
      activeId: PROFILE_ID,
    });
    useProgressStore.setState({
      byProfile: {
        [PROFILE_ID]: {
          profileId: PROFILE_ID,
          updatedAt: '2026-10-02T00:00:00.000Z',
          episodes: [],
          quests: [{ questId: entry.questId, episodeId: entry.episodeId, startedAt: '2026-10-02T00:00:00.000Z', completedAt: '2026-10-02T00:05:00.000Z', stars: 3, attempts: 1, accuracy: 1 }],
          cards: [],
          sessions: [],
          homework: [],
          reviews: [],
          streakDays: 1,
          placements: [],
        },
      },
    });
    const notes = foundNotes(defaultStoryIndex(), storiesAll, useProgressStore.getState().byProfile[PROFILE_ID]);
    const note = notes.find((n) => n.note.id === NOTE_ID);
    if (!note) throw new Error('the finished story has its note');
    const navigation = { navigate: vi.fn(), push: vi.fn(), goBack: vi.fn() };
    const r = await render(
      <CultureNotesScreen
        route={{ key: 'notes', name: 'CultureNotes', params: { storyId: entry.storyId } }}
        navigation={navigation as never}
      />,
    );
    mounted.push(r);
    await press(pressable(r.root, `culture-note-hear-${note.note.id}`));
    await settle();
    const detail = byTestId(r.root, `culture-note-sound-${note.note.id}-detail`);
    expect(detail.length).toBeGreaterThan(0);
    expect(textOf(detail[0]!)).toBe(AUDIO.noKoreanVoiceSentence);
    expect(fallbacks()).toEqual([{ source: 'culture-notes', reason: 'no_voice' }]);
    await press(pressable(r.root, `culture-note-hear-${note.note.id}`));
    await settle();
    expect(fallbacks()).toHaveLength(1);
  });
});
