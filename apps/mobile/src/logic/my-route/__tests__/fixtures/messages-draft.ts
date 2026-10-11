import { plural } from '@hangul-route/i18n';
import type { MyRouteMessages } from '../../copy';

/**
 * The Appendix B draft English strings in the shape the copy selectors read.
 * R-3 puts the final copy in the dictionary (`learner.myRoute`,
 * `caregiver.journey`, `caregiver.skillsNote`, `a11y.myRoute`); this fixture
 * only drives the selector tests and the copy-rule test of the drafts.
 */
const quests = (n: number): string => plural('en', n, { one: '1 quest', other: `${n} quests` });

export const DRAFT_EN: MyRouteMessages = {
  learner: {
    title: 'My route',
    hero: {
      start: 'Your Hangul route starts here.',
      goal: 'Your first goal: read every Hangul letter.',
      here: (n, title) => `You are on Stage ${n}: ${title}.`,
      next: (title) => `Next: ${title}`,
      rest: 'You did everything that is open right now. More is coming.',
      beyond: 'You know a lot! More adventures are coming.',
      cta: { start: 'Start', continue: 'Continue' },
    },
    cta: { stories: 'Open stories', library: 'Open Library' },
    state: { complete: 'Complete', known: 'You knew this', explored: 'Explored', open: 'Open', taste: 'A taste', later: 'Coming later', notOpen: 'Not open yet' },
    tag: { here: 'You are here', start: 'You started here' },
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
        4: 'Follow a short greeting conversation and pick a reply.',
        5: 'Read a short story from start to end.',
        6: 'Read menus, signs and short messages.',
        7: 'Write a few sentences about yourself.',
      },
    },
    laterGroup: (from, to) => `Stages ${from} to ${to}`,
    newQuests: (n, stage) => `${plural('en', n, { one: '1 new quest', other: `${n} new quests` })} joined Stage ${stage}.`,
    skills: { title: 'What your quests practice' },
    skill: { read: 'Read', listen: 'Listen', write: 'Write', quests: (n) => `In ${quests(n)} you finished` },
  },
  grownup: {
    here: (name, n, title) => `${name} is on Stage ${n}: ${title}.`,
    started: (name) => `${name} started here.`,
    known: (name) => `${name} already knew this.`,
    quests: (name, n) => `In ${quests(n)} ${name} finished`,
    viewing: (name) => `Viewing ${name}'s journey`,
    tiles: (n) => `Spelling with tiles: ${quests(n)}`,
    start: (name) => `${name}'s Hangul route starts here.`,
    goal: 'First goal: read every Hangul letter.',
    rest: (name) => `${name} did everything that is open right now. More is coming.`,
    beyond: (name) => `${name} knows a lot! More adventures are coming.`,
    hereTag: (name) => `${name} is here`,
    ready: (name) => `Ready when ${name} is`,
    explored: (name) => `${name} explored everything that is open right now`,
    skillsTitle: (name) => `What ${name}'s quests practice`,
  },
  skillsNote:
    'The level check looks at reading and listening. Writing is practiced with tracing games and is not scored. The rows count finished quests that include these games; a game skipped inside a quest still counts.',
  a11y: {
    stage: (order, title, stateWord, here, start, played) =>
      [`Stage ${order}, ${title}.`, `${stateWord}.`, here ? 'You are here.' : '', start ? 'You started here.' : '', played > 0 ? `${quests(played)} played.` : '']
        .filter((part) => part !== '')
        .join(' '),
    stageGrownup: (name, order, title, stateWord, here, start, played) =>
      [`Stage ${order}, ${title}.`, `${stateWord}.`, here ? `${name} is here.` : '', start ? `${name} started here.` : '', played > 0 ? `${quests(played)} played.` : '']
        .filter((part) => part !== '')
        .join(' '),
  },
};
