import { plural } from '../../plural';

/**
 * The `console` strings the learner PWA reads (AMENDMENTS-START-BUNDLE-2026-11 SB-1): the six subtrees of `console.ts`
 * that a web source of `apps/mobile` reads, at the same paths and with the same values, and nothing else. Only the web
 * twin (`index.web.ts`, Metro's web build) uses this file. Every other console read of the app is in a `.native` screen,
 * which the web build never bundles; the native app, Next and Node read `index.ts` with all of `console.ts`.
 *
 * `console.ts` stays the source (and the review ledger's `enSha` is its hash): change a string there, then copy it
 * here. Two tests hold the copy: `en-web-twin.test.ts` here (every value equals the one in `console.ts`, and nothing
 * else is here) and the app's `start-bundle-content.test.ts` (every `console` path a web source reads is here).
 */
export const consoleApp = {
  /** People on this device: the Remove sheet's button. */
  confirm: {
    remove: 'Remove',
  },
  /** A grown-up home row (`logic/account/homes.ts`). */
  space: {
    learner: {
      lastActive: (when: string) => `Last active ${when}`,
    },
  },
  /** The level-check line of a report (`logic/reports/report-view.ts`). */
  placement: {
    startingSpot: (stage: number, band: string, date: string) => `Starting spot: Stage ${stage} · ${band} · ${date}`,
  },
  /** A grown-up home row (`logic/account/homes.ts`). */
  parentHome: {
    minutes7d: (n: number) => `Minutes, last 7 days: ${n}`,
    lastActive: { notStarted: 'Not started yet' },
  },
  /** The class move consent sheet (the sheet, Approve transfer, Move class). */
  transfer: {
    consent: {
      title: (name: string, destination: string) => `Move ${name} to ${destination}?`,
      language: 'Language',
      who: 'Who is the new class?',
      teacher: (owner: string) => `Teacher: ${owner}`,
      learners: (n: number) => plural('en', n, { one: `${n} learner`, other: `${n} learners` }),
      age: { days: 'Less than a week old', weeks: 'A few weeks old', months: 'A few months old', years: 'More than a year old' },
      visibleClass: (space: string, owner: string) => `${space} (teacher ${owner})`,
      visibleYou: (family: string) => `${family} (you)`,
      visibleFamily: (family: string, owner: string) => `${family} (family, ${owner})`,
      readToEnd: 'Read to the end to continue.',
      updated: 'This text was updated. Please read it again.',
      unavailable: 'Not available in your language yet.',
      yes: (name: string) => `Yes, move ${name}`,
      notNow: { cta: 'Not now' },
      tryAgain: { cta: 'Try again' },
      failed: "Didn't go through",
    },
  },
};
