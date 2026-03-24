import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Keyboard, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { tasksApi } from "@/api/tasks";
import { labelClassesApi } from "@/api/label-classes";
import { annotationsApi } from "@/api/annotations";
import { snapshotsApi } from "@/api/snapshots";
import type { Task } from "@/types/task";
import type { LabelClass } from "@/types/label-class";
import type { ImageMeta } from "@/types/image";
import { useLabelingStore } from "@/stores/labeling-store";
import {
  LabelingCanvas,
  ImageNavigator,
  ClassPanel,
  ToolPanel,
  FilmStrip,
  LabelingProgressBar,
  LabelingFilter,
  KeyboardShortcutsOverlay,
} from "@/components/labeling";

const TOKEN_KEY = "auth_token";

export default function LabelingPage() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  const navigate = useNavigate();
  const projectId = Number(id);
  const taskIdNum = Number(taskId);

  const [task, setTask] = useState<Task | null>(null);
  const [classes, setClasses] = useState<LabelClass[]>([]);
  const [images, setImages] = useState<ImageMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showShortcutsOverlay, setShowShortcutsOverlay] = useState(false);
  const [dirtyDialogOpen, setDirtyDialogOpen] = useState(false);
  const [checkingDirty, setCheckingDirty] = useState(false);

  const {
    tool,
    setSelectedClassId,
    selectedAnnotationId,
    setSelectedAnnotationId,
    currentImageIndex,
    scale,
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
    filter,
    labeledImageIds,
    setLabeledImageId,
    toggleAnnotations,
    selectedClassId,
    setCurrentImageIndex,
  } = useLabelingStore();

  // 현재 이미지 ref (saveCurrentAnnotations 클로저용)
  const currentImageRef = useRef<ImageMeta | null>(null);
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
      const rawImages = imagesRes as { image: ImageMeta }[];
      setImages(rawImages.map((si) => si.image));
    } catch {
      // 에러 처리 -- 빈 상태 유지
    } finally {
      setLoading(false);
    }
  }

  const totalImages = images.length;
  const currentImage = images[currentImageIndex] ?? null;

  // 필터에 따른 이미지 인덱스 배열
  const filteredIndices = useMemo(() => {
    if (filter === "all") return images.map((_, i) => i);
    return images
      .map((img, i) => ({ img, i }))
      .filter(({ img }) =>
        filter === "labeled"
          ? labeledImageIds.has(img.id)
          : !labeledImageIds.has(img.id),
      )
      .map(({ i }) => i);
  }, [filter, images, labeledImageIds]);

  // 라벨링된 이미지 수
  const labeledCount = labeledImageIds.size;

  useEffect(() => {
    currentImageRef.current = currentImage;
  }, [currentImage]);

  // 현재 이미지의 파일 URL 구성
  const imageUrl = currentImage
    ? `/api/v1/images/${currentImage.id}/file?token=${localStorage.getItem(TOKEN_KEY) ?? ""}`
    : null;

  // 저장 함수 (ref 값 사용해 최신 상태 읽음)
  const saveCurrentAnnotations = useCallback(
    async (targetImageId?: number) => {
      const imageId = targetImageId ?? currentImageRef.current?.id;
      if (!imageId) return;
      if (!isDirtyRef.current) return;

      setIsSaving(true);
      try {
        const taskImageAnnotations = annotationsRef.current.map((a) => ({
          label_class_id: a.label_class_id,
          annotation_type: a.annotation_type,
          data: a.data,
        }));
        await annotationsApi.bulkSave(taskIdNum, imageId, taskImageAnnotations);
        setIsDirty(false);
      } catch {
        // 저장 실패 시 에러 표시 — 이미지 전환은 계속 진행
        console.error("저장 실패: 변경사항이 로컬에 보존됩니다");
      } finally {
        setIsSaving(false);
      }
    },
    [taskIdNum, setIsDirty],
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
        const res = await annotationsApi.list(taskIdNum, currentImage!.id);
        if (!cancelled) {
          setAnnotations(res.data);
          setSelectedAnnotationId(null);
          // 라벨링 상태 갱신
          setLabeledImageId(currentImage!.id, res.data.length > 0);
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
  }, [currentImage?.id, taskIdNum, setAnnotations]); // eslint-disable-line react-hooks/exhaustive-deps

  // 어노테이션 변경 시 현재 이미지의 라벨링 상태 실시간 반영
  useEffect(() => {
    if (!currentImage) return;
    setLabeledImageId(currentImage.id, annotations.length > 0);
  }, [annotations.length, currentImage?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
            .create(taskIdNum, imageAtKey.id, {
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

      // D — 현재 이미지 완료 표시 + 다음 이미지
      if (e.key === "d" || e.key === "D") {
        e.preventDefault();
        saveCurrentAnnotations();
        const idx = currentImageIndexRef.current;
        const total = totalImagesRef.current;
        if (idx < total - 1) setCurrentImageIndex(idx + 1);
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

  async function handleBack() {
    if (checkingDirty) return;
    setCheckingDirty(true);
    try {
      const res = await snapshotsApi.getVersionStatus(taskIdNum);
      if (res.data.is_dirty) {
        setDirtyDialogOpen(true);
      } else {
        navigate(taskDetailPath);
      }
    } catch {
      // API 실패 시 그냥 이동
      navigate(taskDetailPath);
    } finally {
      setCheckingDirty(false);
    }
  }

  function handleLeaveAnyway() {
    setDirtyDialogOpen(false);
    navigate(taskDetailPath);
  }

  function handleCommitAndLeave() {
    setDirtyDialogOpen(false);
    navigate(`${taskDetailPath}?tab=versions`);
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
          const res = await annotationsApi.create(taskIdNum, currentImage.id, {
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
      taskIdNum,
      updateAnnotation,
      addAnnotation,
      setSelectedClassId,
    ],
  );

  const taskType = task?.task_type ?? null;

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
      />

      {/* dirty 프롬프트 */}
      <AlertDialog open={dirtyDialogOpen} onOpenChange={setDirtyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              확정되지 않은 변경사항이 있습니다
            </AlertDialogTitle>
            <AlertDialogDescription>
              라벨링 데이터는 저장되었지만, 아직 버전으로 확정되지 않았습니다.
              버전을 확정한 후 나가거나, 그냥 나갈 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDirtyDialogOpen(false)}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction variant="outline" onClick={handleLeaveAnyway}>
              그냥 나가기
            </AlertDialogAction>
            <AlertDialogAction onClick={handleCommitAndLeave}>
              버전 확정 후 나가기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 상단 바 */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4 select-none">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleBack}
          disabled={checkingDirty}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <span className="text-sm font-semibold">
          {loading ? "로드 중..." : (task?.name ?? "라벨링")}
        </span>

        <div className="mx-2 h-4 w-px bg-border" />

        {/* 이미지 네비게이션 */}
        <ImageNavigator totalImages={totalImages} />

        <div className="mx-2 h-4 w-px bg-border" />

        {/* 진행 바 */}
        <LabelingProgressBar labeled={labeledCount} total={totalImages} />

        <div className="mx-2 h-4 w-px bg-border" />

        {/* 필터 */}
        <LabelingFilter />

        <div className="mx-2 h-4 w-px bg-border" />

        {/* 줌 표시 */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <ZoomIn className="h-3.5 w-3.5" />
          <span className="tabular-nums">{Math.round(scale * 100)}%</span>
        </div>

        <div className="flex-1" />

        {/* 저장 상태 */}
        <SaveStatus />

        {/* 단축키 도움말 버튼 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setShowShortcutsOverlay((v) => !v)}
          title="키보드 단축키 (?)"
        >
          <Keyboard className="h-4 w-4" />
        </Button>
      </header>

      {/* 본문 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 패널 */}
        <aside className="flex w-64 shrink-0 flex-col border-r bg-background select-none">
          {/* 도구 선택 */}
          <div className="border-b p-3">
            <p className="mb-2 text-xs font-medium text-muted-foreground">
              도구
            </p>
            <ToolPanel taskType={taskType} />
          </div>

          {/* 라벨 클래스 목록 */}
          <div className="flex-1 overflow-y-auto p-3">
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
        </aside>

        {/* 우측: 캔버스 + 필름스트립 */}
        <div className="flex flex-1 flex-col overflow-hidden">
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
              <LabelingCanvas
                imageUrl={imageUrl}
                annotations={annotations}
                labelClasses={classes}
                selectedAnnotationId={selectedAnnotationId}
                onSelectAnnotation={setSelectedAnnotationId}
                onScaleChange={handleScaleChange}
              />
            )}
          </main>

          {/* 하단 필름스트립 */}
          {totalImages > 0 && (
            <FilmStrip images={images} filteredIndices={filteredIndices} />
          )}
        </div>
      </div>
    </div>
  );
}
