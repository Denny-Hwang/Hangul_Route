import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * [LR] AMENDMENTS-QUEST-LEAVE-RESUME row LR-2 (section 3.2): the mobile vitest lane does not render HomeScreen, so this
 * pins the wiring a render test would: the hero asks `useHeroResume` for the learner's lesson, shows what it answers,
 * and Start again goes through the hook (it forgets the saved run first), then opens the lesson as Start does.
 */
const src = readFileSync(join(__dirname, '..', '..', 'screens', 'home', 'HomeScreen.tsx'), 'utf8');

describe('Home hero resume wiring', () => {
  it('asks the hook with the learner and the hero lesson', () => {
    expect(src).toMatch(/useHeroResume\(profile\?\.id \?\? null, nextLesson\?\.questId \?\? null\)/);
    expect(src).toMatch(/resume: heroResume, startAgain: startHeroAgain/);
  });

  it('passes the answer and Start again to the hero card, Start again opening the lesson as Start does', () => {
    expect(src).toMatch(/<NextLessonCard[\s\S]*resume=\{heroResume\}[\s\S]*onStart=\{startNextLesson\}[\s\S]*onStartAgain=\{\(\) => startHeroAgain\(startNextLesson\)\}/);
  });
});
