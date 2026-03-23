import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import type { LabelClass } from "@/types/label-class";

interface TaskClassPanelProps {
  classes: LabelClass[];
  loading: boolean;
  addingClass: boolean;
  newClassName: string;
  newClassColor: string;
  savingClass: boolean;
  onStartAdding: () => void;
  onCancelAdding: () => void;
  onNewClassNameChange: (name: string) => void;
  onNewClassColorChange: (color: string) => void;
  onAddClass: () => void;
  onDeleteClass: (classId: number) => void;
}

export function TaskClassPanel({
  classes,
  loading,
  addingClass,
  newClassName,
  newClassColor,
  savingClass,
  onStartAdding,
  onCancelAdding,
  onNewClassNameChange,
  onNewClassColorChange,
  onAddClass,
  onDeleteClass,
}: TaskClassPanelProps) {
  return (
    <div className="w-64 shrink-0 overflow-y-auto select-none">
      <div className="rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">클래스</h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onStartAdding}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {addingClass && (
          <div className="mb-3 flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={newClassColor}
                onChange={(e) => onNewClassColorChange(e.target.value)}
                className="h-7 w-7 cursor-pointer rounded border"
              />
              <Input
                value={newClassName}
                onChange={(e) => onNewClassNameChange(e.target.value)}
                placeholder="클래스 이름"
                className="h-7 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onAddClass();
                  if (e.key === "Escape") onCancelAdding();
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-1.5">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={onAddClass}
                disabled={savingClass || !newClassName.trim()}
              >
                {savingClass ? "저장 중..." : "추가"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={onCancelAdding}
                disabled={savingClass}
              >
                취소
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            클래스가 없습니다.
            <br />+ 버튼으로 추가하세요.
          </p>
        ) : (
          <div className="space-y-1">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent"
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: cls.color }}
                />
                <span
                  className="flex-1 truncate text-sm select-text"
                  title={cls.name}
                >
                  {cls.name}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {cls.label_count}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => onDeleteClass(cls.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
