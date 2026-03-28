import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TaskClassPanel } from "./TaskClassPanel";
import { labelClassesApi } from "@/api/label-classes";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import type { VersionStatus } from "@/types/snapshot";
import type { LabelClass } from "@/types/label-class";

const CLASS_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#14b8a6",
  "#6366f1",
];

export function ClassManagePopover({
  taskId,
  disabled,
}: {
  taskId: number;
  disabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const { confirmDialog, confirm, showAlert } = useConfirmDialog();

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["label-classes", taskId],
    queryFn: () => labelClassesApi.list(taskId).then((r) => r.data),
    enabled: !!taskId,
  });

  const [addingClass, setAddingClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [newClassColor, setNewClassColor] = useState("#3b82f6");
  const [savingClass, setSavingClass] = useState(false);

  function getNextUnusedColor(): string {
    const usedColors = new Set(classes.map((c) => c.color));
    return (
      CLASS_COLORS.find((c) => !usedColors.has(c)) ??
      CLASS_COLORS[classes.length % CLASS_COLORS.length]
    );
  }

  async function handleAddClass() {
    if (!newClassName.trim()) return;
    setSavingClass(true);
    try {
      await labelClassesApi.create(taskId, {
        name: newClassName.trim(),
        color: newClassColor,
      });
      queryClient.invalidateQueries({ queryKey: ["label-classes", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
      queryClient.setQueryData<VersionStatus>(
        ["tasks", taskId, "version-status"],
        (old) =>
          old
            ? {
                ...old,
                is_dirty: true,
                changes: { ...old.changes, class_changed: true },
              }
            : old,
      );
      queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "version-status"],
      });
      setNewClassName("");
      setNewClassColor(getNextUnusedColor());
    } catch {
      await showAlert({ title: "클래스 추가에 실패했습니다." });
    } finally {
      setSavingClass(false);
    }
  }

  async function handleDeleteClass(classId: number) {
    const confirmed = await confirm({
      title: "클래스 삭제",
      description: "클래스를 삭제하시겠습니까?",
      confirmLabel: "삭제",
      variant: "destructive",
    });
    if (!confirmed) return;
    try {
      await labelClassesApi.delete(classId);
      queryClient.invalidateQueries({ queryKey: ["label-classes", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks", taskId] });
      queryClient.setQueryData<VersionStatus>(
        ["tasks", taskId, "version-status"],
        (old) =>
          old
            ? {
                ...old,
                is_dirty: true,
                changes: { ...old.changes, class_changed: true },
              }
            : old,
      );
      queryClient.invalidateQueries({
        queryKey: ["tasks", taskId, "version-status"],
      });
    } catch {
      await showAlert({ title: "클래스 삭제에 실패했습니다." });
    }
  }

  async function handleUpdateClassColor(classId: number, color: string) {
    queryClient.setQueryData<LabelClass[]>(
      ["label-classes", taskId],
      (old) => old?.map((c) => (c.id === classId ? { ...c, color } : c)) ?? old,
    );
    try {
      await labelClassesApi.update(classId, { color });
    } catch {
      queryClient.invalidateQueries({ queryKey: ["label-classes", taskId] });
    }
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={`inline-flex items-center rounded-full border border-border text-muted-foreground hover:bg-accent px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer${disabled ? " pointer-events-none opacity-50" : ""}`}
          >
            {classes.length}개 클래스
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 p-3"
          align="start"
          side="bottom"
          sideOffset={4}
        >
          <TaskClassPanel
            classes={classes}
            loading={isLoading}
            addingClass={addingClass}
            newClassName={newClassName}
            newClassColor={newClassColor}
            savingClass={savingClass}
            onStartAdding={() => {
              setAddingClass(true);
              setNewClassColor(getNextUnusedColor());
            }}
            onCancelAdding={() => setAddingClass(false)}
            onNewClassNameChange={setNewClassName}
            onNewClassColorChange={setNewClassColor}
            onAddClass={handleAddClass}
            onDeleteClass={handleDeleteClass}
            onUpdateClassColor={handleUpdateClassColor}
          />
        </PopoverContent>
      </Popover>
      {confirmDialog}
    </>
  );
}
