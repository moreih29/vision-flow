import { useEffect, useState } from "react";
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
  const isChecked = checkedPaths.has(node.path);
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
        setNodes((prev) =>
          updateNodeInTree(prev, node.path, (n) => ({
            ...n,
            expanded: true,
            loaded: true,
            children: (res.data.folders ?? []).map(buildNode),
          })),
        );
      } catch {
        // silently fail
      }
    } else {
      setNodes((prev) =>
        updateNodeInTree(prev, node.path, (n) => ({ ...n, expanded: true })),
      );
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
        <input
          type="checkbox"
          className="h-3.5 w-3.5 shrink-0 accent-primary cursor-pointer"
          checked={isChecked}
          onChange={(e) => onCheckPath(node.path, e.target.checked)}
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
