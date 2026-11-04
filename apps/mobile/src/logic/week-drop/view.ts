import type { UiLocale } from '@hangul-route/content-schema';
import type { WeekDropEntry, WeekNotePart, WeekText } from '@hangul-route/content-schema/week-drops';
import type { Messages } from '@hangul-route/i18n';
import { cardCitationView, type CardCitationView } from '../library/card-citation';

/*
 * A drop as its card and pages draw it in the UI language (F-CURR-002 §5.7, row CM-48;
 * design/wireframes/home/this-week-in-korea.md A and B). Pure. Each text falls back to the English where the drop has no
 * es or ko text (the build holds every drop to both, so that is only a safety net). Taught Korean and its romanization
 * never change; the source line is the card back's citation (never a URL).
 */

export interface WeekDropView {
  id: string;
  week: string;
  title: string;
  minutes: number;
  /** The drop's first word, which names its moment (the term or holiday), drawn on the card. */
  lead: { ko: string; romanization: string };
  note: readonly WeekNotePart[];
  citation: CardCitationView | null;
  words: readonly { id: string; ko: string; romanization: string; meaning: string }[];
}

const pick = <T,>(text: WeekText<T>, locale: UiLocale): T => (locale === 'en' ? text.en : (text[locale] ?? text.en));

export function weekDropView(drop: WeekDropEntry, locale: UiLocale, citation: Messages['learner']['cardDetail']['citation']): WeekDropView {
  const first = drop.items[0];
  return {
    id: drop.id,
    week: drop.weekOf,
    title: pick(drop.title, locale),
    minutes: drop.minutes,
    lead: { ko: first?.ko ?? '', romanization: first?.romanization ?? '' },
    note: pick(drop.note, locale),
    citation: cardCitationView({ citation: { publisher: drop.source.publisher, title: drop.source.title, more: drop.source.more } }, citation),
    words: drop.items.map((item) => ({ id: item.id, ko: item.ko, romanization: item.romanization, meaning: pick(item.gloss, locale) })),
  };
}
