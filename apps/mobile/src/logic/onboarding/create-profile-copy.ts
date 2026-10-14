import type { LearnerType } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

/**
 * Choices between the CreateProfile form's dictionary lines — F-LEARN-001
 * §3.2, §3.15. The words live in `packages/i18n` (`learner.createProfile`);
 * these helpers only pick the right one, so the choice is tested without a
 * renderer. Nothing names an age or says "for kids" (CLAUDE.md §1).
 */
export type CreateProfileWords = Messages['learner']['createProfile'];

/** The "Ready to go!" line: the backup sentence only on a build that backs up (`syncApi()` not null). */
export function readyLine(words: CreateProfileWords, cloudSavingOn: boolean): string {
  return cloudSavingOn ? words.ready.line : words.ready.lineDeviceOnly;
}

export type WhoCopy = CreateProfileWords['profile']['self'];

/** Wording of the profile step: first person for "Me", third for someone looked after. */
export function whoCopy(words: CreateProfileWords, learnerType: LearnerType): WhoCopy {
  return learnerType === 'self' ? words.profile.self : words.profile.child;
}

/** The line under "Who is learning?": it names the level check only on a build that offers it (F-PLC-001 §3.10). */
export function lessonsLine(words: CreateProfileWords, levelCheckOn: boolean): string {
  return levelCheckOn ? words.lessons.withCheck : words.lessons.plain;
}
