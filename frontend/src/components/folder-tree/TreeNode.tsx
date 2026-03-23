import { useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { FolderTreeNode } from "./tree-utils";

// -- 타입 정의 --

export interface TreeNodeProps {
  node: FolderTreeNode;
  depth: number;
  selectedPath: string;
  editingPath: string | null;
  editName: string;
  draggingPath: string | null;
  dragOverPath: string | null;
  editStartTime: number;
  readOnly?: boolean;
  onSelectPath: (path: string) => void;
  onToggleExpand: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onStartRename: (path: string, name: string) => void;
  onEditNameChange: (value: string) => void;
  onFinishRename: () => void;
  onCancelRename: () => void;
  onDragStart: (path: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, path: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, targetPath: string) => void;
}

// -- 컴포넌트 --

export function TreeNode({
  node,
  depth,
  selectedPath,
  editingPath,
  editName,
  draggingPath,
  dragOverPath,
  editStartTime,
  readOnly = false,
  onSelectPath,
  onToggleExpand,
  onDeleteFolder,
  onCreateFolder,
  onStartRename,
  onEditNameChange,
  onFinishRename,
  onCancelRename,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: TreeNodeProps) {
  const isSelected = selectedPath === node.path;
  const hasChildren = node.subfolder_count > 0;
  const isEditing = editingPath === node.path;
  const isDragging = draggingPath === node.path;
  const isDragOver = dragOverPath === node.path;
  const inputRef = useRef<HTMLInputElement>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  const isValidDropTarget =
    draggingPath !== null &&
    draggingPath !== node.path &&
    !node.path.startsWith(draggingPath);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  function handleSingleClick() {
    onSelectPath(node.path);
    if (hasChildren && !node.expanded) onToggleExpand(node.path);
  }

  function handleClick() {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      if (isSelected && !readOnly) {
        onStartRename(node.path, node.name);
      }
      return;
    }
    handleSingleClick();
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
    }, 300);
  }

  function handleBlur() {
    if (Date.now() - editStartTime < 300) return;
    onCancelRename();
  }

  const rowContent = (
    <div
      data-tree-node
      className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors
        ${isSelected ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent hover:text-accent-foreground"}
        ${isDragging ? "opacity-40" : ""}
        ${isDragOver && (isValidDropTarget || draggingPath === null) ? "ring-2 ring-primary bg-primary/10" : ""}
      `}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      draggable={!isEditing && !readOnly}
      onContextMenu={() => onSelectPath(node.path)}
      onDragStart={
        readOnly
          ? undefined
          : (e) => {
              e.dataTransfer.setData("text/plain", node.path);
              e.dataTransfer.effectAllowed = "move";
              onDragStart(node.path);
            }
      }
      onDragEnd={readOnly ? undefined : onDragEnd}
      onDragOver={
        readOnly
          ? undefined
          : (e) => {
              const types = Array.from(e.dataTransfer.types);
              const hasExternalItems = types.includes(
                "application/x-datapool-items",
              );
              const hasExternalFiles =
                types.includes("Files") && !hasExternalItems;

              if (isValidDropTarget || hasExternalItems) {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                onDragOver(e, node.path);
              } else if (hasExternalFiles) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
                onDragOver(e, node.path);
              }
            }
      }
      onDragLeave={
        readOnly
          ? undefined
          : (e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                onDragLeave();
              }
            }
      }
      onDrop={
        readOnly
          ? undefined
          : (e) => {
              const types = Array.from(e.dataTransfer.types);
              const hasExternalItems = types.includes(
                "application/x-datapool-items",
              );
              const hasExternalFiles =
                types.includes("Files") && !hasExternalItems;

              if (isValidDropTarget || hasExternalItems || hasExternalFiles) {
                e.preventDefault();
                e.stopPropagation();
                onDrop(e, node.path);
              }
            }
      }
    >
      <button
        type="button"
        className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground"
        onClick={() => hasChildren && onToggleExpand(node.path)}
        aria-label={node.expanded ? "축소" : "확장"}
      >
        {hasChildren ? (
          node.expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )
        ) : null}
      </button>

      {isEditing ? (
        <div className="flex flex-1 items-center gap-1">
          {node.expanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <Input
            ref={inputRef}
            value={editName}
            onChange={(e) => onEditNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onFinishRename();
              if (e.key === "Escape") onCancelRename();
            }}
            onBlur={handleBlur}
            className="h-6 px-1 py-0 text-sm"
          />
        </div>
      ) : (
        <button
          type="button"
          className="flex flex-1 items-center gap-1.5 overflow-hidden text-left"
          onClick={handleClick}
        >
          {node.expanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate" title={node.name}>
            {node.name}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            ({node.image_count})
          </span>
        </button>
      )}
    </div>
  );

  return (
    <div>
      {isEditing || readOnly ? (
        rowContent
      ) : (
        <ContextMenu>
          <ContextMenuTrigger>{rowContent}</ContextMenuTrigger>
          <ContextMenuContent className="w-40">
            <ContextMenuItem onClick={() => onCreateFolder(node.path)}>
              <FolderPlus className="mr-2 h-3.5 w-3.5" />새 폴더
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() => onStartRename(node.path, node.name)}
            >
              <Pencil className="mr-2 h-3.5 w-3.5" />
              이름 변경
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              variant="destructive"
              onClick={() => onDeleteFolder(node.path)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" />
              삭제
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      )}

      {node.expanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              editingPath={editingPath}
              editName={editName}
              draggingPath={draggingPath}
              dragOverPath={dragOverPath}
              editStartTime={editStartTime}
              readOnly={readOnly}
              onSelectPath={onSelectPath}
              onToggleExpand={onToggleExpand}
              onDeleteFolder={onDeleteFolder}
              onCreateFolder={onCreateFolder}
              onStartRename={onStartRename}
              onEditNameChange={onEditNameChange}
              onFinishRename={onFinishRename}
              onCancelRename={onCancelRename}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}
