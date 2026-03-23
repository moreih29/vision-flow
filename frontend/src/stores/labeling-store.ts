import { create } from "zustand";
import type { Annotation } from "@/types/annotation";

type LabelingTool = "select" | "classification" | "bbox";
export type LabelingFilter = "all" | "unlabeled" | "labeled";

const MAX_UNDO_STACK = 50;

interface LabelingState {
  // 이미지 네비게이션
  currentImageIndex: number;

  // 도구
  tool: LabelingTool;
  selectedClassId: number | null;

  // 어노테이션 (현재 이미지)
  annotations: Annotation[];
  isDirty: boolean;

  // 선택
  selectedAnnotationId: number | null;

  // 줌
  scale: number;

  // Undo/Redo
  past: Annotation[][];
  future: Annotation[][];

  // 필터
  filter: LabelingFilter;
  // 라벨링된 이미지 ID 집합 (이미지 인덱스 기준)
  labeledImageIds: Set<number>;

  // 어노테이션 표시/숨기기
  showAnnotations: boolean;

  // Actions
  setCurrentImageIndex: (index: number) => void;
  setTool: (tool: LabelingTool) => void;
  setSelectedClassId: (id: number | null) => void;
  setSelectedAnnotationId: (id: number | null) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: number, data: Partial<Annotation>) => void;
  removeAnnotation: (id: number) => void;
  setIsDirty: (dirty: boolean) => void;
  setScale: (scale: number) => void;
  reset: () => void;
  setFilter: (filter: LabelingFilter) => void;
  setLabeledImageId: (imageId: number, labeled: boolean) => void;
  toggleAnnotations: () => void;

  // Undo/Redo Actions
  pushUndo: () => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

const initialState = {
  currentImageIndex: 0,
  tool: "select" as LabelingTool,
  selectedClassId: null,
  annotations: [],
  isDirty: false,
  selectedAnnotationId: null,
  scale: 1,
  past: [] as Annotation[][],
  future: [] as Annotation[][],
  filter: "all" as LabelingFilter,
  labeledImageIds: new Set<number>(),
  showAnnotations: true,
};

export const useLabelingStore = create<LabelingState>((set, get) => ({
  ...initialState,

  setCurrentImageIndex: (index) => set({ currentImageIndex: index }),
  setTool: (tool) => set({ tool }),
  setSelectedClassId: (id) => set({ selectedClassId: id }),
  setSelectedAnnotationId: (id) => set({ selectedAnnotationId: id }),
  setAnnotations: (annotations) =>
    set({
      annotations,
      isDirty: false,
      selectedAnnotationId: null,
      past: [],
      future: [],
    }),
  addAnnotation: (annotation) =>
    set((state) => {
      const past = [...state.past, state.annotations].slice(-MAX_UNDO_STACK);
      return {
        annotations: [...state.annotations, annotation],
        isDirty: true,
        past,
        future: [],
      };
    }),
  updateAnnotation: (id, data) =>
    set((state) => {
      const past = [...state.past, state.annotations].slice(-MAX_UNDO_STACK);
      return {
        annotations: state.annotations.map((a) =>
          a.id === id ? { ...a, ...data } : a,
        ),
        isDirty: true,
        past,
        future: [],
      };
    }),
  removeAnnotation: (id) =>
    set((state) => {
      const past = [...state.past, state.annotations].slice(-MAX_UNDO_STACK);
      return {
        annotations: state.annotations.filter((a) => a.id !== id),
        isDirty: true,
        past,
        future: [],
      };
    }),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  setScale: (scale) => set({ scale }),
  reset: () => set({ ...initialState, labeledImageIds: new Set<number>() }),
  setFilter: (filter) => set({ filter }),
  toggleAnnotations: () =>
    set((state) => ({ showAnnotations: !state.showAnnotations })),
  setLabeledImageId: (imageId, labeled) =>
    set((state) => {
      const next = new Set(state.labeledImageIds);
      if (labeled) {
        next.add(imageId);
      } else {
        next.delete(imageId);
      }
      return { labeledImageIds: next };
    }),

  pushUndo: () =>
    set((state) => ({
      past: [...state.past, state.annotations].slice(-MAX_UNDO_STACK),
      future: [],
    })),

  undo: () =>
    set((state) => {
      if (state.past.length === 0) return {};
      const previous = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      return {
        past: newPast,
        annotations: previous,
        future: [state.annotations, ...state.future].slice(0, MAX_UNDO_STACK),
        isDirty: true,
      };
    }),

  redo: () =>
    set((state) => {
      if (state.future.length === 0) return {};
      const next = state.future[0];
      const newFuture = state.future.slice(1);
      return {
        future: newFuture,
        annotations: next,
        past: [...state.past, state.annotations].slice(-MAX_UNDO_STACK),
        isDirty: true,
      };
    }),

  clearHistory: () => set({ past: [], future: [] }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
