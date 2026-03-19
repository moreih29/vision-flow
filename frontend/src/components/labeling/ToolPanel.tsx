import { MousePointer2, Tag, Square } from 'lucide-react'
import type { TaskType } from '@/types/task'
import { useLabelingStore } from '@/stores/labeling-store'

type LabelingTool = 'select' | 'classification' | 'bbox'

interface ToolDef {
  id: LabelingTool
  label: string
  icon: React.ReactNode
}

const ALL_TOOLS: ToolDef[] = [
  { id: 'select', label: '선택', icon: <MousePointer2 className="h-4 w-4" /> },
  { id: 'classification', label: '분류', icon: <Tag className="h-4 w-4" /> },
  { id: 'bbox', label: '바운딩 박스', icon: <Square className="h-4 w-4" /> },
]

function getAvailableTools(taskType: TaskType | null): ToolDef[] {
  if (taskType === 'classification') {
    return ALL_TOOLS.filter((t) => t.id === 'classification')
  }
  if (taskType === 'object_detection') {
    return ALL_TOOLS.filter((t) => t.id === 'select' || t.id === 'bbox')
  }
  // 기타 task type: 선택 + bbox
  return ALL_TOOLS.filter((t) => t.id === 'select' || t.id === 'bbox')
}

interface ToolPanelProps {
  taskType: TaskType | null
}

export default function ToolPanel({ taskType }: ToolPanelProps) {
  const { tool, setTool } = useLabelingStore()
  const availableTools = getAvailableTools(taskType)

  return (
    <div className="flex flex-col gap-1">
      {availableTools.map((t) => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
            tool === t.id
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  )
}
