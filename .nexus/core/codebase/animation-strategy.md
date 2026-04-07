<!-- tags: animation, motion, framer-motion, tailwind, transition -->
# Animation Strategy

## 현재 접근: Tailwind/CSS Only
- Dialog/Alert: `duration-180` (150-200ms 범위)
- Tab 전환: CSS fade-in (opacity 0→1, 150ms)
- 헤더: 스크롤 시 backdrop-blur + shadow 강화
- 마이크로 인터랙션: transform, opacity만 사용 (layout thrash 방지)
- `motion-reduce:` variant 적용 (접근성)

## 향후 도입 검토: Motion (구 framer-motion)
- 라이브러리: `motion/react` (import 경로 변경됨)
- GitHub: `motiondivision/motion`
- 번들 크기: ~20KB
- 도입 시점: 라벨링 페이지 등 복잡한 진입/퇴장 애니메이션 필요 시
- 핵심 기능: AnimatePresence (exit animation), layout animation, gesture
- 대안: AutoAnimate (`useAutoAnimate()` 훅 — DOM 변경 자동 애니메이션, 설정 0)

## 원칙
- duration: 150-300ms (300ms 초과 = 느리게 인식)
- transform, opacity만 애니메이션 (width/height 금지)
- ease-out: 진입용, ease-in: 퇴장용
- `motion-reduce:` / `motion-safe:` Tailwind variant 필수 (WCAG)