import { useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLabelingStore } from '@/stores/labeling-store'

interface ImageNavigatorProps {
  totalImages: number
}

export default function ImageNavigator({ totalImages }: ImageNavigatorProps) {
  const { currentImageIndex, setCurrentImageIndex, tool } = useLabelingStore()

  function handlePrev() {
    if (currentImageIndex > 0) setCurrentImageIndex(currentImageIndex - 1)
  }

  function handleNext() {
    if (currentImageIndex < totalImages - 1) setCurrentImageIndex(currentImageIndex + 1)
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // 도구가 select일 때만 화살표 네비게이션 허용
      if (tool !== 'select') return
      // input/textarea에 포커스일 때 무시
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (currentImageIndex > 0) setCurrentImageIndex(currentImageIndex - 1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (currentImageIndex < totalImages - 1) setCurrentImageIndex(currentImageIndex + 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentImageIndex, totalImages, tool, setCurrentImageIndex])

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
        {totalImages === 0 ? '0 / 0' : `${currentImageIndex + 1} / ${totalImages}`}
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
  )
}
