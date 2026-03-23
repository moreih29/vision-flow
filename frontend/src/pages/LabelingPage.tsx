import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ZoomIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { tasksApi } from "@/api/tasks";
import { labelClassesApi } from "@/api/label-classes";
import { annotationsApi } from "@/api/annotations";
import type { Task } from "@/types/task";
import type { LabelClass } from "@/types/label-class";
import type { ImageMeta } from "@/types/image";
import { useLabelingStore } from "@/stores/labeling-store";
import {
  LabelingCanvas,
  ImageNavigator,
  ClassPanel,
  ToolPanel,
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

  // ImageNavigator의 이미지 전환을 가로채기 위한 래퍼
  // ImageNavigator는 store의 setCurrentImageIndex를 직접 호출하므로,
  // 이미지 전환 전 저장을 위해 별도 핸들러를 사용할 수 없음.
  // 대신 currentImageIndex 변경을 감지하되, 저장은 navigateImage로 처리.
  // 여기서는 beforeunload와 Ctrl+S 저장만 처리.

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
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, canUndo, canRedo, saveCurrentAnnotations]);

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
      {/* 상단 바 */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4 select-none">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(`/projects/${projectId}/tasks/${taskIdNum}`)}
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

        {/* 줌 표시 */}
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <ZoomIn className="h-3.5 w-3.5" />
          <span className="tabular-nums">{Math.round(scale * 100)}%</span>
        </div>

        <div className="flex-1" />

        {/* 저장 상태 */}
        <SaveStatus />
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
      </div>
    </div>
  );
}
