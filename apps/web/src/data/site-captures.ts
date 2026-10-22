/**
 * Product captures on the site (AMENDMENTS-SITE-NEWUSER §3.13, row SN-1): real screens of the learner app and the
 * console, per UI locale, because they hold UI text. The files are `public/site/<locale>/<name>.<hash8>.webp`, made on
 * demand by `scripts/site-captures.mjs` (never in CI or a build), which also writes `site-captures.generated.ts`.
 *
 * Captures follow claims: a page renders a capture only when `showsClaim` is true for every claim its feature needs
 * (`CAPTURE_CLAIMS`), so `CLAIM_LOCALES` and a rollback (LV-D1) apply to pictures as they do to lines, and no capture
 * shows a feature whose claim is off. The Learning Route (`learningRoute`) and the level check's starting spot stay
 * outside every crop while their claims are off; a claim-flip PR may add a capture of its feature with that claim
 * listed here (F-SITE-002 §3.9).
 */
import type { UiLocale } from '@hangul-route/i18n';
import { showsClaim, type BooleanClaimKey, type SiteClaims } from './site-claims';
import { SITE_CAPTURE_FILES } from './site-captures.generated';

/** Every capture the site uses, in the order of spec §3.13. */
export const CAPTURE_NAMES = ['discover', 'discover-narrow', 'home', 'game', 'card', 'report', 'class-list', 'class-list-narrow', 'lecture-slide'] as const;
export type CaptureName = (typeof CAPTURE_NAMES)[number];

/** One published file: its path on the site and its pixel size. */
export interface CaptureFile {
  src: string;
  width: number;
  height: number;
}

export type CaptureManifest = Partial<Record<UiLocale, Partial<Record<CaptureName, CaptureFile>>>>;

/**
 * The claims of every feature a capture shows. `report` is a parent's weekly report; the class page shows its "This
 * week" summary and the Class report, the class statistics `teacherReports` covers; the slide is Lecture mode. The
 * learner screens (Discover, Home without the Learning Route link, a mini-game, a card) need no claim.
 */
export const CAPTURE_CLAIMS: Readonly<Record<CaptureName, readonly BooleanClaimKey[]>> = Object.freeze({
  discover: [],
  'discover-narrow': [],
  home: [],
  game: [],
  card: [],
  report: ['parentReports'],
  'class-list': ['teacherReports'],
  'class-list-narrow': ['teacherReports'],
  'lecture-slide': ['lectureMode'],
});

/** Which captures each page references (both sources of a `<picture>`), for the image budgets of §3.11. */
export const PAGE_CAPTURES = {
  '/': ['discover', 'discover-narrow'],
  '/learners': ['home', 'game', 'card'],
  '/parents': ['report'],
  '/teachers': ['class-list', 'class-list-narrow', 'lecture-slide'],
} as const satisfies Record<string, readonly CaptureName[]>;

/** The page image budgets of §3.11 in bytes (one locale, every `<picture>` source counted). */
export const PAGE_CAPTURE_BUDGET_BYTES: Readonly<Record<keyof typeof PAGE_CAPTURES, number>> = Object.freeze({
  '/': 40 * 1024,
  '/learners': 70 * 1024,
  '/parents': 60 * 1024,
  '/teachers': 80 * 1024,
});

/** True when the page may render `name` in `locale`: every claim of its feature shows there. */
export function showsCapture(claims: Readonly<SiteClaims>, name: CaptureName, locale: UiLocale): boolean {
  return CAPTURE_CLAIMS[name].every((key) => showsClaim(claims, key, locale));
}

/**
 * The file of `name` in `locale`, or `null` when there is none (a locale without captures renders the page without
 * them, never another locale's screen, since a capture holds UI text).
 */
export function captureFile(locale: UiLocale, name: CaptureName, manifest: CaptureManifest = SITE_CAPTURE_FILES): CaptureFile | null {
  return manifest[locale]?.[name] ?? null;
}
