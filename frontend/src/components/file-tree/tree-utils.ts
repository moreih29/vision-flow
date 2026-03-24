// -- 타입 정의 --

export interface FileTreeNode {
  type: "folder" | "file";
  path: string;
  name: string;
  count: number;
  subfolder_count: number;
  children?: FileTreeNode[];
  expanded: boolean;
  loaded: boolean;
  fileId?: number;
  totalFiles?: number;
}

// -- 순수 유틸리티 함수 --

export function buildFolderNode(folder: {
  path: string;
  name: string;
  count: number;
  subfolder_count: number;
}): FileTreeNode {
  return {
    type: "folder",
    path: folder.path,
    name: folder.name,
    count: folder.count,
    subfolder_count: folder.subfolder_count,
    children: undefined,
    expanded: false,
    loaded: false,
  };
}

export function buildFileNode(file: {
  id: number;
  name: string;
  path: string;
}): FileTreeNode {
  return {
    type: "file",
    path: file.path,
    name: file.name,
    count: 0,
    subfolder_count: 0,
    expanded: false,
    loaded: true,
    fileId: file.id,
  };
}

export function updateNodeInTree(
  nodes: FileTreeNode[],
  targetPath: string,
  updater: (node: FileTreeNode) => FileTreeNode,
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) return updater(node);
    if (node.children)
      return {
        ...node,
        children: updateNodeInTree(node.children, targetPath, updater),
      };
    return node;
  });
}

export function findNodeInTree(
  nodes: FileTreeNode[],
  targetPath: string,
): FileTreeNode | undefined {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.children) {
      const found = findNodeInTree(node.children, targetPath);
      if (found) return found;
    }
  }
  return undefined;
}

export function removeNodeFromTree(
  nodes: FileTreeNode[],
  targetPath: string,
): FileTreeNode[] {
  return nodes
    .filter(
      (node) =>
        node.path !== targetPath && !node.path.startsWith(targetPath + "/"),
    )
    .map((node) =>
      node.children
        ? { ...node, children: removeNodeFromTree(node.children, targetPath) }
        : node,
    );
}

export function updateChildPaths(
  nodes: FileTreeNode[],
  oldPrefix: string,
  newPrefix: string,
): FileTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    path: newPrefix + node.path.slice(oldPrefix.length),
    children: node.children
      ? updateChildPaths(node.children, oldPrefix, newPrefix)
      : undefined,
  }));
}

export function renameNodeInTree(
  nodes: FileTreeNode[],
  oldPath: string,
  newPath: string,
  newName: string,
): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.path === oldPath) {
      return {
        ...node,
        path: newPath,
        name: newName,
        children: node.children
          ? updateChildPaths(node.children, oldPath, newPath)
          : undefined,
      };
    }
    if (node.children) {
      return {
        ...node,
        children: renameNodeInTree(node.children, oldPath, newPath, newName),
      };
    }
    return node;
  });
}

export function addOrInvalidateChild(
  node: FileTreeNode,
  parentPath: string,
  child: FileTreeNode,
): FileTreeNode {
  if (node.path === parentPath) {
    if (node.expanded && node.loaded && node.children) {
      const newChildren = [...node.children, child].sort((a, b) =>
        a.path.localeCompare(b.path),
      );
      return {
        ...node,
        children: newChildren,
        subfolder_count: node.subfolder_count + 1,
      };
    }
    return {
      ...node,
      loaded: false,
      children: undefined,
      subfolder_count: node.subfolder_count + 1,
    };
  }
  if (node.children) {
    return {
      ...node,
      children: node.children.map((c) =>
        addOrInvalidateChild(c, parentPath, child),
      ),
    };
  }
  return node;
}

export function collectExpandedPaths(nodes: FileTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.expanded) {
      paths.push(node.path);
      if (node.children) paths.push(...collectExpandedPaths(node.children));
    }
  }
  return paths;
}
