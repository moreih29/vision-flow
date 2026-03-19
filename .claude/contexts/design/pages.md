# Page Design

## 페이지 구조 및 사용자 흐름

### 1. LoginPage
- **목적**: 사용자 인증
- **주요 요소**: 이메일/비밀번호 입력, 로그인 버튼, 회원가입 링크
- **특이사항**: 로그인 정보 저장 기능 (D023 - 토큰 7일 유효)
- **완료 후**: 프로젝트 목록으로 이동

### 2. RegisterPage
- **목적**: 신규 사용자 등록
- **주요 요소**: 이름/이메일/비밀번호/비밀번호 확인 입력
- **검증**: 비밀번호 일치 확인, 이메일 형식 검증
- **완료 후**: 로그인 페이지로 이동

### 3. ProjectsPage (메인)
- **목적**: 프로젝트 관리 허브
- **주요 요소**:
  - 프로젝트 카드 목록
  - "새 프로젝트" 생성 다이얼로그
  - 프로젝트 편집/삭제
- **카드 정보**: 프로젝트 이름, 설명, 생성일
- **인증**: ProtectedRoute로 보호

### 4. ProjectDetailPage
- **목적**: 프로젝트 내 데이터 관리
- **구조**: 탭 기반 레이아웃
  - **Data Pool 탭**: DataStore의 이미지 관리
  - **Tasks 탭**: Task 목록 및 생성

#### Data Pool 탭 (DataPoolTab)
- 프로젝트의 원본 이미지 저장소 (DataStore)
- 폴더 트리 사이드바 + 이미지 그리드/리스트 메인 영역
- 이미지 업로드, 폴더 관리, 다중 선택, 배치 작업
- 뷰 모드 전환 (그리드/리스트/트리)

#### Tasks 탭 (TasksTab)
- 현재 프로젝트의 Task 카드 목록
- Task Type별 색상 뱃지 (Classification=초록, Detection=파랑, Segmentation=보라, Pose=주황)
- "새 Task" 생성 다이얼로그 (이름, Task Type 선택)

### 5. DataStoreDetailPage (DataStore 상세)
- **목적**: 특정 DataStore의 폴더/이미지 탐색
- **레이아웃**:
  - 상단: 브레드크럼 네비게이션
  - 좌측: 폴더 트리 뷰 (토글 가능)
  - 중앙: 이미지 그리드 또는 리스트
- **기능**: 폴더 진입, 이미지 관리, 업로드

### 6. TaskDetailPage
- **목적**: Task의 이미지 및 라벨 클래스 관리
- **레이아웃**:
  - 상단: Task 정보 (이름, Task Type, Status, 이미지 수)
  - 좌측: 라벨 클래스 관리 패널
  - 중앙: Task에 포함된 이미지 그리드
- **기능**:
  - 이미지 추가 (DataStore에서 선택)
  - 이미지 제거
  - 라벨 클래스 CRUD (이름 + 색상)
- **미구현**: 라벨링 도구 (Konva.js 기반, 향후 구현 예정)

### 7. DashboardPage (미구현)
- **목적**: 프로젝트/학습 현황 대시보드
- **예정 기능**: 프로젝트 통계, 학습 진행 현황, 최근 활동

## 페이지 간 데이터 흐름

```
ProjectsPage
  │ 프로젝트 선택
  ▼
ProjectDetailPage
  ├── [Data Pool 탭]
  │     │ DataStore 선택
  │     ▼
  │   DataStoreDetailPage
  │     (이미지 업로드/관리)
  │
  └── [Tasks 탭]
        │ Task 선택
        ▼
      TaskDetailPage
        ├── 이미지 추가 (→ ImageSelectionModal → DataStore 이미지 선택)
        └── 라벨 클래스 관리
```

## 공통 레이아웃

- 현재 전체 레이아웃 컴포넌트 없음 (각 페이지가 독립적)
- 향후 공통 헤더/사이드바 레이아웃 도입 고려
- 네비게이션: URL 기반 (React Router), 뒤로 가기 지원
