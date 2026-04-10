import { ArrowRight, Database, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TaskActionBarProps {
  hasImages: boolean;
  isRestoring?: boolean;
  poolPanelOpen: boolean;
  onTogglePoolPanel: () => void;
  onLabelingClick: () => void;
  onToggleVersionRail?: () => void;
  versionRailOpen?: boolean;
}

/**
 * DetailLayout의 actionBar slot — "데이터 추가" 토글 + "라벨링 시작" + 버전 rail 토글.
 */
export function TaskActionBar({
  hasImages,
  isRestoring = false,
  poolPanelOpen,
  onTogglePoolPanel,
  onLabelingClick,
  onToggleVersionRail,
  versionRailOpen = false,
}: TaskActionBarProps) {
  return (
    <div className="flex items-center justify-between select-none">
      <div className="flex items-center gap-2">
        <Button
          variant={poolPanelOpen ? "secondary" : "ghost"}
          size="sm"
          onClick={onTogglePoolPanel}
          title="데이터 풀에서 이미지 추가"
          disabled={isRestoring}
        >
          <Database className="mr-1.5 h-3.5 w-3.5" />
          데이터 추가
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {onToggleVersionRail && (
          <Button
            variant={versionRailOpen ? "secondary" : "ghost"}
            size="sm"
            onClick={onToggleVersionRail}
            title="버전 패널 열기 / 닫기 (V)"
            disabled={isRestoring}
          >
            <GitBranch className="mr-1.5 h-3.5 w-3.5" />
            버전
            <kbd className="ml-1.5 hidden rounded border bg-muted px-1 text-[10px] font-normal text-muted-foreground sm:inline-block">
              V
            </kbd>
          </Button>
        )}
        <Button
          variant="default"
          size="sm"
          disabled={!hasImages}
          title={hasImages ? "라벨링 시작" : "이미지를 먼저 추가하세요"}
          onClick={onLabelingClick}
        >
          라벨링 시작
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
