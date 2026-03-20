import { Maximize, Minus, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ZoomControlsProps {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  onResetZoom: () => void;
}

export default function ZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  onResetZoom,
}: ZoomControlsProps) {
  const percentage = Math.round(scale * 100);

  return (
    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur-sm">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onZoomOut}
        title="축소 (Ctrl+-)"
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>

      <button
        className="min-w-[48px] px-1.5 text-center text-xs font-medium tabular-nums hover:text-primary"
        onClick={onResetZoom}
        title="100%로 리셋"
      >
        {percentage}%
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onZoomIn}
        title="확대 (Ctrl+=)"
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <div className="mx-0.5 h-4 w-px bg-border" />

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onFitToScreen}
        title="화면에 맞추기 (Ctrl+0)"
      >
        <Maximize className="h-3.5 w-3.5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onResetZoom}
        title="원본 크기"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
