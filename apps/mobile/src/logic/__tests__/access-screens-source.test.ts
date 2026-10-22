import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source guards for the learner screens of the free limit (F-ENT-003 section 3.7, 3.15; E3-D D5,
 * D7; OD-6). The mobile vitest lane does not render components, so these pin what a render test
 * would: no lock glyph in any access state, the marks drawn from the shared RouteMarkers, the ask
 * through the one gate helper with its telemetry, and the player guard.
 */
const SRC = join(__dirname, '..', '..');
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');
const SYMBOL = /[\p{Extended_Pictographic}←-⇿⌀-⏿■-◿☀-➿️]/u;

const EPISODE = 'screens/episode/EpisodeDetailView.tsx';

describe('the episode page (E3-6)', () => {
  const src = read(EPISODE);

  it('a tagged row still reads its blurb, builds-on line and stars (the group hides them otherwise)', () => {
    expect(src).toMatch(/messages\.a11y\.access\.row\(/);
    expect(src).toMatch(/\[q\.blurbEn, buildsOn \? buildsOnLine\(buildsOn, m\) : null, messages\.a11y\.stars\(stars\)\]/);
  });

  it('draws no lock glyph in any state (D7: the waiting card tile has no glyph)', () => {
    expect(src).not.toMatch(/name=["']lock["']/);
  });

  it('draws the marks from RouteMarkers and the closed caption with the later pip', () => {
    expect(src).toMatch(/<NextMarker\b/);
    expect(src).toMatch(/<RouteTag kind="next"/);
    expect(src).toMatch(/<RouteTag kind="inPlan"/);
    expect(src).toMatch(/<Pip state="later" context="stage" \/>/);
  });

  it('asks through askFor and askGate, sends access.help_asked first and access.preview_opened once per open', () => {
    expect(src).toMatch(/askFor\(audience, isClassOnly\(/);
    expect(src).toMatch(/helpAskedEvent\(profileId, 'episode', ask\.audience\)[\s\S]*askGate\(passGate\('Paywall', gateOpensDirectlyNow\(\)\), 'episode'\)/);
    expect(src).toMatch(/previewOpenedEvent\(/);
    expect(src).toMatch(/previewSent\.current === episode\.id/);
  });

  it('reads access and the one next through the shared hooks, never the raw switch', () => {
    expect(src).toMatch(/useQuestAccess\(\)/);
    expect(src).toMatch(/useAccessTier\(/);
    expect(src).toMatch(/gatingActive\(flags, bundleOs\(\)\)/);
    expect(src).not.toMatch(/contentGatingEnabled/);
  });

  it('a story page with a closed quest (a Stage 5 book on the free plan) falls back to the quest list in preview', () => {
    // F-STORY-005 PR 5.6: book quests are grid lessons, so the story page must not offer Start for a closed one.
    expect(src).toMatch(/if \(storyEntries && !preview\)/);
  });

  it('has no emoji-capable or arrow character and no colour literal', () => {
    expect(src).not.toMatch(SYMBOL);
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
  });

  it('names its design references', () => {
    expect(src).toMatch(/design\/wireframes\/episode\/detail-access-preview\.md/);
    expect(src).toMatch(/design\/components\/RouteMarkers\/spec\.md/);
  });
});

describe('the quest player guard (section 3.6)', () => {
  it('replaces a closed quest with its lesson page in preview, from the player, before the run starts', () => {
    const src = read('screens/quest/QuestPlayerScreen.tsx');
    expect(src).toMatch(/playerGuard\(questOpen, questId, episodeId\)/);
    expect(src).toMatch(/navigation\.replace\('EpisodeDetail', guard\)/);
    expect(src).toMatch(/if \(!settled \|\| guard\) return null;/);
    // A closed answer is checked again once the tier and memberships are read (never redirect an owned quest).
    expect(src).toMatch(/settledPlayerGuard\(\{ learnerId, questId, episodeId \}\)/);
  });
});

describe('the Homework screen (section 3.6)', () => {
  it('shows Not open yet in place of the row button for a closed assignment', () => {
    const src = read('screens/homework/HomeworkScreen.tsx');
    expect(src).toMatch(/closed=\{!questOpen\(h\.questId\)\}/);
    expect(src).toMatch(/messages\.learner\.access\.notOpen/);
  });
});
