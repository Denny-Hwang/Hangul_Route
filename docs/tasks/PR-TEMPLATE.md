# Task → PR Template

태스크를 PR 로 전환할 때 사용. `.github/pull_request_template.md` 가 실제 PR 에 자동 삽입되는 템플릿이며, 이 파일은 태스크 메모 → PR 본문 변환용 참조.

```md
## Summary
- 무엇이 바뀌는가 (1–3 bullet)

## Related
- Task: T-XXX
- Spec: docs/specs/F-XXX-<slug>.md
- Design (optional): design/screens/... or design/components/...

## Tests
- [ ] Unit
- [ ] Integration
- [ ] E2E (if applicable)
- Coverage delta: +X.Y%

## Screenshots (UI only)
(before / after)

## Checklist
- [ ] 스펙 링크 있음 (F-XXX)
- [ ] 테스트 추가됨
- [ ] 디자인 토큰만 사용
- [ ] 언어 정책 준수 (UI=English, Korean=content only)
- [ ] 커버리지 목표 달성
```
