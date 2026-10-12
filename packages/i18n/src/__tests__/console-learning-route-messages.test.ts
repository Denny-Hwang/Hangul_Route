import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// AMENDMENTS-ROUTE-LEARNING-ROUTE section 11.1 `console.learningRoute` (LR-7): the grown-up
// Learning Route card, the stage list page and the class plan line. English values are pinned
// to section 11.1; every locale passes the caregiver banned words and carries no ranking,
// comparison, ratio, percent or zero count, because the page is about one learner among others.
// The casing, "my route", "family plan" / "class plan" and grown-up honesty rules of section 7.3
// run on this namespace in learning-route-copy.test.ts.
const lr = getMessages('en').console.learningRoute;

const PHRASES = ['behind', 'ahead', 'average', 'rank', 'score', 'compared', 'best', 'worst', 'late', 'overdue', 'deadline', 'left', 'remaining', 'kids', 'ages'];

function outputsOf(tree: unknown, prefix: string): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  for (const path of leafPaths(tree as Record<string, unknown>)) {
    const value = lookup(tree as Record<string, unknown>, path);
    if (typeof value === 'function') {
      const samples = SAMPLES[`${prefix}.${path}`];
      expect(samples, `${prefix}.${path} needs a row in SAMPLES`).toBeDefined();
      for (const args of samples ?? []) out.push({ path, text: (value as (...a: unknown[]) => string)(...args) });
    } else out.push({ path, text: String(value) });
  }
  return out;
}

describe('console.learningRoute (English, section 11.1)', () => {
  it('names the page, its link and its section', () => {
    expect(lr.title('Sam')).toBe("Sam's Learning Route");
    expect(lr.open).toBe('Open Learning Route');
    expect(lr.section).toBe('Learning Route');
    // The heading over the stage list (LR-D, design/screens/learning-route/stage-list.md).
    expect(lr.stagesTitle).toBe('Stages');
    expect(lr.back).toEqual({ report: 'Back to the report', class: 'Back to the class', family: 'Back to the family', space: 'Back' });
  });

  it('words case 1: the goal the learner device shows (family viewer only)', () => {
    expect(lr.now('Sam', 1, 'Hangul')).toBe('Sam is on Stage 1: Hangul.');
    expect(lr.learnerGoal('Sam', 2, 'Words')).toBe("Sam's goal: Stage 2 · Words");
    expect(lr.fromLead.class).toBe("From the class's weekly plan");
    expect(lr.fromLead.school).toBe("From the school's weekly plan");
    expect(lr.fromLead.family).toBe("From your family's weekly plan");
    expect(lr.fromLead.self('Sam')).toBe("From Sam's own weekly plan");
    expect(lr.fromLead.default).toBe("Hoya's suggestion: the next open stage");
    expect(lr.reached('Sam', 2, 'Words')).toBe('Sam reached the goal: Stage 2 · Words.');
  });

  it("words case 2 about the plan, and case 3 about the road, never as the learner's goal", () => {
    expect(lr.planReaches.class(1, 'Hangul')).toBe("Your class's weekly plan reaches Stage 1 · Hangul");
    expect(lr.planReaches.family(2, 'Words')).toBe("Your family's weekly plan reaches Stage 2 · Words");
    expect(lr.stageReached('Mina')).toBe('Mina reached this stage.');
    expect(lr.nextOpen(2, 'Words')).toBe('Next open stage: Stage 2 · Words');
  });

  it('words the shared parts, the stage tags and the sync state', () => {
    expect(lr.canDoLead('Sam')).toBe('By the end of this stage, Sam can:');
    expect(lr.planEnds('Dec 20')).toBe('Plan ends Dec 20');
    expect(lr.endOfRoad('Sam')).toBe('Sam reached the end of the open road. More is coming.');
    expect(lr.hereTag('Sam')).toBe('Sam is here');
    expect(lr.startTag('Sam')).toBe('Sam started here');
    expect(lr.goalTag('Sam')).toBe("Sam's goal");
    expect(lr.planGoalTag).toBe('Plan goal');
    expect(lr.updated('Oct 11')).toBe('Updated Oct 11');
    expect(lr.notSynced('Mina')).toBe("The Learning Route appears after Mina's next sync on the newest app.");
    expect(lr.notFound).toBe('We could not find this learner in this space.');
  });

  it("words the known part alone exactly as the strip's stage line words it (zero parts left out)", () => {
    const journey = getMessages('en').console.journey;
    expect(lr.knownLine(8)).toBe('8 known from the level check');
    expect(lr.knownLine(1)).toBe('1 known from the level check');
    // A stage row's heading is one dictionary string, so a locale can reorder or re-punctuate it (LR-8).
    expect(lr.stageRow(2, 'Words', 'Open')).toBe('2. Words · Open');
    for (const known of [1, 4, 8]) expect(journey.stageLine(known, 2).startsWith(`${lr.knownLine(known)}, `)).toBe(true);
  });
});

describe('console.learningRoute (every locale)', () => {
  it('passes the caregiver banned words, with no ranking, comparison, ratio, percent or zero count', () => {
    for (const locale of LOCALES) {
      for (const { path, text } of outputsOf(getMessages(locale).console.learningRoute, 'console.learningRoute')) {
        const where = `${locale} ${path}: ${text}`;
        expect(findBannedWord(text, locale, 'caregiver'), where).toBeNull();
        for (const phrase of PHRASES) expect(text.toLowerCase(), where).not.toMatch(new RegExp(`\\b${phrase}\\b`));
        expect(text, where).not.toMatch(/\d+ ?\/ ?\d+|%/);
        expect(text, where).not.toMatch(/(^|\D)0 /);
        expect(KIDS_ONLY_FRAMING.filter(({ re }) => re.test(text)).map(({ name }) => name), where).toEqual([]);
      }
    }
  });

  it('never words speaking (reading, listening and writing only)', () => {
    for (const locale of LOCALES) {
      for (const { text } of outputsOf(getMessages(locale).console.learningRoute, 'console.learningRoute')) {
        expect(text.toLowerCase()).not.toMatch(/\b(speak|speaking|say it|pronounce|microphone)\b/);
      }
    }
  });

  it('has no price, product or purchase words (no billing line on these views, LR-OD-8)', () => {
    for (const { text } of outputsOf(lr, 'console.learningRoute')) {
      expect(text).not.toMatch(/\$|premium|subscri|billing|upgrade|unlock|buy|price/i);
    }
  });
});
