'use client';

import { Fragment } from 'react';
import type { ConsoleWord, StudentWords } from '@/lib/console/vocab-words';
import { useConsoleLocale } from '@/lib/i18n/locale-context';
import { aroundSlot } from '@/lib/i18n/slot';

/**
 * The word lines of the console roster (F-VOC-005 P-4, section 3.8, behaviour 14; wireframe
 * `design/wireframes/console/roster.md` "Words lines"): a student card reads
 * "Words: N collected · M strong" and, when the learner's device sent any,
 * "Words to revisit: <Hangul> sagwa (apple) · <Hangul> nun (eye)"; the week reads the class's words to
 * revisit together. Plain text in the card's existing type, no chart, no rate, no ranking. The
 * Hangul stays outside the message and is marked `lang="ko"`; its romanization and its gloss in
 * the UI language travel with it (CLAUDE.md section 1). Every other word comes from the dictionary.
 */

/**
 * The Hangul and its romanization are kept on one line, so the romanization never wraps away from
 * the word it reads. The gloss is not: real glosses run to 40-plus characters ("tteokbokki
 * (pasteles de arroz picantes)"), which kept unbreakable would overflow a 280 px card.
 */
const KEEP_TOGETHER = { whiteSpace: 'nowrap' } as const;
/** A line breaks inside one long word rather than overflow its card. */
export const LINE_STYLE = { overflowWrap: 'anywhere' } as const;

function Word({ word }: { word: ConsoleWord }): JSX.Element {
  const { messages: m } = useConsoleLocale();
  if (word.ko === null || word.gloss === null) return <span>{word.romanization}</span>;
  const gloss = word.gloss;
  // One message ("sagwa (apple)") split around the romanization, so a translation keeps its order.
  const around = aroundSlot((romanization) => m.console.space.wordGloss(romanization, gloss));
  return (
    <span>
      <span style={KEEP_TOGETHER}>
        <span lang="ko">{word.ko}</span> {around.before}
        {word.romanization}
      </span>
      {around.after}
    </span>
  );
}

/** Words joined by " · ", as the jamo lists of the same page. */
function WordList({ words }: { words: readonly ConsoleWord[] }): JSX.Element {
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={word.id}>
          {i > 0 ? ' · ' : null}
          <Word word={word} />
        </Fragment>
      ))}
    </>
  );
}

/** A roster card's word lines; nothing when the roster carries no `summary.vocab`. */
export function StudentWordsLines({ words }: { words: StudentWords | null }): JSX.Element | null {
  const { messages: m } = useConsoleLocale();
  if (!words) return null;
  const s = m.console.space.learner;
  const revisit = aroundSlot(s.wordsRevisit);
  return (
    <>
      <div data-testid="student-words" style={LINE_STYLE}>
        {s.words(words.collected, words.strong)}
      </div>
      {words.revisit.length ? (
        <div data-testid="student-words-revisit" style={LINE_STYLE}>
          {revisit.before}
          <WordList words={words.revisit} />
          {revisit.after}
        </div>
      ) : null}
    </>
  );
}

/** The week's line: the up-to-three words most often on the students' lists, never who has them. */
export function WeekWordsRevisit({ words }: { words: readonly ConsoleWord[] }): JSX.Element | null {
  const { messages: m } = useConsoleLocale();
  if (!words.length) return null;
  const line = aroundSlot(m.console.space.week.wordsRevisit);
  return (
    <li data-testid="week-words-revisit" style={LINE_STYLE}>
      {line.before}
      <WordList words={words} />
      {line.after}
    </li>
  );
}
