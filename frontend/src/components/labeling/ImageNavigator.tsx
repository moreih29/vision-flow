import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLabelingStore } from "@/stores/labeling-store";

interface ImageNavigatorProps {
  totalImages: number;
}

export default function ImageNavigator({ totalImages }: ImageNavigatorProps) {
  const { currentImageIndex, setCurrentImageIndex } = useLabelingStore();

  function handlePrev() {
    if (currentImageIndex > 0) setCurrentImageIndex(currentImageIndex - 1);
  }

  function handleNext() {
    if (currentImageIndex < totalImages - 1)
      setCurrentImageIndex(currentImageIndex + 1);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // input/textarea에 포커스일 때 무시
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // Ctrl/Meta 조합 키 무시 (다른 단축키와 충돌 방지)
      if (e.ctrlKey || e.metaKey) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (currentImageIndex > 0) setCurrentImageIndex(currentImageIndex - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (currentImageIndex < totalImages - 1)
          setCurrentImageIndex(currentImageIndex + 1);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentImageIndex, totalImages, setCurrentImageIndex]);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handlePrev}
        disabled={currentImageIndex === 0 || totalImages === 0}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[60px] text-center text-sm tabular-nums text-muted-foreground">
        {totalImages === 0
          ? "0 / 0"
          : `${currentImageIndex + 1} / ${totalImages}`}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleNext}
        disabled={currentImageIndex >= totalImages - 1 || totalImages === 0}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
