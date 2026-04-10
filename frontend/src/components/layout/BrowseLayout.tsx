import React from "react";

interface BrowseLayoutProps {
  children: React.ReactNode;
  /** 페이지 상단 제목·액션 영역 (sticky sub-header로 표시) */
  header?: React.ReactNode;
}

/**
 * 훑기(Browse) 밀도 레이아웃.
 * max-w-7xl + px-6 py-6 를 강제하며 페이지는 자체 max-w/px 지정 금지.
 */
export default function BrowseLayout({ children, header }: BrowseLayoutProps) {
  return (
    <div className="flex flex-1 flex-col min-h-0">
      {header && (
        <div className="border-b bg-background">
          <div className="mx-auto max-w-7xl px-6 py-4">{header}</div>
        </div>
      )}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
      </main>
    </div>
  );
}
