import { readFileSync } from "node:fs";
import {
  LessonCellSchema,
  ROMANIZATION_EXCEPTIONS,
  checkFrameRomanization,
  checkRomanization,
  discoverItemTexts,
  type LessonQuest,
  type LessonScope,
} from "@hangul-route/content-schema";
import { supportedCardIds } from "@hangul-route/design-system/heritage-card-ids";
import { WORD_ART_KEYS } from "@hangul-route/design-system/word-art";
import { describe, expect, it } from "vitest";
import { resolvePicture } from "../../logic/picture-ref";

/**
 * F-CURR-001 row S3-4, Animal Sentences (`content/episodes/stage-3/nature.json`): the
 * content checks of sections 3.1 and 3.4 for this cell (romanization of the draft cell,
 * U-3 new items, U-4 sentence shape, U-6 reuse, pictures), until the shared checks of
 * upper-stage-curriculum.test.ts land.
 */

const ROOT = new URL("../../../../../", import.meta.url);
const read = (rel: string): unknown =>
  JSON.parse(readFileSync(new URL(rel, ROOT), "utf8"));
const cell = LessonCellSchema.parse(
  read("content/episodes/stage-3/nature.json"),
);
const overlays = (["es", "ko"] as const).map(
  (l) =>
    read(`content/i18n/${l}/lessons-stage3-nature.json`) as {
      entries: Record<string, Record<string, string>>;
    },
);

/** A sentence's words (어절) without sentence marks, and each word without its particle (에, 이, 가). */
const words = (ko: string): string[] =>
  ko
    .replace(/[.?!,]/g, "")
    .split(/\s+/)
    .filter(Boolean);
const PARTICLE = /(에|이|가)$/;
/** Nouns that end in 이 or 가 as part of the word, never a particle. */
const WHOLE = new Set(["고양이", "호랑이"]);
function lemma(word: string): string {
  if (WHOLE.has(word)) return word;
  if (WHOLE.has(word.slice(0, -1))) return word.slice(0, -1);
  return word.replace(PARTICLE, "");
}
const lemmas = (ko: string): string[] => words(ko).map(lemma);

/** Taught before Stage 3 (Stage 1 words, the Stage 2 nature taste, the Stage 2 vocabulary topics). */
const KNOWN = new Set(["나무", "물", "집", "산", "곰", "여우", "하늘", "꽃"]);

const discoverKo = (quest: LessonQuest): string[] =>
  quest.steps.flatMap(
    (s) =>
      s.discover?.pages.flatMap((p) =>
        p.items.flatMap((i) => discoverItemTexts(i).map((t) => t.ko)),
      ) ?? [],
  );

function scopeKo(scope: LessonScope): string[] {
  switch (scope.kind) {
    case "order-it":
      return scope.rounds.flatMap((r) => [
        r.sentence.ko,
        ...r.distractors.map((d) => d.ko),
      ]);
    case "listen-pick":
      return scope.rounds.flatMap((r) => [
        r.prompt.ko,
        ...r.options.flatMap((o) => (o.text ? [o.text.ko] : [])),
      ]);
    default:
      return [];
  }
}

/** Every `{ ko, romanization }` pair in a value. */
function pairs(
  value: unknown,
  out: Array<[string, string]> = [],
): Array<[string, string]> {
  if (Array.isArray(value)) value.forEach((v) => pairs(v, out));
  else if (typeof value === "object" && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o.ko === "string" && typeof o.romanization === "string")
      out.push([o.ko, o.romanization]);
    Object.values(o).forEach((v) => pairs(v, out));
  }
  return out;
}

describe("Animal Sentences (F-CURR-001 S3-4)", () => {
  it("is the nature cell of Stage 3: three quests, no new cards, a draft until both MAR sign-offs", () => {
    expect(cell.id).toBe("episode:stage3-nature");
    expect(cell.titleEn).toBe("Animal Sentences");
    expect(cell.quests.map((q) => q.id)).toEqual([
      "quest:stage3-nature-q1",
      "quest:stage3-nature-q2",
      "quest:stage3-nature-q3",
    ]);
    expect(cell.rewardCardIds).toEqual([]);
    expect(cell.quests.every((q) => q.rewardCardId === undefined)).toBe(true);
    expect(cell.status).toBe("draft");
  });

  it("teaches the section 3.4 sentences: N-e isseoyo, size and look, animal actions", () => {
    const taught = cell.quests.map((q) => discoverKo(q).join(" "));
    expect(taught[0]).toContain("나무에 새가 있어요.");
    expect(taught[0]).toContain("물에 물고기가 있어요.");
    const shown = cell.quests.map((q) =>
      [...discoverKo(q), ...q.scopes.flatMap(scopeKo)].join(" "),
    );
    for (const s of ["호랑이가 커요.", "토끼가 작아요.", "고양이가 귀여워요."])
      expect(shown[1]).toContain(s);
    for (const s of ["새가 날아요.", "토끼가 뛰어요."])
      expect(shown[2]).toContain(s);
  });

  it("every taught Korean string has its Revised Romanization (frames checked piece by piece)", () => {
    const ctx = { exceptions: ROMANIZATION_EXCEPTIONS };
    const issues = pairs(cell.quests).flatMap(([ko, rom]) =>
      (ko.includes("___")
        ? checkFrameRomanization(ko, rom, ctx)
        : checkRomanization(ko, rom, ctx)
      ).map((i) => i.message),
    );
    expect(issues).toEqual([]);
  });

  it("Stage 3 shape: Sentence Builder x 5 (3 order rounds, 2 particle rounds), Listen & Pick x 4, a 2-round Check (heard -> picture, then a reading round)", () => {
    for (const quest of cell.quests) {
      expect(
        quest.scopes.map((s) => s.kind),
        quest.id,
      ).toEqual(["order-it", "listen-pick", "listen-pick"]);
      const [play, apply, check] = quest.scopes;
      if (
        play?.kind !== "order-it" ||
        apply?.kind !== "listen-pick" ||
        check?.kind !== "listen-pick"
      )
        throw new Error(quest.id);
      expect(
        play.rounds.filter((r) => r.particle === undefined).length,
        quest.id,
      ).toBe(3);
      for (const r of play.rounds) {
        if (r.particle)
          expect(
            r.distractors,
            `${quest.id} ${r.id}: a particle round carries no distractors`,
          ).toEqual([]);
        else expect(r.distractors.length, `${quest.id} ${r.id}`).toBe(1);
      }
      expect(
        apply.rounds.every((r) =>
          r.options.every(
            (o) => o.pictureRef !== undefined && o.labelEn !== undefined,
          ),
        ),
      ).toBe(true);
      expect(
        check.rounds[0]?.options.every((o) => o.pictureRef !== undefined),
      ).toBe(true);
      expect(
        check.rounds[1]?.options.every(
          (o) => o.text !== undefined && o.pictureRef === undefined,
        ),
      ).toBe(true);
    }
  });

  it("every sentence is polite 해요체 and ends with its sentence mark", () => {
    const sentences = cell.quests.flatMap((q) => [
      ...discoverKo(q),
      ...q.scopes.flatMap((s) =>
        s.kind === "order-it" ? s.rounds.map((r) => r.sentence.ko) : scopeKo(s),
      ),
    ]);
    for (const s of sentences) expect(s, s).toMatch(/요\.$/);
  });

  it("every picture resolves to art (no text fallback)", () => {
    const ctx = { supportedCardIds, swatches: {}, wordArtKeys: WORD_ART_KEYS };
    const refs =
      JSON.stringify(cell.quests).match(
        /"(?:pictureRef|picture)":"([^"]+)"/g,
      ) ?? [];
    expect(refs.length).toBeGreaterThan(0);
    for (const m of refs) {
      const ref = m.split('":"')[1]!.slice(0, -1);
      expect(resolvePicture(ref, ctx).kind, ref).not.toBe("text");
    }
  });

  it("rule 4: every word a quest asks was shown in its Discover, an earlier quest of the cell, or before Stage 3", () => {
    const taught = new Set(KNOWN);
    for (const quest of cell.quests) {
      for (const ko of discoverKo(quest))
        for (const w of lemmas(ko)) taught.add(w);
      for (const scope of quest.scopes)
        for (const ko of scopeKo(scope))
          for (const w of lemmas(ko))
            expect(taught.has(w), `${scope.ref}: ${w} in ${ko}`).toBe(true);
    }
  });

  it("U-3: at most 4 new words per quest (the pattern itself counts apart)", () => {
    const seen = new Set(KNOWN);
    for (const quest of cell.quests) {
      const pattern = new Set(
        quest.steps.flatMap(
          (s) =>
            s.discover?.pages.flatMap((p) =>
              p.items.flatMap((i) =>
                i.type === "pattern"
                  ? lemmas(i.frame.ko.replace(/___\S*/, ""))
                  : [],
              ),
            ) ?? [],
        ),
      );
      expect(pattern.size, `${quest.id}: one pattern`).toBe(1);
      const fresh = [...new Set(discoverKo(quest).flatMap(lemmas))].filter(
        (w) => !seen.has(w) && !pattern.has(w),
      );
      for (const w of pattern) seen.add(w);
      expect(
        fresh.length,
        `${quest.id}: ${fresh.join(", ")}`,
      ).toBeLessThanOrEqual(4);
      for (const w of fresh) seen.add(w);
    }
  });

  it("U-6: at least half the Korean words outside Discover were taught before the quest", () => {
    const before = new Set(KNOWN);
    for (const quest of cell.quests) {
      const shown = new Set(
        quest.scopes.flatMap((s) => scopeKo(s).flatMap(lemmas)),
      );
      const reused = [...shown].filter((w) => before.has(w));
      expect(
        reused.length * 2,
        `${quest.id}: ${reused.length} of ${shown.size}`,
      ).toBeGreaterThanOrEqual(shown.size);
      for (const w of discoverKo(quest).flatMap(lemmas)) before.add(w);
    }
  });

  it("notes: each language note has two or more sources, one a Korean public institution, and its pass-2 record", () => {
    expect(cell.culture.map((n) => n.id)).toEqual(["n1", "n2", "n3"]);
    for (const note of cell.culture) {
      expect(note.kind).toBe("language");
      expect(note.sources?.length ?? 0, note.id).toBeGreaterThanOrEqual(2);
      expect(note.verification.scope).toBe("lesson");
      expect(note.verification.notes, note.id).toMatch(/^pass 2 /);
    }
  });

  it("the es and ko overlays cover every entity of the cell, and no Korean gloss repeats the Korean it explains", () => {
    const ids = [
      cell.id,
      ...cell.quests.map((q) => q.id),
      ...cell.quests.flatMap((q) => q.scopes.map((s) => s.ref)),
    ].sort();
    const taught = new Set(
      pairs(cell.quests).map(([ko]) => ko.replace(/[.?!]$/, "")),
    );
    for (const overlay of overlays) {
      expect(Object.keys(overlay.entries).sort()).toEqual(ids);
    }
    for (const value of Object.values(overlays[1]!.entries).flatMap((e) =>
      Object.values(e),
    )) {
      expect(taught.has(value.replace(/[.?!]$/, "")), value).toBe(false);
    }
  });
});
