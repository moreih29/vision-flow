import { useEffect, useRef, useState } from "react";
import { ChevronRight, ChevronDown, Folder } from "lucide-react";
import { imagesApi } from "@/api/images";
import {
  buildNode,
  updateNodeInTree,
} from "@/components/folder-tree/tree-utils";
import type { FolderTreeNode } from "@/components/folder-tree/tree-utils";

interface PoolFolderCheckTreeProps {
  dataStoreId: number;
  checkedPaths: Set<string>;
  onCheckPath: (path: string, checked: boolean) => void;
}

// indeterminate 지원 체크박스
function IndeterminateCheckbox({
  checked,
  indeterminate,
  onChange,
  onClick,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !!indeterminate && !checked;
    }
  }, [indeterminate, checked]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="h-3.5 w-3.5 shrink-0 accent-primary cursor-pointer"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={onClick}
    />
  );
}

// 노드 및 하위 노드의 모든 path 수집 (로드된 것만)
function collectAllLoadedPaths(node: FolderTreeNode): string[] {
  const paths = [node.path];
  if (node.children) {
    for (const child of node.children) {
      paths.push(...collectAllLoadedPaths(child));
    }
  }
  return paths;
}

// 노드의 체크 상태 계산: checked / indeterminate / unchecked
function getNodeCheckState(
  node: FolderTreeNode,
  checkedPaths: Set<string>,
): "checked" | "indeterminate" | "unchecked" {
  const isChecked = checkedPaths.has(node.path);
  if (isChecked) return "checked";

  // 로드된 하위 중 체크된 게 있으면 indeterminate
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

function CheckTreeNode({
  node,
  depth,
  dataStoreId,
  checkedPaths,
  onCheckPath,
  nodes,
  setNodes,
}: {
  node: FolderTreeNode;
  depth: number;
  dataStoreId: number;
  checkedPaths: Set<string>;
  onCheckPath: (path: string, checked: boolean) => void;
  nodes: FolderTreeNode[];
  setNodes: React.Dispatch<React.SetStateAction<FolderTreeNode[]>>;
}) {
  const checkState = getNodeCheckState(node, checkedPaths);
  const isChecked = checkState === "checked";
  const isIndeterminate = checkState === "indeterminate";
  const hasChildren = node.subfolder_count > 0;

  async function handleToggleExpand(e: React.MouseEvent) {
    e.stopPropagation();
    if (node.expanded) {
      setNodes((prev) =>
        updateNodeInTree(prev, node.path, (n) => ({ ...n, expanded: false })),
      );
      return;
    }
    if (!node.loaded) {
      try {
        const res = await imagesApi.getFolderContents(dataStoreId, node.path);
        const children = (res.data.folders ?? []).map(buildNode);
        setNodes((prev) =>
          updateNodeInTree(prev, node.path, (n) => ({
            ...n,
            expanded: true,
            loaded: true,
            children,
          })),
        );
        // 상위가 체크된 상태면 새로 로드된 하위도 체크
        if (checkedPaths.has(node.path)) {
          for (const child of children) {
            onCheckPath(child.path, true);
          }
        }
      } catch {
        // silently fail
      }
    } else {
      setNodes((prev) =>
        updateNodeInTree(prev, node.path, (n) => ({ ...n, expanded: true })),
      );
    }
  }

  function handleCheck(checked: boolean) {
    onCheckPath(node.path, checked);
    // 체크 시 로드된 하위도 재귀 체크
    if (checked && node.children) {
      const allPaths = collectAllLoadedPaths(node);
      for (const p of allPaths) {
        if (p !== node.path) onCheckPath(p, true);
      }
    }
    // 해제 시 로드된 하위도 재귀 해제
    if (!checked && node.children) {
      const allPaths = collectAllLoadedPaths(node);
      for (const p of allPaths) {
        if (p !== node.path) onCheckPath(p, false);
      }
    }
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent cursor-pointer select-none text-sm"
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {/* 펼치기/접기 */}
        <span
          className="shrink-0 w-4 h-4 flex items-center justify-center text-muted-foreground"
          onClick={hasChildren ? handleToggleExpand : undefined}
        >
          {hasChildren ? (
            node.expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : null}
        </span>

        {/* 체크박스 */}
        <IndeterminateCheckbox
          checked={isChecked}
          indeterminate={isIndeterminate}
          onChange={handleCheck}
          onClick={(e) => e.stopPropagation()}
        />

        {/* 폴더 아이콘 + 이름 */}
        <Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span
          className="truncate"
          onClick={hasChildren ? handleToggleExpand : undefined}
        >
          {node.name}
        </span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {node.image_count}
        </span>
      </div>

      {node.expanded && node.children && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <CheckTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              dataStoreId={dataStoreId}
              checkedPaths={checkedPaths}
              onCheckPath={onCheckPath}
              nodes={nodes}
              setNodes={setNodes}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PoolFolderCheckTree({
  dataStoreId,
  checkedPaths,
  onCheckPath,
}: PoolFolderCheckTreeProps) {
  const [nodes, setNodes] = useState<FolderTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    imagesApi
      .getFolderContents(dataStoreId, "")
      .then((res) => {
        if (!cancelled) setNodes((res.data.folders ?? []).map(buildNode));
      })
      .catch(() => {
        if (!cancelled) setNodes([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataStoreId]);

  // 전체 선택 상태 계산
  const allPaths = nodes.map((n) => n.path);
  const allChecked =
    allPaths.length > 0 && allPaths.every((p) => checkedPaths.has(p));
  const someChecked =
    !allChecked &&
    (allPaths.some((p) => checkedPaths.has(p)) || checkedPaths.size > 0);

  function handleSelectAll(checked: boolean) {
    for (const node of nodes) {
      const allNodePaths = collectAllLoadedPaths(node);
      for (const p of allNodePaths) {
        onCheckPath(p, checked);
      }
    }
  }

  if (loading) {
    return (
      <div className="space-y-1 p-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-5 animate-pulse rounded bg-muted" />
        ))}
      </div>
    );
  }

  if (nodes.length === 0) {
    return (
      <p className="py-4 text-center text-xs text-muted-foreground">
        폴더가 없습니다.
      </p>
    );
  }

  return (
    <div className="space-y-0.5">
      {/* 전체 선택 */}
      <div className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-accent cursor-pointer select-none text-sm border-b mb-0.5 pb-1">
        <span className="shrink-0 w-4 h-4" />
        <IndeterminateCheckbox
          checked={allChecked}
          indeterminate={someChecked}
          onChange={handleSelectAll}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="text-xs text-muted-foreground ml-1">전체 선택</span>
      </div>

      {nodes.map((node) => (
        <CheckTreeNode
          key={node.path}
          node={node}
          depth={0}
          dataStoreId={dataStoreId}
          checkedPaths={checkedPaths}
          onCheckPath={onCheckPath}
          nodes={nodes}
          setNodes={setNodes}
        />
      ))}
    </div>
  );
}
