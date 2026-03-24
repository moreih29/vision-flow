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

const SHORTCUTS: { category: string; rows: ShortcutRow[] }[] = [
  {
    category: "이미지 네비게이션",
    rows: [
      { keys: ["←", "→"], description: "이전/다음 이미지" },
      { keys: ["D"], description: "현재 이미지 완료 표시 + 다음 이미지 이동" },
    ],
  },
  {
    category: "Classification",
    rows: [
      {
        keys: ["Space"],
        description: "현재 클래스 적용 + 다음 이미지 자동 이동",
      },
    ],
  },
  {
    category: "뷰",
    rows: [
      { keys: ["F"], description: "화면에 맞추기 (Fit to Screen)" },
      { keys: ["H"], description: "어노테이션 표시/숨기기" },
      { keys: ["Ctrl", "+"], description: "확대" },
      { keys: ["Ctrl", "-"], description: "축소" },
      { keys: ["Ctrl", "0"], description: "화면에 맞추기" },
    ],
  },
  {
    category: "편집",
    rows: [
      { keys: ["Ctrl", "Z"], description: "실행 취소" },
      { keys: ["Ctrl", "Shift", "Z"], description: "다시 실행" },
      { keys: ["Ctrl", "S"], description: "저장" },
      { keys: ["Escape"], description: "bbox 그리기 취소 / 선택 해제" },
      { keys: ["Tab"], description: "다음 어노테이션 선택 순환" },
    ],
  },
  {
    category: "기타",
    rows: [{ keys: ["?"], description: "단축키 도움말 표시/숨기기" }],
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
}

export default function KeyboardShortcutsOverlay({
  open,
  onOpenChange,
}: KeyboardShortcutsOverlayProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>키보드 단축키</DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-5">
          {SHORTCUTS.map((section) => (
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
