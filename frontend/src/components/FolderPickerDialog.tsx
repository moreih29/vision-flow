import { FolderOpen } from "lucide-react";
import {
  FileTreeView,
  type FileContentsResult,
} from "@/components/file-tree/FileTreeView";
import { imagesApi } from "@/api/images";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMemo, useState } from "react";

interface FolderPickerDialogProps {
  dataStoreId?: number;
  fetchFolderContents?: (
    path: string,
    skip?: number,
    limit?: number,
  ) => Promise<FileContentsResult>;
  fetchAllFolders?: () => Promise<string[]>;
  /** @deprecated fetchAllFolders를 사용하세요 */
  fetchFolders?: () => Promise<string[]>;
  open: boolean;
  onClose: () => void;
  onSelect: (targetFolder: string) => void;
  excludePaths?: string[];
  title?: string;
  confirmLabel?: string;
}

export default function FolderPickerDialog({
  dataStoreId,
  fetchFolderContents,
  fetchAllFolders,
  fetchFolders,
  open,
  onClose,
  onSelect,
  excludePaths = [],
  title = "이동할 폴더 선택",
  confirmLabel = "이동",
}: FolderPickerDialogProps) {
  const [selectedFolder, setSelectedFolder] = useState<string>("");
  const excludeSet = useMemo(() => new Set(excludePaths), [excludePaths]);

  // 폴더만 표시 — files는 항상 빈 배열로 강제
  const resolvedFetchFolderContents = useMemo(() => {
    const base: (
      path: string,
      skip?: number,
      limit?: number,
    ) => Promise<FileContentsResult> = fetchFolderContents
      ? fetchFolderContents
      : dataStoreId != null
        ? async (path, skip, limit) => {
            const res = await imagesApi.getFolderContents(
              dataStoreId,
              path,
              skip,
              limit,
            );
            return {
              folders: res.data.folders.map((f) => ({
                path: f.path,
                name: f.name,
                count: f.image_count,
                subfolder_count: f.subfolder_count,
              })),
              files: [],
            };
          }
        : async () => ({ folders: [], files: [] });
    return async (
      path: string,
      skip?: number,
      limit?: number,
    ): Promise<FileContentsResult> => {
      const result = await base(path, skip, limit);
      return { ...result, files: [], totalFiles: 0 };
    };
  }, [fetchFolderContents, dataStoreId]);

  const resolvedFetchAllFolders = useMemo(
    () =>
      fetchAllFolders
        ? fetchAllFolders
        : fetchFolders
          ? fetchFolders
          : dataStoreId != null
            ? () => imagesApi.getAllFolders(dataStoreId).then((res) => res.data)
            : () => Promise.resolve([]),
    [fetchAllFolders, fetchFolders, dataStoreId],
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="w-[520px] max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="h-[400px] overflow-auto rounded-md border flex flex-col">
          {open && (
            <FileTreeView
              readOnly
              fetchFolderContents={resolvedFetchFolderContents}
              fetchAllFolders={resolvedFetchAllFolders}
              rootLabel="루트 (최상위)"
              rootIcon={<FolderOpen className="h-4 w-4 shrink-0" />}
              selectedPath={selectedFolder}
              onSelectPath={(path) => {
                if (!excludeSet.has(path)) {
                  setSelectedFolder(path);
                }
              }}
            />
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>
            취소
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onSelect(selectedFolder);
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
