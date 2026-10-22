import { GATED_REVIEW_KINDS, pruneReviews, reviewsForReader } from '@hangul-route/content-schema';

/**
 * The minimum-app-version gate of the review kinds an app build from before row CM-3b cannot read
 * (F-CURR-002 section 13, "Older builds and rollbacks after a W→A row ships"; row CM-15 writes `warmup`
 * first). Such a build reads `reviews[]` strictly, so one entry of a newer kind fails its whole copy. A
 * build that reads a gated kind declares it with the capability of the same name (`?cap=warmup`) on its
 * snapshot read and write and on its Rescue Code claim; no app version needs to be sent or compared.
 *
 * - **Served copies** (the GET, a 409, the Rescue Code claim) hold the gated kinds only for a caller that
 *   declares them.
 * - **Writes.** A caller that does not declare a gated kind never saw its entries, so leaving them out says
 *   nothing: the stored entries of that kind are kept (the "review kind added after CM-3b" preserve rule of
 *   section 13). A caller that declares it sends the whole list, which is stored as sent.
 * - **Retention** (`pruneReviews`, section 4.8): the warm-up and Try these again entries are kept for 14 local
 *   days after the newest of their kind, on every write, so an older build that still holds a pruned entry
 *   cannot bring it back.
 *
 * Deployed before any app build that writes a gated kind (Worker first); the app keeps its flags at built-in
 * pct 0 until then.
 */

/** The capabilities an app declares, from `?cap=a,b` or `?cap=a&cap=b` values: trimmed, empty ones left out. */
export function reviewCapsOf(values: readonly string[] | undefined): ReadonlySet<string> {
  return new Set((values ?? []).flatMap((value) => value.split(',')).map((cap) => cap.trim()).filter((cap) => cap.length > 0));
}

type Entry = { id: unknown; kind: unknown; scope: unknown };
type Payload = Record<string, unknown> & { reviews: readonly Entry[] };

const withReviews = (value: unknown): value is Payload =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && Array.isArray((value as { reviews?: unknown }).reviews);

/** A stored snapshot as a caller may receive it: the payload itself when nothing is held back. */
export function servedSnapshot(payload: unknown, caps: ReadonlySet<string>): unknown {
  if (!withReviews(payload)) return payload;
  const reviews = reviewsForReader(payload.reviews, caps);
  return reviews === payload.reviews ? payload : { ...payload, reviews };
}

/** The snapshot a write stores: the stored gated entries a caller that cannot read them left out are kept, then the retention. */
export function writtenSnapshot(sent: unknown, stored: unknown, caps: ReadonlySet<string>): unknown {
  if (!withReviews(sent)) return sent;
  let reviews: readonly Entry[] = sent.reviews;
  const unread = (GATED_REVIEW_KINDS as readonly unknown[]).filter((kind) => !caps.has(kind as string));
  if (unread.length > 0) {
    const sentIds = new Set(reviews.map((r) => r.id));
    const kept = withReviews(stored) ? stored.reviews.filter((r) => unread.includes(r.kind) && !sentIds.has(r.id)) : [];
    if (kept.length > 0) reviews = [...reviews, ...kept];
  }
  reviews = pruneReviews(reviews);
  return reviews === sent.reviews ? sent : { ...sent, reviews };
}
