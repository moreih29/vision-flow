import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import {
  ChevronRight,
  ChevronDown,
  Database,
  Folder,
  RefreshCw,
  FolderOpen,
  FolderPlus,
  Pencil,
  Trash2,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { imagesApi } from '@/api/images'
import type { FolderInfo } from '@/types/image'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

// -- Types --

interface FolderTreeNode {
  path: string
  name: string
  image_count: number
  subfolder_count: number
  children?: FolderTreeNode[]
  expanded: boolean
  loaded: boolean
}

export interface FolderTreeRef {
  refresh: () => Promise<void>
}

interface FolderTreeViewProps {
  datasetId: number
  rootLabel?: string
  rootImageCount?: number
  selectedPath: string
  onSelectPath: (path: string) => void
  onDeleteFolder: (path: string) => Promise<void>
  onUpdateFolder?: (oldPath: string, newPath: string) => Promise<void>
  onCreateFolder?: (parentPath: string) => Promise<void>
  onDropItems?: (
    imageIds: number[],
    folderPaths: string[],
    targetPath: string,
  ) => Promise<void>
  onExternalFileDrop?: (
    entries: FileSystemEntry[],
    targetPath: string,
  ) => void
  onRefresh?: () => void
}

// -- Tree utilities --

function buildNode(folder: FolderInfo): FolderTreeNode {
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

function updateNodeInTree(
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

function findNodeInTree(
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

function removeNodeFromTree(
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

function renameNodeInTree(
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

function updateChildPaths(
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

function addOrInvalidateChild(
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

function collectExpandedPaths(nodes: FolderTreeNode[]): string[] {
  const paths: string[] = []
  for (const node of nodes) {
    if (node.expanded) {
      paths.push(node.path)
      if (node.children) paths.push(...collectExpandedPaths(node.children))
    }
  }
  return paths
}

// -- TreeNode component --

interface TreeNodeProps {
  node: FolderTreeNode
  depth: number
  selectedPath: string
  editingPath: string | null
  editName: string
  draggingPath: string | null
  dragOverPath: string | null
  editStartTime: number
  onSelectPath: (path: string) => void
  onToggleExpand: (path: string) => void
  onDeleteFolder: (path: string) => void
  onCreateFolder: (parentPath: string) => void
  onStartRename: (path: string, name: string) => void
  onEditNameChange: (value: string) => void
  onFinishRename: () => void
  onCancelRename: () => void
  onDragStart: (path: string) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent, path: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, targetPath: string) => void
}

function TreeNode({
  node,
  depth,
  selectedPath,
  editingPath,
  editName,
  draggingPath,
  dragOverPath,
  editStartTime,
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
  const isSelected = selectedPath === node.path
  const hasChildren = node.subfolder_count > 0
  const isEditing = editingPath === node.path
  const isDragging = draggingPath === node.path
  const isDragOver = dragOverPath === node.path
  const inputRef = useRef<HTMLInputElement>(null)
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    }
  }, [])

  const isValidDropTarget =
    draggingPath !== null &&
    draggingPath !== node.path &&
    !node.path.startsWith(draggingPath)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  function handleSingleClick() {
    onSelectPath(node.path)
    if (hasChildren && !node.expanded) onToggleExpand(node.path)
  }

  function handleClick() {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      if (isSelected) {
        onStartRename(node.path, node.name)
      }
      return
    }
    handleSingleClick()
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
    }, 300)
  }

  function handleBlur() {
    if (Date.now() - editStartTime < 300) return
    onCancelRename()
  }

  const rowContent = (
    <div
      data-tree-node
      className={`group flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors
        ${isSelected ? 'bg-accent text-accent-foreground font-medium' : 'hover:bg-accent hover:text-accent-foreground'}
        ${isDragging ? 'opacity-40' : ''}
        ${isDragOver && (isValidDropTarget || draggingPath === null) ? 'ring-2 ring-primary bg-primary/10' : ''}
      `}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      draggable={!isEditing}
      onContextMenu={() => onSelectPath(node.path)}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', node.path)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(node.path)
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        const types = Array.from(e.dataTransfer.types)
        const hasExternalItems = types.includes(
          'application/x-datapool-items',
        )
        const hasExternalFiles =
          types.includes('Files') && !hasExternalItems

        if (isValidDropTarget || hasExternalItems) {
          e.preventDefault()
          e.stopPropagation()
          e.dataTransfer.dropEffect = 'move'
          onDragOver(e, node.path)
        } else if (hasExternalFiles) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          onDragOver(e, node.path)
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onDragLeave()
        }
      }}
      onDrop={(e) => {
        const types = Array.from(e.dataTransfer.types)
        const hasExternalItems = types.includes(
          'application/x-datapool-items',
        )
        const hasExternalFiles =
          types.includes('Files') && !hasExternalItems

        if (isValidDropTarget || hasExternalItems || hasExternalFiles) {
          e.preventDefault()
          e.stopPropagation()
          onDrop(e, node.path)
        }
      }}
    >
      <button
        type="button"
        className="flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground"
        onClick={() => hasChildren && onToggleExpand(node.path)}
        aria-label={node.expanded ? '\uCD95\uC18C' : '\uD655\uC7A5'}
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
              if (e.key === 'Enter') onFinishRename()
              if (e.key === 'Escape') onCancelRename()
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
  )

  return (
    <div>
      {isEditing ? (
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
  )
}

// -- Main FolderTreeView --

export default forwardRef<FolderTreeRef, FolderTreeViewProps>(
  function FolderTreeView(
    {
      datasetId,
      rootLabel,
      rootImageCount,
      selectedPath,
      onSelectPath,
      onDeleteFolder,
      onUpdateFolder,
      onCreateFolder,
      onDropItems,
      onExternalFileDrop,
      onRefresh,
    },
    ref,
  ) {
    const [rootNodes, setRootNodes] = useState<FolderTreeNode[]>([])
    const [loading, setLoading] = useState(true)
    const [editingPath, setEditingPath] = useState<string | null>(null)
    const [editName, setEditName] = useState('')
    const [editStartTime, setEditStartTime] = useState(0)
    const [draggingPath, setDraggingPath] = useState<string | null>(null)
    const [dragOverPath, setDragOverPath] = useState<string | null>(null)
    const [bgMenu, setBgMenu] = useState<{ x: number; y: number } | null>(
      null,
    )
    const fileDropTargetRef = useRef<string>('')
    const { confirmDialog: treeConfirmDialog, showAlert: treeShowAlert } =
      useConfirmDialog()

    useEffect(() => {
      if (!bgMenu) return
      const handler = () => setBgMenu(null)
      const timer = setTimeout(() => {
        window.addEventListener('mousedown', handler)
      }, 0)
      return () => {
        clearTimeout(timer)
        window.removeEventListener('mousedown', handler)
      }
    }, [bgMenu])

    const handleTreeBgContextMenu = useCallback(
      (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('[data-tree-node]')) return
        e.preventDefault()
        setBgMenu({ x: e.clientX, y: e.clientY })
        onSelectPath('')
      },
      [onSelectPath],
    )

    const handleTreeBgClick = useCallback(
      (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('[data-tree-node]')) return
        if (
          !(e.currentTarget as HTMLElement).contains(e.target as HTMLElement)
        )
          return
        onSelectPath('')
      },
      [onSelectPath],
    )

    useEffect(() => {
      async function loadRoot() {
        setLoading(true)
        try {
          const res = await imagesApi.getFolderContents(datasetId, '')
          setRootNodes(res.data.folders.map(buildNode))
        } catch {
          // silently fail
        } finally {
          setLoading(false)
        }
      }
      loadRoot()
    }, [datasetId])

    useImperativeHandle(ref, () => ({
      async refresh() {
        const expandedPaths = collectExpandedPaths(rootNodes).sort(
          (a, b) => a.split('/').length - b.split('/').length,
        )

        const res = await imagesApi.getFolderContents(datasetId, '')
        let newNodes = res.data.folders.map(buildNode)

        for (const path of expandedPaths) {
          if (!findNodeInTree(newNodes, path)) continue
          try {
            const childRes = await imagesApi.getFolderContents(
              datasetId,
              path,
            )
            newNodes = updateNodeInTree(newNodes, path, (n) => ({
              ...n,
              expanded: true,
              loaded: true,
              children: childRes.data.folders.map(buildNode),
            }))
          } catch {
            // skip failed re-expansions
          }
        }

        setRootNodes(newNodes)
      },
    }))

    async function handleToggleExpand(path: string) {
      const findNode = (
        nodes: FolderTreeNode[],
      ): FolderTreeNode | undefined => {
        for (const n of nodes) {
          if (n.path === path) return n
          if (n.children) {
            const found = findNode(n.children)
            if (found) return found
          }
        }
        return undefined
      }

      const node = findNode(rootNodes)
      if (!node) return

      if (node.expanded) {
        setRootNodes((prev) =>
          updateNodeInTree(prev, path, (n) => ({ ...n, expanded: false })),
        )
        return
      }

      if (!node.loaded) {
        try {
          const res = await imagesApi.getFolderContents(datasetId, path)
          setRootNodes((prev) =>
            updateNodeInTree(prev, path, (n) => ({
              ...n,
              expanded: true,
              loaded: true,
              children: res.data.folders.map(buildNode),
            })),
          )
        } catch {
          // silently fail
        }
      } else {
        setRootNodes((prev) =>
          updateNodeInTree(prev, path, (n) => ({ ...n, expanded: true })),
        )
      }
    }

    async function handleDeleteFolder(path: string) {
      try {
        await onDeleteFolder(path)
      } catch {
        // cancelled or API error
      }
    }

    function handleStartRename(path: string, name: string) {
      setEditingPath(path)
      setEditName(name)
      setEditStartTime(Date.now())
    }

    async function handleFinishRename() {
      if (!editingPath || !editName.trim()) {
        setEditingPath(null)
        return
      }

      const oldPath = editingPath
      const trimmedName = editName.trim()

      if (trimmedName.includes('/') || trimmedName.includes('\\')) {
        await treeShowAlert({
          title:
            '\uD3F4\uB354 \uC774\uB984\uC5D0 / \uB610\uB294 \\ \uBB38\uC790\uB97C \uD3EC\uD568\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4.',
        })
        return
      }

      const parts = oldPath.replace(/\/$/, '').split('/')
      const oldName = parts[parts.length - 1]
      if (trimmedName === oldName) {
        setEditingPath(null)
        return
      }
      parts[parts.length - 1] = trimmedName
      const newPath = parts.join('/') + '/'

      setEditingPath(null)

      try {
        await onUpdateFolder?.(oldPath, newPath)
        setRootNodes((prev) =>
          renameNodeInTree(prev, oldPath, newPath, trimmedName),
        )
      } catch {
        // error handled by parent
      }
    }

    function handleCancelRename() {
      setEditingPath(null)
    }

    function handleDragStart(path: string) {
      setDraggingPath(path)
    }
    function handleDragEnd() {
      setDraggingPath(null)
      setDragOverPath(null)
    }
    function handleDragOver(_e: React.DragEvent, path: string) {
      setDragOverPath(path)
      fileDropTargetRef.current = path
    }
    function handleDragLeave() {
      setDragOverPath(null)
    }

    async function handleDrop(_e: React.DragEvent, targetPath: string) {
      const types = Array.from(_e.dataTransfer.types)
      const hasExternalFiles =
        types.includes('Files') &&
        !types.includes('application/x-datapool-items')

      if (hasExternalFiles && !draggingPath) {
        setDragOverPath(null)
        fileDropTargetRef.current = ''
        const entries = _e.dataTransfer.items
          ? Array.from(_e.dataTransfer.items)
              .map((item) => item.webkitGetAsEntry())
              .filter(
                (entry): entry is FileSystemEntry => entry !== null,
              )
          : []
        if (entries.length > 0) {
          onExternalFileDrop?.(entries, targetPath)
        }
        return
      }

      const itemsData = _e.dataTransfer.getData(
        'application/x-datapool-items',
      )
      if (itemsData) {
        setDragOverPath(null)
        try {
          const { imageIds, folderPaths } = JSON.parse(itemsData)
          await onDropItems?.(imageIds, folderPaths, targetPath)
        } catch {
          /* handled by parent */
        }
        return
      }

      if (!draggingPath) return

      const sourcePath = draggingPath
      const folderName = sourcePath.replace(/\/$/, '').split('/').pop()!
      const newPath = `${targetPath}${folderName}/`

      setDraggingPath(null)
      setDragOverPath(null)

      if (newPath === sourcePath) return

      try {
        await onUpdateFolder?.(sourcePath, newPath)
        setRootNodes((prev) => {
          const movedNode = findNodeInTree(prev, sourcePath)
          let updated = removeNodeFromTree(prev, sourcePath)
          if (movedNode) {
            const newChild: FolderTreeNode = {
              ...movedNode,
              path: newPath,
              name: folderName,
              children: undefined,
              loaded: false,
              expanded: false,
            }
            updated = updated.map((n) =>
              addOrInvalidateChild(n, targetPath, newChild),
            )
          }
          return updated
        })
      } catch {
        // error handled by parent
      }
    }

    // -- Root drop zone --

    function handleRootDragOver(e: React.DragEvent) {
      const types = Array.from(e.dataTransfer.types)
      const hasExternalItems = types.includes(
        'application/x-datapool-items',
      )
      const hasExternalFiles =
        types.includes('Files') && !hasExternalItems

      if (hasExternalFiles) {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
        if (!fileDropTargetRef.current) {
          setDragOverPath('__root__')
        }
        return
      }
      if (hasExternalItems) {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = 'move'
        setDragOverPath('__root__')
        return
      }
      if (!draggingPath) return
      const parts = draggingPath.replace(/\/$/, '').split('/')
      if (parts.length <= 1) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDragOverPath('__root__')
    }

    function handleRootDragLeave(e: React.DragEvent) {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragOverPath(null)
      }
    }

    async function handleRootDrop(e: React.DragEvent) {
      e.preventDefault()
      e.stopPropagation()

      const types = Array.from(e.dataTransfer.types)
      const hasExternalFiles =
        types.includes('Files') &&
        !types.includes('application/x-datapool-items')

      if (hasExternalFiles) {
        const targetPath = fileDropTargetRef.current
        fileDropTargetRef.current = ''
        setDragOverPath(null)
        const entries = e.dataTransfer.items
          ? Array.from(e.dataTransfer.items)
              .map((item) => item.webkitGetAsEntry())
              .filter(
                (entry): entry is FileSystemEntry => entry !== null,
              )
          : []

        if (entries.length > 0) {
          onExternalFileDrop?.(entries, targetPath)
        }
        return
      }

      const itemsData = e.dataTransfer.getData(
        'application/x-datapool-items',
      )
      if (itemsData) {
        setDragOverPath(null)
        try {
          const { imageIds, folderPaths } = JSON.parse(itemsData)
          await onDropItems?.(imageIds, folderPaths, '')
        } catch {
          /* handled by parent */
        }
        return
      }

      if (!draggingPath) return

      const sourcePath = draggingPath
      const parts = sourcePath.replace(/\/$/, '').split('/')
      if (parts.length <= 1) return

      const folderName = parts[parts.length - 1]
      const newPath = `${folderName}/`

      setDraggingPath(null)
      setDragOverPath(null)

      try {
        await onUpdateFolder?.(sourcePath, newPath)
        setRootNodes((prev) => {
          const movedNode = findNodeInTree(prev, sourcePath)
          const updated = removeNodeFromTree(prev, sourcePath)
          if (movedNode) {
            const newRootNode: FolderTreeNode = {
              ...movedNode,
              path: newPath,
              name: folderName,
              children: undefined,
              loaded: false,
              expanded: false,
            }
            return [...updated, newRootNode].sort((a, b) =>
              a.path.localeCompare(b.path),
            )
          }
          return updated
        })
      } catch {
        // error handled by parent
      }
    }

    // -- Create folder --

    function generateNewFolderName(parentPath: string): string {
      const baseName = '\uC0C8 \uD3F4\uB354'
      const existingNames = new Set<string>()
      if (parentPath === '') {
        rootNodes.forEach((n) => existingNames.add(n.name))
      } else {
        const parentNode = findNodeInTree(rootNodes, parentPath)
        if (parentNode?.children) {
          parentNode.children.forEach((n) => existingNames.add(n.name))
        }
      }
      if (!existingNames.has(baseName)) return baseName
      let i = 1
      while (existingNames.has(`${baseName}(${i})`)) i++
      return `${baseName}(${i})`
    }

    async function handleCreateFolder(parentPath: string) {
      if (!onCreateFolder) return
      const name = generateNewFolderName(parentPath)
      const newPath = parentPath + name + '/'
      try {
        await onCreateFolder(newPath)
        const newNode = buildNode({
          path: newPath,
          name,
          image_count: 0,
          subfolder_count: 0,
        })
        if (parentPath === '') {
          setRootNodes((prev) =>
            [...prev, newNode].sort((a, b) =>
              a.path.localeCompare(b.path),
            ),
          )
        } else {
          setRootNodes((prev) => {
            let updated = prev
            const parentNode = findNodeInTree(updated, parentPath)
            if (parentNode && !parentNode.expanded) {
              updated = updateNodeInTree(updated, parentPath, (n) => ({
                ...n,
                expanded: true,
                loaded: true,
                children: n.children ?? [],
              }))
            }
            return updated.map((n) =>
              addOrInvalidateChild(n, parentPath, newNode),
            )
          })
        }
        handleStartRename(newPath, name)
      } catch {
        // error handled by parent
      }
    }

    // -- Loading --

    if (loading) {
      return (
        <div className="space-y-1 p-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-muted" />
          ))}
        </div>
      )
    }

    // -- Root node element --

    const rootNodeElement = rootLabel ? (
      <div
        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-sm cursor-pointer transition-colors mb-1 ${
          selectedPath === ''
            ? 'bg-accent text-accent-foreground font-medium'
            : 'hover:bg-accent hover:text-accent-foreground'
        } ${dragOverPath === '__root__' ? 'ring-2 ring-primary bg-primary/10' : ''}`}
        onClick={() => onSelectPath('')}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >
        <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{rootLabel}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          ({rootImageCount})
        </span>
        {onRefresh && (
          <button
            type="button"
            className="ml-auto shrink-0 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              onRefresh()
            }}
            title="\uC0C8\uB85C\uACE0\uCE68"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    ) : null

    // -- Empty state --

    if (rootNodes.length === 0) {
      return (
        <div
          className="min-h-full"
          onContextMenu={handleTreeBgContextMenu}
          onClick={handleTreeBgClick}
        >
          {rootNodeElement}
          <div className="flex flex-col items-center gap-2 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              폴더가 없습니다.
            </p>
            {onCreateFolder && (
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => handleCreateFolder('')}
              >
                + 새 폴더 만들기
              </button>
            )}
          </div>
          {bgMenu && (
            <div
              className="fixed z-50 w-40 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
              style={{ left: bgMenu.x, top: bgMenu.y }}
            >
              <button
                type="button"
                className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setBgMenu(null)
                  handleCreateFolder('')
                }}
              >
                <FolderPlus className="h-3.5 w-3.5" />새 폴더
              </button>
            </div>
          )}
          {treeConfirmDialog}
        </div>
      )
    }

    // -- Tree content --

    return (
      <>
        <div
          className="space-y-0.5 min-h-full"
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
          onContextMenu={handleTreeBgContextMenu}
          onClick={handleTreeBgClick}
        >
          {rootNodeElement}
          {rootNodes.map((node) => (
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
        {bgMenu && (
          <div
            className="fixed z-50 w-40 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
            style={{ left: bgMenu.x, top: bgMenu.y }}
          >
            <button
              type="button"
              className="relative flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={() => {
                setBgMenu(null)
                handleCreateFolder('')
              }}
            >
              <FolderPlus className="h-3.5 w-3.5" />새 폴더
            </button>
          </div>
        )}
        {treeConfirmDialog}
      </>
    )
  },
)
