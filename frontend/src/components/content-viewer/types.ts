/** 제네릭 뷰어가 요구하는 최소 인터페이스 */
export interface ViewerItem {
  /** 아이템 고유 키 (선택 상태 관리에 사용) */
  key: string;
}

/** 외부 파일 드래그 앤 드롭 업로드 props */
export interface FileDropProps {
  isDragOver: boolean;
  dropLabel?: string;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

/** 범용 콘텐츠 영역 props */
export interface ContentAreaProps<T extends ViewerItem> {
  items: T[];
  contentsLoading?: boolean;
  previewMode: "grid" | "list";
  selectedKeys: Set<string>;
  onItemClick: (index: number, event: React.MouseEvent) => void;
  onClearSelection?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** 전체 아이템 수 — 미리 전체 스크롤 길이를 확보하는 데 사용 */
  totalCount?: number;
  /** 그리드 아이템 렌더러 */
  renderGridItem: (
    item: T,
    index: number,
    selected: boolean,
  ) => React.ReactNode;
  /** 리스트 행 렌더러 */
  renderListItem: (
    item: T,
    index: number,
    selected: boolean,
    virtualRow: VirtualRowInfo,
  ) => React.ReactNode;
  /** 리스트 헤더 렌더러 */
  renderListHeader?: () => React.ReactNode;
  /** 상위 폴더 이동 버튼 표시 여부 */
  hasParentItem?: boolean;
  /** 상위 폴더 이동 핸들러 */
  onNavigateUp?: () => void;
  /** 배경 우클릭 메뉴 콘텐츠 */
  renderBgMenu?: (close: () => void) => React.ReactNode;
  /** 외부 파일 드래그 앤 드롭 — undefined이면 업로드 오버레이 비활성 */
  fileDrop?: FileDropProps;
  /** 빈 상태 렌더러 — undefined이면 기본 메시지 표시 */
  renderEmpty?: () => React.ReactNode;
  /** 이 key를 가진 아이템으로 자동 스크롤 */
  scrollToItemKey?: string | null;
  /** 스크롤 완료 후 호출 — 부모가 scrollToItemKey를 null로 리셋하는 데 사용 */
  onScrollComplete?: () => void;
  /** 그리드 열 수 변경 시 호출 */
  onColumnsChange?: (columns: number) => void;
}

/** 가상 그리드 공통 props */
export interface VirtualGridProps<T extends ViewerItem> {
  items: T[];
  selectedKeys: Set<string>;
  onItemClick: (index: number, event: React.MouseEvent) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onClearSelection: () => void;
  /** 그리드 아이템 렌더러 */
  renderItem: (item: T, index: number, isSelected: boolean) => React.ReactNode;
  /** 상위 폴더 이동 버튼 표시 여부 */
  hasParentItem?: boolean;
  /** 상위 폴더 이동 핸들러 */
  onNavigateUp?: () => void;
  /** 배경 우클릭 메뉴 콘텐츠 */
  renderBgMenu?: (close: () => void) => React.ReactNode;
  /** 전체 아이템 수 — 스크롤 전체 길이 미리 확보용 (없으면 기존 방식 fallback) */
  totalCount?: number;
  /** 이 key를 가진 아이템으로 자동 스크롤 */
  scrollToItemKey?: string | null;
  /** 스크롤 완료 후 호출 — 부모가 scrollToItemKey를 null로 리셋하는 데 사용 */
  onScrollComplete?: () => void;
  /** 그리드 열 수 변경 시 호출 */
  onColumnsChange?: (columns: number) => void;
}

/** 가상 리스트 renderItem에 전달되는 가상화 정보 */
export interface VirtualRowInfo {
  /** 가상화된 행의 실제 높이(px) */
  size: number;
  /** 스크롤 컨테이너 상단으로부터의 오프셋(px) */
  start: number;
}

/** 가상 리스트 공통 props */
export interface VirtualListProps<T extends ViewerItem> {
  items: T[];
  selectedKeys: Set<string>;
  onItemClick: (index: number, event: React.MouseEvent) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onClearSelection: () => void;
  /** 리스트 행 렌더러 — virtualRow는 절대 위치 계산에 필요한 가상화 정보 */
  renderItem: (
    item: T,
    index: number,
    isSelected: boolean,
    virtualRow: VirtualRowInfo,
  ) => React.ReactNode;
  /** 컬럼 헤더 렌더러 */
  renderHeader?: () => React.ReactNode;
  /** 상위 폴더 이동 행 표시 여부 */
  hasParentItem?: boolean;
  /** 상위 폴더 이동 핸들러 */
  onNavigateUp?: () => void;
  /** 배경 우클릭 메뉴 콘텐츠 */
  renderBgMenu?: (close: () => void) => React.ReactNode;
  /** 전체 아이템 수 — 스크롤 전체 길이 미리 확보용 (없으면 기존 방식 fallback) */
  totalCount?: number;
  /** 이 key를 가진 아이템으로 자동 스크롤 */
  scrollToItemKey?: string | null;
  /** 스크롤 완료 후 호출 — 부모가 scrollToItemKey를 null로 리셋하는 데 사용 */
  onScrollComplete?: () => void;
}
