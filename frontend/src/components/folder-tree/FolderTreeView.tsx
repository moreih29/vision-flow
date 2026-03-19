import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Database, FolderPlus, RefreshCw } from 'lucide-react'
import { imagesApi } from '@/api/images'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { TreeNode } from './TreeNode'
import {
  buildNode,
  updateNodeInTree,
  findNodeInTree,
  removeNodeFromTree,
  renameNodeInTree,
  addOrInvalidateChild,
  collectExpandedPaths,
} from './tree-utils'
import type { FolderTreeNode } from './tree-utils'

// -- 타입 정의 --

export interface FolderTreeRef {
  refresh: () => Promise<void>
}

export interface FolderTreeViewProps {
  dataStoreId: number
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

// -- 메인 컴포넌트 --

export const FolderTreeView = forwardRef<FolderTreeRef, FolderTreeViewProps>(
  function FolderTreeView(
    {
      dataStoreId,
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
          const res = await imagesApi.getFolderContents(dataStoreId, '')
          setRootNodes(res.data.folders.map(buildNode))
        } catch {
          // silently fail
        } finally {
          setLoading(false)
        }
      }
      loadRoot()
    }, [dataStoreId])

    useImperativeHandle(ref, () => ({
      async refresh() {
        const expandedPaths = collectExpandedPaths(rootNodes).sort(
          (a, b) => a.split('/').length - b.split('/').length,
        )

        const res = await imagesApi.getFolderContents(dataStoreId, '')
        let newNodes = res.data.folders.map(buildNode)

        for (const path of expandedPaths) {
          if (!findNodeInTree(newNodes, path)) continue
          try {
            const childRes = await imagesApi.getFolderContents(
              dataStoreId,
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
          const res = await imagesApi.getFolderContents(dataStoreId, path)
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
          title: '폴더 이름에 / 또는 \\ 문자를 포함할 수 없습니다.',
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

    // -- 루트 드롭 존 --

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

    // -- 폴더 생성 --

    function generateNewFolderName(parentPath: string): string {
      const baseName = '새 폴더'
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

    // -- 로딩 상태 --

    if (loading) {
      return (
        <div className="space-y-1 p-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-muted" />
          ))}
        </div>
      )
    }

    // -- 루트 노드 엘리먼트 --

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
            title="새로고침"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    ) : null

    // -- 빈 상태 --

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

    // -- 트리 콘텐츠 --

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
