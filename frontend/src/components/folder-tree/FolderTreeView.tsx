import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Database,
  FolderPlus,
  RefreshCw,
} from "lucide-react";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { TreeNode } from "./TreeNode";
import {
  buildNode,
  updateNodeInTree,
  findNodeInTree,
  removeNodeFromTree,
  renameNodeInTree,
  addOrInvalidateChild,
  collectExpandedPaths,
} from "./tree-utils";
import type { FolderTreeNode } from "./tree-utils";

// -- 타입 정의 --

export interface FolderContentsResult {
  folders: Array<{
    path: string;
    name: string;
    image_count: number;
    subfolder_count: number;
  }>;
}

export interface FolderTreeRef {
  refresh: () => Promise<void>;
  expandAll: () => Promise<void>;
  collapseAll: () => void;
}

export interface FolderTreeViewProps {
  fetchFolderContents: (path: string) => Promise<FolderContentsResult>;
  fetchAllFolders?: () => Promise<string[]>;
  rootLabel?: string;
  rootImageCount?: number;
  rootIcon?: React.ReactNode;
  selectedPath?: string;
  readOnly?: boolean;
  acceptDropTypes?: string[];
  acceptFileDrop?: boolean;
  onSelectPath?: (path: string) => void;
  onDeleteFolder?: (path: string) => Promise<void>;
  onUpdateFolder?: (oldPath: string, newPath: string) => Promise<void>;
  onCreateFolder?: (parentPath: string) => Promise<void>;
  onDropItems?: (
    imageIds: number[],
    folderPaths: string[],
    targetPath: string,
  ) => Promise<void>;
  onPoolDrop?: (imageIds: number[], targetPath: string) => Promise<void>;
  onExternalFileDrop?: (entries: FileSystemEntry[], targetPath: string) => void;
  onRefresh?: () => void | Promise<void>;
  // checkbox 모드
  checkable?: boolean;
  checkedPaths?: Set<string>;
  onCheckPath?: (path: string, checked: boolean) => void;
  // 접기/펼치기
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  defaultCollapsed?: boolean;
}

// -- 헬퍼 함수 --

function collectAllLoadedPaths(node: FolderTreeNode): string[] {
  const paths = [node.path];
  if (node.children) {
    for (const child of node.children) {
      paths.push(...collectAllLoadedPaths(child));
    }
  }
  return paths;
}

function getNodeCheckState(
  node: FolderTreeNode,
  checkedPaths: Set<string>,
): "checked" | "indeterminate" | "unchecked" {
  const isChecked = checkedPaths.has(node.path);
  if (isChecked) return "checked";
  if (node.children && node.children.length > 0) {
    const childStates = node.children.map((c) =>
      getNodeCheckState(c, checkedPaths),
    );
    const anyChecked = childStates.some(
      (s) => s === "checked" || s === "indeterminate",
    );
    if (anyChecked) return "indeterminate";
  }
  return "unchecked";
}

// -- 메인 컴포넌트 --

export const FolderTreeView = forwardRef<FolderTreeRef, FolderTreeViewProps>(
  function FolderTreeView(
    {
      fetchFolderContents,
      fetchAllFolders,
      rootLabel,
      rootImageCount,
      rootIcon,
      selectedPath = "",
      readOnly = false,
      acceptDropTypes = [],
      acceptFileDrop = false,
      onSelectPath,
      onDeleteFolder,
      onUpdateFolder,
      onCreateFolder,
      onDropItems,
      onPoolDrop,
      onExternalFileDrop,
      onRefresh,
      checkable = false,
      checkedPaths,
      onCheckPath,
      collapsible = false,
      collapsed: controlledCollapsed,
      onCollapsedChange,
      defaultCollapsed = false,
    },
    ref,
  ) {
    const [rootNodes, setRootNodes] = useState<FolderTreeNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [editingPath, setEditingPath] = useState<string | null>(null);
    const [editName, setEditName] = useState("");
    const [editStartTime, setEditStartTime] = useState(0);
    const [draggingPath, setDraggingPath] = useState<string | null>(null);
    const [dragOverPath, setDragOverPath] = useState<string | null>(null);
    const [bgMenu, setBgMenu] = useState<{ x: number; y: number } | null>(null);
    const fileDropTargetRef = useRef<string>("");
    const selectAllRef = useRef<HTMLInputElement>(null);
    const [internalCollapsed, setInternalCollapsed] =
      useState(defaultCollapsed);
    const { confirmDialog: treeConfirmDialog, showAlert: treeShowAlert } =
      useConfirmDialog();

    const isCollapsed =
      controlledCollapsed !== undefined
        ? controlledCollapsed
        : internalCollapsed;

    const handleToggleCollapse = useCallback(() => {
      const next = !isCollapsed;
      setInternalCollapsed(next);
      onCollapsedChange?.(next);
    }, [isCollapsed, onCollapsedChange]);

    // checkable 모드에서는 readOnly 강제
    const effectiveReadOnly = readOnly || checkable;

    useEffect(() => {
      if (!bgMenu) return;
      const handler = () => setBgMenu(null);
      const timer = setTimeout(() => {
        window.addEventListener("mousedown", handler);
      }, 0);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("mousedown", handler);
      };
    }, [bgMenu]);

    const handleTreeBgContextMenu = useCallback(
      (e: React.MouseEvent) => {
        if (effectiveReadOnly) return;
        if ((e.target as HTMLElement).closest("[data-tree-node]")) return;
        e.preventDefault();
        setBgMenu({ x: e.clientX, y: e.clientY });
        onSelectPath?.("");
      },
      [onSelectPath, effectiveReadOnly],
    );

    const handleTreeBgClick = useCallback(
      (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest("[data-tree-node]")) return;
        if (!(e.currentTarget as HTMLElement).contains(e.target as HTMLElement))
          return;
        onSelectPath?.("");
      },
      [onSelectPath],
    );

    useEffect(() => {
      async function loadRoot() {
        setLoading(true);
        try {
          const result = await fetchFolderContents("");
          setRootNodes(result.folders.map(buildNode));
        } catch {
          // silently fail
        } finally {
          setLoading(false);
        }
      }
      loadRoot();
    }, [fetchFolderContents]);

    // -- 전체 선택 체크박스 상태 --
    const resolvedCheckedPaths = checkedPaths ?? new Set<string>();
    const allRootPaths = rootNodes.map((n) => n.path);
    const allChecked =
      allRootPaths.length > 0 &&
      allRootPaths.every((p) => resolvedCheckedPaths.has(p));
    const someChecked =
      !allChecked &&
      (allRootPaths.some((p) => resolvedCheckedPaths.has(p)) ||
        resolvedCheckedPaths.size > 0);

    useEffect(() => {
      if (selectAllRef.current) {
        selectAllRef.current.indeterminate = someChecked && !allChecked;
      }
    }, [someChecked, allChecked]);

    function handleSelectAll(checked: boolean) {
      if (!onCheckPath) return;
      for (const node of rootNodes) {
        const allNodePaths = collectAllLoadedPaths(node);
        for (const p of allNodePaths) {
          onCheckPath(p, checked);
        }
      }
    }

    function handleCheckNode(node: FolderTreeNode, checked: boolean) {
      if (!onCheckPath) return;
      onCheckPath(node.path, checked);
      if (node.children) {
        const allPaths = collectAllLoadedPaths(node);
        for (const p of allPaths) {
          if (p !== node.path) onCheckPath(p, checked);
        }
      }
    }

    // -- 전체 펼치기/접기 --
    async function handleExpandAll() {
      try {
        // API 1회로 전체 폴더 경로 목록 가져오기
        const allPaths: string[] = fetchAllFolders
          ? await fetchAllFolders()
          : [];

        // 경로 목록에서 트리 구조 구축
        function buildTreeFromPaths(parentPath: string): FolderTreeNode[] {
          const directChildren = new Map<
            string,
            { path: string; name: string; subPaths: string[] }
          >();
          for (const fp of allPaths) {
            if (!fp.startsWith(parentPath) || fp === parentPath) continue;
            const relative = fp.slice(parentPath.length);
            const firstSegment = relative.split("/")[0];
            if (!firstSegment) continue;
            const childPath = parentPath + firstSegment + "/";
            if (!directChildren.has(childPath)) {
              directChildren.set(childPath, {
                path: childPath,
                name: firstSegment,
                subPaths: [],
              });
            }
          }
          // 각 자식의 하위 폴더 수 + 이미지 카운트는 기존 rootNodes에서 찾기
          return [...directChildren.values()]
            .sort((a, b) => a.path.localeCompare(b.path))
            .map(({ path, name }) => {
              const existing = findNodeInTree(rootNodes, path);
              const children = buildTreeFromPaths(path);
              return {
                path,
                name,
                image_count: existing?.image_count ?? 0,
                subfolder_count: children.length,
                expanded: true,
                loaded: true,
                children: children.length > 0 ? children : undefined,
              };
            });
        }

        const expandedNodes = buildTreeFromPaths("");
        setRootNodes(expandedNodes);

        // 카운트 업데이트: 펼쳐진 모든 경로에 대해 getFolderContents 병렬 호출
        const pathsToUpdate = collectExpandedPaths(expandedNodes).sort(
          (a, b) => a.split("/").length - b.split("/").length,
        );
        let updatedNodes = expandedNodes;
        await Promise.all(
          pathsToUpdate.map(async (p) => {
            try {
              const childResult = await fetchFolderContents(p);
              const childFolders = childResult.folders;
              updatedNodes = updateNodeInTree(updatedNodes, p, (n) => ({
                ...n,
                children: n.children?.map((c) => {
                  const info = childFolders.find((f) => f.path === c.path);
                  return info
                    ? {
                        ...c,
                        image_count: info.image_count,
                        subfolder_count: info.subfolder_count,
                      }
                    : c;
                }),
              }));
            } catch {
              // skip
            }
          }),
        );
        // 루트 레벨 카운트도 업데이트
        try {
          const rootResult = await fetchFolderContents("");
          updatedNodes = updatedNodes.map((n) => {
            const info = rootResult.folders.find((f) => f.path === n.path);
            return info
              ? {
                  ...n,
                  image_count: info.image_count,
                  subfolder_count: info.subfolder_count,
                }
              : n;
          });
        } catch {
          // skip
        }
        setRootNodes(updatedNodes);
      } catch {
        // fallback: 기존 노드 그냥 펼치기
        setRootNodes((prev) => prev.map((n) => ({ ...n, expanded: true })));
      }
    }

    function handleCollapseAll() {
      function collapseNodes(nodes: FolderTreeNode[]): FolderTreeNode[] {
        return nodes.map((n) => ({
          ...n,
          expanded: false,
          children: n.children ? collapseNodes(n.children) : undefined,
        }));
      }
      setRootNodes(collapseNodes(rootNodes));
    }

    useImperativeHandle(ref, () => ({
      async refresh() {
        const expandedPaths = collectExpandedPaths(rootNodes).sort(
          (a, b) => a.split("/").length - b.split("/").length,
        );

        const rootResult = await fetchFolderContents("");
        let newNodes = rootResult.folders.map(buildNode);

        for (const path of expandedPaths) {
          if (!findNodeInTree(newNodes, path)) continue;
          try {
            const childResult = await fetchFolderContents(path);
            newNodes = updateNodeInTree(newNodes, path, (n) => ({
              ...n,
              expanded: true,
              loaded: true,
              children: childResult.folders.map(buildNode),
            }));
          } catch {
            // skip failed re-expansions
          }
        }

        setRootNodes(newNodes);
      },
      expandAll: handleExpandAll,
      collapseAll: handleCollapseAll,
    }));

    async function handleToggleExpand(path: string) {
      const findNode = (
        nodes: FolderTreeNode[],
      ): FolderTreeNode | undefined => {
        for (const n of nodes) {
          if (n.path === path) return n;
          if (n.children) {
            const found = findNode(n.children);
            if (found) return found;
          }
        }
        return undefined;
      };

      const node = findNode(rootNodes);
      if (!node) return;

      if (node.expanded) {
        setRootNodes((prev) =>
          updateNodeInTree(prev, path, (n) => ({ ...n, expanded: false })),
        );
        return;
      }

      if (!node.loaded) {
        try {
          const result = await fetchFolderContents(path);
          const children = result.folders.map(buildNode);
          setRootNodes((prev) =>
            updateNodeInTree(prev, path, (n) => ({
              ...n,
              expanded: true,
              loaded: true,
              children,
            })),
          );
          // 체크 모드: 상위가 체크된 상태면 새로 로드된 하위도 체크
          if (checkable && onCheckPath && resolvedCheckedPaths.has(path)) {
            for (const child of children) {
              onCheckPath(child.path, true);
            }
          }
        } catch {
          // silently fail
        }
      } else {
        setRootNodes((prev) =>
          updateNodeInTree(prev, path, (n) => ({ ...n, expanded: true })),
        );
      }
    }

    async function handleDeleteFolder(path: string) {
      if (!onDeleteFolder) return;
      try {
        await onDeleteFolder(path);
      } catch {
        // cancelled or API error
      }
    }

    function handleStartRename(path: string, name: string) {
      setEditingPath(path);
      setEditName(name);
      setEditStartTime(Date.now());
    }

    async function handleFinishRename() {
      if (!editingPath || !editName.trim()) {
        setEditingPath(null);
        return;
      }

      const oldPath = editingPath;
      const trimmedName = editName.trim();

      if (trimmedName.includes("/") || trimmedName.includes("\\")) {
        await treeShowAlert({
          title: "폴더 이름에 / 또는 \\ 문자를 포함할 수 없습니다.",
        });
        return;
      }

      const parts = oldPath.replace(/\/$/, "").split("/");
      const oldName = parts[parts.length - 1];
      if (trimmedName === oldName) {
        setEditingPath(null);
        return;
      }
      parts[parts.length - 1] = trimmedName;
      const newPath = parts.join("/") + "/";

      setEditingPath(null);

      try {
        await onUpdateFolder?.(oldPath, newPath);
        setRootNodes((prev) =>
          renameNodeInTree(prev, oldPath, newPath, trimmedName),
        );
      } catch {
        // error handled by parent
      }
    }

    function handleCancelRename() {
      setEditingPath(null);
    }

    function handleDragStart(path: string) {
      setDraggingPath(path);
    }
    function handleDragEnd() {
      setDraggingPath(null);
      setDragOverPath(null);
    }
    function handleDragOver(_e: React.DragEvent, path: string) {
      setDragOverPath(path);
      fileDropTargetRef.current = path;
    }
    function handleDragLeave() {
      setDragOverPath(null);
    }

    async function handleDrop(_e: React.DragEvent, targetPath: string) {
      const types = Array.from(_e.dataTransfer.types);
      const hasExternalFiles =
        types.includes("Files") &&
        !types.includes("application/x-datapool-items");

      if (hasExternalFiles && !draggingPath) {
        setDragOverPath(null);
        fileDropTargetRef.current = "";
        const entries = _e.dataTransfer.items
          ? Array.from(_e.dataTransfer.items)
              .map((item) => item.webkitGetAsEntry())
              .filter((entry): entry is FileSystemEntry => entry !== null)
          : [];
        if (entries.length > 0) {
          onExternalFileDrop?.(entries, targetPath);
        }
        return;
      }

      const taskItemsData =
        _e.dataTransfer.getData("application/x-task-items") ||
        _e.dataTransfer.getData("application/x-datapool-items");
      if (taskItemsData) {
        setDragOverPath(null);
        try {
          const { taskImageIds, imageIds, folderPaths, source } =
            JSON.parse(taskItemsData);
          if (source === "pool" && onPoolDrop) {
            await onPoolDrop(imageIds ?? [], targetPath);
          } else {
            await onDropItems?.(
              taskImageIds ?? imageIds ?? [],
              folderPaths ?? [],
              targetPath,
            );
          }
        } catch {
          /* handled by parent */
        }
        return;
      }

      if (!draggingPath) return;

      const sourcePath = draggingPath;
      const folderName = sourcePath.replace(/\/$/, "").split("/").pop()!;
      const newPath = `${targetPath}${folderName}/`;

      setDraggingPath(null);
      setDragOverPath(null);

      if (newPath === sourcePath) return;

      try {
        await onUpdateFolder?.(sourcePath, newPath);
        setRootNodes((prev) => {
          const movedNode = findNodeInTree(prev, sourcePath);
          let updated = removeNodeFromTree(prev, sourcePath);
          if (movedNode) {
            const newChild: FolderTreeNode = {
              ...movedNode,
              path: newPath,
              name: folderName,
              children: undefined,
              loaded: false,
              expanded: false,
            };
            updated = updated.map((n) =>
              addOrInvalidateChild(n, targetPath, newChild),
            );
          }
          return updated;
        });
      } catch {
        // error handled by parent
      }
    }

    // -- 루트 드롭 존 --

    function handleRootDragOver(e: React.DragEvent) {
      const types = Array.from(e.dataTransfer.types);
      const hasExternalItems =
        types.includes("application/x-datapool-items") ||
        types.includes("application/x-task-items");
      const hasExternalFiles = types.includes("Files") && !hasExternalItems;

      if (hasExternalFiles) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        if (!fileDropTargetRef.current) {
          setDragOverPath("__root__");
        }
        return;
      }
      if (hasExternalItems) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = "move";
        setDragOverPath("__root__");
        return;
      }
      if (!draggingPath) return;
      const parts = draggingPath.replace(/\/$/, "").split("/");
      if (parts.length <= 1) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverPath("__root__");
    }

    function handleRootDragLeave(e: React.DragEvent) {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragOverPath(null);
      }
    }

    async function handleRootDrop(e: React.DragEvent) {
      e.preventDefault();
      e.stopPropagation();

      const types = Array.from(e.dataTransfer.types);
      const hasExternalFiles =
        types.includes("Files") &&
        !types.includes("application/x-datapool-items") &&
        !types.includes("application/x-task-items");

      if (hasExternalFiles) {
        const targetPath = fileDropTargetRef.current;
        fileDropTargetRef.current = "";
        setDragOverPath(null);
        const entries = e.dataTransfer.items
          ? Array.from(e.dataTransfer.items)
              .map((item) => item.webkitGetAsEntry())
              .filter((entry): entry is FileSystemEntry => entry !== null)
          : [];

        if (entries.length > 0) {
          onExternalFileDrop?.(entries, targetPath);
        }
        return;
      }

      const taskItemsData =
        e.dataTransfer.getData("application/x-task-items") ||
        e.dataTransfer.getData("application/x-datapool-items");
      if (taskItemsData) {
        setDragOverPath(null);
        try {
          const { taskImageIds, imageIds, folderPaths, source } =
            JSON.parse(taskItemsData);
          if (source === "pool" && onPoolDrop) {
            await onPoolDrop(imageIds ?? [], "");
          } else {
            await onDropItems?.(
              taskImageIds ?? imageIds ?? [],
              folderPaths ?? [],
              "",
            );
          }
        } catch {
          /* handled by parent */
        }
        return;
      }

      if (!draggingPath) return;

      const sourcePath = draggingPath;
      const parts = sourcePath.replace(/\/$/, "").split("/");
      if (parts.length <= 1) return;

      const folderName = parts[parts.length - 1];
      const newPath = `${folderName}/`;

      setDraggingPath(null);
      setDragOverPath(null);

      try {
        await onUpdateFolder?.(sourcePath, newPath);
        setRootNodes((prev) => {
          const movedNode = findNodeInTree(prev, sourcePath);
          const updated = removeNodeFromTree(prev, sourcePath);
          if (movedNode) {
            const newRootNode: FolderTreeNode = {
              ...movedNode,
              path: newPath,
              name: folderName,
              children: undefined,
              loaded: false,
              expanded: false,
            };
            return [...updated, newRootNode].sort((a, b) =>
              a.path.localeCompare(b.path),
            );
          }
          return updated;
        });
      } catch {
        // error handled by parent
      }
    }

    // -- 폴더 생성 --

    function generateNewFolderName(parentPath: string): string {
      const baseName = "새 폴더";
      const existingNames = new Set<string>();
      if (parentPath === "") {
        rootNodes.forEach((n) => existingNames.add(n.name));
      } else {
        const parentNode = findNodeInTree(rootNodes, parentPath);
        if (parentNode?.children) {
          parentNode.children.forEach((n) => existingNames.add(n.name));
        }
      }
      if (!existingNames.has(baseName)) return baseName;
      let i = 1;
      while (existingNames.has(`${baseName}(${i})`)) i++;
      return `${baseName}(${i})`;
    }

    async function handleCreateFolder(parentPath: string) {
      if (!onCreateFolder) return;
      const name = generateNewFolderName(parentPath);
      const newPath = parentPath + name + "/";
      try {
        await onCreateFolder(newPath);
        const newNode = buildNode({
          path: newPath,
          name,
          image_count: 0,
          subfolder_count: 0,
        });
        if (parentPath === "") {
          setRootNodes((prev) =>
            [...prev, newNode].sort((a, b) => a.path.localeCompare(b.path)),
          );
        } else {
          setRootNodes((prev) => {
            let updated = prev;
            const parentNode = findNodeInTree(updated, parentPath);
            if (parentNode && !parentNode.expanded) {
              updated = updateNodeInTree(updated, parentPath, (n) => ({
                ...n,
                expanded: true,
                loaded: true,
                children: n.children ?? [],
              }));
            }
            return updated.map((n) =>
              addOrInvalidateChild(n, parentPath, newNode),
            );
          });
        }
        handleStartRename(newPath, name);
      } catch {
        // error handled by parent
      }
    }

    // -- checkable 모드 노드 렌더 --

    function renderCheckableNodes(
      list: FolderTreeNode[],
      depth: number,
    ): React.ReactNode {
      return list.map((node) => {
        const checkState = getNodeCheckState(node, resolvedCheckedPaths);
        return (
          <TreeNode
            key={node.path}
            node={node}
            depth={depth}
            readOnly
            checkable
            checked={checkState === "checked"}
            indeterminate={checkState === "indeterminate"}
            onCheck={(checked) => handleCheckNode(node, checked)}
            onToggleExpand={handleToggleExpand}
            renderChildren={(children, childDepth) =>
              renderCheckableNodes(children, childDepth)
            }
          />
        );
      });
    }

    // -- 로딩 상태 --

    if (loading) {
      return (
        <div className="space-y-1 p-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-muted" />
          ))}
        </div>
      );
    }

    // -- 루트 노드 엘리먼트 --

    const rootNodeElement = rootLabel ? (
      <div
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-colors mb-1 ${
          collapsible
            ? "cursor-pointer hover:bg-accent hover:text-accent-foreground"
            : selectedPath === ""
              ? "bg-accent text-accent-foreground font-medium cursor-pointer"
              : "hover:bg-accent hover:text-accent-foreground cursor-pointer"
        } ${dragOverPath === "__root__" ? "ring-2 ring-primary bg-primary/10" : ""}`}
        onClick={collapsible ? handleToggleCollapse : () => onSelectPath?.("")}
        onDragOver={effectiveReadOnly ? undefined : handleRootDragOver}
        onDragLeave={effectiveReadOnly ? undefined : handleRootDragLeave}
        onDrop={effectiveReadOnly ? undefined : handleRootDrop}
      >
        {collapsible && (
          <button
            type="button"
            className="shrink-0 flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleCollapse();
            }}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
        {checkable && (
          <input
            ref={selectAllRef}
            type="checkbox"
            className="h-3.5 w-3.5 shrink-0 accent-primary cursor-pointer"
            checked={allChecked}
            onChange={(e) => handleSelectAll(e.target.checked)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        {rootIcon ?? (
          <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate font-medium">{rootLabel}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          ({rootImageCount})
        </span>
        <span className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              const hasExpanded = rootNodes.some((n) => n.expanded);
              if (hasExpanded) {
                handleCollapseAll();
              } else {
                handleExpandAll();
              }
            }}
            title={
              rootNodes.some((n) => n.expanded) ? "전체 접기" : "전체 펼치기"
            }
          >
            {rootNodes.some((n) => n.expanded) ? (
              <ChevronsDownUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronsUpDown className="h-3.5 w-3.5" />
            )}
          </button>
          {onRefresh && (
            <button
              type="button"
              className="shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              disabled={refreshing}
              onClick={async (e) => {
                e.stopPropagation();
                setRefreshing(true);
                try {
                  await onRefresh();
                } finally {
                  setRefreshing(false);
                }
              }}
              title="새로고침"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
          )}
        </span>
      </div>
    ) : null;

    // -- 빈 상태 --

    if (rootNodes.length === 0) {
      return (
        <div
          className="flex flex-col flex-1 min-h-0"
          onContextMenu={handleTreeBgContextMenu}
          onClick={handleTreeBgClick}
        >
          {rootNodeElement}
          {!isCollapsed && (
            <div className="flex flex-col items-center gap-2 p-4 text-center">
              <p className="text-sm text-muted-foreground">폴더가 없습니다.</p>
              {onCreateFolder && !effectiveReadOnly && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => handleCreateFolder("")}
                >
                  + 새 폴더 만들기
                </button>
              )}
            </div>
          )}
          {bgMenu && !effectiveReadOnly && (
            <div
              className="fixed z-50 w-40 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              style={{ left: bgMenu.x, top: bgMenu.y }}
            >
              <button
                type="button"
                className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setBgMenu(null);
                  handleCreateFolder("");
                }}
              >
                <FolderPlus className="h-3.5 w-3.5" />새 폴더
              </button>
            </div>
          )}
          {treeConfirmDialog}
        </div>
      );
    }

    // -- 트리 콘텐츠 --

    return (
      <div className="flex flex-col flex-1 min-h-0">
        {/* 루트 노드 헤더 — 고정 */}
        <div className="shrink-0">{rootNodeElement}</div>
        {/* 트리 목록 — collapsed이면 숨김 */}
        {!isCollapsed && (
          <div
            className="space-y-0.5 flex-1 min-h-0 overflow-y-auto"
            onDragOver={effectiveReadOnly ? undefined : handleRootDragOver}
            onDragLeave={effectiveReadOnly ? undefined : handleRootDragLeave}
            onDrop={effectiveReadOnly ? undefined : handleRootDrop}
            onContextMenu={handleTreeBgContextMenu}
            onClick={handleTreeBgClick}
          >
            {checkable
              ? renderCheckableNodes(rootNodes, 0)
              : rootNodes.map((node) => (
                  <TreeNode
                    key={node.path}
                    node={node}
                    depth={0}
                    selectedPath={selectedPath}
                    editingPath={editingPath}
                    editName={editName}
                    draggingPath={draggingPath}
                    dragOverPath={dragOverPath}
                    editStartTime={editStartTime}
                    readOnly={effectiveReadOnly}
                    acceptDropTypes={acceptDropTypes}
                    acceptFileDrop={acceptFileDrop}
                    onSelectPath={onSelectPath}
                    onToggleExpand={handleToggleExpand}
                    onDeleteFolder={handleDeleteFolder}
                    onCreateFolder={handleCreateFolder}
                    onStartRename={handleStartRename}
                    onEditNameChange={setEditName}
                    onFinishRename={handleFinishRename}
                    onCancelRename={handleCancelRename}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  />
                ))}
          </div>
        )}
        {bgMenu && !effectiveReadOnly && (
          <div
            className="fixed z-50 w-40 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            style={{ left: bgMenu.x, top: bgMenu.y }}
          >
            <button
              type="button"
              className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                setBgMenu(null);
                handleCreateFolder("");
              }}
            >
              <FolderPlus className="h-3.5 w-3.5" />새 폴더
            </button>
          </div>
        )}
        {treeConfirmDialog}
      </div>
    );
  },
);
