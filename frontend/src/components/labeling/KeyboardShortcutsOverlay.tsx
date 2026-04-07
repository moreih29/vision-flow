import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ShortcutRow {
  keys: string[];
  description: string;
}

interface ShortcutSection {
  category: string;
  taskTypes?: string[];
  rows: ShortcutRow[];
}

const SHORTCUTS: ShortcutSection[] = [
  {
    category: "작업 흐름",
    rows: [
      { keys: ["D"], description: "저장하고 다음" },
      { keys: ["A"], description: "저장하고 이전" },
      { keys: ["S"], description: "저장" },
      { keys: ["W"], description: "라벨 삭제" },
      { keys: ["E"], description: "저장하지 않고 다음" },
      { keys: ["Q"], description: "저장하지 않고 이전" },
    ],
  },
  {
    category: "분류",
    taskTypes: ["classification"],
    rows: [{ keys: ["Space"], description: "클래스 적용하고 다음" }],
  },
  {
    category: "편집",
    taskTypes: ["object_detection"],
    rows: [
      { keys: ["Esc"], description: "그리기 취소 / 선택 해제" },
      { keys: ["Delete"], description: "선택 삭제" },
      { keys: ["Tab"], description: "다음 어노테이션 선택" },
      { keys: ["Ctrl", "Z"], description: "실행 취소" },
      { keys: ["Ctrl", "Shift", "Z"], description: "다시 실행" },
    ],
  },
  {
    category: "화면",
    rows: [
      { keys: ["F"], description: "화면에 맞추기" },
      { keys: ["H"], description: "어노테이션 표시 토글" },
      { keys: ["Ctrl", "+"], description: "확대" },
      { keys: ["Ctrl", "-"], description: "축소" },
      { keys: ["Ctrl", "S"], description: "저장" },
      { keys: ["/"], description: "파일 트리 토글" },
      { keys: ["?"], description: "단축키 도움말" },
    ],
  },
];

function KbdKey({ label }: { label: string }) {
  return (
    <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground shadow-sm">
      {label}
    </kbd>
  );
}

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskType?: string | null;
}

export default function KeyboardShortcutsOverlay({
  open,
  onOpenChange,
  taskType,
}: KeyboardShortcutsOverlayProps) {
  const filtered = SHORTCUTS.filter(
    (s) => !s.taskTypes || (taskType && s.taskTypes.includes(taskType)),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>키보드 단축키</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {filtered.map((section) => (
            <div key={section.category}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.category}
              </p>
              <div className="space-y-1.5">
                {section.rows.map((row, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm text-foreground">
                      {row.description}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {row.keys.map((k, j) => (
                        <KbdKey key={j} label={k} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
