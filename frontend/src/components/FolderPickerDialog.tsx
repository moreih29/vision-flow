import { useEffect, useState } from 'react'
import { Folder, FolderOpen } from 'lucide-react'
import { imagesApi } from '@/api/images'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface FolderPickerDialogProps {
  dataStoreId: number
  open: boolean
  onClose: () => void
  onSelect: (targetFolder: string) => void
  excludePaths?: string[]
}

export default function FolderPickerDialog({
  dataStoreId,
  open,
  onClose,
  onSelect,
  excludePaths = [],
}: FolderPickerDialogProps) {
  const [folders, setFolders] = useState<string[]>([])
  const [selected, setSelected] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true)
      setSelected('')
      imagesApi
        .getAllFolders(dataStoreId)
        .then((res) => setFolders(res.data))
        .catch(() => setFolders([]))
        .finally(() => setLoading(false))
    }
  }, [open, dataStoreId])

  const excludeSet = new Set(excludePaths)
  const available = folders.filter((f) => !excludeSet.has(f))

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose()
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>이동할 폴더 선택</DialogTitle>
        </DialogHeader>

        <div className="max-h-64 overflow-y-auto -mx-4 px-2">
          {loading ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              로딩 중...
            </p>
          ) : (
            <>
              <button
                type="button"
                className={`w-full flex items-center gap-2 rounded px-3 py-2 text-sm hover:bg-accent ${
                  selected === '' ? 'bg-accent font-medium' : ''
                }`}
                onClick={() => setSelected('')}
              >
                <FolderOpen className="h-4 w-4 shrink-0" />
                루트 (최상위)
              </button>
              {available.map((path) => {
                const depth = path.split('/').length - 2
                const name = path.replace(/\/$/, '').split('/').pop()
                return (
                  <button
                    key={path}
                    type="button"
                    className={`w-full flex items-center gap-2 rounded py-2 text-sm hover:bg-accent ${
                      selected === path ? 'bg-accent font-medium' : ''
                    }`}
                    style={{
                      paddingLeft: `${depth * 16 + 12}px`,
                      paddingRight: '12px',
                    }}
                    onClick={() => setSelected(path)}
                  >
                    <Folder className="h-4 w-4 shrink-0" />
                    <span className="truncate">{name}</span>
                  </button>
                )
              })}
              {available.length === 0 && !loading && (
                <p className="p-4 text-center text-xs text-muted-foreground">
                  다른 폴더가 없습니다.
                </p>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <DialogClose>
            <Button variant="outline" size="sm">
              취소
            </Button>
          </DialogClose>
          <Button size="sm" onClick={() => onSelect(selected)}>
            이동
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
