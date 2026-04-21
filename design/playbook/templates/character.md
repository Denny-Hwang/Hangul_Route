# Template — Character Prompt

호야 포즈 · 조연 캐릭터 시안 요청 시 베이스.

```prompt
Design [CHARACTER NAME — e.g. "Hoya"] — [VERSION e.g. "v2 with 10 expressions"].

Who they are:
- [ROLE — e.g. "guide character of Hangul Route"]
- Personality: [2–3 keywords]
- Age energy: [e.g. "7-year-old"]

Shared visual language (do not deviate):
- 3.5-head proportion (NOT Korean 2.0-head; think Pixar cartoon).
- Stroke / corner radius matching design/icons/spec.md.
- Palette drawn from design/tokens/colors.v1.md (no hardcoded hex).
- Stripes / motifs live on clothing only, never on face.
- Silhouette must be readable at 64×64 thumbnail.

Deliver:
- [N] poses/expressions, each 512×512 transparent PNG.
- Updated spec.md (personality / proportions / color rules / pose library /
  hard NOs).

Pose / expression list:
1. ...
2. ...

Anti-patterns to avoid:
- Shaming / angry expressions directed at the child.
- Cultural mascot clichés (hanbok unless content-side, not guide-side).
- Over-exaggeration (tone down 50% from first pass).

[ATTACH palette and any previous version PNG for continuity.]
```

## 사용 팁
- 첫 번째 프롬프트에서는 2-3 포즈만. 한 번에 10 포즈 요청하면 일관성 깨짐.
- "keep head/body ratio identical, only change limbs" 를 후속 요청에 꼭 포함.
