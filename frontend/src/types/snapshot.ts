import type { ImageMeta } from "@/types/image";

export interface Snapshot {
  id: number;
  task_id: number;
  major_version: number;
  data_version: number;
  label_version: number;
  is_stash: boolean;
  name: string;
  description: string | null;
  image_count: number;
  labeled_image_count: number;
  annotation_count: number;
  class_schema_hash: string | null;
  image_set_hash: string | null;
  annotation_hash: string | null;
  label_classes_snapshot: Record<string, unknown>[];
  created_at: string;
}

export interface SnapshotCreate {
  name: string;
  description?: string;
}

export interface AnnotationData {
  label_class_id: number | null;
  label_class_name: string;
  annotation_type: string;
  data: Record<string, unknown>;
}

export interface SnapshotItem {
  id: number;
  image_id: number;
  folder_path: string;
  annotation_data: AnnotationData[];
  image: ImageMeta;
}

export interface SnapshotItemListResponse {
  items: SnapshotItem[];
  total: number;
  skip: number;
  limit: number;
}

export interface SnapshotDiff {
  added_images: number[];
  removed_images: number[];
  added_count: number;
  removed_count: number;
  annotation_changes: Record<string, { before: number; after: number }>;
  class_compatible: boolean;
}

export interface VersionChanges {
  class_changed: boolean;
  data_changed: boolean;
  label_changed: boolean;
}

export interface VersionStatus {
  current_version: string | null;
  is_dirty: boolean;
  changes: Partial<VersionChanges>;
}

export interface SnapshotRestoreDryRun {
  dry_run: true;
  snapshot_id: number;
  version: number;
  image_count: number;
  annotation_count: number;
  message: string;
}
