import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

/**
 * F-PLAN-002 section 3.9 and 3.11, AMENDMENTS-PLC-PLAN-HANDOFF FP-B6 / FP-B15 (P2-7a): the
 * learner's weekly plan words on Home, Profile and the proposal screen. Any age reads them.
 * Learner copy says "plan", never "route" (OD-7); locked and unreleased lessons are only "More
 * lessons are coming." (never Premium, a price or a plan product); nothing is late, behind or
 * missed; reading, listening and writing only (no speaking words); no score shapes.
 */
const BANNED: readonly RegExp[] = [
  /premium/i,
  /\bprice\b/i,
  /\$/,
  /\bbuy\b/i,
  /\bpay\b/i,
  /\btrial\b/i,
  /\blocked\b/i,
  /\bunlock/i,
  /family plan/i,
  /\broute\b/i,
  /\blate\b/i,
  /\bbehind\b/i,
  /\bmissed\b/i,
  /\boverdue\b/i,
  /\bdeadline\b/i,
  /\bspeak/i,
  /\bsay\b/i,
  /\bpronounc/i,
  /\bkids?\b/i,
  /\bages?\b/i,
  /%/,
  /\d\s*\/\s*\d/,
];

/** Every rendered string under `learner.weeklyPlan`, function messages through their SAMPLES rows. */
function rendered(locale: (typeof LOCALES)[number]): Array<{ path: string; text: string }> {
  const tree = getMessages(locale).learner.weeklyPlan;
  return leafPaths(tree).flatMap((path) => {
    const value = lookup(tree, path);
    if (typeof value === 'string') return [{ path, text: value }];
    const samples = SAMPLES[`learner.weeklyPlan.${path}`] ?? [];
    expect(samples.length, `learner.weeklyPlan.${path} needs a SAMPLES row`).toBeGreaterThan(0);
    return samples.map((args) => ({ path, text: (value as (...a: unknown[]) => string)(...args) }));
  });
}

describe('learner.weeklyPlan (F-PLAN-002 P2-7a)', () => {
  it('holds the wireframe K1 and AM-6 English values', () => {
    const en = getMessages('en').learner.weeklyPlan;
    expect(en.homePrompt.line).toBe('Hoya can make a weekly plan for you');
    expect(en.homePrompt.make.cta).toBe('Make my plan');
    expect(en.homePrompt.notNow.cta).toBe('Not now');
    expect(en.profileRow.make).toBe('Make a weekly plan');
    expect(en.proposal.intro).toBe('Hoya made a weekly plan for you.');
    expect(en.proposal.suggested.pill).toBe('Hoya suggests');
    expect(en.proposal.otherPlanFirst.teacher).toBe('Your teacher has a weekly plan for you. You can add your own; theirs comes first.');
    expect(en.proposal.daysHint(3)).toBe('Pick 3 days.');
    expect(en.proposal.startPlan.cta).toBe('Start this plan');
    expect(en.proposal.notNow.cta).toBe('Not now');
    expect(en.proposal.changeDays.cta).toBe('Change days and time');
    expect(en.proposal.preview.moreComing).toBe('More lessons are coming.');
    expect(en.proposal.preview.freePractice(3)).toBe('About 3 weeks of lessons are ready now. The rest is free practice.');
    expect(en.proposal.preview.lessonsAndStories(1, 7)).toBe('Stage 1 is done around week 7, then heritage stories.');
  });

  it('holds the P2-7b values: set-up, preview, overview (G1 to G3) and the Hoya check-in (FP-B14)', () => {
    const en = getMessages('en').learner.weeklyPlan;
    expect(en.setup.title).toBe('Change the plan');
    expect(en.setup.see.cta).toBe('See my plan');
    expect(en.setup.tooMany).toBe('That is more than a plan can hold. Choose fewer weeks or days.');
    expect(en.planPreview.start.cta).toBe('Start this plan');
    expect(en.planPreview.change.cta).toBe('Change something');
    expect(en.planPreview.notices.moreComing).toBe('More lessons are coming.');
    expect(en.overview.title).toBe('Your weekly plan');
    expect(en.overview.intro).toBe('We found a path for you.');
    expect(en.overview.moved).toBe('Hoya moved your plan along.');
    expect(en.overview.moveAlong.cta).toBe('Move my plan along');
    expect(en.overview.stop.cta).toBe('Stop this plan');
    expect(en.checkIn.lighter.line).toBe('Want a lighter week?');
    expect(en.checkIn.faster.line).toBe('Want to go a bit faster?');
    expect(en.checkIn.notNow.cta).toBe('Not now');
    expect(en.homeMoved.line).toBe('Hoya moved your plan along.');
  });

  it('the check-in and the moved line carry no count of sessions done or not done', () => {
    const en = getMessages('en').learner.weeklyPlan;
    for (const text of [en.checkIn.lighter.line, en.checkIn.faster.line, en.overview.moved, en.overview.movedDone, en.homeMoved.line]) {
      expect(text).not.toMatch(/\d/);
      expect(text).not.toMatch(/\bsessions?\b|\bskipp|\bmissing\b|\bfail/i);
    }
  });

  it('a cut-short card never claims a finish', () => {
    const line = getMessages('en').learner.weeklyPlan.proposal.preview.cutShort(4);
    expect(line).not.toMatch(/\bdone\b|\bfinished\b|\bcomplete/i);
  });

  for (const locale of LOCALES) {
    it(`${locale}: no banned word, product word, speaking word, emoji or score shape`, () => {
      for (const { path, text } of rendered(locale)) {
        expect(text.trim(), path).not.toBe('');
        for (const rule of BANNED) expect(text, `${path}: ${rule}`).not.toMatch(rule);
        expect(findBannedWord(text, locale, 'learner'), path).toBeNull();
        expect(findBannedWord(text, locale, 'caregiver'), path).toBeNull();
        expect(text, path).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    });
  }
});
