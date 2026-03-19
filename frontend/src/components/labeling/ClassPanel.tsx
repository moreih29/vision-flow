import { useEffect } from 'react'
import type { LabelClass } from '@/types/label-class'
import type { Annotation } from '@/types/annotation'
import { useLabelingStore } from '@/stores/labeling-store'

interface ClassPanelProps {
  classes: LabelClass[]
  annotations: Annotation[]
  loading?: boolean
  onClassifyImage?: (classId: number) => void
}

export default function ClassPanel({
  classes,
  annotations,
  loading = false,
  onClassifyImage,
}: ClassPanelProps) {
  const { tool, selectedClassId, setSelectedClassId } = useLabelingStore()
  const isClassificationMode = tool === 'classification'

  // 현재 이미지의 classification annotation에서 선택된 클래스 확인
  const currentClassificationAnnotation = annotations.find(
    (a) => a.annotation_type === 'classification',
  )
  const activeClassId = currentClassificationAnnotation?.label_class_id ?? null

  // 숫자 키 단축키 (1-9)로 빠른 클래스 선택
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const num = parseInt(e.key)
      if (isNaN(num) || num < 1 || num > 9) return
      // 입력 필드에서는 단축키 무시
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      const cls = classes[num - 1]
      if (!cls) return

      if (isClassificationMode && onClassifyImage) {
        onClassifyImage(cls.id)
      } else {
        setSelectedClassId(selectedClassId === cls.id ? null : cls.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [classes, isClassificationMode, onClassifyImage, selectedClassId, setSelectedClassId])

  function handleClassClick(cls: LabelClass) {
    if (isClassificationMode && onClassifyImage) {
      // classification 모드: 즉시 어노테이션 배정
      onClassifyImage(cls.id)
    } else {
      // 일반 모드: 선택된 클래스 토글
      setSelectedClassId(selectedClassId === cls.id ? null : cls.id)
    }
  }

  if (loading) {
    return (
      <div className="space-y-1.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    )
  }

  if (classes.length === 0) {
    return <p className="text-xs text-muted-foreground">클래스가 없습니다.</p>
  }

  return (
    <div className="flex flex-col gap-1">
      {classes.map((cls, index) => {
        const isSelected = isClassificationMode
          ? activeClassId === cls.id
          : selectedClassId === cls.id

        return (
          <button
            key={cls.id}
            onClick={() => handleClassClick(cls)}
            className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
              isSelected
                ? 'bg-accent text-accent-foreground ring-1 ring-primary'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
            title={`${cls.name} (단축키: ${index + 1})`}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: cls.color }}
            />
            <span className="flex-1 truncate text-left">{cls.name}</span>
            <span className="text-xs text-muted-foreground">{cls.label_count}</span>
          </button>
        )
      })}
    </div>
  )
}
