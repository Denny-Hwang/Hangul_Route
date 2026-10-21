// Test support for the build-lessons.mjs and check-added-in.mjs self-tests: a valid lesson cell
// (F-CURR-001 §3.10) with three quests, each of the six steps and three scopes the shaper needs.

export const kt = (ko, romanization, en, extra = {}) => ({ ko, romanization, en, ...extra });
export const lp = (id) => ({ id, prompt: kt("연", "yeon", "kite"), options: [{ id: "a", pictureRef: "word:kite" }, { id: "b", pictureRef: "word:ball" }], answerId: "a" });

export function quest(stage, theme, k, seconds = [7, 50, 80, 70, 35, 8]) {
  const n = stage.slice(5);
  const ref = (step) => `minigame:s${n}-${theme}-q${k}-${step}`;
  const kinds = ["intro", "discover", "practice", "apply", "check", "reward"];
  return {
    id: `quest:${stage}-${theme}-q${k}`,
    titleEn: `Quest ${k}`,
    estimatedMinutes: 4,
    steps: kinds.map((kind, i) => ({
      id: `s${i + 1}`,
      kind,
      titleEn: kind,
      durationSeconds: seconds[i],
      ...(kind === "practice" ? { minigameKind: "card-match", minigameRef: ref("practice") } : {}),
      ...(kind === "apply" ? { minigameKind: "build-letter", minigameRef: ref("apply") } : {}),
      ...(kind === "check" ? { minigameKind: "listen-pick", minigameRef: ref("check") } : {}),
    })),
    scopes: [
      { ref: ref("practice"), kind: "card-match", pairs: [kt("연", "yeon", "kite"), kt("공", "gong", "ball")] },
      { ref: ref("apply"), kind: "build-letter", words: [kt("설날", "seollal", "Lunar New Year", { syllables: ["seol", "lal"] }), kt("연", "yeon", "kite")] },
      { ref: ref("check"), kind: "listen-pick", rounds: [lp("c1"), lp("c2")] },
    ],
  };
}
export function cell(stage, theme, status = "ready", extra = {}) {
  return {
    id: `episode:${stage}-${theme}`,
    stage,
    theme,
    status,
    titleEn: "Holiday Words",
    subtitleEn: "Words of the holidays",
    hoyaIntroEn: "Let us read holiday words!",
    order: 3,
    pillarTags: ["B5"],
    quests: [1, 2, 3].map((k) => quest(stage, theme, k)),
    culture: [{ id: "n1", kind: "culture", textEn: "A note.", sources: [{ title: "t", publisher: "p", url: "https://stdict.korean.go.kr/", accessed: "2026-10-01", quoteOrLocator: "q" }], verification: { passes: 3, checkedAt: "2026-10-01", scope: "lesson", notes: "x" } }],
    review: { language: "native-reviewed", culture: "culture-reviewed", reviewedBy: "MAR", reviewedAt: "2026-10-01" },
    contentVer: 1,
    ...extra,
  };
}
