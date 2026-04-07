<!-- tags: frontend, design, shadcn, tailwind, animation, research -->
# Frontend Design Research (2026-04-07)

## shadcn/ui 커스터마이징 전략

shadcn은 라이브러리가 아닌 **코드 소유** 구조 — 컴포넌트를 직접 편집하는 것이 의도된 사용법.

### "generic shadcn look" 탈피 핵심 3가지
1. **Primary color + border-radius + font-family** — 이 3가지만 바꿔도 즉시 차별화
2. **컴포넌트 직접 편집** — hover, transition, shadow를 컴포넌트 레벨에서 수정
3. **CSS 변수 시맨틱 토큰** — `components.json`의 `tailwind.cssVariables: true`로 관리

### 도구
- [shadcn.io/theme-generator](https://shadcn.io/theme-generator) — 테마 프리셋 생성
- [Shadcn Studio](https://shadcnstudio.com) — Figma 연동, Motion 변형 포함
- [shadcn-ui-blocks.com](https://shadcn-ui-blocks.com) — 커스터마이즈된 블록 참조

## 오픈소스 프로젝트 디자인 구조

| 프로젝트 | 스택 | 디자인 특징 |
|----------|------|------------|
| **Dub.co** | Next.js + Tailwind | `packages/ui`로 UI 독립 패키지 분리 |
| **Plane** | React + Vite | 수평 탭 패턴, Django 백엔드 |
| **CVAT** | React | 고밀도 정보 UI, 숙련자 대상 |
| **Label Studio** | React + MobX-State-Tree | 독립 NPM 패키지로 embed 가능 |

## 마이크로 인터랙션 원칙

- **duration 150-300ms** (300ms 초과 = 느리게 인식)
- **transform, opacity만** 애니메이션 (width/height → layout thrash)
- **`motion-reduce:` variant** 필수 (접근성, WCAG)
- **2025 표준 스택**: Tailwind + Motion(구 framer-motion, `motion/react`)
- **AutoAnimate**: DOM 변경 자동 애니메이션 (`useAutoAnimate()` 훅)
- **사전 제작 컴포넌트**: Magic UI, Aceternity UI, Cult UI (copy-paste 방식)

## "AI-generated UI" 탈피 원칙

1. **레퍼런스 기반** — 참조할 디자인 제공, 빈 프롬프트 지양
2. **기존 토큰/컴포넌트 재사용** — 빈 sandbox는 generic 결과 유발
3. **타이포그래피가 진위 도장** — 서체 선택이 최종 인상 결정
4. **Composition 다양성** — 균일한 레이아웃이 AI 느낌의 핵심 원인
5. **Constraint-first** — 핵심 제약만 명시, 과적재는 "평균값 해결책" 유도

## Sources
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [shadcn Ecosystem Guide 2025](https://www.devkit.best/blog/mdx/shadcn-ui-ecosystem-complete-guide-2025)
- [Motion library](https://motion.dev)
- [AI UI Curse DEV Community](https://dev.to/a_shokn/how-to-break-the-ai-generated-ui-curse-your-guide-to-authentic-professional-design-2en)
- [Tailwind Animation Utilities](https://tailkits.com/blog/tailwind-animation-utilities/)