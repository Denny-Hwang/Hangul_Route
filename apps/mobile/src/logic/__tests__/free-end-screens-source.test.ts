import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Source guards for the E3-7 learner screens (F-ENT-003 sections 3.7, 3.8, 3.12; E3-D D8 to D10;
 * OD-6). The mobile vitest lane does not render components, so these pin what a render test would:
 * the free-end card once and the practice card with no ask on Home, the celebration and the calm
 * line on Results, the seen key and `access.free_end_reached` through one store, and the Library
 * tiles' dotted ring, ask hint and In your plan tag.
 */
const SRC = join(__dirname, '..', '..');
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');
const SYMBOL = /[\p{Extended_Pictographic}←-⇿⌀-⏿■-◿☀-➿️]/u;
const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;

describe('Home (section 3.7)', () => {
  const src = read('screens/home/HomeScreen.tsx');
  const card = read('screens/home/FreeEndCard.tsx');

  it('feeds the mission the seen key and the practice target, and marks the celebration when it shows', () => {
    expect(src).toMatch(/readFreeEndSeen\(profile\.id\)/);
    expect(src).toMatch(/seen: freeEndSeen !== false/);
    expect(src).toMatch(/practiceTarget\(\{/);
    expect(src).toMatch(/markFreeEndSeen\(profile\.id, freeEndShown\.placedOut === true\)/);
  });

  it('asks from Home through askFor and askGate, with access.help_asked first', () => {
    expect(src).toMatch(/helpAskedEvent\(profile\?\.id, 'home', ask\.audience\)[\s\S]*askGate\(gateOpensDirectlyNow\(\), 'home'\)/);
  });

  it('the free-end card has Hoya cheering, the title, the line and its three actions, and no lock glyph', () => {
    expect(card).toMatch(/pose="cheering"/);
    expect(card).toMatch(/access\.freeEnd\.title/);
    expect(card).toMatch(/access\.openForYou/);
    expect(card).toMatch(/access\.replay\.cta/);
    // With neither a word topic nor a sampler story, Play a favorite again is the one primary (never only the ask).
    expect(card).toMatch(/tone=\{primary \? 'secondary' : 'primary'\}/);
    expect(card).not.toMatch(/name=["']lock["']/);
    for (const s of [src, card]) {
      expect(s).not.toMatch(SYMBOL);
      expect(s).not.toMatch(COLOUR);
    }
  });
});

describe('Results (section 3.8)', () => {
  const src = read('screens/results/ResultsScreen.tsx');
  const view = read('screens/results/ResultsFreeEnd.tsx');

  it('reads routeNext with the quest just played, celebrates once and marks the key', () => {
    expect(src).toMatch(/routeNext\(\{ \.\.\.routeInput, justCompleted: questId \}\)/);
    expect(src).toMatch(/freeEndResults\(\{ next, scored: total > 0, seen: freeEndSeen \}\)/);
    expect(src).toMatch(/markFreeEndSeen\(profileId, next\.placedOut\)/);
    expect(src).toMatch(/helpAskedEvent\(profileId, 'results', ask\.audience\)[\s\S]*askGate\(gateOpensDirectlyNow\(\), 'results'\)/);
  });

  it('the calm line has no ask; the celebration has Back home, Practice words and the ask', () => {
    const calm = view.slice(view.indexOf('export function ResultsOpenForYou'));
    expect(calm).toMatch(/access\.openForYou/);
    expect(calm).not.toMatch(/askLabel|onAsk/);
    const party = view.slice(0, view.indexOf('export function ResultsOpenForYou'));
    expect(party).toMatch(/access\.home\.cta/);
    expect(party).toMatch(/onAsk/);
    expect(view).not.toMatch(SYMBOL);
    expect(view).not.toMatch(COLOUR);
  });
});

describe('Results when the same run completes Stage 1 (F-QUEST-002 section 3.8)', () => {
  const src = read('screens/results/ResultsScreen.tsx');
  const view = read('screens/results/ResultsFreeEnd.tsx');

  it('keeps See your Stage 1 prize on the celebration and on the calm line, as the one primary', () => {
    expect(src).toMatch(/const freeEndPrize = actions\.stagePrize/);
    expect(src.match(/stagePrize=\{freeEndPrize\}/g)).toHaveLength(2);
    expect(view).toMatch(/testID="results-stage-prize"/);
    expect(view.match(/<StagePrizeButton stagePrize=\{stagePrize\} \/>/g)).toHaveLength(2);
    // Back home steps down when the prize is there.
    expect(view).toMatch(/tone=\{stagePrize \? 'secondary' : 'primary'\}/);
  });
});

describe('the one seen key (sections 3.10, 3.12, 3.16)', () => {
  it('goes through platform storage and sends access.free_end_reached from one place', () => {
    const store = read('store/free-end-seen.ts');
    expect(store).toMatch(/from '\.\.\/platform\/storage'/);
    expect(store).toMatch(/freeEndReachedEvent\(profileId, placedOut\)/);
    expect(store).not.toMatch(/localStorage|AsyncStorage/);
  });
});

describe('the Library tiles (section 3.7, wireframe library/access-and-plan-tags)', () => {
  it('a closed story tile draws the dotted mark, never the lock, and carries the ask as its hint', () => {
    const tile = read('screens/library/StoryTile.tsx');
    expect(tile).toMatch(/<TagMark kind="notOpen"/);
    expect(tile).toMatch(/<RouteTag kind="inPlan"/);
    expect(tile).not.toMatch(/name=["']lock["']/);
    const grid = read('screens/library/StoryTileGrid.tsx');
    expect(grid).toMatch(/hint=\{item\.view\.locked \? tiles\.askHint : undefined\}/);
    expect(grid).toMatch(/helpAskedEvent\(profileId, 'library', ask\.audience\)/);
  });

  it('a closed word topic tile carries the ask as its hint and sends access.help_asked before the gate', () => {
    const grid = read('screens/vocab/TopicGrid.tsx');
    expect(grid).toMatch(/askFor\(audience, isClassOnly\(/);
    expect(grid).toMatch(/helpAskedEvent\(profile\?\.id, 'library', ask\.audience\)[\s\S]*lockedStoryGate\(/);
    expect(grid).toMatch(/hint=\{view\.locked \? ask\.label : undefined\}/);
    const tile = read('screens/vocab/TopicTile.tsx');
    expect(tile).toMatch(/accessibilityHint=\{hint\}/);
  });
});
