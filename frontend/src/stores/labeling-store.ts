import { create } from 'zustand'
import type { Annotation } from '@/types/annotation'

type LabelingTool = 'select' | 'classification' | 'bbox'

interface LabelingState {
  // 이미지 네비게이션
  currentImageIndex: number

  // 도구
  tool: LabelingTool
  selectedClassId: number | null

  // 어노테이션 (현재 이미지)
  annotations: Annotation[]
  isDirty: boolean

  // 줌
  scale: number

  // Actions
  setCurrentImageIndex: (index: number) => void
  setTool: (tool: LabelingTool) => void
  setSelectedClassId: (id: number | null) => void
  setAnnotations: (annotations: Annotation[]) => void
  addAnnotation: (annotation: Annotation) => void
  updateAnnotation: (id: number, data: Partial<Annotation>) => void
  removeAnnotation: (id: number) => void
  setIsDirty: (dirty: boolean) => void
  setScale: (scale: number) => void
  reset: () => void
}

const initialState = {
  currentImageIndex: 0,
  tool: 'select' as LabelingTool,
  selectedClassId: null,
  annotations: [],
  isDirty: false,
  scale: 1,
}

export const useLabelingStore = create<LabelingState>((set) => ({
  ...initialState,

  setCurrentImageIndex: (index) => set({ currentImageIndex: index }),
  setTool: (tool) => set({ tool }),
  setSelectedClassId: (id) => set({ selectedClassId: id }),
  setAnnotations: (annotations) => set({ annotations, isDirty: false }),
  addAnnotation: (annotation) =>
    set((state) => ({
      annotations: [...state.annotations, annotation],
      isDirty: true,
    })),
  updateAnnotation: (id, data) =>
    set((state) => ({
      annotations: state.annotations.map((a) =>
        a.id === id ? { ...a, ...data } : a,
      ),
      isDirty: true,
    })),
  removeAnnotation: (id) =>
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
      isDirty: true,
    })),
  setIsDirty: (dirty) => set({ isDirty: dirty }),
  setScale: (scale) => set({ scale }),
  reset: () => set(initialState),
}))
