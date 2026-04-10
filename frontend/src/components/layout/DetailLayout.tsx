import React from "react";

interface DetailLayoutProps {
  children: React.ReactNode;
  /** breadcrumb 등 최상단 헤더 */
  header?: React.ReactNode;
  /** 태스크 타입 뱃지, 버전 pill 등 메타 정보 바 */
  metaBar?: React.ReactNode;
  /** CTA 버튼 등 액션 바 */
  actionBar?: React.ReactNode;
  /** isDirty 배너 등 상태 배너 */
  statusBanner?: React.ReactNode;
  /** 좌측 사이드바 rail (TasksTab 등) */
  sidebar?: React.ReactNode;
  /** 좌측 사이드바 너비 (기본 "w-64") */
  sidebarWidth?: string;
  /** 우측 버전 rail — T7에서 VersionPanel 이동 예정, 슬롯만 마련 */
  versionRail?: React.ReactNode;
  /** 우측 버전 rail 너비 (기본 "w-80") */
  versionRailWidth?: string;
}

/**
 * 정하기(Detail) 밀도 레이아웃.
 * 모든 sub-bar가 동일한 max-w-7xl + px-6 안에 정렬되며
 * 페이지는 자체 max-w/px 지정 금지.
 * sidebar / versionRail 슬롯이 있으면 flex 좌우 배치.
 */
export default function DetailLayout({
  children,
  header,
  metaBar,
  actionBar,
  statusBanner,
  sidebar,
  sidebarWidth = "w-64",
  versionRail,
  versionRailWidth = "w-80",
}: DetailLayoutProps) {
  const hasSideBars = sidebar || versionRail;

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* 헤더 바 */}
      {header && (
        <div className="border-b">
          <div className="mx-auto max-w-7xl px-6 py-4">{header}</div>
        </div>
      )}

      {/* 메타 정보 바 */}
      {metaBar && (
        <div className="border-b">
          <div className="mx-auto max-w-7xl px-6 py-2">{metaBar}</div>
        </div>
      )}

      {/* 액션 바 */}
      {actionBar && (
        <div className="border-b">
          <div className="mx-auto max-w-7xl px-6 py-2">{actionBar}</div>
        </div>
      )}

      {/* 상태 배너 (isDirty 등) */}
      {statusBanner && <div>{statusBanner}</div>}

      {/* 본문 — sidebar/versionRail 유무에 따라 flex 배치 */}
      <main className="flex-1 overflow-auto min-h-0">
        {hasSideBars ? (
          <div className="mx-auto flex max-w-7xl h-full gap-6 px-6 py-4">
            {sidebar && (
              <aside
                className={`${sidebarWidth} shrink-0 min-h-0 overflow-auto`}
              >
                {sidebar}
              </aside>
            )}
            <div className="flex-1 min-h-0 overflow-auto">{children}</div>
            {versionRail && (
              <aside
                className={`${versionRailWidth} shrink-0 min-h-0 overflow-auto`}
              >
                {versionRail}
              </aside>
            )}
          </div>
        ) : (
          <div className="mx-auto max-w-7xl px-6 py-4">{children}</div>
        )}
      </main>
    </div>
  );
}
