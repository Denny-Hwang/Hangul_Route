import { plural } from '@hangul-route/i18n';
import type { MyRouteMessages } from '../../copy';

/**
 * The Appendix B draft English strings in the shape the copy selectors read.
 * R-3 puts the final copy in the dictionary (`learner.myRoute`,
 * `caregiver.journey`, `caregiver.skillsNote`, `a11y.myRoute`); this fixture
 * only drives the selector tests and the copy-rule test of the drafts.
 * LR-1 (AMENDMENTS-ROUTE-LEARNING-ROUTE section 7.2) renamed the page to
 * "Learning Route"; the four renamed values below follow it.
 */
const quests = (n: number): string => plural('en', n, { one: '1 quest', other: `${n} quests` });

export const DRAFT_EN: MyRouteMessages = {
  learner: {
    title: 'Learning Route',
    hero: {
      start: 'Your Learning Route starts here.',
      goal: 'Your first goal: read every Hangul letter.',
      here: (n, title) => `You are on Stage ${n}: ${title}.`,
      next: (title) => `Next: ${title}`,
      rest: 'You did everything that is open right now. More is coming.',
      beyond: 'You know a lot! More adventures are coming.',
      cta: { start: 'Start', continue: 'Continue' },
      error: 'Hoya could not open your Learning Route.',
    },
    cta: { stories: 'Open stories', library: 'Open Library' },
    // The route card drafts of AMENDMENTS-ROUTE-LEARNING-ROUTE section 11.1 (LR-3b).
    now: { label: 'Now' },
    goal: {
      label: 'Goal',
      stage: (n, title) => `Stage ${n} · ${title}`,
      inGoal: (n, title) => `Stage ${n} · ${title}: you are in your goal stage`,
      explore: (n, title) => `Explore Stage ${n} · ${title}`,
      exploreInGoal: (n, title) => `Explore Stage ${n} · ${title}: you are in your goal stage`,
      tasteLine: 'Try the first quests of this stage.',
      reachedStage: (n, title) => `Stage ${n} · ${title} · reached`,
      keepGoing: (title) => `Keep going: ${title}`,
      reachedHoya: 'You reached your goal. Hoya is proud!',
      endOfRoad: 'You reached the end of the open road. More is coming.',
      from: {
        class: "From your class's weekly plan",
        school: "From your school's weekly plan",
        family: "From your family's weekly plan",
        self: 'From your own weekly plan',
        default: "Hoya's suggestion",
      },
    },
    state: { complete: 'Complete', known: 'You knew this', explored: 'Explored', open: 'Open', taste: 'A taste', later: 'Coming later', notOpen: 'Not open yet' },
    tag: { here: 'You are here', goal: 'Your goal', start: 'You started here' },
    cell: { playing: 'Playing' },
    caption: {
      played: (n) => `${quests(n)} played`,
      ready: 'Ready when you are',
      explored: 'You explored everything that is open right now',
      newJoined: 'New quests joined',
    },
    canDoLead: 'By the end of this stage you can:',
    stage: {
      canDo: {
        1: 'Read any Hangul letter and syllable and know its sound.',
        2: 'Read everyday words and know what they mean.',
        3: 'Read and build short, simple sentences.',
        4: 'Follow a short everyday conversation and pick a reply.', // F-CURR-001 OD-12 (S4-4)
        5: 'Read a short story from start to end.',
        6: 'Read menus, signs and short messages.',
        7: 'Write a few sentences about daily life and favorite things.',
      },
    },
    laterGroup: (from, to) => `Stages ${from} to ${to}`,
    newQuests: (n, stage) => `${plural('en', n, { one: '1 new quest', other: `${n} new quests` })} joined Stage ${stage}.`,
    skills: { title: 'What your quests practice' },
    skill: { read: 'Read', listen: 'Listen', write: 'Write', quests: (n) => `In ${quests(n)} you finished` },
  },
  // F-ENT-003 Appendix A access words the route page reads (LR-5b).
  access: {
    notOpen: 'Not open yet',
    openForYou: 'You played every quest that is open for you.',
    practiceWords: { cta: 'Practice words' },
  },
  grownup: {
    here: (name, n, title) => `${name} is on Stage ${n}: ${title}.`,
    next: (title) => `Next: ${title}`,
    canDoLead: (name) => `By the end of this stage, ${name} can:`,
    started: (name) => `${name} started here.`,
    known: (name) => `${name} already knew this.`,
    quests: (name, n) => `In ${quests(n)} ${name} finished`,
    viewing: (name) => `Viewing ${name}'s Learning Route`,
    tiles: (n) => `Spelling with tiles: ${quests(n)}`,
    start: (name) => `${name}'s Learning Route starts here.`,
    goal: {
      first: 'First goal: read every Hangul letter.',
      inGoal: (name, n, title) => `Stage ${n} · ${title}: ${name} is in the goal stage`,
      exploreInGoal: (name, n, title) => `Explore Stage ${n} · ${title}: ${name} is in the goal stage`,
      reached: (name, n, title) => `${name} reached the goal: Stage ${n} · ${title}.`,
      from: {
        class: "From the class's weekly plan",
        school: "From the school's weekly plan",
        family: "From the family's weekly plan",
        self: (name) => `From ${name}'s own weekly plan`,
        default: "Hoya's suggestion",
      },
    },
    planEnds: (date) => `Plan ends ${date}`,
    goalTag: (name) => `${name}'s goal`,
    endOfRoad: (name) => `${name} reached the end of the open road. More is coming.`,
    error: (name) => `Hoya could not open ${name}'s Learning Route.`,
    rest: (name) => `${name} did everything that is open right now. More is coming.`,
    beyond: (name) => `${name} knows a lot! More adventures are coming.`,
    hereTag: (name) => `${name} is here`,
    // Owner request 2026-10-16 (item 8): a plain fact for a grown-up, no name needed.
    ready: () => 'Not started yet',
    explored: (name) => `${name} explored everything that is open right now`,
    skillsTitle: (name) => `What ${name}'s quests practice`,
  },
  skillsNote:
    'The level check looks at reading and listening. Writing is practiced with tracing games and is not scored. The rows count finished quests that include these games; a game skipped inside a quest still counts.',
  a11y: {
    stage: (order, title, stateWord, here, start, played, goal = false) =>
      [`Stage ${order}, ${title}.`, `${stateWord}.`, here ? 'You are here.' : '', goal ? 'Your goal.' : '', start ? 'You started here.' : '', played > 0 ? `${quests(played)} played.` : '']
        .filter((part) => part !== '')
        .join(' '),
    stageGrownup: (name, order, title, stateWord, here, start, played, goal = false) =>
      [`Stage ${order}, ${title}.`, `${stateWord}.`, here ? `${name} is here.` : '', goal ? `${name}'s goal.` : '', start ? `${name} started here.` : '', played > 0 ? `${quests(played)} played.` : '']
        .filter((part) => part !== '')
        .join(' '),
    routeCard: (hoyaText, nowText, goalText, fromText, planEndsText, pipsText, nextText) =>
      [
        hoyaText,
        ...[nowText, goalText, fromText, planEndsText, pipsText, nextText]
          .filter((part): part is string => part !== null && part !== '')
          .map((part) => `${part.replace(/ · /g, ', ').replace(/[.!]$/, '')}.`),
      ]
        .filter((part): part is string => part !== null && part !== '')
        .join(' '),
    labelled: (label, line) => `${label}: ${line}`,
    goalPips: { none: 'Ready when you are', some: 'Some quests done, more are ready', someDone: 'Some quests done', all: 'Every quest here is done' },
  },
};
