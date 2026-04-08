import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, FolderTree, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tasksApi } from "@/api/tasks";
import { labelClassesApi } from "@/api/label-classes";
import { annotationsApi } from "@/api/annotations";
import { useProject } from "@/hooks/use-projects";
import type { Task } from "@/types/task";
import type { LabelClass } from "@/types/label-class";
import type { TaskImageResponse } from "@/types/task-image";
import { useLabelingStore } from "@/stores/labeling-store";
import {
  LabelingCanvas,
  ImageNavigator,
  ClassPanel,
  LabelingProgressBar,
  LabelingFilter,
  KeyboardShortcutsOverlay,
  AnnotationList,
  InspectorPanel,
  FloatingToolbar,
} from "@/components/labeling";
import { FileTreeView, type FileContentsResult } from "@/components/file-tree";

const TOKEN_KEY = "auth_token";

export default function LabelingPage() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = Number(id);
  const taskIdNum = Number(taskId);
  const initialImageId = searchParams.get("imageId")
    ? Number(searchParams.get("imageId"))
    : null;

  useProject(projectId);

  const [task, setTask] = useState<Task | null>(null);
  const [classes, setClasses] = useState<LabelClass[]>([]);
  const [images, setImages] = useState<TaskImageResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [folderTreeOpen, setFolderTreeOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showShortcutsOverlay, setShowShortcutsOverlay] = useState(false);

  const {
    tool,
    setSelectedClassId,
    selectedAnnotationId,
    setSelectedAnnotationId,
    currentImageIndex,
    setScale,
    annotations,
    setAnnotations,
    addAnnotation,
    updateAnnotation,
    isDirty,
    setIsDirty,
    reset,
    undo,
    redo,
    canUndo,
    canRedo,
    labeledImageIds,
    setLabeledImageId,
    toggleAnnotations,
    selectedClassId,
    setCurrentImageIndex,
  } = useLabelingStore();

  // 현재 이미지 ref (saveCurrentAnnotations 클로저용)
  const currentImageRef = useRef<TaskImageResponse | null>(null);
  const isDirtyRef = useRef(isDirty);
  const annotationsRef = useRef(annotations);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    annotationsRef.current = annotations;
  }, [annotations]);

  useEffect(() => {
    reset();
    fetchAll();
  }, [taskIdNum]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchAll() {
    setLoading(true);
    try {
      const [taskRes, classesRes, imagesRes] = await Promise.all([
        tasksApi.get(taskIdNum),
        labelClassesApi.list(taskIdNum),
        tasksApi.getAllImages(taskIdNum),
      ]);
      setTask(taskRes.data);
      setClasses(classesRes.data);
      // 트리 DFS 순서와 일치하도록 정렬: 각 레벨에서 하위 폴더 → 파일 순
      const sorted = [...imagesRes].sort((a, b) => {
        const partsA = [
          ...(a.folder_path ? a.folder_path.split("/").filter(Boolean) : []),
          a.image.original_filename,
        ];
        const partsB = [
          ...(b.folder_path ? b.folder_path.split("/").filter(Boolean) : []),
          b.image.original_filename,
        ];
        const maxLen = Math.max(partsA.length, partsB.length);
        for (let i = 0; i < maxLen; i++) {
          const isFileA = i === partsA.length - 1;
          const isFileB = i === partsB.length - 1;
          if (!isFileA && isFileB) return -1;
          if (isFileA && !isFileB) return 1;
          const cmp = partsA[i].localeCompare(partsB[i], undefined, {
            numeric: true,
          });
          if (cmp !== 0) return cmp;
        }
        return 0;
      });
      setImages(sorted);
      if (initialImageId != null) {
        const idx = sorted.findIndex((ti) => ti.image.id === initialImageId);
        if (idx >= 0) setCurrentImageIndex(idx);
      }
    } catch {
      // 에러 처리 -- 빈 상태 유지
    } finally {
      setLoading(false);
    }
  }

  const totalImages = images.length;
  const currentImage = images[currentImageIndex] ?? null;

  // 라벨링된 이미지 수
  const labeledCount = labeledImageIds.size;

  // 클래스 로드 시 첫 번째 클래스 자동 선택
  useEffect(() => {
    if (classes.length > 0 && selectedClassId == null) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId, setSelectedClassId]);

  useEffect(() => {
    currentImageRef.current = currentImage;
  }, [currentImage]);

  // 현재 이미지의 파일 URL 구성
  const imageUrl = currentImage
    ? `/api/v1/images/${currentImage.image.id}/file?token=${localStorage.getItem(TOKEN_KEY) ?? ""}`
    : null;

  // 현재 이미지의 폴더 경로
  const currentFolderPath = currentImage?.folder_path ?? null;

  // 저장 함수 (ref 값 사용해 최신 상태 읽음)
  const saveCurrentAnnotations = useCallback(
    async (targetTaskImageId?: number) => {
      const taskImageId = targetTaskImageId ?? currentImageRef.current?.id;
      if (!taskImageId) return;
      if (!isDirtyRef.current) return;

      setIsSaving(true);
      try {
        const taskImageAnnotations = annotationsRef.current.map((a) => ({
          label_class_id: a.label_class_id,
          annotation_type: a.annotation_type,
          data: a.data,
        }));
        await annotationsApi.bulkSave(taskImageId, taskImageAnnotations);
        setIsDirty(false);
      } catch {
        toast.error("저장 실패: 변경사항이 로컬에 보존됩니다");
      } finally {
        setIsSaving(false);
      }
    },
    [setIsDirty],
  );

  // 이미지 전환 시 어노테이션 로드 (전환 전 자동저장)
  useEffect(() => {
    if (!currentImage) {
      setAnnotations([]);
      setSelectedAnnotationId(null);
      return;
    }

    let cancelled = false;

    async function loadAnnotations() {
      // 이전 이미지 저장 (currentImage가 바뀌기 전 ref로 이전 imageId 접근 불가 —
      // 이미지 전환은 currentImageIndex 변경이므로 저장은 navigateToImage에서 처리)
      try {
        const res = await annotationsApi.list(currentImage!.id);
        if (!cancelled) {
          setAnnotations(res.data);
          setSelectedAnnotationId(null);
          // 라벨링 상태 갱신
          setLabeledImageId(currentImage!.image.id, res.data.length > 0);
        }
      } catch {
        if (!cancelled) {
          setAnnotations([]);
        }
      }
    }

    loadAnnotations();
    return () => {
      cancelled = true;
    };
  }, [currentImage?.image.id, taskIdNum, setAnnotations]); // eslint-disable-line react-hooks/exhaustive-deps

  // 어노테이션 변경 시 현재 이미지의 라벨링 상태 실시간 반영
  useEffect(() => {
    if (!currentImage) return;
    setLabeledImageId(currentImage.image.id, annotations.length > 0);
  }, [annotations.length, currentImage?.image.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ImageNavigator의 이미지 전환을 가로채기 위한 래퍼
  // ImageNavigator는 store의 setCurrentImageIndex를 직접 호출하므로,
  // 이미지 전환 전 저장을 위해 별도 핸들러를 사용할 수 없음.
  // 대신 currentImageIndex 변경을 감지하되, 저장은 navigateImage로 처리.
  // 여기서는 beforeunload와 Ctrl+S 저장만 처리.

  // 현재 이미지 인덱스의 ref (키보드 핸들러 클로저용)
  const currentImageIndexRef = useRef(currentImageIndex);
  const totalImagesRef = useRef(totalImages);
  const selectedClassIdRef = useRef(selectedClassId);

  useEffect(() => {
    currentImageIndexRef.current = currentImageIndex;
  }, [currentImageIndex]);
  useEffect(() => {
    totalImagesRef.current = totalImages;
  }, [totalImages]);
  useEffect(() => {
    selectedClassIdRef.current = selectedClassId;
  }, [selectedClassId]);

  // review-status 업데이트 헬퍼 (실패 시 무시)
  const updateReviewStatus = useCallback(
    async (
      taskImageId: number,
      status: import("@/types/task-image").ReviewStatus,
    ) => {
      try {
        await tasksApi.updateReviewStatus(taskIdNum, taskImageId, status);
      } catch {
        // 리뷰 상태 업데이트 실패는 무시 — 이미지 전환은 계속 진행
        console.error("리뷰 상태 업데이트 실패");
      }
    },
    [taskIdNum],
  );

  // 키보드 단축키
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // input/textarea 포커스 중에는 무시
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const isCtrl = e.ctrlKey || e.metaKey;

      if (isCtrl && e.shiftKey && (e.key === "Z" || e.key === "z")) {
        e.preventDefault();
        if (canRedo()) redo();
        return;
      }

      if (isCtrl && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        if (canRedo()) redo();
        return;
      }

      if (isCtrl && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (canUndo()) undo();
        return;
      }

      if (isCtrl && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        saveCurrentAnnotations();
        return;
      }

      // Ctrl 없는 단일 키 처리
      if (isCtrl) return;

      // H — 어노테이션 표시/숨기기
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        toggleAnnotations();
        return;
      }

      // ? — 단축키 도움말
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcutsOverlay((v) => !v);
        return;
      }

      // / — 파일 트리 토글
      if (e.key === "/") {
        e.preventDefault();
        setFolderTreeOpen((v) => !v);
        return;
      }

      // Escape — 선택 해제
      if (e.key === "Escape") {
        setSelectedAnnotationId(null);
        return;
      }

      // Tab — 다음 어노테이션 순환
      if (e.key === "Tab") {
        e.preventDefault();
        const anns = annotationsRef.current;
        if (anns.length === 0) return;
        const currentSel = useLabelingStore.getState().selectedAnnotationId;
        const idx = anns.findIndex((a) => a.id === currentSel);
        const nextIdx = (idx + 1) % anns.length;
        setSelectedAnnotationId(anns[nextIdx].id);
        return;
      }

      // Space — classification: 현재 클래스 적용 + 다음 이미지
      if (e.key === " ") {
        e.preventDefault();
        const currentTool = useLabelingStore.getState().tool;
        if (currentTool !== "classification") return;
        const classId = selectedClassIdRef.current;
        if (classId == null) return;
        // handleClassifyImage는 최신 ref 값을 사용하는 비동기 함수가 필요 — 직접 호출
        const anns = annotationsRef.current;
        const imageAtKey = currentImageRef.current;
        if (!imageAtKey) return;
        const existing = anns.find(
          (a) => a.annotation_type === "classification",
        );
        const doNext = () => {
          const idx = currentImageIndexRef.current;
          const total = totalImagesRef.current;
          if (idx < total - 1) setCurrentImageIndex(idx + 1);
        };
        if (existing) {
          if (existing.label_class_id !== classId) {
            annotationsApi
              .update(existing.id, { label_class_id: classId })
              .then(() => {
                updateAnnotation(existing.id, { label_class_id: classId });
                doNext();
              })
              .catch(() => doNext());
          } else {
            doNext();
          }
        } else {
          annotationsApi
            .create(imageAtKey.id, {
              label_class_id: classId,
              annotation_type: "classification",
              data: {},
            })
            .then((res) => {
              addAnnotation(res.data);
              doNext();
            })
            .catch(() => doNext());
        }
        return;
      }

      // S — 저장 (이동 없음)
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        saveCurrentAnnotations();
        return;
      }

      // D — 저장 + reviewed + 다음 이미지
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        const imageAtKey = currentImageRef.current;
        saveCurrentAnnotations();
        if (imageAtKey) {
          updateReviewStatus(imageAtKey.id, "reviewed");
        }
        const idx = currentImageIndexRef.current;
        const total = totalImagesRef.current;
        if (idx < total - 1) setCurrentImageIndex(idx + 1);
        return;
      }

      // A — 저장 + reviewed + 이전 이미지
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        const imageAtKey = currentImageRef.current;
        saveCurrentAnnotations();
        if (imageAtKey) {
          updateReviewStatus(imageAtKey.id, "reviewed");
        }
        const idx = currentImageIndexRef.current;
        if (idx > 0) setCurrentImageIndex(idx - 1);
        return;
      }

      // Q — 이전 이미지 (저장 없음, 미저장 시 경고)
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        if (isDirtyRef.current) {
          toast.warning("미저장 변경사항이 있습니다", {
            description: "S키로 저장하거나 A/D키로 저장 후 이동하세요.",
            duration: 2000,
          });
        }
        const idx = currentImageIndexRef.current;
        if (idx > 0) setCurrentImageIndex(idx - 1);
        return;
      }

      // E — 다음 이미지 (저장 없음, 미저장 시 경고)
      if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        if (isDirtyRef.current) {
          toast.warning("미저장 변경사항이 있습니다", {
            description: "S키로 저장하거나 A/D키로 저장 후 이동하세요.",
            duration: 2000,
          });
        }
        const idx = currentImageIndexRef.current;
        const total = totalImagesRef.current;
        if (idx < total - 1) setCurrentImageIndex(idx + 1);
        return;
      }

      // W — 제외 토글 (excluded ↔ unreviewed)
      if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        const imageAtKey = currentImageRef.current;
        if (!imageAtKey) return;
        const currentStatus = imageAtKey.review_status ?? "unreviewed";
        const newStatus =
          currentStatus === "excluded" ? "unreviewed" : "excluded";
        updateReviewStatus(imageAtKey.id, newStatus);
        // 로컬 상태 업데이트 (images 배열에서 해당 이미지 review_status 반영)
        setImages((prev) =>
          prev.map((ti) =>
            ti.id === imageAtKey.id ? { ...ti, review_status: newStatus } : ti,
          ),
        );
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    undo,
    redo,
    canUndo,
    canRedo,
    saveCurrentAnnotations,
    toggleAnnotations,
    setSelectedAnnotationId,
    setCurrentImageIndex,
    updateAnnotation,
    addAnnotation,
    taskIdNum,
    updateReviewStatus,
  ]);

  // 페이지 이탈 경고
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const taskDetailPath = `/projects/${projectId}/tasks/${taskIdNum}`;

  function handleBack() {
    navigate(taskDetailPath);
  }

  const handleScaleChange = useCallback(
    (newScale: number) => {
      setScale(newScale);
    },
    [setScale],
  );

  // classification 모드에서 클래스 선택 시 호출
  const handleClassifyImage = useCallback(
    async (classId: number) => {
      if (!currentImage) return;

      // 이미 있는 classification annotation 확인
      const existing = annotations.find(
        (a) => a.annotation_type === "classification",
      );

      if (existing) {
        // 이미 같은 클래스면 아무것도 하지 않음
        if (existing.label_class_id === classId) return;

        // 기존 annotation label_class_id 업데이트
        try {
          await annotationsApi.update(existing.id, { label_class_id: classId });
          updateAnnotation(existing.id, { label_class_id: classId });
        } catch {
          // 에러 무시 — 상태는 변경하지 않음
        }
      } else {
        // 새 classification annotation 생성
        try {
          const res = await annotationsApi.create(currentImage.id, {
            label_class_id: classId,
            annotation_type: "classification",
            data: {},
          });
          addAnnotation(res.data);
        } catch {
          // 에러 무시
        }
      }

      // 선택된 클래스도 업데이트
      setSelectedClassId(classId);
    },
    [
      currentImage,
      annotations,
      updateAnnotation,
      addAnnotation,
      setSelectedClassId,
    ],
  );

  // 폴더 트리: fetchFolderContents (파일 포함)
  const fetchFolderContents = useCallback(
    async (
      path: string,
      skip?: number,
      limit?: number,
    ): Promise<FileContentsResult> => {
      const res = await tasksApi.getFolderContents(
        taskIdNum,
        path,
        skip,
        limit,
      );
      const data = res.data;
      return {
        folders: data.folders.map((f) => ({
          path: f.path,
          name: f.name,
          count: f.image_count,
          subfolder_count: f.subfolder_count,
        })),
        files: data.images.map((ti) => ({
          id: ti.image.id,
          name: ti.image.original_filename,
          path: ti.folder_path
            ? ti.folder_path + "/" + ti.image.original_filename
            : ti.image.original_filename,
        })),
        totalFiles: data.total_images,
      };
    },
    [taskIdNum],
  );

  const fetchAllFolders = useCallback(async () => {
    const res = await tasksApi.getAllFolders(taskIdNum);
    return res.data;
  }, [taskIdNum]);

  // 폴더 클릭 → 해당 폴더의 첫 번째 이미지로 점프
  const handleFolderSelect = useCallback(
    (folderPath: string) => {
      const idx = images.findIndex((ti) => {
        if (folderPath === "") return true;
        return (
          ti.folder_path === folderPath ||
          ti.folder_path.startsWith(folderPath + "/")
        );
      });
      if (idx >= 0) setCurrentImageIndex(idx);
    },
    [images, setCurrentImageIndex],
  );

  // 파일 클릭 → 해당 이미지로 점프
  const handleFileClick = useCallback(
    (_path: string, fileId?: number) => {
      if (fileId == null) return;
      const idx = images.findIndex((ti) => ti.image.id === fileId);
      if (idx >= 0) setCurrentImageIndex(idx);
    },
    [images, setCurrentImageIndex],
  );

  // 현재 이미지의 파일 트리 path (하이라이트용)
  const currentFilePath = currentImage
    ? currentImage.folder_path
      ? currentImage.folder_path + "/" + currentImage.image.original_filename
      : currentImage.image.original_filename
    : undefined;

  // 저장 상태 표시
  function SaveStatus() {
    if (isSaving) {
      return <span className="text-xs text-muted-foreground">저장 중...</span>;
    }
    if (isDirty) {
      return <span className="text-xs text-yellow-500">변경사항 있음</span>;
    }
    return <span className="text-xs text-green-500">저장됨</span>;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <KeyboardShortcutsOverlay
        open={showShortcutsOverlay}
        onOpenChange={setShowShortcutsOverlay}
        taskType={task?.task_type}
      />

      {/* 상단 바 */}
      <header className="flex h-12 shrink-0 items-center border-b bg-background px-4 select-none">
        {/* 좌측: 나가기 버튼 + 네비게이터 */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-sm"
            onClick={handleBack}
            disabled={loading}
            title="태스크로 돌아가기"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="max-w-[140px] truncate">
              {loading ? "로드 중..." : (task?.name ?? "")}
            </span>
          </Button>

          <div className="h-4 w-px bg-border" />

          <ImageNavigator totalImages={totalImages} />
        </div>

        {/* 중앙: 진행 바 + 필터 */}
        <div className="flex flex-1 items-center justify-center gap-3">
          <LabelingProgressBar labeled={labeledCount} total={totalImages} />
          <div className="h-4 w-px bg-border" />
          <LabelingFilter />
        </div>

        {/* 우측: 저장 상태 + 폴더 트리 + 단축키 */}
        <div className="flex items-center gap-1">
          <SaveStatus />
          <div className="mx-1 h-4 w-px bg-border" />
          <Button
            variant={folderTreeOpen ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setFolderTreeOpen((v) => !v)}
            title="폴더 트리"
          >
            <FolderTree className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowShortcutsOverlay((v) => !v)}
            title="키보드 단축키 (?)"
          >
            <Keyboard className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 패널 */}
        <aside className="flex w-60 shrink-0 flex-col border-r bg-background select-none">
          {/* 라벨 클래스 목록 */}
          <div className="max-h-[40%] overflow-y-auto border-b p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              라벨 클래스
            </p>
            <ClassPanel
              classes={classes}
              annotations={annotations}
              loading={loading}
              onClassifyImage={
                tool === "classification" ? handleClassifyImage : undefined
              }
            />
          </div>

          {/* 인스턴스 리스트 */}
          <div className="flex-1 overflow-y-auto border-b py-2">
            <p className="mb-1 px-3 text-xs font-medium text-muted-foreground">
              인스턴스
            </p>
            <AnnotationList annotations={annotations} labelClasses={classes} />
          </div>

          {/* 속성 / 정보 패널 */}
          <div className="shrink-0 overflow-y-auto border-t max-h-[35%]">
            <InspectorPanel
              selectedAnnotationId={selectedAnnotationId}
              annotations={annotations}
              labelClasses={classes}
              currentImage={currentImage}
              taskType={task?.task_type}
              imageSize={
                currentImage?.image.width != null &&
                currentImage?.image.height != null
                  ? {
                      width: currentImage.image.width,
                      height: currentImage.image.height,
                    }
                  : undefined
              }
            />
          </div>
        </aside>

        {/* 중앙 캔버스 영역 */}
        <main className="relative flex-1 overflow-hidden bg-neutral-800">
          {!loading && totalImages === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-neutral-400">
                <p className="text-sm">이미지가 없습니다</p>
                <p className="text-xs">태스크에 이미지를 추가하세요</p>
              </div>
            </div>
          ) : (
            <>
              <LabelingCanvas
                imageUrl={imageUrl}
                annotations={annotations}
                labelClasses={classes}
                selectedAnnotationId={selectedAnnotationId}
                onSelectAnnotation={setSelectedAnnotationId}
                onScaleChange={handleScaleChange}
              />
              <FloatingToolbar taskType={task?.task_type ?? null} />
            </>
          )}
        </main>

        {/* 우측 폴더 트리 패널 */}
        {folderTreeOpen && (
          <aside className="flex w-56 shrink-0 flex-col border-l bg-background select-none overflow-hidden">
            <FileTreeView
              fetchFolderContents={fetchFolderContents}
              fetchAllFolders={fetchAllFolders}
              rootLabel="전체"
              rootCount={totalImages}
              selectedPath={currentFilePath ?? currentFolderPath ?? ""}
              syncSelectedPath
              readOnly
              onSelectPath={handleFolderSelect}
              onFileClick={handleFileClick}
            />
          </aside>
        )}
      </div>
    </div>
  );
}
