import { useEffect } from "react";
import { Tag, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TaskType } from "@/types/task";
import { useLabelingStore } from "@/stores/labeling-store";

type LabelingTool = "classification" | "bbox";

interface ToolDef {
  id: LabelingTool;
  label: string;
  icon: React.ReactNode;
}

const ALL_TOOLS: ToolDef[] = [
  {
    id: "classification",
    label: "분류",
    icon: <Tag className="h-4 w-4" />,
  },
  {
    id: "bbox",
    label: "바운딩 박스",
    icon: <Square className="h-4 w-4" />,
  },
];

function getAvailableTools(taskType: TaskType | null): ToolDef[] {
  if (taskType === "classification") {
    return ALL_TOOLS.filter((t) => t.id === "classification");
  }
  if (taskType === "object_detection") {
    return ALL_TOOLS.filter((t) => t.id === "bbox");
  }
  // 기타 task type: bbox
  return ALL_TOOLS.filter((t) => t.id === "bbox");
}

interface FloatingToolbarProps {
  taskType: TaskType | null;
}

export default function FloatingToolbar({ taskType }: FloatingToolbarProps) {
  const { tool, setTool } = useLabelingStore();
  const availableTools = getAvailableTools(taskType);

  // 도구 1개면 자동 선택
  useEffect(() => {
    if (availableTools.length === 1 && tool !== availableTools[0].id) {
      setTool(availableTools[0].id);
    }
  }, [availableTools, tool, setTool]);

  // 도구 1개 이하면 렌더 안 함
  if (availableTools.length < 2) {
    return null;
  }

  return (
    <div className="absolute top-3 left-3 z-20 flex flex-col gap-1 rounded-lg border bg-background/80 p-1 backdrop-blur-sm">
      {availableTools.map((t) => (
        <Button
          key={t.id}
          variant={tool === t.id ? "secondary" : "ghost"}
          size="icon"
          className="h-8 w-8"
          onClick={() => setTool(t.id)}
          title={t.label}
        >
          {t.icon}
        </Button>
      ))}
    </div>
  );
}
