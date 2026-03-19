import type { FolderInfo } from '@/types/image'

// -- 타입 정의 --

export interface FolderTreeNode {
  path: string
  name: string
  image_count: number
  subfolder_count: number
  children?: FolderTreeNode[]
  expanded: boolean
  loaded: boolean
}

// -- 순수 유틸리티 함수 --

export function buildNode(folder: FolderInfo): FolderTreeNode {
  return {
    path: folder.path,
    name: folder.name,
    image_count: folder.image_count,
    subfolder_count: folder.subfolder_count,
    children: undefined,
    expanded: false,
    loaded: false,
  }
}

export function updateNodeInTree(
  nodes: FolderTreeNode[],
  targetPath: string,
  updater: (node: FolderTreeNode) => FolderTreeNode,
): FolderTreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) return updater(node)
    if (node.children)
      return {
        ...node,
        children: updateNodeInTree(node.children, targetPath, updater),
      }
    return node
  })
}

export function findNodeInTree(
  nodes: FolderTreeNode[],
  targetPath: string,
): FolderTreeNode | undefined {
  for (const node of nodes) {
    if (node.path === targetPath) return node
    if (node.children) {
      const found = findNodeInTree(node.children, targetPath)
      if (found) return found
    }
  }
  return undefined
}

export function removeNodeFromTree(
  nodes: FolderTreeNode[],
  targetPath: string,
): FolderTreeNode[] {
  return nodes
    .filter(
      (node) =>
        node.path !== targetPath && !node.path.startsWith(targetPath + '/'),
    )
    .map((node) =>
      node.children
        ? { ...node, children: removeNodeFromTree(node.children, targetPath) }
        : node,
    )
}

export function updateChildPaths(
  nodes: FolderTreeNode[],
  oldPrefix: string,
  newPrefix: string,
): FolderTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    path: newPrefix + node.path.slice(oldPrefix.length),
    children: node.children
      ? updateChildPaths(node.children, oldPrefix, newPrefix)
      : undefined,
  }))
}

export function renameNodeInTree(
  nodes: FolderTreeNode[],
  oldPath: string,
  newPath: string,
  newName: string,
): FolderTreeNode[] {
  return nodes.map((node) => {
    if (node.path === oldPath) {
      return {
        ...node,
        path: newPath,
        name: newName,
        children: node.children
          ? updateChildPaths(node.children, oldPath, newPath)
          : undefined,
      }
    }
    if (node.children) {
      return {
        ...node,
        children: renameNodeInTree(node.children, oldPath, newPath, newName),
      }
    }
    return node
  })
}

export function addOrInvalidateChild(
  node: FolderTreeNode,
  parentPath: string,
  child: FolderTreeNode,
): FolderTreeNode {
  if (node.path === parentPath) {
    if (node.expanded && node.loaded && node.children) {
      const newChildren = [...node.children, child].sort((a, b) =>
        a.path.localeCompare(b.path),
      )
      return {
        ...node,
        children: newChildren,
        subfolder_count: node.subfolder_count + 1,
      }
    }
    return {
      ...node,
      loaded: false,
      children: undefined,
      subfolder_count: node.subfolder_count + 1,
    }
  }
  if (node.children) {
    return {
      ...node,
      children: node.children.map((c) =>
        addOrInvalidateChild(c, parentPath, child),
      ),
    }
  }
  return node
}

export function collectExpandedPaths(nodes: FolderTreeNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.expanded) {
      paths.push(node.path)
      if (node.children) paths.push(...collectExpandedPaths(node.children))
    }
  }
  return paths
}
