import { FolderInput, FolderOpen, Pencil, Trash2 } from "lucide-react";
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import type { DataPoolItem } from "@/types/image";

interface DataPoolContextMenuProps {
  item: DataPoolItem;
  selectedKeys: Set<string>;
  deleteLabel?: string;
  onNavigateFolder: (path: string) => void;
  onRenameFolder: (path: string) => void;
  onMoveSelected: () => void;
  onDeleteSelected: () => void;
  onDeleteFolder: (path: string) => void;
  onDeleteImage: (id: number) => void;
}

export default function DataPoolContextMenu({
  item,
  selectedKeys,
  deleteLabel = "삭제",
  onNavigateFolder,
  onRenameFolder,
  onMoveSelected,
  onDeleteSelected,
  onDeleteFolder,
  onDeleteImage,
}: DataPoolContextMenuProps) {
  const isMultiSelected = selectedKeys.size > 1;

  if (isMultiSelected && selectedKeys.has(item.key)) {
    return (
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onMoveSelected}>
          <FolderInput className="mr-2 h-3.5 w-3.5" />
          {selectedKeys.size}개 항목 이동...
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={onDeleteSelected}>
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          {selectedKeys.size}개 항목 {deleteLabel}
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  if (item.type === "folder" && item.folder) {
    return (
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => onNavigateFolder(item.folder!.path)}>
          <FolderOpen className="mr-2 h-3.5 w-3.5" />
          열기
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onRenameFolder(item.folder!.path)}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          이름 변경
        </ContextMenuItem>
        <ContextMenuItem onClick={onMoveSelected}>
          <FolderInput className="mr-2 h-3.5 w-3.5" />
          이동...
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={() => onDeleteFolder(item.folder!.path)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          {deleteLabel}
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  if (item.type === "image" && item.image) {
    return (
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={onMoveSelected}>
          <FolderInput className="mr-2 h-3.5 w-3.5" />
          이동...
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onClick={() => onDeleteImage(item.image!.id)}
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          {deleteLabel}
        </ContextMenuItem>
      </ContextMenuContent>
    );
  }

  return null;
}
