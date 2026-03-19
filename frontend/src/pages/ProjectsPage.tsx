import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FolderOpen, Trash2 } from 'lucide-react'
import { useProjects, useCreateProject, useDeleteProject } from '@/hooks/use-projects'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import type { Project } from '@/types/project'

export default function ProjectsPage() {
  const navigate = useNavigate()
  const { confirmDialog, confirm, showAlert } = useConfirmDialog()

  const { data: projects = [], isLoading, isError } = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const creatingRef = useRef(false)
  const deletingRef = useRef<number | null>(null)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')

  async function handleCreate() {
    if (!newName.trim() || creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    try {
      await createProject.mutateAsync({
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      })
      setDialogOpen(false)
      setNewName('')
      setNewDesc('')
    } catch {
      await showAlert({ title: '프로젝트 생성에 실패했습니다.' })
    } finally {
      creatingRef.current = false
      setCreating(false)
    }
  }

  async function handleDelete(e: React.MouseEvent, project: Project) {
    e.stopPropagation()
    if (deletingRef.current === project.id) return
    const confirmed = await confirm({
      title: `"${project.name}" 프로젝트를 삭제하시겠습니까?`,
      description: '프로젝트에 포함된 모든 데이터가 함께 삭제됩니다. 이 작업은 되돌릴 수 없습니다.',
      confirmLabel: '삭제',
      variant: 'destructive',
    })
    if (!confirmed) return
    deletingRef.current = project.id
    try {
      await deleteProject.mutateAsync(project.id)
    } catch {
      await showAlert({ title: '프로젝트 삭제에 실패했습니다.' })
    } finally {
      deletingRef.current = null
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">내 프로젝트</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              이미지 데이터셋을 관리하세요
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />새 프로젝트
          </Button>
        </div>

        {isError && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            프로젝트 목록을 불러오지 못했습니다.
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground" />
            <div>
              <p className="font-medium">프로젝트가 없습니다</p>
              <p className="text-sm text-muted-foreground">
                첫 번째 프로젝트를 만들어 시작하세요
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />새 프로젝트 만들기
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-base">{project.name}</CardTitle>
                  {project.description && (
                    <CardDescription className="line-clamp-2">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>데이터 저장소 {project.data_store_count}개</span>
                    <div className="flex items-center gap-2">
                      <span>{formatDate(project.created_at)}</span>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDelete(e, project)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 프로젝트</DialogTitle>
            <DialogDescription>
              프로젝트 이름과 설명을 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-name">이름 *</Label>
              <Input
                id="project-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="프로젝트 이름"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="project-desc">설명</Label>
              <Textarea
                id="project-desc"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="프로젝트 설명 (선택)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={creating}
            >
              취소
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
            >
              {creating ? '생성 중...' : '만들기'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {confirmDialog}
    </div>
  )
}
