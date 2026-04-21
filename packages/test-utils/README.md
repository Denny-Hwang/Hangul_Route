# @hangul-route/test-utils

모노레포 공용 테스트 헬퍼. vitest / Detox / Playwright 간 재사용할 만한 것을 모은다.

## 범위
- Fixture factory (Episode, Card, User)
- Custom matchers (한글 자모 비교, 로마자 변환 비교)
- React/RN rendering helpers (design-system provider 포함)
- Mock D1 / R2 어댑터

## 사용
```ts
import { createEpisodeFixture } from "@hangul-route/test-utils";
```

실제 export 는 각 패키지에 테스트가 들어갈 때 채워진다.
