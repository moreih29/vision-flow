import React from "react";

interface WorkspaceLayoutProps {
  /** 커스텀 헤더 바 (h-12 기준) */
  topBar?: React.ReactNode;
  /** 메인 영역 (보통 PanelGroup) */
  children: React.ReactNode;
  /** 하단 필름스트립 등 */
  bottomBar?: React.ReactNode;
  /**
   * 색조 설정.
   * "dark"이면 메인 영역에 --canvas-bg CSS 변수 기반 배경 적용.
   */
  tone?: "default" | "dark";
}

/**
 * 몰입하기(Workspace) 밀도 레이아웃.
 * 전체폭, max-width 없음, padding 최소.
 * LabelingPage처럼 스스로 전체 화면을 제어하는 페이지에서 사용.
 */
export default function WorkspaceLayout({
  topBar,
  children,
  bottomBar,
  tone = "default",
}: WorkspaceLayoutProps) {
  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {topBar && (
        <div className="shrink-0 h-12 border-b bg-background flex items-center">
          {topBar}
        </div>
      )}

      <div
        className={`flex-1 min-h-0 overflow-hidden${tone === "dark" ? " bg-[var(--canvas-bg)]" : ""}`}
      >
        {children}
      </div>

      {bottomBar && (
        <div className="shrink-0 border-t bg-background">{bottomBar}</div>
      )}
    </div>
  );
}
