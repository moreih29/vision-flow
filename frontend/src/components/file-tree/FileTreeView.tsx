import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  buildFolderNode,
  buildFileNode,
  updateNodeInTree,
  findNodeInTree,
  removeNodeFromTree,
  renameNodeInTree,
  addOrInvalidateChild,
  collectExpandedPaths,
} from "./tree-utils";
import type { FileTreeNode, FlatNode } from "./tree-utils";
import { flattenTree } from "./tree-utils";

// -- 상수 --

const FILE_PAGE_SIZE = 50;
const TREE_ROW_HEIGHT = 28; // 트리 노드 높이 (py-1 = 4px*2 + text ~20px)

// -- PlaceholderRow 컴포넌트 --

function PlaceholderRow({ depth }: { depth: number }) {
  return (
    <div className="px-2 py-1" style={{ paddingLeft: `${depth * 16 + 8}px` }}>
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}

// -- 헬퍼: 폴더 먼저, 파일 나중 정렬 --

function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  const folders = nodes
    .filter((n) => n.type === "folder")
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }));
  const files = nodes
    .filter((n) => n.type === "file")
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  return [...folders, ...files];
}

// -- 헬퍼: files → 노드 변환 --

function buildFileNodes(result: {
  files?: Array<{ id: number; name: string; path: string }>;
  totalFiles?: number;
}): { visibleFiles: FileTreeNode[]; hiddenCount: number } {
  const visibleFiles = (result.files ?? []).map(buildFileNode);
  const hiddenCount = Math.max(
    0,
    (result.totalFiles ?? visibleFiles.length) - visibleFiles.length,
  );
  return { visibleFiles, hiddenCount };
}

// -- 타입 정의 --

export interface FileContentsResult {
  folders: Array<{
    path: string;
    name: string;
    count: number;
    subfolder_count: number;
  }>;
  files?: Array<{
    id: number;
    name: string;
    path: string;
  }>;
  totalFiles?: number;
}

export interface FileTreeRef {
  refresh: () => Promise<void>;
  expandAll: () => Promise<void>;
  collapseAll: () => void;
  expandToPath: (path: string) => Promise<void>;
  collapseBelow: (path: string) => void;
}

export interface FileTreeViewProps {
  fetchFolderContents: (
    path: string,
    skip?: number,
    limit?: number,
  ) => Promise<FileContentsResult>;
  fetchAllFolders?: () => Promise<string[]>;
  rootLabel?: string;
  rootCount?: number;
  rootIcon?: React.ReactNode;
  selectedPath?: string;
  readOnly?: boolean;
  acceptDropTypes?: string[];
  acceptFileDrop?: boolean;
  onSelectPath?: (path: string) => void;
  onFileClick?: (path: string, fileId?: number) => void;
  onDeleteFolder?: (path: string) => Promise<void>;
  onUpdateFolder?: (oldPath: string, newPath: string) => Promise<void>;
  onCreateFolder?: (parentPath: string) => Promise<void>;
  onItemDrop?: (e: React.DragEvent, targetPath: string) => void;
  onExternalFileDrop?: (entries: FileSystemEntry[], targetPath: string) => void;
  onRefresh?: () => void | Promise<void>;
  // checkbox 모드
  checkable?: boolean;
  checkedPaths?: Set<string>;
  onCheckPath?: (
    path: string,
    checked: boolean,
    count: number,
    fileId?: number,
  ) => void;
  // 접기/펼치기
  collapsible?: boolean;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  defaultCollapsed?: boolean;
  newFolderBaseName?: string;
}

// -- 헬퍼 함수 --

function collectAllLoadedNodes(
  node: FileTreeNode,
): Array<{ path: string; count: number; fileId?: number }> {
  const count = node.type === "file" ? 1 : node.count;
  const nodes: Array<{ path: string; count: number; fileId?: number }> = [
    { path: node.path, count, fileId: node.fileId },
  ];
  if (node.children) {
    for (const child of node.children) {
      nodes.push(...collectAllLoadedNodes(child));
    }
  }
  return nodes;
}

function getNodeCheckState(
  node: FileTreeNode,
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

export const FileTreeView = forwardRef<FileTreeRef, FileTreeViewProps>(
  function FileTreeView(
    {
      fetchFolderContents,
      fetchAllFolders,
      rootLabel,
      rootCount,
      rootIcon,
      selectedPath = "",
      readOnly = false,
      acceptDropTypes = [],
      acceptFileDrop = false,
      onSelectPath,
      onFileClick,
      onDeleteFolder,
      onUpdateFolder,
      onCreateFolder,
      onItemDrop,
      onExternalFileDrop,
      onRefresh,
      checkable = false,
      checkedPaths,
      onCheckPath,
      collapsible = false,
      collapsed: controlledCollapsed,
      onCollapsedChange,
      defaultCollapsed = false,
      newFolderBaseName,
    },
    ref,
  ) {
    const [rootNodes, setRootNodes] = useState<FileTreeNode[]>([]);
    const [rootHiddenFileCount, setRootHiddenFileCount] = useState(0);
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
    const scrollRef = useRef<HTMLDivElement>(null);
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
        if (readOnly) {
          e.preventDefault();
          return;
        }
        if ((e.target as HTMLElement).closest("[data-tree-node]")) return;
        e.preventDefault();
        setBgMenu({ x: e.clientX, y: e.clientY });
        onSelectPath?.("");
      },
      [onSelectPath, readOnly],
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
          const result = await fetchFolderContents("", 0, FILE_PAGE_SIZE);
          const folderNodes = result.folders.map(buildFolderNode);
          const { visibleFiles, hiddenCount } = buildFileNodes(result);
          setRootNodes(sortNodes([...folderNodes, ...visibleFiles]));
          setRootHiddenFileCount(hiddenCount);
        } catch {
          // silently fail
        } finally {
          setLoading(false);
        }
        // 초기 마운트 시 selectedPath가 있으면 해당 경로까지 자동 펼침
        if (selectedPath) {
          const segments = selectedPath
            .replace(/\/$/, "")
            .split("/")
            .filter(Boolean);
          let current = "";
          for (const seg of segments) {
            current += seg + "/";
            await expandNode(current);
          }
        }
      }
      loadRoot();
    }, [fetchFolderContents]); // eslint-disable-line react-hooks/exhaustive-deps

    // -- 가상화 --
    const { flatNodes, maxDepth } = useMemo(() => {
      const result: FlatNode[] = [];
      flattenTree(rootNodes, 0, result);
      if (rootHiddenFileCount > 0) {
        const rootFileCount = rootNodes.filter((n) => n.type === "file").length;
        for (let i = 0; i < rootHiddenFileCount; i++) {
          result.push({
            type: "placeholder",
            parentPath: "",
            fileIndex: rootFileCount + i,
            depth: 0,
          });
        }
      }
      const max = result.reduce((acc, fn) => Math.max(acc, fn.depth), 0);
      return { flatNodes: result, maxDepth: max };
    }, [rootNodes, rootHiddenFileCount]);

    const virtualizer = useVirtualizer({
      count: flatNodes.length,
      getScrollElement: () => scrollRef.current,
      estimateSize: () => TREE_ROW_HEIGHT,
      overscan: 10,
    });

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
        const allNodes = collectAllLoadedNodes(node);
        for (const n of allNodes) {
          onCheckPath(n.path, checked, n.count, n.fileId);
        }
      }
    }

    function handleCheckNode(node: FileTreeNode, checked: boolean) {
      if (!onCheckPath) return;
      const nodeCount = node.type === "file" ? 1 : node.count;
      onCheckPath(node.path, checked, nodeCount, node.fileId);
      if (node.children) {
        const allNodes = collectAllLoadedNodes(node);
        for (const n of allNodes) {
          if (n.path !== node.path)
            onCheckPath(n.path, checked, n.count, n.fileId);
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
        function buildTreeFromPaths(parentPath: string): FileTreeNode[] {
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
                type: "folder" as const,
                path,
                name,
                count: existing?.count ?? 0,
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
              const childFileNodes = (childResult.files ?? []).map(
                buildFileNode,
              );
              updatedNodes = updateNodeInTree(updatedNodes, p, (n) => ({
                ...n,
                children: [
                  ...(n.children?.map((c) => {
                    const info = childFolders.find((f) => f.path === c.path);
                    return info
                      ? {
                          ...c,
                          count: info.count,
                          subfolder_count: info.subfolder_count,
                        }
                      : c;
                  }) ?? []),
                  ...childFileNodes,
                ],
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
                  count: info.count,
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
      function collapseNodes(nodes: FileTreeNode[]): FileTreeNode[] {
        return nodes.map((n) => ({
          ...n,
          expanded: false,
          children: n.children ? collapseNodes(n.children) : undefined,
        }));
      }
      setRootNodes(collapseNodes(rootNodes));
    }

    // -- 파일 페이지 로드 --

    const loadedPagesRef = useRef<Set<string>>(new Set());

    const handleLoadPage = useCallback(
      async (parentPath: string, skip: number) => {
        const pageKey = `${parentPath}:${skip}`;
        if (loadedPagesRef.current.has(pageKey)) return;
        loadedPagesRef.current.add(pageKey);

        try {
          const result = await fetchFolderContents(
            parentPath,
            skip,
            FILE_PAGE_SIZE,
          );
          const newFileNodes = (result.files ?? []).map(buildFileNode);

          if (parentPath === "") {
            setRootNodes((prev) => {
              const existingIds = new Set(
                prev.filter((n) => n.type === "file").map((n) => n.fileId),
              );
              const dedupedNew = newFileNodes.filter(
                (n) => !existingIds.has(n.fileId),
              );
              const updated = sortNodes([...prev, ...dedupedNew]);
              const totalLoaded = updated.filter(
                (n) => n.type === "file",
              ).length;
              const remaining = Math.max(
                0,
                (result.totalFiles ?? 0) - totalLoaded,
              );
              setRootHiddenFileCount(remaining);
              return updated;
            });
          } else {
            setRootNodes((prev) =>
              updateNodeInTree(prev, parentPath, (n) => {
                const existingChildren = n.children ?? [];
                const existingIds = new Set(
                  existingChildren
                    .filter((c) => c.type === "file")
                    .map((c) => c.fileId),
                );
                const dedupedNew = newFileNodes.filter(
                  (c) => !existingIds.has(c.fileId),
                );
                const updatedChildren = sortNodes([
                  ...existingChildren,
                  ...dedupedNew,
                ]);
                const totalLoaded = updatedChildren.filter(
                  (c) => c.type === "file",
                ).length;
                const remaining = Math.max(
                  0,
                  (result.totalFiles ?? 0) - totalLoaded,
                );
                return {
                  ...n,
                  children: updatedChildren,
                  totalFiles: remaining > 0 ? remaining : undefined,
                };
              }),
            );
          }
        } catch {
          loadedPagesRef.current.delete(pageKey);
        }
      },
      [fetchFolderContents],
    );

    // -- placeholder 자동 fetch: virtualizer 아이템 감시 --
    const virtualItems = virtualizer.getVirtualItems();

    useEffect(() => {
      // 뷰포트에 보이는 placeholder의 parentPath 수집
      const visibleParents = new Set<string>();
      for (const vr of virtualItems) {
        const fn = flatNodes[vr.index];
        if (fn && fn.type === "placeholder") {
          visibleParents.add(fn.parentPath);
        }
      }
      // 보이는 placeholder가 있는 폴더의 미로드 페이지를 처음부터 순차 로드
      for (const parentPath of visibleParents) {
        for (const fn of flatNodes) {
          if (
            fn.type === "placeholder" &&
            fn.parentPath === parentPath &&
            fn.fileIndex % FILE_PAGE_SIZE === 0
          ) {
            handleLoadPage(fn.parentPath, fn.fileIndex);
            break; // 해당 폴더의 첫 미로드 페이지만 트리거 (순차)
          }
        }
      }
    }, [virtualItems, flatNodes, handleLoadPage]);

    useImperativeHandle(ref, () => ({
      async refresh() {
        loadedPagesRef.current.clear();
        const expandedPaths = collectExpandedPaths(rootNodes).sort(
          (a, b) => a.split("/").length - b.split("/").length,
        );

        const rootResult = await fetchFolderContents("", 0, FILE_PAGE_SIZE);
        const rootFolderNodes = rootResult.folders.map(buildFolderNode);
        const { visibleFiles: rootFileNodes, hiddenCount: rootHidden } =
          buildFileNodes(rootResult);
        let newNodes = sortNodes([...rootFolderNodes, ...rootFileNodes]);
        setRootHiddenFileCount(rootHidden);

        for (const path of expandedPaths) {
          if (!findNodeInTree(newNodes, path)) continue;
          try {
            const childResult = await fetchFolderContents(
              path,
              0,
              FILE_PAGE_SIZE,
            );
            const childFolderNodes = childResult.folders.map(buildFolderNode);
            const { visibleFiles: childFileNodes, hiddenCount } =
              buildFileNodes(childResult);
            newNodes = updateNodeInTree(newNodes, path, (n) => ({
              ...n,
              expanded: true,
              loaded: true,
              children: sortNodes([...childFolderNodes, ...childFileNodes]),
              totalFiles: hiddenCount > 0 ? hiddenCount : undefined,
            }));
          } catch {
            // skip failed re-expansions
          }
        }

        setRootNodes(newNodes);
      },
      expandAll: async () => {
        loadedPagesRef.current.clear();
        await handleExpandAll();
      },
      collapseAll: () => {
        loadedPagesRef.current.clear();
        handleCollapseAll();
      },
      async expandToPath(targetPath: string) {
        const segments = targetPath
          .replace(/\/$/, "")
          .split("/")
          .filter(Boolean);
        let current = "";
        for (const seg of segments) {
          current += seg + "/";
          await expandNode(current);
        }
      },
      collapseBelow(path: string) {
        function collapseAllDescendants(nodes: FileTreeNode[]): FileTreeNode[] {
          return nodes.map((n) => ({
            ...n,
            expanded: false,
            children: n.children
              ? collapseAllDescendants(n.children)
              : n.children,
          }));
        }
        setRootNodes((prev) => {
          if (!path) {
            // 루트로 이동: 모든 노드 접기
            return collapseAllDescendants(prev);
          }
          const normalizedPath = path.endsWith("/") ? path : path + "/";
          // 대상 노드의 자식들만 재귀적으로 접기
          return updateNodeInTree(prev, normalizedPath, (n) => ({
            ...n,
            children: n.children
              ? collapseAllDescendants(n.children)
              : n.children,
          }));
        });
      },
    }));

    // 최신 rootNodes를 functional updater 경유로 읽기
    // React가 pending state updates를 체이닝하므로 항상 최신 상태를 반환
    function getLatestRootNodes(): Promise<FileTreeNode[]> {
      return new Promise((resolve) => {
        setRootNodes((prev) => {
          resolve(prev);
          return prev;
        });
      });
    }

    async function expandNode(path: string) {
      const findNode = (nodes: FileTreeNode[]): FileTreeNode | undefined => {
        for (const n of nodes) {
          if (n.path === path) return n;
          if (n.children) {
            const found = findNode(n.children);
            if (found) return found;
          }
        }
        return undefined;
      };

      const latestNodes = await getLatestRootNodes();
      const node = findNode(latestNodes);
      if (!node) return;
      if (node.expanded && node.loaded) return; // 이미 확장됨

      if (!node.loaded) {
        try {
          const result = await fetchFolderContents(path, 0, FILE_PAGE_SIZE);
          const folderChildren = result.folders.map(buildFolderNode);
          const { visibleFiles: fileChildren, hiddenCount } =
            buildFileNodes(result);
          const children = sortNodes([...folderChildren, ...fileChildren]);
          setRootNodes((prev) =>
            updateNodeInTree(prev, path, (n) => ({
              ...n,
              expanded: true,
              loaded: true,
              children,
              totalFiles: hiddenCount > 0 ? hiddenCount : undefined,
            })),
          );
        } catch {
          // silently fail
        }
      } else {
        setRootNodes((prev) =>
          updateNodeInTree(prev, path, (n) => ({ ...n, expanded: true })),
        );
      }
    }

    async function handleToggleExpand(path: string) {
      const findNode = (nodes: FileTreeNode[]): FileTreeNode | undefined => {
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
          const result = await fetchFolderContents(path, 0, FILE_PAGE_SIZE);
          const folderChildren = result.folders.map(buildFolderNode);
          const { visibleFiles: fileChildren, hiddenCount } =
            buildFileNodes(result);
          const children = sortNodes([...folderChildren, ...fileChildren]);
          setRootNodes((prev) =>
            updateNodeInTree(prev, path, (n) => ({
              ...n,
              expanded: true,
              loaded: true,
              children,
              totalFiles: hiddenCount > 0 ? hiddenCount : undefined,
            })),
          );
          // 체크 모드: 상위가 체크된 상태면 새로 로드된 하위도 체크
          if (checkable && onCheckPath && resolvedCheckedPaths.has(path)) {
            for (const child of children) {
              onCheckPath(child.path, true, child.count);
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
      const types = Array.from(_e.dataTransfer.types);
      const hasAcceptedItems = acceptDropTypes.some((t) => types.includes(t));
      const hasExternalFiles = types.includes("Files") && !hasAcceptedItems;
      if (!hasAcceptedItems && !hasExternalFiles && !draggingPath) return;
      _e.preventDefault();
      _e.stopPropagation();
      if (hasAcceptedItems) {
        _e.dataTransfer.dropEffect = "move";
      } else if (hasExternalFiles) {
        _e.dataTransfer.dropEffect = "copy";
      } else {
        _e.dataTransfer.dropEffect = "move";
      }
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
        !acceptDropTypes.some((t) => types.includes(t));

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

      const hasAcceptedItems = acceptDropTypes.some((t) => types.includes(t));
      if (hasAcceptedItems) {
        setDragOverPath(null);
        onItemDrop?.(_e, targetPath);
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
            const newChild: FileTreeNode = {
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
      const hasExternalItems = acceptDropTypes.some((t) => types.includes(t));
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
        !acceptDropTypes.some((t) => types.includes(t));

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

      const hasAcceptedItems = acceptDropTypes.some((t) => types.includes(t));
      if (hasAcceptedItems) {
        setDragOverPath(null);
        onItemDrop?.(e, "");
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
            const newRootNode: FileTreeNode = {
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
      const baseName = newFolderBaseName ?? "새 폴더";
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
        const newNode = buildFolderNode({
          path: newPath,
          name,
          count: 0,
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

    // -- bgMenu 엘리먼트 --

    const bgMenuElement = bgMenu && !readOnly && (
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
    );

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
        onDragOver={readOnly ? undefined : handleRootDragOver}
        onDragLeave={readOnly ? undefined : handleRootDragLeave}
        onDrop={readOnly ? undefined : handleRootDrop}
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
        {rootCount !== undefined && (
          <span className="shrink-0 text-xs text-muted-foreground">
            ({rootCount})
          </span>
        )}
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
              {onCreateFolder && !readOnly && (
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
          {bgMenuElement}
          {treeConfirmDialog}
        </div>
      );
    }

    // -- 트리 콘텐츠 --

    return (
      <div
        className="flex flex-col flex-1 min-h-0"
        onContextMenu={readOnly ? (e) => e.preventDefault() : undefined}
      >
        {/* 루트 노드 헤더 — 고정 */}
        <div className="shrink-0">{rootNodeElement}</div>
        {/* 트리 목록 — collapsed이면 숨김 */}
        {!isCollapsed && (
          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-auto select-none"
            onDragOver={readOnly ? undefined : handleRootDragOver}
            onDragLeave={readOnly ? undefined : handleRootDragLeave}
            onDrop={readOnly ? undefined : handleRootDrop}
            onContextMenu={handleTreeBgContextMenu}
            onClick={handleTreeBgClick}
          >
            <div
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                width: "100%",
                minWidth: maxDepth * 16 + 200,
                position: "relative",
              }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const flatNode = flatNodes[virtualRow.index];
                if (flatNode.type === "placeholder") {
                  return (
                    <div
                      key={`ph-${flatNode.parentPath}-${flatNode.fileIndex}`}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: `${virtualRow.size}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <PlaceholderRow depth={flatNode.depth} />
                    </div>
                  );
                }
                const { node, depth } = flatNode;
                const checkState = checkable
                  ? getNodeCheckState(node, resolvedCheckedPaths)
                  : undefined;

                return (
                  <div
                    key={
                      node.type === "file"
                        ? `${node.path}:${node.fileId}`
                        : node.path
                    }
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <TreeNode
                      node={node}
                      depth={depth}
                      selectedPath={selectedPath}
                      editingPath={readOnly ? undefined : editingPath}
                      editName={readOnly ? undefined : editName}
                      draggingPath={draggingPath}
                      dragOverPath={dragOverPath}
                      editStartTime={readOnly ? undefined : editStartTime}
                      readOnly={readOnly}
                      acceptDropTypes={acceptDropTypes}
                      acceptFileDrop={acceptFileDrop}
                      checkable={checkable}
                      checked={checkState === "checked"}
                      indeterminate={checkState === "indeterminate"}
                      onCheck={
                        checkable
                          ? (checked) => handleCheckNode(node, checked)
                          : undefined
                      }
                      onSelectPath={onSelectPath}
                      onFileClick={onFileClick}
                      onToggleExpand={handleToggleExpand}
                      onDeleteFolder={readOnly ? undefined : handleDeleteFolder}
                      onCreateFolder={readOnly ? undefined : handleCreateFolder}
                      onStartRename={readOnly ? undefined : handleStartRename}
                      onEditNameChange={readOnly ? undefined : setEditName}
                      onFinishRename={readOnly ? undefined : handleFinishRename}
                      onCancelRename={readOnly ? undefined : handleCancelRename}
                      onDragStart={readOnly ? undefined : handleDragStart}
                      onDragEnd={readOnly ? undefined : handleDragEnd}
                      onDragOver={readOnly ? undefined : handleDragOver}
                      onDragLeave={readOnly ? undefined : handleDragLeave}
                      onDrop={readOnly ? undefined : handleDrop}
                    />
                  </div>
                );
              })}
            </div>
            {/* 빈 공간 — 우클릭 컨텍스트 메뉴 영역 */}
            <div className="min-h-10 flex-1" />
          </div>
        )}
        {bgMenuElement}
        {treeConfirmDialog}
      </div>
    );
  },
);
