import { z } from 'zod';

/**
 * Locale overlays for content (F-I18N-001 §3.6). English content (`*En` fields, and
 * the JSON `title` / `blurb` / `en` fields) stays the source of truth; Spanish and
 * Korean live beside it in `content/i18n/<locale>/<domain>.json`, keyed by entity id,
 * partial, with English fallback. `scripts/build-overlays.mjs` merges the files into
 * `../i18n-overlays.generated.ts` (`OVERLAYS`); `../localize.ts` applies them.
 *
 * Taught Korean and its romanization come only from the base content, so an overlay
 * can never set `ko`, `romanization`, `target`, `char`, `audioRef`, ids or order:
 * only the fields of `OVERLAY_FIELDS` for the id prefix are allowed.
 */

/** Locales that have overlays. English is the source and never has one (`content/i18n/en/` is an error). */
export const OVERLAY_LOCALES = ['es', 'ko'] as const;
export const OverlayLocaleSchema = z.enum(OVERLAY_LOCALES);
export type OverlayLocale = z.infer<typeof OverlayLocaleSchema>;

/** Entity id: `<prefix>:<rest>` (`card:gangaji`, `vocab-topic:food`, `story:sun-and-moon`). */
export const OVERLAY_ENTITY_ID = /^[a-z0-9-]+:[a-z0-9-:.]+$/;

/**
 * The allow-list per id prefix: translatable field names with the `En` suffix
 * stripped, or dotted paths inside the entity where `<name>` stands for the id of an
 * array element (its `id`, else `key`, else its romanization as a slug, else its index;
 * see `overlayElementKey`). A path that ends on an element (`checks.<id>.options.<id>`)
 * translates that element's `en`.
 *
 * `scripts/overlay-fields.mjs` holds the same table for the plain-Node validator;
 * `__tests__/locale-overlay-mirror.test.ts` keeps the two equal. Rows `story:`
 * (F-STORY-001 §3.12), `vocab:` / `vocab-topic:` (F-VOC-001 §3.7) and `pitem:`
 * (F-PLC-001 §3.4) are those specs' additions.
 */
export const OVERLAY_FIELDS = {
  jamo: ['gloss', 'soundHint', 'exampleWord.gloss', 'nameHint'],
  card: ['title', 'blurb', 'fact'],
  episode: ['title', 'subtitle', 'hoyaIntro'],
  quest: [
    'title',
    'blurb',
    'teaser',
    'steps.<stepId>.title',
    'steps.<stepId>.body',
    'steps.<stepId>.hoyaLine',
    'steps.<stepId>.discover.pages.<page>.caption',
    'steps.<stepId>.discover.pages.<page>.items.<item>.example.gloss',
    'steps.<stepId>.discover.pages.<page>.items.<item>.word.gloss',
    'steps.<stepId>.discover.pages.<page>.items.<item>.note',
    // F-CURR-001 §3.10: the upper-stage Discover items (sentence, pattern, exchange, realia).
    'steps.<stepId>.discover.pages.<page>.items.<item>.sentence.gloss',
    'steps.<stepId>.discover.pages.<page>.items.<item>.frame.gloss',
    'steps.<stepId>.discover.pages.<page>.items.<item>.examples.<example>.gloss',
    'steps.<stepId>.discover.pages.<page>.items.<item>.lines.<line>.speaker',
    'steps.<stepId>.discover.pages.<page>.items.<item>.lines.<line>.line.gloss',
    'steps.<stepId>.discover.pages.<page>.items.<item>.keyWords.<word>.gloss',
    'steps.<stepId>.discover.pages.<page>.items.<item>.caption',
  ],
  minigame: [
    'cardPairs.<pair>.gloss',
    'storySteps.<stepId>.label',
    'dialogue.<turn>.npc',
    'dialogue.<turn>.options.<option>.gloss',
    'listenPick.rounds.<roundId>.prompt',
    // F-CURR-001 §3.10: the lesson scopes of the upper-stage games (build-lessons.mjs runtime shape).
    'orderIt.rounds.<roundId>.sentence.gloss',
    'realiaRead.realia.alt',
    'realiaRead.realia.title.gloss',
    'realiaRead.realia.entries.<entry>.text.gloss',
    'realiaRead.realia.entries.<entry>.value.gloss',
    'realiaRead.rounds.<roundId>.question',
    'realiaRead.rounds.<roundId>.options.<option>.text.gloss',
    'typeHangul.rounds.<roundId>.prompt',
    'typeHangul.rounds.<roundId>.target.gloss',
    'traceWord.rounds.<roundId>.word.gloss',
    'writeFrame.rounds.<roundId>.frame.gloss',
    'writeFrame.rounds.<roundId>.slots.<slot>.bank.<word>.gloss',
  ],
  stage: ['title', 'oneLiner', 'anchorSkill'],
  theme: ['title', 'oneLiner', 'anchorSkill'],
  story: [
    'title',
    'summary',
    'hoyaIntro',
    'hoyaOutro',
    'scenes.<sceneId>.narration',
    'scenes.<sceneId>.caption',
    'scenes.<sceneId>.alt',
    'keywords.<keywordId>.gloss',
    'checks.<checkId>.prompt',
    'checks.<checkId>.explain',
    'checks.<checkId>.hint',
    'checks.<checkId>.options.<optionId>',
    'cultureNotes.<noteId>.title',
    'cultureNotes.<noteId>.body',
    'facts.<factId>.claim',
    'errata.<erratumId>.summary',
  ],
  vocab: ['gloss', 'senseNote'],
  'vocab-topic': ['title', 'blurb', 'hoyaIntro'],
  pitem: ['gloss', 'options.<optionId>.gloss'],
} as const satisfies Record<string, readonly string[]>;
export type OverlayPrefix = keyof typeof OVERLAY_FIELDS;

/** Never overridable, whatever the prefix (taught Korean, its romanization, audio, ids, order, pictures). */
export const NEVER_OVERRIDABLE_FIELDS = [
  'ko',
  'char',
  'romanization',
  'target',
  'answer_ko',
  'lang_ko',
  'audioRef',
  'id',
  'order',
  'sound',
  'pictureRef',
  'visual',
] as const;

/** The id prefix: everything before the first colon (`''` when there is none). */
export function overlayPrefix(entityId: string): string {
  const at = entityId.indexOf(':');
  return at <= 0 ? '' : entityId.slice(0, at);
}

const ELEMENT_ID = '[a-z0-9-]+';
const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PATTERNS: Record<string, readonly RegExp[]> = Object.fromEntries(
  Object.entries(OVERLAY_FIELDS).map(([prefix, fields]) => [
    prefix,
    fields.map(
      (field) =>
        new RegExp(
          `^${field
            .split('.')
            .map((seg) => (seg.startsWith('<') ? ELEMENT_ID : escape(seg)))
            .join('\\.')}$`,
        ),
    ),
  ]),
);

/** Whether `field` may be translated on `entityId` (its prefix has a row and one pattern matches). */
export function isOverlayFieldAllowed(entityId: string, field: string): boolean {
  if (!OVERLAY_ENTITY_ID.test(entityId)) return false;
  const patterns = PATTERNS[overlayPrefix(entityId)];
  return patterns !== undefined && patterns.some((re) => re.test(field));
}

export const OverlayEntityIdSchema = z.string().regex(OVERLAY_ENTITY_ID);
/** One entity's translated fields: field key -> non-blank text. */
export const EntityOverlaySchema = z.record(z.string().min(1), z.string().trim().min(1));
export type EntityOverlay = Readonly<Record<string, string>>;
/** What the generator emits: locale -> entity id -> fields. */
export type Overlays = Readonly<Record<OverlayLocale, Readonly<Record<string, EntityOverlay>>>>;

/** `content/i18n/<locale>/<domain>.json` (the validator also checks locale = directory and domain = file name). */
export const LocaleOverlayFileSchema = z
  .object({
    locale: OverlayLocaleSchema,
    domain: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    entries: z.record(OverlayEntityIdSchema, EntityOverlaySchema),
  })
  .strict()
  .superRefine((file, ctx) => {
    for (const [id, fields] of Object.entries(file.entries)) {
      for (const field of Object.keys(fields)) {
        if (!isOverlayFieldAllowed(id, field)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['entries', id, field],
            message: `overlay-forbidden-field: ${field} cannot be translated on ${id}`,
          });
        }
      }
    }
  });
export type LocaleOverlayFile = z.infer<typeof LocaleOverlayFileSchema>;
