# E2E 테스트 시나리오

## 개요

Playwright MCP를 사용하여 브라우저 기반 E2E 테스트를 수행한다.
각 시나리오는 순차적으로 실행되며, 이전 시나리오의 데이터를 활용한다.

## 사전 조건

- Docker 인프라 실행 중 (PostgreSQL + Redis)
- Backend 서버 실행 중 (`uvicorn app.main:app --port 8100`)
- Frontend 개발 서버 실행 중 (`npm run dev` → `http://localhost:5273`)
- Playwright MCP 브라우저 사용 가능

## 테스트 도구 참고

```
# Playwright MCP 주요 도구
browser_navigate(url)          — URL 이동
browser_snapshot()             — 페이지 접근성 트리 캡처
browser_click(ref)             — 요소 클릭
browser_fill_form(fields)      — 폼 입력
browser_type(ref, text)        — 텍스트 입력
browser_press_key(key)         — 키 입력
browser_file_upload(paths)     — 파일 업로드 (프로젝트 디렉토리 내 파일만)
browser_take_screenshot(type)  — 스크린샷
browser_console_messages(level)— 콘솔 메시지 확인
browser_network_requests()     — 네트워크 요청 확인
browser_run_code(code)         — Playwright 코드 직접 실행
browser_wait_for(time/text)    — 대기
```

## 시나리오 목록

### S01: 회원가입 + 로그인

**경로**: `/register` → `/login` → `/`

1. `browser_navigate('http://localhost:5273/register')`
2. 이름/이메일/비밀번호 입력 (비밀번호: 대소문자+숫자+특수문자 8자+)
3. "회원가입" 클릭 → `/login`으로 이동 확인
4. 이메일/비밀번호 입력 → "로그인" 클릭
5. **검증**: `/` 또는 `/projects` 페이지 도착, 헤더에 사용자 이름 표시

### S02: 프로젝트 생성

**경로**: `/projects`

1. "새 프로젝트" 버튼 클릭 → 다이얼로그 열림
2. 이름/설명 입력 → "만들기" 클릭
3. **검증**: 프로젝트 카드 목록에 새 프로젝트 표시, 다이얼로그 자동 닫힘
4. **검증**: 최신 프로젝트가 목록 상단에 위치

### S03: 프로젝트 상세 진입

**경로**: `/projects` → `/projects/:id`

1. 프로젝트 카드 클릭
2. **검증**: ProjectDetailPage 표시, "Data Pool" / "Tasks" 탭 존재
3. **검증**: Data Pool 탭에 "Default Pool" DataStore 자동 생성됨

### S04: 이미지 업로드

**경로**: `/projects/:id` (Data Pool 탭)

**사전 준비**: 테스트 이미지 생성
```python
# backend venv에서 실행 (Pillow 필요)
from PIL import Image, ImageDraw
import os
os.makedirs('/tmp/test-images', exist_ok=True)
colors = [(80, 100, 200), (160, 100, 200), (240, 100, 200)]
for i, c in enumerate(colors, 1):
    img = Image.new('RGB', (640, 480), c)
    d = ImageDraw.Draw(img)
    d.text((200, 200), f'Test Image {i}', fill='white')
    img.save(f'/tmp/test-images/test_{i}.jpg')
```

**주의**: Playwright 파일 업로드는 프로젝트 디렉토리 내 파일만 허용.
```bash
cp /tmp/test-images/*.jpg /path/to/vision-flow/
```

1. "파일" 업로드 버튼 클릭 → 파일 선택기 열림
2. `browser_file_upload([파일 경로들])`
3. **검증**: 이미지 그리드에 업로드된 이미지 표시, 개수 카운트 정확
4. **검증**: 폴더 트리에 이미지 수 반영

### S05: 폴더 생성

**경로**: `/projects/:id` (Data Pool 탭)

1. "새 폴더" 버튼 클릭
2. 폴더 이름 입력 (인라인 편집 모드) → Enter
3. **검증**: 폴더 카드 표시, 트리에 반영

### S06: 태스크 생성

**경로**: `/projects/:id` (Tasks 탭)

1. "Tasks" 탭 클릭
2. "새 태스크" 버튼 클릭 → 다이얼로그 열림
3. 이름/설명 입력
4. Task 유형 콤보박스에서 "객체 탐지" (object_detection) 선택
5. "만들기" 클릭
6. **검증**: 태스크 카드 표시 (이름, 유형 뱃지, 진행률 0%)
7. **콘솔 체크**: `browser_console_messages('error')` — button 중첩 에러 없어야 함

### S07: 태스크 상세 진입

**경로**: `/projects/:id` → `/projects/:id/tasks/:taskId`

1. 태스크 카드 클릭
2. **검증**: TaskDetailPage 표시 (이미지 영역 + 클래스 영역)
3. **검증**: "라벨링" 버튼 disabled (이미지 0개)

### S08: 라벨 클래스 생성

**경로**: `/projects/:id/tasks/:taskId`

1. 클래스 패널의 "+" 버튼 클릭
2. 클래스 이름 입력 → Enter (또는 "추가" 클릭)
3. 2~3개 클래스 반복 생성
4. **검증**: 클래스 목록에 표시, 색상이 자동으로 다른 색상 배정
5. **검증**: 헤더의 클래스 카운트 갱신

### S09: 이미지 추가 (DataStore에서)

**경로**: `/projects/:id/tasks/:taskId`

1. "Pool에서 추가" 버튼 클릭 → ImageSelectionModal 열림
2. 이미지 목록 표시 확인
3. "전체 선택" 클릭 → 모든 이미지 선택됨 (체크 표시, "N개 선택됨" 텍스트)
4. "추가" 클릭
5. **검증**: 이미지 그리드에 추가된 이미지 표시
6. **검증**: "라벨링" 버튼 활성화됨, 진행률 0%

### S10: 라벨링 페이지 진입

**경로**: `/projects/:id/tasks/:taskId` → `/projects/:id/tasks/:taskId/label`

1. "라벨링" 버튼 클릭
2. **검증**: 전체화면 LabelingPage 표시 (AppLayout 없음)
3. **검증**: 상단 바 (Task 이름, "1 / N" 네비게이션, 줌 %, "저장됨")
4. **검증**: 좌측 패널 (도구 목록, 라벨 클래스 목록)
5. **검증**: 중앙에 첫 번째 이미지 렌더링됨
6. **콘솔 체크**: 이미지 로드 에러 없어야 함

### S11: Classification 라벨링

**경로**: `/projects/:id/tasks/:taskId/label` (task_type = classification인 경우)

1. "분류" 도구 선택
2. 클래스 클릭 → 이미지에 classification annotation 즉시 배정
3. **검증**: 캔버스 좌상단에 클래스명+색상 배지 표시
4. 다른 클래스 클릭 → 클래스 변경
5. **검증**: "변경사항 있음" 표시
6. 다음 이미지 버튼 클릭 → 자동 저장 발생
7. **검증**: "저장됨" 표시

### S12: BBox 라벨링

**경로**: `/projects/:id/tasks/:taskId/label` (task_type = object_detection)

**주의**: Konva 캔버스 이벤트는 Playwright로 시뮬레이션이 어려울 수 있음.
`browser_run_code`로 직접 마우스 이벤트를 보내야 한다:

```javascript
async (page) => {
  const canvas = await page.locator('canvas').first();
  const box = await canvas.boundingBox();
  // bbox 그리기: 캔버스 30%~70% 영역에 드래그
  const startX = box.x + box.width * 0.3;
  const startY = box.y + box.height * 0.3;
  const endX = box.x + box.width * 0.7;
  const endY = box.y + box.height * 0.7;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
}
```

1. 클래스 선택 → "바운딩 박스" 도구 선택
2. 캔버스에서 마우스 드래그 (위 코드)
3. **검증**: bbox가 캔버스에 표시됨 (스크린샷으로 확인)
4. **검증**: "변경사항 있음" 표시

**Fallback**: Konva 이벤트가 동작하지 않으면 수동 테스트로 대체하고, 나머지 시나리오 진행.

### S13: Undo/Redo + 자동저장

**경로**: `/projects/:id/tasks/:taskId/label`

1. 어노테이션 생성 후 Ctrl+Z → undo 확인
2. Ctrl+Shift+Z → redo 확인
3. Ctrl+S → 수동 저장 ("저장됨" 표시)
4. 이미지 전환 → 자동 저장 발생

### S14: 이미지 네비게이션

**경로**: `/projects/:id/tasks/:taskId/label`

1. "다음" 버튼 클릭 → "2 / N" 표시
2. "이전" 버튼 클릭 → "1 / N" 표시
3. 뒤로가기 버튼 클릭 → TaskDetailPage 복귀
4. **검증**: 이전 페이지 데이터 정상 표시

### S15: 프로젝트/태스크 삭제

**경로**: 각 해당 페이지

1. 태스크 카드의 삭제 아이콘 클릭 → 확인 다이얼로그
2. "삭제" 클릭 → 태스크 목록에서 제거 확인
3. 프로젝트 카드의 삭제 아이콘 클릭 → 확인 다이얼로그
4. "삭제" 클릭 → 프로젝트 목록에서 제거 확인

## 검증 체크리스트

### 콘솔 에러 확인
매 시나리오 후 `browser_console_messages('error')` 실행:
- `<button>` 중첩 에러 없어야 함 (TaskCard `<div role="button">` 수정됨)
- 이미지 404 에러 없어야 함 (URL: `/api/v1/images/{id}/file`)
- React hydration 경고 없어야 함

### 네트워크 요청 확인
의심스러운 동작 시 `browser_network_requests()` 실행:
- API 요청이 올바른 엔드포인트로 가는지
- 401/403/404/500 에러 응답 확인
- `undefined`가 URL에 포함되지 않는지

### 스크린샷 활용
UI 레이아웃 검증이 필요할 때 `browser_take_screenshot()`:
- 라벨링 캔버스 이미지 렌더링 확인
- BBox 그려진 상태 확인
- 모달/다이얼로그 레이아웃 확인

## 과거 발견된 버그 (수정 완료)

| 날짜 | 시나리오 | 버그 | 수정 |
|------|----------|------|------|
| 2026-03-19 | S06 | TaskCard `<button>` 안에 삭제 `<button>` 중첩 (HTML 규격 위반) | `<div role="button">`으로 변경 |
| 2026-03-19 | S10 | 이미지 URL `/data-stores/{id}/images/{id}/file` 404 | `/images/{id}/file`로 수정 |
| 2026-03-19 | S10 | `currentImage.image_id` undefined (images 배열에서 image만 추출) | `currentImage.id` 사용 |

## 과거 발견된 UI/UX 개선사항 (수정 완료)

| 날짜 | 시나리오 | 이슈 | 수정 |
|------|----------|------|------|
| 2026-03-19 | S02 | 새 프로젝트가 목록 아래에 추가됨 | `created_at DESC` 정렬 추가 |
| 2026-03-19 | S08 | 클래스 추가 시 항상 같은 색상 (#3b82f6) | 10색 팔레트 자동 순환 |
